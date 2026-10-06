// Таблица: буквы столбцов электронной таблицы, признак «столбец из нулей и единиц» и расширения волны 3
// (состояния строк, «было → стало», тона, рамка диапазона, стрелки, JOIN) — чистая логика без React.

import type { DictKey } from "@/i18n/dict";
import type { Scene, SceneTone, Text } from "@/lib/types";

export type TableScene = Extract<Scene, { kind: "table" }>;

/** Имя столбца электронной таблицы: 0 → A, 1 → B, … 25 → Z, 26 → AA. */
export function colLetter(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/**
 * Данные таблицы: в режиме sheet столбцы-заголовки не используются — если они заданы,
 * это первая строка данных; в обычном режиме шапка отдельно от строк.
 */
export function tableData(scene: TableScene): { head: Text[] | null; rows: Text[][] } {
  if (scene.sheet) return { head: null, rows: scene.columns ? [scene.columns, ...scene.rows] : scene.rows };
  return { head: scene.columns ?? null, rows: scene.rows };
}

/** Для каждого столбца: все ли ячейки — «0» или «1» (только тогда цифры подкрашиваются). */
export function binaryColumns(rows: string[][]): boolean[] {
  const width = rows[0]?.length ?? 0;
  return Array.from({ length: width }, (_, c) => rows.length > 0 && rows.every((r) => r[c] === "0" || r[c] === "1"));
}

// ---------- Расширения волны 3 (этап 16Б) ----------

export type RowState = "struck" | "dim" | "rejected" | "new";

/** Заливка ячейки тоном: токены (светлая и тёмная тема). Классы — литералами, чтобы Tailwind их увидел. */
export const TONE_BG: Record<SceneTone, string> = {
  primary: "bg-primary-soft",
  success: "bg-success-soft",
  danger: "bg-danger-soft",
  warning: "bg-warning-soft",
  ai: "bg-ai-soft",
  gold: "bg-gold-soft",
  muted: "bg-surface-2",
};
/** Рамка цели стрелки тоном стрелки (inset-кольцо, классы — литералами). */
export const TONE_RING: Record<SceneTone, string> = {
  primary: "ring-primary",
  success: "ring-success",
  danger: "ring-danger",
  warning: "ring-warning",
  ai: "ring-ai",
  gold: "ring-gold",
  muted: "ring-muted",
};
/** Линия и стрелка тоном (SVG). */
export const TONE_STROKE: Record<SceneTone, string> = {
  primary: "stroke-primary",
  success: "stroke-success",
  danger: "stroke-danger",
  warning: "stroke-warning",
  ai: "stroke-ai",
  gold: "stroke-gold",
  muted: "stroke-muted",
};
export const TONE_FILL: Record<SceneTone, string> = {
  primary: "fill-primary",
  success: "fill-success",
  danger: "fill-danger",
  warning: "fill-warning",
  ai: "fill-ai",
  gold: "fill-gold",
  muted: "fill-muted",
};

/** Ключ ячейки «строка:столбец». */
export const cellKey = (r: number, c: number) => `${r}:${c}`;

/** Состояние строки по её номеру. */
export function rowStateMap(scene: TableScene): Map<number, RowState> {
  return new Map((scene.rowStates ?? []).map((x) => [x.row, x.state]));
}

/** «Было» по ячейке (ключ — cellKey). */
export function changeMap(scene: TableScene): Map<string, Text> {
  return new Map((scene.changes ?? []).map((x) => [cellKey(x.cell[0], x.cell[1]), x.from]));
}

/** Тон ячейки: более поздняя группа перекрывает раннюю. */
export function toneMap(scene: TableScene): Map<string, SceneTone> {
  const out = new Map<string, SceneTone>();
  for (const g of scene.tones ?? []) for (const [r, c] of g.cells) out.set(cellKey(r, c), g.tone);
  return out;
}

/** Номер строки у края в режиме sheet: свой (после фильтра 2, 5, 7) или по порядку. */
export function sheetRowNumber(scene: TableScene, r: number): number {
  return scene.rowNumbers?.[r] ?? r + 1;
}

/** Куда указывают стрелки: ключ ячейки → тон (у нескольких стрелок в одну ячейку — тон последней). Цель стрелки подсвечивается сама. */
export function arrowTargets(scene: TableScene): Map<string, SceneTone> {
  return new Map((scene.arrows ?? []).map((a) => [cellKey(a.to[0], a.to[1]), a.tone ?? "primary"]));
}

/**
 * Место стрелки среди стрелок в одну и ту же ячейку: слот 0 — у самой дальней ячейки-источника (её дуга длиннее и приходит левее),
 * дальше — ближе. Так концы стрелок в одну ячейку разведены и дуги не пересекаются у наконечников.
 */
export function arrowSlots(scene: TableScene): { slot: number; slots: number }[] {
  const arrows = scene.arrows ?? [];
  return arrows.map((a, i) => {
    const same = arrows.map((b, j) => ({ b, j })).filter(({ b }) => b.to[0] === a.to[0] && b.to[1] === a.to[1]);
    const dist = (b: (typeof arrows)[number]) => Math.abs(b.from[0] - b.to[0]) + Math.abs(b.from[1] - b.to[1]);
    same.sort((x, y) => dist(y.b) - dist(x.b) || x.j - y.j);
    return { slot: same.findIndex(({ j }) => j === i), slots: same.length };
  });
}

/** Нужен ли слой поверх таблицы (рамка диапазона, стрелки). */
export function needsOverlay(scene: TableScene): boolean {
  return !!scene.range || !!scene.arrows?.length;
}

/** Есть ли у сцены хоть одно расширение волны 3 (иначе разметка — та же, что раньше). */
export function usesTableExt(scene: TableScene): boolean {
  return !!(scene.rowStates?.length || scene.changes?.length || scene.tones?.length || scene.range || scene.arrows?.length || scene.formula || scene.rowNumbers || scene.join);
}

// ----- Геометрия слоя: прямоугольники ячеек приходят из измерения DOM, всё остальное — чистая арифметика -----

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Pt = [number, number];

export const rectCenter = (r: Rect): Pt => [r.x + r.w / 2, r.y + r.h / 2];

/** Рамка, охватывающая ячейки from..to включительно; null — если нет измерения. */
export function rangeRect(rects: ReadonlyMap<string, Rect>, range: NonNullable<TableScene["range"]>): Rect | null {
  const a = rects.get(cellKey(range.from[0], range.from[1]));
  const b = rects.get(cellKey(range.to[0], range.to[1]));
  if (!a || !b) return null;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Точка, где луч из центра прямоугольника к точке `toward` выходит за его границу. */
export function rayExit(rect: Rect, toward: Pt): Pt {
  const [cx, cy] = rectCenter(rect);
  const dx = toward[0] - cx;
  const dy = toward[1] - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const tx = dx === 0 ? Infinity : rect.w / 2 / Math.abs(dx);
  const ty = dy === 0 ? Infinity : rect.h / 2 / Math.abs(dy);
  const t = Math.min(tx, ty);
  return [cx + dx * t, cy + dy * t];
}

export interface ArrowGeo {
  start: Pt;
  end: Pt;
  ctrl: Pt;
  /** Путь SVG: квадратичная дуга start → основание наконечника. */
  d: string;
  /** Наконечник — вершины треугольника (первая — остриё). */
  head: [Pt, Pt, Pt];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Размер наконечника стрелки, px. */
const HEAD_SIZE = 8;
const HEAD_HALF = 4.5;
/**
 * Высота плоской дуги над серединой хорды: вершина дуги стоит выше границы строк (END_INSET − FLAT_PEAK = −5 px), а не на ней, и умещается
 * в нижний отступ соседней строки (≥ 11 px: цифры не задеваются), px.
 */
export const FLAT_PEAK = 15;
/**
 * Насколько концы стрелки заходят внутрь своих ячеек: острие и весь наконечник (до ≈ 9 px вдоль хорды при крутой дуге) лежат в целевой ячейке,
 * а не на границе строк (ревью v18b: при 5 px наконечник пересекал рамку), px.
 */
export const END_INSET = 10;

/** Собирает стрелку-дугу (путь, наконечник по касательной в конце) из начала, управляющей точки и конца. */
function finishArrow(start: Pt, ctrl: Pt, end: Pt): ArrowGeo {
  const tx = end[0] - ctrl[0];
  const ty = end[1] - ctrl[1];
  const tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl;
  const uy = ty / tl;
  const head: [Pt, Pt, Pt] = [
    [r1(end[0]), r1(end[1])],
    [r1(end[0] - ux * HEAD_SIZE - uy * HEAD_HALF), r1(end[1] - uy * HEAD_SIZE + ux * HEAD_HALF)],
    [r1(end[0] - ux * HEAD_SIZE + uy * HEAD_HALF), r1(end[1] - uy * HEAD_SIZE - ux * HEAD_HALF)],
  ];
  // Дугу заканчиваем у основания наконечника, чтобы линия не торчала за остриё.
  const baseEnd: Pt = [end[0] - ux * (HEAD_SIZE - 1), end[1] - uy * (HEAD_SIZE - 1)];
  return {
    start: [r1(start[0]), r1(start[1])],
    end: [r1(end[0]), r1(end[1])],
    ctrl: [r1(ctrl[0]), r1(ctrl[1])],
    d: `M${r1(start[0])} ${r1(start[1])} Q${r1(ctrl[0])} ${r1(ctrl[1])} ${r1(baseEnd[0])} ${r1(baseEnd[1])}`,
    head,
  };
}

/** Куда в ячейке-цели приходит стрелка по строке: слева (если идёт слева направо) или справа, слоты разведены по ширине ячейки. */
function flatEndX(to: Rect, sign: number, slot: number, slots: number): number {
  const inset = Math.max(7, Math.min(16, to.w * 0.2));
  const step = slots > 1 ? Math.min(16, Math.max(0, (to.w - 2 * inset) / (slots - 1))) : 0;
  return sign > 0 ? to.x + inset + slot * step : to.x + to.w - inset - slot * step;
}

/**
 * Стрелка между ячейками одной строки: плоская дуга через границу строк (над строкой, у первой — под ней). Начало и конец — внутри
 * своих ячеек у края строки (на END_INSET от границы): острие стрелки указывает в целевую ячейку, а не на линию между строками.
 * Концы нескольких стрелок в одну ячейку разведены по слотам. null — места нет (одна строка во всю высоту).
 */
function flatRowArrow(from: Rect, to: Rect, bounds: { w: number; h: number }, slot = 0, slots = 1): ArrowGeo | null {
  const c1 = rectCenter(from);
  const c2 = rectCenter(to);
  const sign = c2[0] >= c1[0] ? 1 : -1;
  const sx = c1[0] + sign * Math.min(14, from.w * 0.25);
  const ex = flatEndX(to, sign, slot, slots);
  if (sign * (ex - sx) < 14) return null; // ячейки слишком близко: плоская дуга не поместится
  const margin = 2;
  for (const up of [true, false]) {
    const sy = up ? from.y + END_INSET : from.y + from.h - END_INSET;
    const ey = up ? to.y + END_INSET : to.y + to.h - END_INSET;
    const ctrl: Pt = [(sx + ex) / 2, (sy + ey) / 2 + (up ? -2 : 2) * FLAT_PEAK];
    const apexY = (sy + ey) / 4 + ctrl[1] / 2;
    if (apexY < margin || apexY > bounds.h - margin) continue;
    return finishArrow([sx, sy], ctrl, [ex, ey]);
  }
  return null;
}

/**
 * Стрелка по клеткам для ячеек в разных строках и столбцах (по диагонали): идёт по линиям сетки — вдоль границы строк от исходной
 * ячейки до границы столбцов целевой, затем вдоль неё до середины целевой ячейки и заходит внутрь. Так линия проходит в зазорах
 * между цифрами (поля ячеек), а не по диагонали через них.
 */
function gridRouteArrow(from: Rect, to: Rect, bounds: { w: number; h: number }): ArrowGeo {
  const c1 = rectCenter(from);
  const c2 = rectCenter(to);
  const hDir = c2[0] >= c1[0] ? 1 : -1;
  const down = c2[1] >= c1[1];
  const clampX = (x: number) => Math.min(bounds.w - 1, Math.max(1, x));
  const yH = down ? from.y + from.h : from.y; // граница строк, обращённая к цели
  const xV = clampX(hDir > 0 ? to.x : to.x + to.w); // граница столбцов, обращённая к источнику
  const yEnd = c2[1];
  const start: Pt = [c1[0], yH];
  const corner1: Pt = [xV, yH];
  const end: Pt = [clampX(xV + hDir * 10), yEnd];
  return finishPolyline([start, corner1, [xV, yEnd], end]);
}

/** Стрелка-ломаная со скруглёнными углами (радиус до 6 px) и наконечником по последнему отрезку. */
function finishPolyline(pts: Pt[]): ArrowGeo {
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const tl = Math.hypot(last[0] - prev[0], last[1] - prev[1]) || 1;
  const ux = (last[0] - prev[0]) / tl;
  const uy = (last[1] - prev[1]) / tl;
  const head: [Pt, Pt, Pt] = [
    [r1(last[0]), r1(last[1])],
    [r1(last[0] - ux * HEAD_SIZE - uy * HEAD_HALF), r1(last[1] - uy * HEAD_SIZE + ux * HEAD_HALF)],
    [r1(last[0] - ux * HEAD_SIZE + uy * HEAD_HALF), r1(last[1] - uy * HEAD_SIZE - ux * HEAD_HALF)],
  ];
  const baseEnd: Pt = [last[0] - ux * (HEAD_SIZE - 1), last[1] - uy * (HEAD_SIZE - 1)];
  const path = [...pts.slice(0, -1), baseEnd];
  let d = `M${r1(path[0][0])} ${r1(path[0][1])}`;
  for (let i = 1; i < path.length; i++) {
    const p = path[i];
    const a = path[i - 1];
    const n = path[i + 1];
    if (!n) {
      d += ` L${r1(p[0])} ${r1(p[1])}`;
      continue;
    }
    const len1 = Math.hypot(p[0] - a[0], p[1] - a[1]);
    const len2 = Math.hypot(n[0] - p[0], n[1] - p[1]);
    const rad = Math.min(6, len1 / 2, len2 / 2);
    if (rad < 1) {
      d += ` L${r1(p[0])} ${r1(p[1])}`;
      continue;
    }
    const k1 = rad / len1;
    const k2 = rad / len2;
    d += ` L${r1(p[0] - (p[0] - a[0]) * k1)} ${r1(p[1] - (p[1] - a[1]) * k1)} Q${r1(p[0])} ${r1(p[1])} ${r1(p[0] + (n[0] - p[0]) * k2)} ${r1(p[1] + (n[1] - p[1]) * k2)}`;
  }
  return { start: [r1(pts[0][0]), r1(pts[0][1])], end: [r1(last[0]), r1(last[1])], ctrl: [r1(pts[1][0]), r1(pts[1][1])], d, head };
}

/**
 * Стрелка между вертикальными соседями: у них луч из центра выходит в одной точке общей границы (начало = конец, стрелки не видно).
 * Рисуем дугу вдоль правого края: от ближней к границе части исходной ячейки к ближней к границе части целевой, выгиб вправо.
 * `down` — целевая ячейка ниже исходной (копирование вниз); иначе выше: части зеркальны, стрелка остаётся короткой и не тянется через текст.
 */
function sideArrow(from: Rect, to: Rect, bounds: { w: number; h: number }, down: boolean): ArrowGeo {
  const x0 = from.x + from.w - Math.min(18, from.w * 0.25);
  const near = down ? 0.62 : 0.38; // доля высоты исходной ячейки, откуда стартуем (у общей границы)
  const sy = from.y + from.h * near;
  const ey = to.y + to.h * (1 - near);
  const bulge = Math.max(0, Math.min(14, bounds.w - 2 - x0));
  return finishArrow([x0, sy], [x0 + bulge, (sy + ey) / 2], [x0, ey]);
}

/**
 * Стрелка между горизонтальными соседями, когда ни над строкой, ни под ней места нет (таблица в одну строку): плоская дуга внутри строки,
 * в полосе у нижнего края ячеек — ниже цифр. null — ячейки слишком близко или полосы нет в таблице.
 */
function innerRowArrow(from: Rect, to: Rect, bounds: { w: number; h: number }): ArrowGeo | null {
  const c1 = rectCenter(from);
  const c2 = rectCenter(to);
  const sign = c2[0] >= c1[0] ? 1 : -1;
  const sx = c1[0] + sign * Math.min(14, from.w * 0.25);
  const ex = c2[0] - sign * Math.min(14, to.w * 0.25);
  if (sign * (ex - sx) < 14) return null;
  const sy = from.y + from.h - 6;
  const ey = to.y + to.h - 6;
  const ctrl: Pt = [(sx + ex) / 2, (sy + ey) / 2 + 4];
  const apexY = (sy + ey) / 4 + ctrl[1] / 2;
  if (Math.min(sy, ey, apexY) < 2 || Math.max(sy, ey, apexY) > bounds.h - 2) return null;
  return finishArrow([sx, sy], ctrl, [ex, ey]);
}

/** Сдвигает точку на границе прямоугольника внутрь него (к центру) на `px`: острие стрелки должно стоять в целевой ячейке. */
function inward(r: Rect, p: Pt, px: number): Pt {
  const [cx, cy] = rectCenter(r);
  const d = Math.hypot(cx - p[0], cy - p[1]);
  if (d < 1) return p;
  const k = Math.min(1, px / d);
  return [p[0] + (cx - p[0]) * k, p[1] + (cy - p[1]) * k];
}

/**
 * Стрелка от ячейки к ячейке; острие стоит внутри целевой ячейки (её же подсвечивает слой — см. arrowTargets).
 * По строке — плоская дуга через границу строк (flatRowArrow); по диагонали — вдоль линий сетки (gridRouteArrow), без прохода по цифрам;
 * по столбцу и в прочих случаях — дуга, выгнутая вверх (у вертикальных — вправо) и целиком внутри `bounds` (размер таблицы).
 * `slot` / `slots` — место этой стрелки среди стрелок в ту же ячейку (arrowSlots). null — ячейка та же или стрелке негде поместиться.
 */
export function arrowGeometry(from: Rect, to: Rect, bounds: { w: number; h: number }, o: { slot?: number; slots?: number } = {}): ArrowGeo | null {
  const c1 = rectCenter(from);
  const c2 = rectCenter(to);
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  if (Math.abs(dy) < Math.min(from.h, to.h) / 2) {
    const flat = flatRowArrow(from, to, bounds, o.slot ?? 0, o.slots ?? 1);
    if (flat) return flat;
  } else if (Math.abs(dx) >= Math.min(from.w, to.w) / 2) {
    return gridRouteArrow(from, to, bounds);
  }
  const mid: Pt = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
  // Нормали: n1 — «вверх» (у вертикальных — «вправо»), n2 — противоположная.
  const base: Pt = [-dy / len, dx / len];
  const flip = (p: Pt): Pt => [-p[0], -p[1]];
  const mostlyVertical = Math.abs(dy) > Math.abs(dx) * 1.5;
  const n1: Pt = mostlyVertical ? (base[0] >= 0 ? base : flip(base)) : base[1] <= 0 ? base : flip(base);
  const n2 = flip(n1);
  const want = Math.min(Math.max(len * 0.28, 16), 44);
  const margin = 2;
  const build = (n: Pt, bulge: number) => {
    const ctrl: Pt = [mid[0] + n[0] * bulge * 2, mid[1] + n[1] * bulge * 2];
    const start = rayExit(from, ctrl);
    const end = rayExit(to, ctrl);
    return { ctrl, start, end };
  };
  // Дуга годится, если вся она (по точкам кривой) лежит внутри таблицы: начало и конец сидят на границах ячеек,
  // поэтому у первой строки «вверх» не проходит, а у последней — «вниз».
  const fits = (g: { ctrl: Pt; start: Pt; end: Pt }) =>
    Array.from({ length: 9 }, (_, i) => i / 8).every((t) => {
      const x = (1 - t) * (1 - t) * g.start[0] + 2 * (1 - t) * t * g.ctrl[0] + t * t * g.end[0];
      const y = (1 - t) * (1 - t) * g.start[1] + 2 * (1 - t) * t * g.ctrl[1] + t * t * g.end[1];
      return x >= margin && x <= bounds.w - margin && y >= margin && y <= bounds.h - margin;
    });
  let pick = build(n1, 6);
  search: for (const bulge of [want, want * 0.6, 8]) {
    for (const n of [n1, n2]) {
      const g = build(n, bulge);
      if (fits(g)) {
        pick = g;
        break search;
      }
    }
  }
  const { ctrl, start, end } = pick;
  // Начало и конец совпали (соседи по общей границе): вертикальные — дуга у правого края ячеек; соседи по строке, когда над и под
  // строкой места нет (таблица в одну строку), — дуга внутри строки. Вертикальную стрелку для соседей по строке не рисуем: она указывала бы вверх.
  if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 12) {
    if (Math.abs(dy) > Math.abs(dx)) return sideArrow(from, to, bounds, dy > 0);
    if (Math.abs(dy) < Math.min(from.h, to.h) / 2) return innerRowArrow(from, to, bounds);
  }
  return finishArrow(start, ctrl, inward(to, end, END_INSET + 1));
}

// ----- JOIN: тон совпавших строк и вид раскладки -----

/**
 * Совпавшие строки двух таблиц — одним тоном (primary, «основное действие»): у всех строк, у которых есть пара, он один,
 * строки без пары остаются без тона. Разные цвета для разных пар не берём: цвета success/warning/danger в схеме значат другое,
 * а пары различает линия между строками (широкий вид) или порядок строк.
 */
export const JOIN_TONE: SceneTone = "primary";

export function joinTones(links: [number, number][]): { left: Map<number, SceneTone>; right: Map<number, SceneTone> } {
  const left = new Map<number, SceneTone>();
  const right = new Map<number, SceneTone>();
  for (const [a, b] of links) {
    left.set(a, JOIN_TONE);
    right.set(b, JOIN_TONE);
  }
  return { left, right };
}

/** Ширина контейнера, начиная с которой таблицы JOIN стоят рядом и соединяются линиями (на телефоне — друг под другом). */
export const JOIN_WIDE_FROM = 540;

/** Прямоугольник, обрезанный по видимой области `clip` (прокручиваемый блок таблицы); ширина и высота не отрицательные. */
export function clipRect(r: Rect, clip: Rect): Rect {
  const x1 = Math.max(r.x, clip.x);
  const x2 = Math.min(r.x + r.w, clip.x + clip.w);
  const y1 = Math.max(r.y, clip.y);
  const y2 = Math.min(r.y + r.h, clip.y + clip.h);
  return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}

// ----- Текстовая замена рисунка для скринридера -----

/** Имя ячейки как в электронной таблице: столбец-буква и номер строки (в sheet — с учётом rowNumbers). */
export function cellName(scene: TableScene, [r, c]: [number, number]): string {
  return `${colLetter(c)}${scene.sheet ? sheetRowNumber(scene, r) : r + 1}`;
}

/** Фразы для скринридера о том, что только нарисовано: рамка диапазона, стрелки, совпавшие строки JOIN. */
export function tableExtDescription(scene: TableScene, t: (key: DictKey, params?: Record<string, string | number>) => string): string[] {
  const out: string[] = [];
  if (scene.range) out.push(t("scene.table.range", { range: `${cellName(scene, scene.range.from)}:${cellName(scene, scene.range.to)}` }));
  for (const a of scene.arrows ?? []) out.push(t("scene.table.arrow", { from: cellName(scene, a.from), to: cellName(scene, a.to) }));
  if (scene.join?.links.length) out.push(t("scene.table.joinMatch", { pairs: scene.join.links.map(([a, b]) => `${a + 1}–${b + 1}`).join(", ") }));
  return out;
}

/** Кривая-связка между строками левой и правой таблиц (от правого края строки к левому): путь SVG. */
export function joinLinkPath(a: Rect, b: Rect): { d: string; from: Pt; to: Pt } {
  const from: Pt = [r1(a.x + a.w), r1(a.y + a.h / 2)];
  const to: Pt = [r1(b.x), r1(b.y + b.h / 2)];
  const mx = r1((from[0] + to[0]) / 2);
  const d = from[1] === to[1] ? `M${from[0]} ${from[1]} L${to[0]} ${to[1]}` : `M${from[0]} ${from[1]} C${mx} ${from[1]} ${mx} ${to[1]} ${to[0]} ${to[1]}`;
  return { d, from, to };
}
