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

/**
 * Стрелка-дуга от ячейки к ячейке. Начало и конец — на границах ячеек (не поверх цифр), дуга выгибается вверх (у вертикальных —
 * вправо) и остаётся внутри `bounds` (размер таблицы): если сверху нет места, выгиб идёт вниз. null — ячейка та же.
 */
export function arrowGeometry(from: Rect, to: Rect, bounds: { w: number; h: number }): ArrowGeo | null {
  const c1 = rectCenter(from);
  const c2 = rectCenter(to);
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
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
  // Наконечник — по касательной в конце дуги (от управляющей точки к концу).
  const tx = end[0] - ctrl[0];
  const ty = end[1] - ctrl[1];
  const tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl;
  const uy = ty / tl;
  const size = 8;
  const half = 4.5;
  const head: [Pt, Pt, Pt] = [
    [r1(end[0]), r1(end[1])],
    [r1(end[0] - ux * size - uy * half), r1(end[1] - uy * size + ux * half)],
    [r1(end[0] - ux * size + uy * half), r1(end[1] - uy * size - ux * half)],
  ];
  // Дугу заканчиваем у основания наконечника, чтобы линия не торчала за остриё.
  const baseEnd: Pt = [end[0] - ux * (size - 1), end[1] - uy * (size - 1)];
  return {
    start: [r1(start[0]), r1(start[1])],
    end: [r1(end[0]), r1(end[1])],
    ctrl: [r1(ctrl[0]), r1(ctrl[1])],
    d: `M${r1(start[0])} ${r1(start[1])} Q${r1(ctrl[0])} ${r1(ctrl[1])} ${r1(baseEnd[0])} ${r1(baseEnd[1])}`,
    head,
  };
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
