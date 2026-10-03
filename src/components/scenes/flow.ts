// Блок-схема на сетке: размеры блоков и маршруты стрелок (чистая логика, без React).
// Координаты — пиксели: сцена не масштабируется целиком, чтобы подписи оставались читаемыми на телефоне.

import type { Lang, Scene } from "@/lib/types";
import { tx } from "@/lib/text";
import type { Pt } from "./circuit";
import { estimateTextWidth } from "./text-width";

export type FlowScene = Extract<Scene, { kind: "flow" }>;
export type FlowShape = FlowScene["nodes"][number]["shape"];

/** Отступ вокруг сетки (для стрелок-обходов у края). */
export const FLOW_PAD = 12;
/** Просвет между соседними блоками по горизонтали. */
const GAP_X = 14;
const MIN_CELL_W = 44;
const MAX_CELL_W = 150;
/** Минимальный вертикальный просвет между рядами (место для стрелки и подписи). */
const GAP_Y = 30;
const ARROW = 7;

/** Кегли подписей блоков: пробуем от крупного к мелкому, берём самый крупный, при котором схема влезает по ширине. */
export const FLOW_FONTS = [13, 12, 11] as const;
/** На самом мелком кегле, если и он не влезает, ещё урезаем поля подписи на столько px (в сумме слева и справа) — перед тем как прокручивать. */
const TIGHT_TRIM = 4;
/** Межстрочный интервал подписи (tailwind leading-tight). */
const LINE_RATIO = 1.25;
/** Больше трёх строк в блоке — обрезка (line-clamp-3). */
export const MAX_LABEL_LINES = 3;
/** Ромб уже ячейки на столько px (у остальных блоков — GAP_X). */
const DIAMOND_GAP = 6;
/** Запас текста от края ромба (по вертикали — к высоте блока текста, по горизонтали — к ширине). */
const DIAMOND_PAD_Y = 2;
const DIAMOND_PAD_X = 6;
/** Иконка устройства над подписью: 22 px + просвет 2 px. */
const ICON_H = 24;
/** Подписи стрелок набраны насыщенностью 800 — шире, чем 700, по которой снята таблица ширин. */
const EDGE_LABEL_BOLD = 1.05;
/** Вертикальный запас внутри прямоугольного блока (сумма сверху и снизу). */
const BOX_PAD_Y = 7;

/** Суммарные горизонтальные поля подписи (слева+справа, px) по форме: чтобы текст не лез на скосы и скругления. Ромб — отдельно, по вписанному прямоугольнику. */
export const LABEL_PAD_X: Record<FlowShape, number> = {
  start: 20,
  end: 20,
  action: 10,
  box: 10,
  io: 28,
  if: 0,
  device: 10,
};

/** Поля подписи с учётом урезания trim (не меньше 4 px; у ромба полей нет). */
const labelPadX = (shape: FlowShape, trim: number) => (shape === "if" ? 0 : Math.max(4, LABEL_PAD_X[shape] - trim));

/** Высота блока по форме. */
export const SHAPE_H: Record<FlowShape, number> = {
  start: 40,
  end: 40,
  action: 48,
  box: 48,
  io: 48,
  if: 76,
  device: 72,
};

export interface FlowBox {
  id: string;
  shape: FlowShape;
  col: number;
  row: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Ширина колонки текста внутри блока (у ромба — вписанный прямоугольник). */
  textW: number;
  /** Сколько строк займёт подпись при переносе только между словами (оценка). */
  lines: number;
  /** Самое длинное слово занимает почти всю колонку: здесь браузеру разрешён перенос с дефисом как страховка. */
  tight: boolean;
}

export interface FlowEdgeGeom {
  from: string;
  to: string;
  points: Pt[];
  /** Наконечник: вершина и два «уса». */
  arrow: [Pt, Pt, Pt];
  /** Позиция подписи стрелки и выравнивание текста. */
  labelAt: Pt;
  labelAnchor: "start" | "middle" | "end";
  /** Сколько блоков пересекает путь (0 — чистый). */
  crossings: number;
}

export interface FlowLayout {
  width: number;
  height: number;
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  /** Кегль подписей (px): 13, а на узком экране с длинными словами — 12 или 11. */
  fontPx: number;
  /** Схема шире доступной ширины даже на минимальном кегле — контейнер прокручивается по горизонтали. */
  scrolls: boolean;
  /** Какая-то подпись не влезла: слово шире колонки или больше MAX_LABEL_LINES строк. */
  clipped: boolean;
  boxes: FlowBox[];
  edges: FlowEdgeGeom[];
}

