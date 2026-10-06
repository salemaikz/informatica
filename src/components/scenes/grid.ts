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
  /** Кегль имён осей (подгоняется под AXIS_NAME / ширину сетки). */
  nameFont: number;
  /** Текст номеров обхода по клеткам («1,3», при >2 визитах «1…5») и его кегль. */
  numLabels: Map<string, { text: string; font: number }>;
  /**
   * Когда в клетках есть значения, путь рисуется не линией через центры, а короткими стрелками между соседними клетками —
   * они лежат в просветах между значениями и ничего не перечёркивают.
   */
  steps: GridStep[];
  /** Путь из одной клетки со значением в ней: клетка обводится кольцом (залитый кружок в центре лёг бы на значение). */
  ring: { x: number; y: number; w: number; h: number } | null;
}

/** Шаг пути между двумя соседними клетками: отрезок и наконечник (три точки). */
export interface GridStep {
  from: { x: number; y: number };
  to: { x: number; y: number };
  head: { x: number; y: number }[];
}

/** Кегль номеров обхода: не мельче (на телефоне рисунок ужимается до ≈ 0.82 — 10.5 дают ≈ 9 px). */
export const NUM_FONT_MIN = 10.5;
export const NUM_FONT_MAX = 12;
/** Длина стрелки шага: от и до (px viewBox). */
export const STEP_LEN_MIN = 7;
export const STEP_LEN_MAX = 16;
/** Зазор между стрелкой шага и значением в клетке. */
export const STEP_GAP = 2;
/** Сдвиг параллельных стрелок, если шаг между той же парой клеток повторяется (туда и обратно). */
export const STEP_LANE = 5;

/** Подпись номеров обхода: два номера — через запятую, больше — «первый…последний». */
export function numberLabel(ns: number[]): string {
  return ns.length > 2 ? `${ns[0]}…${ns[ns.length - 1]}` : ns.join(",");
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

  const numFont0 = Math.max(NUM_FONT_MIN, Math.min(NUM_FONT_MAX, cell * 0.34));
  const numLabels = new Map<string, { text: string; font: number }>();
  for (const [k, ns] of numbers) {
    const text = numberLabel(ns);
    numLabels.set(k, { text, font: fitFont(text, cell - 4, numFont0, 6) });
  }
  // путь с номерами поверх значений: номер стоит в углу клетки, значение чуть ниже и не крупнее 0.42 клетки, чтобы не касаться номера.
  // Кегль и сдвиг — ОДНИ на все значения сетки (не только на клетки пути): иначе «0 1 2 3» выходит неровной строкой
  // с разной высотой цифр (ревью v18b).
  if (numbers.size > 0) {
    const withValue = blocks.filter((b) => b.value !== "");
    if (withValue.length > 0) {
      const nf = Math.max(...[...numLabels.values()].map((nl) => nl.font));
      const size = Math.min(Math.max(6, cell * 0.42), ...withValue.map((b) => b.fontSize));
      for (const b of withValue) {
        b.fontSize = size;
        b.textY += nf * 0.3;
      }
    }
  }
  const nameFont = fitFont(axes?.row ?? "", AXIS_NAME - 2, 13, 7);

  // шаги пути: при значениях — стрелки в просветах между ними, без значений — линия через центры рисует компонент
  const steps = scene.values ? pathSteps(scene, blocks, path, cell, !!scene.numbered) : [];
  const only = scene.path?.length === 1 ? scene.path[0] : null;
  const ring =
    only && scene.values && (scene.values[only[0]]?.[only[1]] ?? "") !== ""
      ? { x: ox + only[1] * cell + 2.5, y: oy + only[0] * cell + 2.5, w: cell - 5, h: cell - 5 }
      : null;

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
    numFont: numFont0,
    nameFont,
    numLabels,
    steps,
    ring,
  };
}

/** Полуразмеры текста значения клетки (по ширине строки и по высоте цифр) и его смещение от центра клетки (cell — размер клетки). */
function valueExtent(b: GridBlock | undefined, cell: number): { hw: number; hh: number; ox: number; oy: number } | null {
  if (!b || b.value === "") return null;
  return { hw: estimateTextWidth(b.value, b.fontSize) / 2, hh: b.fontSize * 0.36, ox: b.textX - (b.x + cell / 2), oy: b.textY - (b.y + cell / 2) };
}

