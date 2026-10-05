// Чистая логика сцены grid (сетка, матрица, объединения): геометрия клеток, слои подсветки, объединения, путь, подписи осей.
// Без React, покрыта тестами (tests/scene-grid.test.ts). Компонент только рисует результат.

import type { DictKey } from "@/i18n/dict";
import type { Scene, SceneTone } from "@/lib/types";
import { estimateTextWidth } from "./text-width";

export type GridData = Extract<Scene, { kind: "grid" }>;
export type GridRegion = NonNullable<NonNullable<GridData["marks"]>[number]["region"]>;
type Tr = (key: DictKey, params?: Record<string, string | number>) => string;

/** Ширина рисунка (единицы viewBox = px на телефоне 360). */
export const GRID_VB = 360;
export const GRID_PAD = 4;
/** Предельный размер клетки: у малых сеток клетки не растут больше. */
export const CELL_MAX = 44;
export const CELL_MIN = 14;
/** Ширина колонки с номерами строк / высота ряда с номерами столбцов и колонка/ряд с именем оси. */
export const AXIS_NUM = 20;
export const AXIS_NAME = 16;

/** Токен цвета тона (смысл цветов — CLAUDE.md). */
export function toneVar(tone: SceneTone): string {
  return `var(--${tone})`;
}

/** Принадлежит ли клетка (r, c) области квадратной сетки n × n. */
export function inRegion(region: GridRegion, r: number, c: number, n: number): boolean {
  switch (region) {
    case "diag":
      return r === c;
    case "anti":
      return r + c === n - 1;
    case "upper":
      return c > r;
    case "lower":
      return c < r;
  }
}

/** Слои подсветки одной клетки: индексы слоёв (по порядку marks) и тоны. */
export function cellLayers(scene: GridData, r: number, c: number): { layer: number; tone: SceneTone }[] {
  const out: { layer: number; tone: SceneTone }[] = [];
  (scene.marks ?? []).forEach((mk, layer) => {
    const hit =
      !!mk.cells?.some(([rr, cc]) => rr === r && cc === c) ||
      !!mk.rows?.includes(r) ||
      !!mk.cols?.includes(c) ||
      (!!mk.region && scene.rows === scene.cols && inRegion(mk.region, r, c, scene.rows));
    if (hit) out.push({ layer, tone: mk.tone });
  });
  return out;
}

/** Сколько клеток закрашено хотя бы одним слоем. */
export function markedCount(scene: GridData): number {
  let n = 0;
  for (let r = 0; r < scene.rows; r++) for (let c = 0; c < scene.cols; c++) if (cellLayers(scene, r, c).length) n++;
  return n;
}

/** Подбор кегля так, чтобы текст влез в ширину maxW (оценка по таблице Nunito). */
export function fitFont(text: string, maxW: number, maxFont: number, minFont = 6): number {
  let f = maxFont;
  while (f > minFont && estimateTextWidth(text, f) > maxW) f -= 0.5;
  return Math.max(minFont, f);
}

export interface GridBlock {
  key: string;
  r: number;
  c: number;
  rs: number;
  cs: number;
  x: number;
  y: number;
  w: number;
  h: number;
  merged: boolean;
  value: string;
  fontSize: number;
  textX: number;
  textY: number;
  /** «Съеденные» клетки объединения (для штриховки). */
  eaten: { key: string; x: number; y: number; w: number; h: number }[];
  /** Слои подсветки блока: объединение всех клеток, в него входящих; порядок слоёв сохраняется. */
  tones: { layer: number; tone: SceneTone }[];
}

export interface GridLayout {
  w: number;
  h: number;
  cell: number;
  /** Левый верхний угол области клеток. */
  ox: number;
  oy: number;
  blocks: GridBlock[];
  /** Номера строк и столбцов (пусто, если axes нет). */
  rowNums: { n: number; x: number; y: number }[];
  colNums: { n: number; x: number; y: number }[];
  rowName?: { text: string; x: number; y: number };
  colName?: { text: string; x: number; y: number };
  /** Центры клеток пути. */
  path: { x: number; y: number }[];
  /** Номера обхода по клеткам: «r:c» → номера по порядку (клетка может встретиться дважды). */
  numbers: Map<string, number[]>;
  numFont: number;
}

/** Размер клетки: сетка влезает в 360 px вместе с осями, но не больше CELL_MAX. */
export function cellSize(cols: number, hasAxes: boolean, hasRowName: boolean): number {
  const left = (hasAxes ? AXIS_NUM : 0) + (hasRowName ? AXIS_NAME : 0);
  const free = GRID_VB - 2 * GRID_PAD - left;
  return Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor(free / cols)));
}

