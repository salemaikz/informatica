// Блок-схема на сетке: размеры блоков и маршруты стрелок (чистая логика, без React).
// Координаты — пиксели: сцена не масштабируется целиком, чтобы подписи оставались читаемыми на телефоне.

import type { Scene } from "@/lib/types";
import type { Pt } from "./circuit";

export type FlowScene = Extract<Scene, { kind: "flow" }>;
export type FlowShape = FlowScene["nodes"][number]["shape"];

/** Отступ вокруг сетки (для стрелок-обходов у края). */
export const FLOW_PAD = 12;
/** Просвет между соседними блоками по горизонтали. */
const GAP_X = 14;
const MIN_CELL_W = 56;
const MAX_CELL_W = 150;
/** Минимальный вертикальный просвет между рядами (место для стрелки и подписи). */
const GAP_Y = 30;
const ARROW = 7;

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
}

export interface FlowEdgeGeom {
  from: string;
  to: string;
  points: Pt[];
  /** Наконечник: вершина и два «уса». */
  arrow: [Pt, Pt, Pt];
  /** Позиция подписи стрелки и выравнивание текста. */
  labelAt: Pt;
  labelAnchor: "start" | "end";
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
 * Раскладка блок-схемы: размеры ячейки по доступной ширине, блоки по сетке (x — столбец, y — ряд),
 * стрелки — ломаные с одним изломом (при «обходе назад» — через поле справа/слева).
 * Из нескольких вариантов маршрута выбирается тот, что меньше всего задевает чужие блоки.
 */
export function layoutFlow(scene: FlowScene, availW: number): FlowLayout {
  const { minX, cols, rows } = flowGrid(scene.nodes);
  const cellW = flowCellWidth(availW, cols);
  const maxH = Math.max(...scene.nodes.map((n) => SHAPE_H[n.shape]), 40);
  const cellH = maxH + GAP_Y;

  const boxes: FlowBox[] = scene.nodes.map((n) => {
    const col = n.x - minX;
    const w = n.shape === "if" ? cellW - 6 : cellW - GAP_X;
    return {
      id: n.id,
      shape: n.shape,
      col,
      row: n.y,
      cx: FLOW_PAD + (col + 0.5) * cellW,
      cy: FLOW_PAD + (n.y + 0.5) * cellH,
      w,
      h: SHAPE_H[n.shape],
    };
  });
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const used = new Set<string>();
  const edges: FlowEdgeGeom[] = [];

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
    const pts = best.c.points;
    const [p0, p1] = pts;
    const vertical = p0[0] === p1[0];
    const labelAt: Pt = vertical
      ? [p0[0] + 6, p0[1] + Math.sign(p1[1] - p0[1]) * 16]
      : [p0[0] + Math.sign(p1[0] - p0[0]) * 6, p0[1] - 7];
    edges.push({
      from: e.from,
      to: e.to,
      points: pts,
      arrow: arrowHead(pts),
      labelAt,
      labelAnchor: vertical || p1[0] >= p0[0] ? "start" : "end",
      crossings: best.crossings,
    });
  }

  return { width: cols * cellW + FLOW_PAD * 2, height: rows * cellH + FLOW_PAD * 2, cols, rows, cellW, cellH, boxes, edges };
}