/** Занятая область сетки: сдвиг по x (компактность) и число столбцов/рядов. */
export function flowGrid(nodes: FlowScene["nodes"]): { minX: number; cols: number; rows: number } {
  if (nodes.length === 0) return { minX: 0, cols: 1, rows: 1 };
  const xs = nodes.map((n) => n.x);
  const minX = Math.min(...xs);
  return { minX, cols: Math.max(...xs) - minX + 1, rows: Math.max(...nodes.map((n) => n.y)) + 1 };
}

/** Ширина ячейки сетки по доступной ширине: от 56 до 150 px. */
export function flowCellWidth(availW: number, cols: number): number {
  return Math.max(MIN_CELL_W, Math.min(MAX_CELL_W, Math.floor((availW - FLOW_PAD * 2) / cols)));
}

// ---------- Подписи: перенос по словам и подбор размеров ----------

/** Слова подписи: браузер переносит строку только по пробелам (слово не рвём). */
export function labelWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export interface Wrapped {
  /** Строк при жадном переносе по словам. */
  lines: number;
  /** Ширина самого длинного слова. */
  longest: number;
  /** Какое-то слово шире колонки (его пришлось бы рвать). */
  overflow: boolean;
}

/** Перенос подписи по словам в колонке шириной `width` (оценка по таблице ширин, без DOM). */
export function wrapLabel(text: string, fontPx: number, width: number): Wrapped {
  const space = estimateTextWidth(" ", fontPx);
  let lines = 1;
  let cur = 0;
  let longest = 0;
  for (const word of labelWords(text)) {
    const w = estimateTextWidth(word, fontPx);
    longest = Math.max(longest, w);
    if (cur === 0) cur = w;
    else if (cur + space + w <= width) cur += space + w;
    else {
      lines++;
      cur = w;
    }
  }
  return { lines, longest, overflow: longest > width };
}

/** Наименьшая ширина колонки, при которой подпись не рвёт слова и укладывается в maxLines строк. */
export function minLabelWidth(text: string, fontPx: number, maxLines = MAX_LABEL_LINES): number {
  const total = estimateTextWidth(labelWords(text).join(" "), fontPx);
  let lo = wrapLabel(text, fontPx, Infinity).longest;
  if (wrapLabel(text, fontPx, lo).lines <= maxLines) return Math.ceil(lo);
  let hi = Math.max(total, lo);
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (wrapLabel(text, fontPx, mid).lines <= maxLines) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi);
}

const lineH = (fontPx: number) => fontPx * LINE_RATIO;

/** Ширина колонки текста во вписанном в ромб прямоугольнике из `lines` строк (ширина ромба w, высота SHAPE_H.if). */
function diamondTextWidth(w: number, lines: number, fontPx: number): number {
  return w * (1 - (lines * lineH(fontPx) + DIAMOND_PAD_Y) / SHAPE_H.if) - DIAMOND_PAD_X;
}

/** Наименьшая ширина ромба, в который подпись укладывается в 1–3 строки. */
function diamondNeedWidth(text: string, fontPx: number): number {
  let best = Infinity;
  for (let lines = 1; lines <= MAX_LABEL_LINES; lines++) {
    const k = 1 - (lines * lineH(fontPx) + DIAMOND_PAD_Y) / SHAPE_H.if;
    if (k <= 0) continue;
    best = Math.min(best, (minLabelWidth(text, fontPx, lines) + DIAMOND_PAD_X) / k);
  }
  return Math.ceil(best);
}

/** Колонка текста и число строк подписи в блоке шириной w. У ромба число строк подбирается по вписанному прямоугольнику. */
function fitLabel(shape: FlowShape, text: string, fontPx: number, w: number, trim: number): { textW: number; wrapped: Wrapped } {
  if (shape === "if") {
    for (let lines = 1; lines <= MAX_LABEL_LINES; lines++) {
      const textW = diamondTextWidth(w, lines, fontPx);
      const wrapped = wrapLabel(text, fontPx, textW);
      if (!wrapped.overflow && wrapped.lines <= lines) return { textW, wrapped };
    }
    const textW = diamondTextWidth(w, MAX_LABEL_LINES, fontPx);
    return { textW, wrapped: wrapLabel(text, fontPx, textW) };
  }
  const textW = w - labelPadX(shape, trim);
  return { textW, wrapped: wrapLabel(text, fontPx, textW) };
}

