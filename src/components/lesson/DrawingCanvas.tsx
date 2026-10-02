"use client";

import { Eraser, Highlighter, Pencil, Trash2, Undo2 } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from "react";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import {
  DEFAULT_SIZE_INDEX,
  MARKER_ALPHA,
  MAX_STROKES,
  PALETTE,
  PEN_COLORS,
  TOOL_SIZES,
  defaultColor,
  exportScale,
  hasInk,
  makeStroke,
  sanitizeStrokes,
  strokesBounds,
  type Box,
  type ColorId,
  type Point,
  type Stroke,
  type ToolId,
} from "@/lib/strokes";

export type { Stroke } from "@/lib/strokes";

export interface DrawingHandle {
  isEmpty: () => boolean;
  /** Рисунок в настоящих цветах на белом фоне (без сетки) — для отправки ИИ. null — холст пока недоступен. */
  exportCanvas: () => HTMLCanvasElement | null;
  /**
   * Рисунок на прозрачном фоне (PNG dataURL, цвета как на светлой теме) — для сохранения и восстановления через `initialImage`.
   * "" — рисунок пуст; null — холст пока недоступен (нулевой размер), сохранять нечего.
   */
  exportImage: () => string | null;
  /**
   * Для конспектов: PNG dataURL в настоящих цветах на белом фоне, обрезанный по содержимому с полями 16 px,
   * шириной не больше 1600 px. null — рисовать нечего.
   */
  exportPaper: () => string | null;
}

interface BaseImage {
  img: HTMLImageElement;
  /** Копия, перекрашенная в нужный цвет чернил. */
  tinted: HTMLCanvasElement | null;
  tint: string;
}

/**
 * Масштаб сохранённого PNG: 2 пикселя на CSS-пиксель, всегда — независимо от devicePixelRatio и ширины панели.
 * Поэтому рисунок не растёт/не сжимается при смене экрана и не обрезается при пересохранении.
 */
const EXPORT_SCALE = 2;
/** Защита от испорченных данных: слишком большую картинку не восстанавливаем (память холста, особенно на iOS). */
const MAX_IMAGE_PX = 4096;
const PAPER_MARGIN = 16;
const PAPER_MAX_WIDTH = 1600;
const PAPER_MAX_SIDE = 8192;

type Palette = Record<ColorId, string>;

/** Освобождает память временного холста (iOS держит их до сборки мусора и быстро упирается в лимит). */
function freeCanvas(c: HTMLCanvasElement | null) {
  if (!c) return;
  c.width = 0;
  c.height = 0;
}