export function gridLayout(scene: GridData): GridLayout {
  const { rows, cols } = scene;
  const axes = scene.axes;
  const hasAxes = !!axes;
  const from = axes?.from ?? 0;
  const leftG = (hasAxes ? AXIS_NUM : 0) + (axes?.row ? AXIS_NAME : 0);
  const topG = (hasAxes ? AXIS_NUM : 0) + (axes?.col ? AXIS_NAME : 0);
  const cell = cellSize(cols, hasAxes, !!axes?.row);
  const ox = GRID_PAD + leftG;
  const oy = GRID_PAD + topG;
  const w = 2 * GRID_PAD + leftG + cols * cell;
  const h = 2 * GRID_PAD + topG + rows * cell;

  // объединения: якорь → размеры; все клетки внутри → якорь
  const anchorOf = new Map<string, { r: number; c: number }>();
  const spans = new Map<string, { rs: number; cs: number }>();
  for (const mg of scene.merges ?? []) {
    const rs = mg.rs ?? 1;
    const cs = mg.cs ?? 1;
    spans.set(`${mg.r}:${mg.c}`, { rs, cs });
    for (let r = mg.r; r < mg.r + rs; r++) for (let c = mg.c; c < mg.c + cs; c++) anchorOf.set(`${r}:${c}`, { r: mg.r, c: mg.c });
  }

  const blocks: GridBlock[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const key = `${r}:${c}`;
      const a = anchorOf.get(key);
      if (a && (a.r !== r || a.c !== c)) continue; // «съеденная» клетка — часть чужого блока
      const sp = spans.get(key) ?? { rs: 1, cs: 1 };
      const merged = sp.rs * sp.cs > 1;
      const x = ox + c * cell;
      const y = oy + r * cell;
      const bw = sp.cs * cell;
      const bh = sp.rs * cell;
      const value = scene.values?.[r]?.[c] ?? "";
      // со штриховкой текст остаётся в якорной клетке, иначе — по центру большой клетки
      const hatched = merged && !!scene.hatch;
      const tw = (hatched ? cell : bw) - 6;
      const fontSize = fitFont(value, tw, Math.min(18, cell * 0.5));
      const eaten: GridBlock["eaten"] = [];
      const layerMap = new Map<number, SceneTone>();
      for (let rr = r; rr < r + sp.rs; rr++)
        for (let cc = c; cc < c + sp.cs; cc++) {
          if (rr !== r || cc !== c) eaten.push({ key: `${rr}:${cc}`, x: ox + cc * cell, y: oy + rr * cell, w: cell, h: cell });
          for (const ly of cellLayers(scene, rr, cc)) layerMap.set(ly.layer, ly.tone);
        }
      blocks.push({
        key,
        r,
        c,
        rs: sp.rs,
        cs: sp.cs,
        x,
        y,
        w: bw,
        h: bh,
        merged,
        value,
        fontSize,
        textX: hatched ? x + cell / 2 : x + bw / 2,
        textY: hatched ? y + cell / 2 : y + bh / 2,
        eaten: scene.hatch ? eaten : [],
        tones: [...layerMap.entries()].sort((p, q) => p[0] - q[0]).map(([layer, tone]) => ({ layer, tone })),
      });
    }

  const center = ([r, c]: [number, number]) => ({ x: ox + c * cell + cell / 2, y: oy + r * cell + cell / 2 });
  const path = (scene.path ?? []).map(center);
  const numbers = new Map<string, number[]>();
  if (scene.numbered)
    (scene.path ?? []).forEach(([r, c], i) => {
      const k = `${r}:${c}`;
      numbers.set(k, [...(numbers.get(k) ?? []), i + 1]);
    });

  return {
    w,
    h,
    cell,
    ox,
    oy,
    blocks,
    rowNums: hasAxes ? Array.from({ length: rows }, (_, i) => ({ n: i + from, x: ox - 5, y: oy + i * cell + cell / 2 })) : [],
    colNums: hasAxes ? Array.from({ length: cols }, (_, i) => ({ n: i + from, x: ox + i * cell + cell / 2, y: oy - 6 })) : [],
    rowName: axes?.row ? { text: axes.row, x: GRID_PAD + AXIS_NAME / 2, y: oy + (rows * cell) / 2 } : undefined,
    colName: axes?.col ? { text: axes.col, x: ox + (cols * cell) / 2, y: GRID_PAD + AXIS_NAME / 2 + 1 } : undefined,
    path,
    numbers,
    numFont: Math.max(6, Math.min(10, cell * 0.3)),
  };
}

/** Стрелка пути: линия до точки чуть раньше центра последней клетки + наконечник (три точки). */
export function pathArrow(path: { x: number; y: number }[], cell: number): { line: { x: number; y: number }[]; head: { x: number; y: number }[] } | null {
  if (path.length < 2) return null;
  const a = path[path.length - 2];
  const b = path[path.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { line: path, head: [] };
  const ux = dx / len;
  const uy = dy / len;
  const size = Math.max(5, cell * 0.2);
  const back = Math.min(cell * 0.18, len / 2);
  const tip = { x: b.x - ux * back, y: b.y - uy * back };
  const base = { x: tip.x - ux * size, y: tip.y - uy * size };
  const nx = -uy * size * 0.55;
  const ny = ux * size * 0.55;
  return {
    line: [...path.slice(0, -1), base],
    head: [tip, { x: base.x + nx, y: base.y + ny }, { x: base.x - nx, y: base.y - ny }],
  };
}

/** Описание для экранного диктора. */
export function gridAria(scene: GridData, t: Tr): string {
  const parts = [t("scene.grid.aria", { rows: scene.rows, cols: scene.cols })];
  if (scene.values) {
    const list = scene.values.map((row) => row.map((v) => (v === "" ? "–" : v)).join(", ")).join("; ");
    parts.push(t("scene.grid.aria.values", { list }));
  }
  const m = markedCount(scene);
  if (m) parts.push(t("scene.grid.aria.marks", { n: m }));
  if (scene.merges?.length) parts.push(t("scene.grid.aria.merges", { n: scene.merges.length }));
  if (scene.path?.length) parts.push(t("scene.grid.aria.path", { n: scene.path.length }));
  return parts.join(" ");
}