/** Ширина ячейки, при которой подпись узла помещается без разрыва слов и больше чем в 3 строки. */
function nodeNeedCell(node: FlowScene["nodes"][number], fontPx: number, lang: Lang, trim: number): number {
  const text = tx(node.label, lang);
  if (node.shape === "if") return diamondNeedWidth(text, fontPx) + DIAMOND_GAP;
  return minLabelWidth(text, fontPx) + labelPadX(node.shape, trim) + GAP_X;
}

/** Минимальная ширина ячейки сетки для кегля fontPx: максимум по узлам. */
export function flowRequiredCell(nodes: FlowScene["nodes"], fontPx: number, lang: Lang = "ru", trim = 0): number {
  return nodes.reduce((m, n) => Math.max(m, nodeNeedCell(n, fontPx, lang, trim)), 0);
}

/**
 * Кегль подписей и минимальная ячейка: берём самый крупный из FLOW_FONTS, при котором вся схема
 * (cols × ячейка + поля) влезает в availW. Не влезло даже на 11 px — пробуем 11 px с урезанными полями подписи (TIGHT_TRIM);
 * и так не влезло — берём этот вариант, ширина схемы станет больше доступной, и контейнер прокрутится по горизонтали.
 */
export function flowFit(nodes: FlowScene["nodes"], availW: number, lang: Lang = "ru"): { fontPx: number; trim: number; minCell: number; fits: boolean } {
  const { cols } = flowGrid(nodes);
  const smallest = FLOW_FONTS[FLOW_FONTS.length - 1];
  const tiers: [number, number][] = [...FLOW_FONTS.map((f): [number, number] => [f, 0]), [smallest, TIGHT_TRIM]];
  let last = { fontPx: smallest as number, trim: 0, minCell: 0, fits: false };
  for (const [fontPx, trim] of tiers) {
    const minCell = flowRequiredCell(nodes, fontPx, lang, trim);
    last = { fontPx, trim, minCell, fits: cols * Math.max(minCell, MIN_CELL_W) + FLOW_PAD * 2 <= availW };
    if (last.fits) return last;
  }
  return last;
}

/** Высота блока: типовая по форме, а если подпись в 3 строки (или иконка + строки) не помещается — больше. */
function boxHeight(node: FlowScene["nodes"][number], lines: number, fontPx: number): number {
  if (node.shape === "if") return SHAPE_H.if;
  const icon = node.shape === "device" && node.icon ? ICON_H : 0;
  return Math.max(SHAPE_H[node.shape], Math.ceil(icon + Math.min(lines, MAX_LABEL_LINES) * lineH(fontPx) + BOX_PAD_Y));
}

type Side = "top" | "bottom" | "left" | "right";

const port = (b: FlowBox, side: Side): Pt => {
  switch (side) {
    case "top":
      return [b.cx, b.cy - b.h / 2];
    case "bottom":
      return [b.cx, b.cy + b.h / 2];
    case "left":
      return [b.cx - b.w / 2, b.cy];
    case "right":
      return [b.cx + b.w / 2, b.cy];
  }
};

/** Длина ломаной. */
function polylineLength(pts: Pt[]): number {
  let n = 0;
  for (let i = 0; i + 1 < pts.length; i++) n += Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]);
  return n;
}

interface Candidate {
  points: Pt[];
  startSide: Side;
}

/** Пересекает ли отрезок внутренность прямоугольника блока (с запасом 1 px внутрь). */
function segmentHitsBox(a: Pt, b: Pt, box: FlowBox): boolean {
  const l = box.cx - box.w / 2 + 1;
  const r = box.cx + box.w / 2 - 1;
  const t = box.cy - box.h / 2 + 1;
  const bt = box.cy + box.h / 2 - 1;
  if (a[1] === b[1]) {
    const lo = Math.min(a[0], b[0]);
    const hi = Math.max(a[0], b[0]);
    return a[1] > t && a[1] < bt && hi > l && lo < r;
  }
  if (a[0] === b[0]) {
    const lo = Math.min(a[1], b[1]);
    const hi = Math.max(a[1], b[1]);
    return a[0] > l && a[0] < r && hi > t && lo < bt;
  }
  return false;
}

