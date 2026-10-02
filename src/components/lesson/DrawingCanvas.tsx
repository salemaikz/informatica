"use client";

import clsx from "clsx";
import { Eraser, Pencil, Trash2, Undo2 } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useT } from "@/i18n/useT";

type Point = { x: number; y: number };
type Stroke = { tool: "pen" | "eraser"; points: Point[] };

export interface DrawingHandle {
  isEmpty: () => boolean;
  /** Рисунок на белом фоне (без сетки) — для отправки ИИ. */
  exportCanvas: () => HTMLCanvasElement | null;
  /**
   * Рисунок на прозрачном фоне (PNG dataURL, чернила #111) — для сохранения и восстановления через `initialImage`.
   * "" — рисунок пуст; null — холст пока недоступен (нулевой размер), сохранять нечего.
   */
  exportImage: () => string | null;
}

interface BaseImage {
  img: HTMLImageElement;
  /** Копия, перекрашенная в цвет чернил текущей темы. */
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

interface DrawingCanvasProps {
  onChange?: (empty: boolean) => void;
  disabled?: boolean;
  /** Сохранённый рисунок (из exportImage) — читается один раз при монтировании; рисуется под новыми штрихами. */
  initialImage?: string;
  /** Фиксированная высота холста в px (по умолчанию зависит от ширины). */
  height?: number;
}

const PEN = 3;
const ERASER = 22;

/** Холст «в клеточку» для решения задач пальцем/стилусом/мышью. */
export const DrawingCanvas = forwardRef<DrawingHandle, DrawingCanvasProps>(
  function DrawingCanvas({ onChange, disabled, initialImage, height: fixedHeight }, ref) {
    const { t } = useT();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const strokes = useRef<Stroke[]>([]);
    const current = useRef<Stroke | null>(null);
    const [tool, setTool] = useState<"pen" | "eraser">("pen");
    const [count, setCount] = useState(0);
    const base = useRef<BaseImage | null>(null);
    /** Размер холста в CSS-пикселях (не зависит от dpr). */
    const size = useRef({ w: 0, h: 0 });
    const initialRef = useRef(initialImage);
    const [hasBase, setHasBase] = useState(false);

    const draw = useCallback((ctx: CanvasRenderingContext2D, list: Stroke[], color: string) => {
      for (const s of list) {
        if (!s.points.length) continue;
        ctx.save();
        ctx.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over";
        ctx.strokeStyle = color;
        ctx.lineWidth = s.tool === "eraser" ? ERASER : PEN;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        if (s.points.length === 1) ctx.lineTo(s.points[0].x + 0.1, s.points[0].y + 0.1);
        for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
      }
    }, []);

    const redraw = useCallback(() => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d")!;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      const ink = getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#1b2333";
      const b = base.current;
      if (b) {
        if (!b.tinted || b.tint !== ink) {
          freeCanvas(b.tinted);
          b.tinted = tintImage(b.img, ink);
          b.tint = ink;
        }
        // Сохранённый рисунок — под штрихами, поэтому ластик стирает и его. Размер — по фиксированному масштабу.
        ctx.drawImage(b.tinted, 0, 0, b.tinted.width / EXPORT_SCALE, b.tinted.height / EXPORT_SCALE);
      }
      draw(ctx, strokes.current, ink);
    }, [draw]);

    // Восстановление сохранённого рисунка (один раз).
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
        redraw();
      };
      img.src = src;
      return () => {
        alive = false;
      };
    }, [redraw]);

    // Смена темы: цвет чернил берётся из --text, поэтому перерисовываем (и перекрашиваем сохранённый рисунок).
    useEffect(() => {
      const mo = new MutationObserver(() => redraw());
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onScheme = () => redraw();
      mq.addEventListener("change", onScheme);
      return () => {
        mo.disconnect();
        mq.removeEventListener("change", onScheme);
      };
    }, [redraw]);

    // Освобождаем перекрашенную копию при размонтировании.
    useEffect(
      () => () => {
        const b = base.current;
        if (b) {
          freeCanvas(b.tinted);
          b.tinted = null;
        }
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
        const height = fixedHeight ?? Math.max(260, Math.min(420, Math.round(width * 0.75)));
        size.current = { w: width, h: height };
        c.style.width = `${width}px`;
        c.style.height = `${height}px`;
        c.width = Math.round(width * dpr);
        c.height = Math.round(height * dpr);
        redraw();
      };
      resize();
      const ro = new ResizeObserver(resize);
      if (wrapRef.current) ro.observe(wrapRef.current);
      return () => ro.disconnect();
    }, [redraw, fixedHeight]);

    const changed = () => {
      setCount(strokes.current.length);
      onChange?.(strokes.current.filter((s) => s.tool === "pen").length === 0 && !base.current);
    };

    /** Слой «сохранённый рисунок + штрихи» на прозрачном фоне: pxW×pxH пикселей, `scale` пикселей на CSS-пиксель. */
    const renderLayer = useCallback(
      (pxW: number, pxH: number, scale: number): HTMLCanvasElement => {
        const layer = document.createElement("canvas");
        layer.width = Math.max(1, pxW);
        layer.height = Math.max(1, pxH);
        const lctx = layer.getContext("2d")!;
        lctx.setTransform(scale, 0, 0, scale, 0, 0);
        const b = base.current;
        // Базу рисуем в её логическом размере: при scale = EXPORT_SCALE это пиксель в пиксель, без пересэмплинга.
        if (b) lctx.drawImage(b.img, 0, 0, b.img.naturalWidth / EXPORT_SCALE, b.img.naturalHeight / EXPORT_SCALE);
        draw(lctx, strokes.current, "#111111");
        return layer;
      },
      [draw],
    );

    useImperativeHandle(ref, () => ({
      isEmpty: () => strokes.current.filter((s) => s.tool === "pen").length === 0 && !base.current,
      exportCanvas: () => {
        const c = canvasRef.current;
        if (!c) return null;
        const dpr = window.devicePixelRatio || 1;
        const out = document.createElement("canvas");
        out.width = c.width;
        out.height = c.height;
        const ctx = out.getContext("2d")!;
        // Сначала рисуем всё на прозрачном слое (чтобы ластик работал), затем подкладываем белый фон.
        const layer = renderLayer(c.width, c.height, dpr);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(layer, 0, 0);
        freeCanvas(layer);
        return out;
      },
      exportImage: () => {
        const c = canvasRef.current;
        if (!c || c.width === 0 || c.height === 0) return null;
        if (!base.current && strokes.current.every((s) => s.tool === "eraser")) return "";
        // Слой не меньше сохранённого рисунка: то, что вышло за текущую ширину панели, не обрезаем.
        const img = base.current?.img;
        const w = Math.max(size.current.w, img ? img.naturalWidth / EXPORT_SCALE : 0);
        const h = Math.max(size.current.h, img ? img.naturalHeight / EXPORT_SCALE : 0);
        const layer = renderLayer(Math.ceil(w * EXPORT_SCALE), Math.ceil(h * EXPORT_SCALE), EXPORT_SCALE);
        try {
          return layer.toDataURL("image/png");
        } finally {
          freeCanvas(layer);
        }
      },
    }));

    const pos = (e: React.PointerEvent): Point => {
      const r = canvasRef.current!.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onDown = (e: React.PointerEvent) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      current.current = { tool, points: [pos(e)] };
      strokes.current.push(current.current);
      redraw();
    };
    const onMove = (e: React.PointerEvent) => {
      if (!current.current) return;
      const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      const r = canvasRef.current!.getBoundingClientRect();
      for (const ev of events) current.current.points.push({ x: ev.clientX - r.left, y: ev.clientY - r.top });
      redraw();
    };
    const onUp = () => {
      if (!current.current) return;
      current.current = null;
      changed();
    };

    const undo = () => {
      strokes.current.pop();
      redraw();
      changed();
    };
    const clear = () => {
      strokes.current = [];
      freeCanvas(base.current?.tinted ?? null);
      base.current = null;
      setHasBase(false);
      redraw();
      changed();
    };

    const toolBtn = (active: boolean) =>
      clsx(
        "flex h-10 items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-bold transition-colors",
        active ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted hover:text-text",
      );

    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={toolBtn(tool === "pen")} onClick={() => setTool("pen")}>
            <Pencil size={16} /> {t("sol.pen")}
          </button>
          <button type="button" className={toolBtn(tool === "eraser")} onClick={() => setTool("eraser")}>
            <Eraser size={16} /> {t("sol.eraser")}
          </button>
          <div className="flex-1" />
          <button type="button" className={toolBtn(false)} onClick={undo} disabled={!count} aria-label={t("sol.undo")}>
            <Undo2 size={16} />
          </button>
          <button type="button" className={toolBtn(false)} onClick={clear} disabled={!count && !hasBase} aria-label={t("sol.clear")}>
            <Trash2 size={16} />
          </button>
        </div>
        <div
          ref={wrapRef}
          className="overflow-hidden rounded-2xl border-2 border-border"
          style={{
            backgroundColor: "var(--surface)",
            backgroundImage:
              "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        >
          <canvas
            ref={canvasRef}
            className={clsx("block touch-none", tool === "eraser" ? "cursor-cell" : "cursor-crosshair")}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={onUp}
          />
        </div>
      </div>
    );
  },
);