/**
 * Стрелки шагов пути между соседними клетками: от края значения в клетке откуда до края значения в клетке куда
 * (длина STEP_LEN_MIN..STEP_LEN_MAX, по центру просвета). Вертикальные стрелки при номерах сдвинуты вправо — номер обхода стоит слева сверху.
 * Повторные шаги между той же парой клеток (туда и обратно) идут параллельно с зазором STEP_LANE.
 */
export function pathSteps(scene: GridData, blocks: GridBlock[], centers: { x: number; y: number }[], cell: number, numbered: boolean): GridStep[] {
  const path = scene.path ?? [];
  const byKey = new Map(blocks.map((b) => [b.key, b]));
  const pairKey = (i: number) => {
    const [a, b] = [path[i], path[i + 1]].map(([r, c]) => r * 1000 + c).sort((p, q) => p - q);
    return `${a}:${b}`;
  };
  const used = new Map<string, number[]>();
  for (let i = 0; i + 1 < path.length; i++) used.set(pairKey(i), [...(used.get(pairKey(i)) ?? []), i]);
  const out: GridStep[] = [];
  for (let i = 0; i + 1 < path.length; i++) {
    const a = centers[i];
    const b = centers[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    // как далеко от центра клетки значение простирается в сторону соседа (проекция рамки текста на направление шага)
    const reach = (cellPos: [number, number], dirX: number, dirY: number): number => {
      const ext = valueExtent(byKey.get(`${cellPos[0]}:${cellPos[1]}`), cell);
      if (!ext) return STEP_GAP;
      let far = -Infinity;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) far = Math.max(far, (ext.ox + sx * ext.hw) * dirX + (ext.oy + sy * ext.hh) * dirY);
      return Math.max(0, far) + STEP_GAP;
    };
    const s0 = reach(path[i], ux, uy);
    const e0 = reach(path[i + 1], -ux, -uy);
    let from = s0;
    let to = len - e0;
    const span = to - from;
    if (span > STEP_LEN_MAX) {
      const mid = (from + to) / 2;
      from = mid - STEP_LEN_MAX / 2;
      to = mid + STEP_LEN_MAX / 2;
    } else if (span < STEP_LEN_MIN) {
      const mid = len / 2;
      from = mid - STEP_LEN_MIN / 2;
      to = mid + STEP_LEN_MIN / 2;
    }
    // боковой сдвиг: параллельные стрелки пары клеток и сдвиг вертикальных вправо при номерах
    const group = used.get(pairKey(i))!;
    const k = group.indexOf(i);
    const lane = (k - (group.length - 1) / 2) * STEP_LANE;
    // нормаль считаем от канонического направления пары, чтобы «туда» и «обратно» разошлись по разные стороны
    const canon = path[i][0] * 1000 + path[i][1] <= path[i + 1][0] * 1000 + path[i + 1][1] ? 1 : -1;
    const nx = -uy * canon;
    const ny = ux * canon;
    const vertical = Math.abs(uy) > Math.abs(ux) && Math.abs(ux) < 0.2;
    const offX = numbered && vertical ? cell * 0.2 : 0;
    // горизонтальные стрелки идут на уровне значений: при номере обхода значение сдвинуто вниз, а стрелка ниже номера, не вплотную к нему
    const horizontal = Math.abs(ux) > Math.abs(uy) && Math.abs(uy) < 0.2;
    const offY = horizontal ? ((valueExtent(byKey.get(`${path[i][0]}:${path[i][1]}`), cell)?.oy ?? 0) + (valueExtent(byKey.get(`${path[i + 1][0]}:${path[i + 1][1]}`), cell)?.oy ?? 0)) / 2 : 0;
    const p = (t: number) => ({ x: a.x + ux * t + nx * lane + offX, y: a.y + uy * t + ny * lane + offY });
    const f = p(from);
    const t = p(to);
    const size = Math.min(6, Math.max(4.5, cell * 0.17));
    const base = { x: t.x - ux * size, y: t.y - uy * size };
    const hx = -uy * size * 0.55;
    const hy = ux * size * 0.55;
    out.push({ from: f, to: base, head: [t, { x: base.x + hx, y: base.y + hy }, { x: base.x - hx, y: base.y - hy }] });
  }
  return out;
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