/** Сколько посторонних блоков задевает ломаная. */
export function countCrossings(points: Pt[], boxes: FlowBox[], skip: string[]): number {
  let n = 0;
  for (const box of boxes) {
    if (skip.includes(box.id)) continue;
    for (let i = 0; i + 1 < points.length; i++) {
      if (segmentHitsBox(points[i], points[i + 1], box)) {
        n++;
        break;
      }
    }
  }
  return n;
}

/** Наконечник стрелки в конце последнего отрезка. */
export function arrowHead(points: Pt[], size = ARROW): [Pt, Pt, Pt] {
  const [x, y] = points[points.length - 1];
  const [px, py] = points[points.length - 2] ?? [x, y - 1];
  const dx = Math.sign(x - px);
  const dy = Math.sign(y - py);
  if (dx !== 0) return [[x, y], [x - dx * size, y - size * 0.6], [x - dx * size, y + size * 0.6]];
  return [[x, y], [x - size * 0.6, y - dy * size], [x + size * 0.6, y - dy * size]];
}

/** Убирает вырожденные точки (повторы и промежуточные на одной прямой). */
function simplify(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) continue;
    out.push(p);
  }
  for (let i = out.length - 2; i > 0; i--) {
    const [a, b, c] = [out[i - 1], out[i], out[i + 1]];
    if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) out.splice(i, 1);
  }
  return out;
}

/**
 * Позиция подписи стрелки (wd — оценка её ширины, px). По умолчанию — у начала первого отрезка: справа от вертикали
 * или над горизонталью. Если у горизонтали подпись не влезает до следующего блока, но влезает в просвет — по центру просвета;
 * если вертикальная подпись вылезает за правый край сцены — слева от линии; остальное прижимаем к краям сцены.
 */
export function placeEdgeLabel(p0: Pt, p1: Pt, wd: number, sceneW: number): { at: Pt; anchor: FlowEdgeGeom["labelAnchor"] } {
  if (p0[0] === p1[0]) {
    const y = p0[1] + Math.sign(p1[1] - p0[1]) * 16;
    if (p0[0] + 6 + wd > sceneW - 2 && p0[0] - 6 - wd >= 2) return { at: [p0[0] - 6, y], anchor: "end" };
    return { at: [p0[0] + 6, y], anchor: "start" };
  }
  const y = p0[1] - 7;
  const dir = Math.sign(p1[0] - p0[0]);
  const gap = Math.abs(p1[0] - p0[0]);
  if (wd + 10 > gap && wd + 4 <= gap) return { at: [(p0[0] + p1[0]) / 2, y], anchor: "middle" };
  const anchor = dir >= 0 ? "start" : "end";
  let x = p0[0] + dir * 6;
  const left = anchor === "start" ? x : x - wd;
  if (left < 2) x += 2 - left;
  else if (left + wd > sceneW - 2) x -= left + wd - (sceneW - 2);
  return { at: [x, y], anchor };
}

function candidates(a: FlowBox, b: FlowBox, laneL: number, laneR: number): Candidate[] {
  const list: Candidate[] = [];
  const below = b.row > a.row;
  const sameCol = b.col === a.col;
  const sameRow = b.row === a.row;
  const horizSide: Side = b.cx >= a.cx ? "right" : "left";
  const backSide: Side = b.cx >= a.cx ? "left" : "right";
  const vertSide: Side = below ? "bottom" : "top";
  const vertTarget: Side = below ? "top" : "bottom";
  const lanes = (): Candidate[] =>
    ([
      ["right", laneR],
      ["left", laneL],
    ] as const).map(([side, lane]) => ({
      startSide: side,
      points: [port(a, side), [lane, a.cy], [lane, b.cy], port(b, side)],
    }));

  if (sameCol && !sameRow) {
    list.push({ startSide: vertSide, points: [port(a, vertSide), port(b, vertTarget)] });
    list.push(...lanes());
  } else if (sameRow) {
    const side: Side = b.cx >= a.cx ? "right" : "left";
    const target: Side = side === "right" ? "left" : "right";
    list.push({ startSide: side, points: [port(a, side), port(b, target)] });
  } else if (below) {
    // Из бока блока по горизонтали, затем вниз в верх приёмника; либо вниз, затем в бок приёмника.
    list.push({ startSide: horizSide, points: [port(a, horizSide), [b.cx, a.cy], port(b, "top")] });
    list.push({ startSide: "bottom", points: [port(a, "bottom"), [a.cx, b.cy], port(b, backSide)] });
    list.push(...lanes());
  } else {
    // «Назад» (цикл): обходим по свободному полю справа или слева.
    list.push(...lanes());
    list.push({ startSide: horizSide, points: [port(a, horizSide), [b.cx, a.cy], port(b, "bottom")] });
  }
  return list;
}