function tintImage(img: HTMLImageElement, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Тёмная ли сейчас тема: ручной выбор (data-theme) или системная настройка. */
function readDark(): boolean {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function subscribeTheme(cb: () => void): () => void {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => {
    mo.disconnect();
    mq.removeEventListener("change", cb);
  };
}

/** Путь штриха: сглаженная ломаная (квадратичные кривые через середины отрезков). */
function tracePath(ctx: CanvasRenderingContext2D, pts: readonly Point[]) {
  ctx.beginPath();
  if (!pts.length) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 1) {
    ctx.lineTo(pts[0][0] + 0.1, pts[0][1] + 0.1);
    return;
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
}

/**
 * Рисует один штрих. `multiply` — «живой» маркер поверх уже нарисованного в светлой теме (после завершения
 * штриха слои пересобираются и маркер оказывается под чернилами).
 */
function applyStroke(ctx: CanvasRenderingContext2D, s: Stroke, pal: Palette, markerAlpha: number, multiply: boolean) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = s.size;
  if (s.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "#000";
  } else {
    ctx.strokeStyle = pal[s.color];
    if (s.tool === "marker") {
      ctx.globalAlpha = markerAlpha;
      if (multiply) ctx.globalCompositeOperation = "multiply";
    }
  }
  tracePath(ctx, s.points);
  ctx.stroke();
  ctx.restore();
}

interface LayerOpts {
  pxW: number;
  pxH: number;
  /** Пикселей на CSS-пиксель. */
  scale: number;
  /** Левый верхний угол видимой области в CSS-пикселях. */
  ox: number;
  oy: number;
  pal: Palette;
  markerAlpha: number;
  /** Подложка (старый PNG), уже окрашенная; рисуется в логическом размере. */
  base: HTMLCanvasElement | null;
}

/**
 * Собирает рисунок в `target` (поверх того, что там уже есть): сначала слой маркера, над ним слой чернил
 * (подложка + ручка). Ластик действует на оба слоя в порядке штрихов, поэтому маркер всегда под чернилами.
 */
function renderLayers(target: CanvasRenderingContext2D, strokes: readonly Stroke[], o: LayerOpts) {
  const makeLayer = () => {
    const c = document.createElement("canvas");
    c.width = Math.max(1, o.pxW);
    c.height = Math.max(1, o.pxH);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(o.scale, 0, 0, o.scale, -o.ox * o.scale, -o.oy * o.scale);
    return { c, ctx };
  };
  const hasMarker = strokes.some((s) => s.tool === "marker");
  if (hasMarker) {
    const { c, ctx } = makeLayer();
    for (const s of strokes) if (s.tool !== "pen") applyStroke(ctx, s, o.pal, o.markerAlpha, false);
    target.save();
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.drawImage(c, 0, 0);
    target.restore();
    freeCanvas(c);
  }
  const { c, ctx } = makeLayer();
  if (o.base) ctx.drawImage(o.base, 0, 0, o.base.width / EXPORT_SCALE, o.base.height / EXPORT_SCALE);
  for (const s of strokes) if (s.tool !== "marker") applyStroke(ctx, s, o.pal, o.markerAlpha, false);
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.drawImage(c, 0, 0);
  target.restore();
  freeCanvas(c);
}

const unionBox = (a: Box | null, b: Box): Box => {
  if (!a) return b;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

interface DrawingCanvasProps {
  /** Рисунок изменился (штрих закончен, отмена, очистка): empty — рисовать нечего. */
  onChange?: (empty: boolean) => void;
  disabled?: boolean;
  /** Сохранённый рисунок-подложка (старый PNG) — читается один раз при монтировании; рисуется под новыми штрихами. */
  initialImage?: string;
  /** Сохранённые штрихи — читаются один раз при монтировании. */
  initialStrokes?: Stroke[];
  /** Список штрихов после каждого изменения (для сохранения вектором). */
  onStrokes?: (strokes: Stroke[]) => void;
  /** Фиксированная высота холста в px (по умолчанию зависит от ширины). */
  height?: number;
  /** Холст занимает всё свободное место родителя (родитель — flex-контейнер с заданной высотой). */
  fill?: boolean;
  className?: string;
}

interface ToolPrefs {
  tool: ToolId;
  penColor: ColorId;
  sizeIdx: Record<ToolId, number>;
}

/**
 * Последний выбор инструмента, цвета и размеров. Холст пересоздаётся при смене листа и входе в полный экран —
 * выбор не должен сбрасываться. Ластик не восстанавливаем: новый холст с ластиком выглядит «сломанным».
 */
let lastPrefs: ToolPrefs = { tool: "pen", penColor: "ink", sizeIdx: { ...DEFAULT_SIZE_INDEX } };

const COLOR_KEYS: Record<ColorId, DictKey> = {
  ink: "canvas.color.ink",
  blue: "canvas.color.blue",
  red: "canvas.color.red",
  green: "canvas.color.green",
  orange: "canvas.color.orange",
  yellow: "canvas.color.yellow",
};

/** Диаметр точки на кнопке размера: растёт с толщиной, но влезает в кнопку. */
function dotPx(tool: ToolId, size: number): number {
  const k = tool === "eraser" ? 0.3 : tool === "marker" ? 0.55 : 1;
  return Math.round(Math.min(22, size * k + 3));
}

/** Холст «в клеточку» для решения задач пальцем/стилусом/мышью: ручка, маркер, ластик, цвета и размеры. */
export const DrawingCanvas = forwardRef<DrawingHandle, DrawingCanvasProps>(function DrawingCanvas(
  { onChange, disabled, initialImage, initialStrokes, onStrokes, height: fixedHeight, fill, className },
  ref,
) {
  const { t } = useT();
  const dark = useSyncExternalStore(subscribeTheme, readDark, () => false);
  const pal = PALETTE[dark ? "dark" : "light"];
  const markerAlpha = MARKER_ALPHA[dark ? "dark" : "light"];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  /** Завершённые штрихи. */
  const strokes = useRef<Stroke[]>([]);
  /** Штрих, который рисуется сейчас (точки «сырые», упрощаются при отпускании). */
  const current = useRef<Stroke | null>(null);
  /** Кэш завершённых штрихов (в пикселях экрана): при движении перерисовывается только текущий штрих. */
  const cache = useRef<HTMLCanvasElement | null>(null);
  const base = useRef<BaseImage | null>(null);
  /** Размер холста в CSS-пикселях и devicePixelRatio, с которым он создан. */
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const initialRef = useRef(initialImage);

  const [initial] = useState(() => sanitizeStrokes(initialStrokes ?? []));
  const [count, setCount] = useState(initial.length);
  const [hasBase, setHasBase] = useState(false);
  const [tool, setToolState] = useState<ToolId>(() => (lastPrefs.tool === "eraser" ? "pen" : lastPrefs.tool));
  const [penColor, setPenColorState] = useState<ColorId>(() => lastPrefs.penColor);
  const [sizeIdx, setSizeIdxState] = useState<Record<ToolId, number>>(() => ({ ...lastPrefs.sizeIdx }));
  /** Палец/стилус, которым рисуется текущий штрих (второе касание не должно дописывать в него точки). */
  const pointerId = useRef<number | null>(null);

  const setTool = (v: ToolId) => {
    lastPrefs = { ...lastPrefs, tool: v };
    setToolState(v);
  };
  const setPenColor = (v: ColorId) => {
    lastPrefs = { ...lastPrefs, penColor: v };
    setPenColorState(v);
  };
  const setSize = (v: ToolId, i: number) => {
    const next = { ...sizeIdx, [v]: i };
    lastPrefs = { ...lastPrefs, sizeIdx: next };
    setSizeIdxState(next);
  };

  const sizes = TOOL_SIZES[tool];
  const curSize = sizes[Math.min(sizeIdx[tool], sizes.length - 1)];
  const curColor: ColorId = tool === "pen" ? penColor : defaultColor(tool);

  /** Подложка, окрашенная в чернила текущей темы. */
  const tintedBase = useCallback((color: string): HTMLCanvasElement | null => {
    const b = base.current;
    if (!b) return null;
    if (!b.tinted || b.tint !== color) {
      freeCanvas(b.tinted);
      b.tinted = tintImage(b.img, color);
      b.tint = color;
    }
    return b.tinted;
  }, []);

  /** Выводит кэш + текущий штрих на экран. */
  const paint = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !c.width) return;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (cache.current && cache.current.width) ctx.drawImage(cache.current, 0, 0);
    const cur = current.current;
    if (cur) {
      ctx.setTransform(size.current.dpr, 0, 0, size.current.dpr, 0, 0);
      applyStroke(ctx, cur, pal, markerAlpha, !dark);
    }
  }, [pal, markerAlpha, dark]);

  /** Пересобирает кэш из подложки и всех штрихов (смена размера/темы, отмена, маркер). */
  const rebuild = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !c.width) return;
    let layer = cache.current;
    if (!layer) {
      layer = document.createElement("canvas");
      cache.current = layer;
    }
    if (layer.width !== c.width || layer.height !== c.height) {
      layer.width = c.width;
      layer.height = c.height;
    }
    const ctx = layer.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, layer.width, layer.height);
    renderLayers(ctx, strokes.current, {
      pxW: layer.width,
      pxH: layer.height,
      scale: size.current.dpr,
      ox: 0,
      oy: 0,
      pal,
      markerAlpha,
      base: tintedBase(pal.ink),
    });
    paint();
  }, [pal, markerAlpha, tintedBase, paint]);

  // Штрихи, переданные при монтировании (объявлен раньше остальных эффектов — выполняется первым).
  useEffect(() => {
    strokes.current = initial.slice();
  }, [initial]);

  // Восстановление старого рисунка-подложки (один раз).
  useEffect(() => {
    const src = initialRef.current;
    if (!src) return;
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth > MAX_IMAGE_PX || img.naturalHeight > MAX_IMAGE_PX) return;
      base.current = { img, tinted: null, tint: "" };
      setHasBase(true);
      rebuild();
    };
    img.src = src;
    return () => {
      alive = false;
    };
  }, [rebuild]);

  // Смена темы: цвета берутся из палитры темы, поэтому пересобираем (и перекрашиваем подложку).
  useEffect(() => {
    rebuild();
  }, [rebuild]);

  // Освобождаем временные холсты при размонтировании.
  useEffect(
    () => () => {
      const b = base.current;
      if (b) {
        // Обнуляем ссылку: освобождённый (0×0) холст нельзя рисовать — drawImage бросит исключение.
        freeCanvas(b.tinted);
        b.tinted = null;
        b.tint = "";
      }
      freeCanvas(cache.current);
      cache.current = null;
    },
    [],
  );

  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      const w = wrapRef.current;
      if (!c || !w) return;
      const dpr = window.devicePixelRatio || 1;
      const width = w.clientWidth;
      const height = fill ? w.clientHeight : (fixedHeight ?? Math.max(260, Math.min(420, Math.round(width * 0.75))));
      size.current = { w: width, h: height, dpr };
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      rebuild();
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [rebuild, fixedHeight, fill]);

  const isEmpty = () => !hasInk(strokes.current) && !base.current;

  const changed = () => {
    setCount(strokes.current.length);
    onChange?.(isEmpty());
    onStrokes?.(strokes.current.slice());
  };

  useImperativeHandle(ref, () => ({
    isEmpty,
    exportCanvas: () => {
      const c = canvasRef.current;
      if (!c || c.width === 0 || c.height === 0) return null;
      const out = document.createElement("canvas");
      out.width = c.width;
      out.height = c.height;
      const ctx = out.getContext("2d")!;
      // Рисуем на прозрачном слое (чтобы ластик работал), поверх белого фона; цвета — как на бумаге.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      const paper = base.current ? tintImage(base.current.img, PALETTE.light.ink) : null;
      renderLayers(ctx, strokes.current, {
        pxW: out.width,
        pxH: out.height,
        scale: size.current.dpr,
        ox: 0,
        oy: 0,
        pal: PALETTE.light,
        markerAlpha: MARKER_ALPHA.light,
        base: paper,
      });
      freeCanvas(paper);
      return out;
    },
    exportImage: () => {
      const c = canvasRef.current;
      if (!c || c.width === 0 || c.height === 0) return null;
      if (isEmpty()) return "";
      // Слой не меньше сохранённой подложки: то, что вышло за текущую ширину панели, не обрезаем.
      const img = base.current?.img;
      const w = Math.max(size.current.w, img ? img.naturalWidth / EXPORT_SCALE : 0);
      const h = Math.max(size.current.h, img ? img.naturalHeight / EXPORT_SCALE : 0);
      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.ceil(w * EXPORT_SCALE));
      out.height = Math.max(1, Math.ceil(h * EXPORT_SCALE));
      const paper = img ? tintImage(img, PALETTE.light.ink) : null;
      renderLayers(out.getContext("2d")!, strokes.current, {
        pxW: out.width,
        pxH: out.height,
        scale: EXPORT_SCALE,
        ox: 0,
        oy: 0,
        pal: PALETTE.light,
        markerAlpha: MARKER_ALPHA.light,
        base: paper,
      });
      freeCanvas(paper);
      try {
        return out.toDataURL("image/png");
      } finally {
        freeCanvas(out);
      }
    },
    exportPaper: () => {
      let box = strokesBounds(strokes.current, 0);
      const img = base.current?.img;
      if (img) box = unionBox(box, { x: 0, y: 0, w: img.naturalWidth / EXPORT_SCALE, h: img.naturalHeight / EXPORT_SCALE });
      if (!box) return null;
      box = { x: box.x - PAPER_MARGIN, y: box.y - PAPER_MARGIN, w: box.w + 2 * PAPER_MARGIN, h: box.h + 2 * PAPER_MARGIN };
      const scale = Math.min(exportScale(box.w, EXPORT_SCALE, PAPER_MAX_WIDTH), PAPER_MAX_SIDE / box.h);
      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.ceil(box.w * scale));
      out.height = Math.max(1, Math.ceil(box.h * scale));
      const ctx = out.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      const paper = img ? tintImage(img, PALETTE.light.ink) : null;
      renderLayers(ctx, strokes.current, {
        pxW: out.width,
        pxH: out.height,
        scale,
        ox: box.x,
        oy: box.y,
        pal: PALETTE.light,
        markerAlpha: MARKER_ALPHA.light,
        base: paper,
      });
      freeCanvas(paper);
      try {
        return out.toDataURL("image/png");
      } finally {
        freeCanvas(out);
      }
    },
  }));

  const pos = (e: React.PointerEvent): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const onDown = (e: React.PointerEvent) => {
    if (disabled || current.current || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerId.current = e.pointerId;
    current.current = { tool, color: curColor, size: curSize, points: [pos(e)] };
    paint();
  };
  const onMove = (e: React.PointerEvent) => {
    const cur = current.current;
    if (!cur || e.pointerId !== pointerId.current) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const r = canvasRef.current!.getBoundingClientRect();
    for (const ev of events) cur.points.push([ev.clientX - r.left, ev.clientY - r.top]);
    paint();
  };
  const onUp = (e: React.PointerEvent) => {
    const cur = current.current;
    if (!cur || e.pointerId !== pointerId.current) return;
    current.current = null;
    pointerId.current = null;
    if (strokes.current.length >= MAX_STROKES) {
      paint();
      return;
    }
    const s = makeStroke(cur.tool, cur.color, cur.size, cur.points);
    strokes.current.push(s);
    const layer = cache.current;
    if (s.tool === "marker" || !layer || !layer.width) {
      // Маркер должен оказаться под чернилами — пересобираем слои.
      rebuild();
    } else {
      // Ручка и ластик ложатся поверх кэша как есть (ластик стирает всё, что нарисовано раньше).
      const ctx = layer.getContext("2d")!;
      ctx.setTransform(size.current.dpr, 0, 0, size.current.dpr, 0, 0);
      applyStroke(ctx, s, pal, markerAlpha, false);
      paint();
    }
    changed();
  };

  const undo = () => {
    if (!strokes.current.length) return;
    strokes.current.pop();
    rebuild();
    changed();
  };
  const clear = () => {
    strokes.current = [];
    if (base.current) freeCanvas(base.current.tinted);
    base.current = null;
    setHasBase(false);
    rebuild();
    changed();
  };

  const focusRing = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const iconBtn = cn(
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-border bg-surface text-muted transition-colors",
    "hover:text-text disabled:cursor-not-allowed disabled:opacity-50",
    focusRing,
  );

  const toolDefs: { id: ToolId; icon: typeof Pencil; label: string }[] = [
    { id: "pen", icon: Pencil, label: t("sol.pen") },
    { id: "marker", icon: Highlighter, label: t("canvas.marker") },
    { id: "eraser", icon: Eraser, label: t("sol.eraser") },
  ];

  // Панель в два ряда, все кнопки ≥ 40 px; на 360 px (ширина контейнера ~328 px) оба ряда влезают:
  // 1) инструменты + размеры (136 + 172 px), 2) цвета + отмена/очистка (208 + 84 px).
  // Подписи инструментов — только если контейнер достаточно широк (container query, а не ширина экрана).
  return (
    <div className={cn("@container flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
          {toolDefs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={tool === id}
              title={label}
              onClick={() => setTool(id)}
              className={cn(
                "flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-bold transition-colors",
                focusRing,
                tool === id ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-text",
              )}
            >
              <Icon size={18} aria-hidden />
              <span className="hidden @min-[32rem]:inline">{label}</span>
            </button>
          ))}
        </div>
        <div role="group" aria-label={t("canvas.sizes")} className="flex items-center gap-1">
          {sizes.map((s, i) => {
            const active = Math.min(sizeIdx[tool], sizes.length - 1) === i;
            const d = dotPx(tool, s);
            const label = t(tool === "eraser" ? "canvas.eraserSize" : "canvas.size", { n: s });
            return (
              <button
                key={s}
                type="button"
                aria-label={label}
                aria-pressed={active}
                title={label}
                onClick={() => setSize(tool, i)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                  focusRing,
                  active ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-2",
                )}
              >
                <span
                  aria-hidden
                  className={cn("block rounded-full", tool === "eraser" && "border-2 border-muted")}
                  style={{ width: d, height: d, backgroundColor: tool === "eraser" ? "transparent" : pal[curColor] }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {tool === "pen" && (
          <div role="group" aria-label={t("canvas.colors")} className="flex items-center gap-0.5">
            {PEN_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={t(COLOR_KEYS[c])}
                aria-pressed={penColor === c}
                title={t(COLOR_KEYS[c])}
                onClick={() => setPenColor(c)}
                className={cn("flex h-10 w-10 items-center justify-center rounded-full", focusRing)}
              >
                <span
                  aria-hidden
                  style={{ backgroundColor: pal[c] }}
                  className={cn(
                    "block h-8 w-8 rounded-full border border-border transition-shadow",
                    penColor === c && "ring-2 ring-primary ring-offset-2 ring-offset-surface",
                  )}
                />
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className={iconBtn} onClick={undo} disabled={!count} aria-label={t("sol.undo")} title={t("sol.undo")}>
            <Undo2 size={18} aria-hidden />
          </button>
          <button
            type="button"
            className={iconBtn}
            onClick={clear}
            disabled={!count && !hasBase}
            aria-label={t("sol.clear")}
            title={t("sol.clear")}
          >
            <Trash2 size={18} aria-hidden />
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        className={cn("overflow-hidden rounded-2xl border-2 border-border", fill && "relative min-h-0 flex-1")}
        style={{
          backgroundColor: "var(--surface)",
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        <canvas
          ref={canvasRef}
          className={cn("block touch-none", fill && "absolute left-0 top-0", tool === "eraser" ? "cursor-cell" : "cursor-crosshair")}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
          onLostPointerCapture={onUp}
        />
      </div>
    </div>
  );
});