/**
 * Раскладка блок-схемы: размеры ячейки по доступной ширине, кегль подписей (13/12/11) по самому длинному слову, блоки по сетке (x — столбец, y — ряд),
 * стрелки — ломаные с одним изломом (при «обходе назад» — через поле справа/слева).
 * Из нескольких вариантов маршрута выбирается тот, что меньше всего задевает чужие блоки.
 */
export function layoutFlow(scene: FlowScene, availW: number, lang: Lang = "ru"): FlowLayout {
  const { minX, cols, rows } = flowGrid(scene.nodes);
  const fit = flowFit(scene.nodes, availW, lang);
  const { fontPx, trim } = fit;
  // Обычно ячейка = доступная ширина / столбцы; если слова не влезли даже на мелком кегле — ячейка по слову, схема прокручивается.
  const cellW = Math.max(fit.minCell, flowCellWidth(availW, cols));

  const sized = scene.nodes.map((n) => {
    const w = n.shape === "if" ? cellW - DIAMOND_GAP : cellW - GAP_X;
    const { textW, wrapped } = fitLabel(n.shape, tx(n.label, lang), fontPx, w, trim);
    return { n, w, textW, wrapped, h: boxHeight(n, wrapped.lines, fontPx) };
  });
  const maxH = Math.max(...sized.map((s) => s.h), 40);
  const cellH = maxH + GAP_Y;

  const boxes: FlowBox[] = sized.map(({ n, w, h, textW, wrapped }) => {
    const col = n.x - minX;
    return {
      id: n.id,
      shape: n.shape,
      col,
      row: n.y,
      cx: FLOW_PAD + (col + 0.5) * cellW,
      cy: FLOW_PAD + (n.y + 0.5) * cellH,
      w,
      h,
      textW,
      lines: wrapped.lines,
      tight: wrapped.longest > textW * 0.9,
    };
  });
  const width = cols * cellW + FLOW_PAD * 2;
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const used = new Set<string>();

  interface Routed {
    e: FlowScene["edges"][number];
    pts: Pt[];
    crossings: number;
  }
  const routed: Routed[] = [];
  for (const e of scene.edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    const laneL = FLOW_PAD + Math.min(a.col, b.col) * cellW;
    const laneR = FLOW_PAD + (Math.max(a.col, b.col) + 1) * cellW;
    let best: { c: Candidate; cost: number; crossings: number } | null = null;
    for (const c of candidates(a, b, laneL, laneR)) {
      const pts = simplify(c.points);
      const crossings = countCrossings(pts, boxes, [a.id, b.id]);
      const cost = crossings * 10 + (used.has(`${a.id}:${c.startSide}`) ? 1 : 0);
      if (!best || cost < best.cost) best = { c: { ...c, points: pts }, cost, crossings };
      if (cost === 0) break;
    }
    if (!best) continue;
    used.add(`${a.id}:${best.c.startSide}`);
    routed.push({ e, pts: best.c.points, crossings: best.crossings });
  }

  // Двусторонняя связь (a→b и b→a): обе стрелки идут по более короткому из двух чистых маршрутов — получается одна линия с двумя наконечниками,
  // а не обход «вокруг всей схемы» в одну из сторон.
  for (const r of routed) {
    const other = routed.find((o) => o !== r && o.e.from === r.e.to && o.e.to === r.e.from);
    if (!other || other.crossings > 0 || r.crossings > 0) continue;
    if (polylineLength(other.pts) < polylineLength(r.pts)) r.pts = [...other.pts].reverse();
  }

  const edges: FlowEdgeGeom[] = routed.map(({ e, pts, crossings }) => {
    const wd = e.label ? estimateTextWidth(tx(e.label, lang), fontPx) * EDGE_LABEL_BOLD : 0;
    const { at: labelAt, anchor: labelAnchor } = placeEdgeLabel(pts[0], pts[1], wd, width);
    return { from: e.from, to: e.to, points: pts, arrow: arrowHead(pts), labelAt, labelAnchor, crossings };
  });

  const clipped = sized.some((s) => s.wrapped.overflow || s.wrapped.lines > MAX_LABEL_LINES);
  return { width, height: rows * cellH + FLOW_PAD * 2, cols, rows, cellW, cellH, fontPx, scrolls: width > availW, clipped, boxes, edges };
}
