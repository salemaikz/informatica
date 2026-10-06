// Чистая логика сцены numberline (числовая ось): шкала, деления, строки, дуги шагов, подписи точек.
// Без React, покрыта тестами (tests/scene-numberline.test.ts). Все размеры — в единицах viewBox шириной NL_W (360 px).

import type { DictKey } from "@/i18n/dict";
import type { SceneTone } from "@/lib/types";
import { estimateTextWidth } from "./text-width";

/** Ширина viewBox: ровно экран телефона, на широком экране рисунок масштабируется. */
export const NL_W = 360;
const PAD = 8;
/** Запас под стрелку луча слева и справа от шкалы. */
const ARROW = 12;
const TICK_FONT = 11;
export const LABEL_FONT = 13;
export const POINT_FONT = 12;
/** Подпись строки слева, если её ширина не больше этого. */
export const LEFT_LABEL_MAX = 84;
/** Радиус кружка зависит от длины деления (чтобы соседние не сливались). */
export function dotRadius(unit: number): number {
  return Math.min(5.5, Math.max(2.1, unit * 0.33));
}
export function dotStroke(r: number): number {
  return Math.min(2.5, Math.max(1.2, r * 0.4));
}
const LEVEL_H = 15;
/** Шаг второго (третьего…) уровня подписей делений под осью. */
export const TICK_LEVEL_H = 13;

export type NlRange = { from: number | null; to: number | null; fromIn?: boolean; toIn?: boolean };

/** Строка с уже выбранным языком (Text → string делает компонент). */
export interface NlRowInput {
  label?: string;
  tone?: SceneTone;
  ranges?: NlRange[];
  points?: { at: number; open?: boolean; label?: string }[];
  jumps?: { start: number; stop: number; step: number };
}

export interface NlInput {
  min: number;
  max: number;
  ticks?: "all" | number[];
  rows: NlRowInput[];
}

type Est = (text: string, fontPx: number) => number;

/** Число для показа: минус — настоящий «−». */
export function fmtNum(n: number): string {
  return n < 0 ? `−${-n}` : String(n);
}

/** Цвет тона (токен). */
export function toneColor(tone: SceneTone | undefined): string {
  return `var(--${tone ?? "primary"})`;
}

/** Числа, которые берёт range(start, stop, step): start, start+step, … пока не дошли до stop (stop не берётся). */
export function jumpValues(start: number, stop: number, step: number): number[] {
  const out: number[] = [];
  if (!Number.isInteger(step) || step === 0) return out;
  for (let v = start; step > 0 ? v < stop : v > stop; v += step) {
    out.push(v);
    if (out.length > 200) break;
  }
  return out;
}

// ---------- Деления ----------

export interface NlTick {
  v: number;
  x: number;
  /** Подпись; undefined — только чёрточка. */
  label?: string;
  /** Уровень подписи под осью: 0 — основной, 1 и ниже — если соседняя мешает. */
  level: number;
}

function inRange(input: NlInput, v: number): boolean {
  return v >= input.min && v <= input.max;
}

/** Числа, без подписи которых сцену не прочитать: концы шкалы, концы промежутков, точки, start и stop прыжков. */
function requiredValues(input: NlInput): number[] {
  const set = new Set<number>([input.min, input.max]);
  for (const r of input.rows) {
    for (const g of r.ranges ?? []) {
      if (g.from !== null) set.add(g.from);
      if (g.to !== null) set.add(g.to);
    }
    for (const p of r.points ?? []) set.add(p.at);
    if (r.jumps) {
      set.add(r.jumps.start);
      set.add(r.jumps.stop);
    }
  }
  return [...set].filter((v) => inRange(input, v)).sort((a, b) => a - b);
}

/** Необязательные подписи (числа прыжков). */
function jumpNumbers(input: NlInput): number[] {
  const set = new Set<number>();
  for (const r of input.rows) if (r.jumps) jumpValues(r.jumps.start, r.jumps.stop, r.jumps.step).forEach((v) => set.add(v));
  return [...set].filter((v) => inRange(input, v)).sort((a, b) => a - b);
}

const TICK_GAP = 3;

/**
 * Подписи делений. Обязательные не теряются: если задевают соседнюю, опускаются на следующий уровень под осью.
 * Необязательные ставятся только на нулевой уровень и только если там есть место.
 * Возвращает уровень каждой подписанной цифры и число необязательных, которым места не хватило.
 */
function placeTickLabels(
  required: number[],
  optional: number[],
  xOf: (v: number) => number,
  min: number,
  max: number,
  est: Est,
): { levels: Map<number, number>; skipped: number } {
  const levels = new Map<number, number>();
  const taken: { a: number; b: number; level: number }[] = [];
  const span = (v: number) => {
    const w = est(fmtNum(v), TICK_FONT);
    return { a: xOf(v) - w / 2, b: xOf(v) + w / 2 };
  };
  const free = (a: number, b: number, level: number) => taken.every((t) => t.level !== level || b + TICK_GAP <= t.a || a - TICK_GAP >= t.b);
  const first = [...required.filter((v) => v === min || v === max), ...required.filter((v) => v !== min && v !== max)];
  for (const v of first) {
    if (levels.has(v)) continue;
    const { a, b } = span(v);
    let level = 0;
    while (!free(a, b, level)) level++;
    taken.push({ a, b, level });
    levels.set(v, level);
  }
  let skipped = 0;
  for (const v of optional) {
    if (levels.has(v)) continue;
    const { a, b } = span(v);
    if (free(a, b, 0)) {
      taken.push({ a, b, level: 0 });
      levels.set(v, 0);
    } else skipped++;
  }
  return { levels, skipped };
}

/** Для "all": самый частый шаг k (числа, кратные k), при котором кратные не мешают друг другу. Считаем от нуля. */
function pickAllStep(min: number, max: number, xOf: (v: number) => number, est: Est, required: Set<number>): number[] {
  for (let k = 1; k <= max - min; k++) {
    const vals: number[] = [];
    for (let v = min; v <= max; v++) if (((v % k) + k) % k === 0 && !required.has(v)) vals.push(v);
    // кратные между собой — на одном уровне, без наложений
    const { skipped } = placeTickLabels([], vals, xOf, min, max, est);
    if (skipped === 0) return vals;
  }
  return [];
}

// ---------- Раскладка ----------

export interface NlLabel {
  text: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  font: number;
  /** Тонкая выноска от подписи точки вниз к самой точке (если подпись поднята над строкой): x и отрезок по y. */
  leader?: { x: number; y1: number; y2: number };
}

export interface NlDot {
  x: number;
  open: boolean;
}

export interface NlArc {
  d: string;
  /** Наконечник — треугольник «x,y x,y x,y»; пусто, если дуга короче 10 px (на густой шкале наконечники слиплись бы). */
  head: string;
  dashed: boolean;
}

export interface NlRowLayout {
  y: number;
  tone: SceneTone;
  label?: NlLabel;
  /** Тонкая базовая линия строки. */
  base: [number, number];
  ranges: {
    x1: number;
    x2: number;
    heads: string[];
    dots: NlDot[];
    /** Пунктиры от концов к оси: x и отрезки по y (с разрывами там, где проходят подписи). */
    drops: { x: number; segs: [number, number][] }[];
  }[];
  points: { x: number; open: boolean; label?: NlLabel }[];
  jumps?: { dots: NlDot[]; arcs: NlArc[]; values: number[] };
}

export interface NlLayout {
  w: number;
  h: number;
  x0: number;
  x1: number;
  axisY: number;
  /** Подпись строки слева (true) или над строкой. */
  leftLabels: boolean;
  /** Радиус кружков и толщина их обводки: зависят от длины деления. */
  r: number;
  sw: number;
  xOf: (v: number) => number;
  /** Все целые деления (чёрточки), подписанные — с label. */
  ticks: NlTick[];
  rows: NlRowLayout[];
}

function arrowHead(tipX: number, y: number, dir: 1 | -1): string {
  const bx = tipX - dir * 8;
  return `${tipX},${y} ${bx},${y - 5} ${bx},${y + 5}`;
}

/** Дуга шага: от x1 к x2 над точкой строки y, наконечник по касательной. */
export function arcPath(x1: number, x2: number, y: number): { d: string; head: string; height: number } {
  const span = Math.abs(x2 - x1);
  const height = Math.min(20, Math.max(7, span * 0.4));
  const cx = (x1 + x2) / 2;
  const cy = y - 2 * height;
  // касательная в конце кривой — от контрольной точки к концу
  const dx = x2 - cx;
  const dy = y - cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bx = x2 - ux * 5;
  const by = y - uy * 5;
  const px = -uy * 3;
  const py = ux * 3;
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    d: `M ${r(x1)} ${r(y)} Q ${r(cx)} ${r(cy)} ${r(x2)} ${r(y)}`,
    head: span < 10 ? "" : `${r(x2)},${r(y)} ${r(bx + px)},${r(by + py)} ${r(bx - px)},${r(by - py)}`,
    height,
  };
}

/** Раскладка уровней подписей точек: каждая следующая подпись, которая задевает предыдущую на уровне, уходит выше. */
export function placePointLabels(
  items: { x: number; text: string }[],
  est: Est,
  width = NL_W,
): { x: number; anchor: "middle"; level: number; w: number }[] {
  const placed: { a: number; b: number; level: number }[] = [];
  const out: { x: number; anchor: "middle"; level: number; w: number }[] = [];
  const order = items.map((it, i) => ({ ...it, i })).sort((p, q) => p.x - q.x);
  const res = new Map<number, { x: number; anchor: "middle"; level: number; w: number }>();
  for (const it of order) {
    const w = est(it.text, POINT_FONT) + 4;
    const cx = Math.min(width - 4 - w / 2, Math.max(4 + w / 2, it.x));
    const a = cx - w / 2;
    const b = cx + w / 2;
    let level = 0;
    while (placed.some((p) => p.level === level && !(b + 3 <= p.a || a - 3 >= p.b))) level++;
    placed.push({ a, b, level });
    res.set(it.i, { x: cx, anchor: "middle", level, w });
  }
  for (let i = 0; i < items.length; i++) out.push(res.get(i)!);
  return out;
}

/** Результат раскладки подписей точек «веером»: центр подписи (x), уровень и нужна ли выноска к точке. */
export interface FanLabel {
  x: number;
  anchor: "middle";
  level: number;
  w: number;
  /** Подпись над своей точкой не стоит (поднята выше нулевого уровня): к точке идёт тонкая выноска. */
  leader: boolean;
  /** -1 — подпись сдвинута влево от точки (правый край у точки), 1 — вправо, 0 — по центру. */
  shift: -1 | 0 | 1;
}

/** Сколько уровней подписей над строкой допускаем (выше — уже слишком далеко от точки). */
const FAN_LEVELS = 3;
/** Предел перебора вариантов (узлов поиска): после него — жадная раскладка с выносками. */
const FAN_BUDGET = 60000;

/**
 * Подписи точек: каждая подпись стоит либо над своей точкой (по центру или сдвинутая в сторону так, что её край у точки),
 * либо выше с тонкой выноской к точке. Подпись нулевого уровня не накрывает чужую точку, выноска не идёт через чужую подпись.
 * Перебор по порядку точек слева направо: меньше уровней и меньше сдвигов — лучше. pointXs — x всех точек строки (в том числе без подписи).
 */
export function placePointLabelsFan(items: { x: number; text: string }[], est: Est, width = NL_W, pointXs?: number[]): FanLabel[] {
  if (!items.length) return [];
  const xs = pointXs ?? items.map((it) => it.x);
  const order = items.map((it, i) => ({ ...it, i })).sort((p, q) => p.x - q.x || p.i - q.i);
  type Opt = { c: number; a: number; b: number; shift: -1 | 0 | 1 };
  const prepared = order.map((it) => {
    const w = est(it.text, POINT_FONT) + 4;
    const clamp = (c: number) => Math.min(width - 4 - w / 2, Math.max(4 + w / 2, c));
    const opts: Opt[] = [];
    ([[it.x, 0], [it.x + 4 - w / 2, -1], [it.x - 4 + w / 2, 1]] as [number, -1 | 0 | 1][]).forEach(([c0, shift]) => {
      const c = clamp(c0);
      const o: Opt = { c, a: c - w / 2, b: c + w / 2, shift };
      // подпись должна оставаться над своей точкой (край экрана мог её отодвинуть)
      if (shift !== 0 && !(o.a - 4 <= it.x && it.x <= o.b + 4)) return;
      if (opts.some((q) => Math.abs(q.c - c) < 0.5)) return;
      opts.push(o);
    });
    return { it, w, opts };
  });

  const pick: { opt: Opt; level: number }[] = [];
  const found: { best: { cost: number; sel: { opt: Opt; level: number }[] } | null } = { best: null };
  let nodes = 0;
  const conflict = (idx: number, opt: Opt, level: number): boolean => {
    const px = prepared[idx].it.x;
    for (let j = 0; j < idx; j++) {
      const q = pick[j];
      // ширина подписи уже включает по 2 px запаса с каждой стороны, поэтому между текстами остаётся ≥ 5 px
      if (q.level === level && !(opt.b + 1 <= q.opt.a || opt.a - 1 >= q.opt.b)) return true;
      // выноска нашей подписи идёт вниз через все нижние уровни: не должна пройти сквозь чужую подпись
      if (q.level < level && px > q.opt.a - 2 && px < q.opt.b + 2) return true;
      // и наоборот: выноска чужой, более высокой подписи — сквозь нашу
      if (q.level > level && prepared[j].it.x > opt.a - 2 && prepared[j].it.x < opt.b + 2) return true;
    }
    // подпись прямо над строкой не должна накрывать чужую точку
    if (level === 0) for (const fx of xs) if (Math.abs(fx - px) > 0.5 && fx > opt.a - 1 && fx < opt.b + 1) return true;
    return false;
  };
  const walk = (idx: number, cost: number) => {
    if (found.best && cost >= found.best.cost) return;
    if (++nodes > FAN_BUDGET) return;
    if (idx === prepared.length) {
      found.best = { cost, sel: pick.map((p) => ({ ...p })) };
      return;
    }
    for (let level = 0; level < FAN_LEVELS; level++) {
      for (const opt of prepared[idx].opts) {
        if (conflict(idx, opt, level)) continue;
        pick[idx] = { opt, level };
        walk(idx + 1, cost + level * 10 + (opt.shift ? 1 : 0));
      }
    }
  };
  if (prepared.length <= 9) walk(0, 0);

  const res = new Map<number, FanLabel>();
  if (found.best) {
    found.best.sel.forEach((p, k) => {
      res.set(prepared[k].it.i, { x: p.opt.c, anchor: "middle", level: p.level, w: prepared[k].w, leader: p.level > 0, shift: p.opt.shift });
    });
  } else {
    // запасной путь: уровни по старому правилу, выноски у всего, что выше нуля
    const old = placePointLabels(items, est, width);
    old.forEach((o, i) => res.set(i, { ...o, leader: o.level > 0, shift: 0 }));
  }
  return items.map((_, i) => res.get(i)!);
}

/** Прямоугольник подписи (для разрывов пунктиров и тестов). */
export interface Rect {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export function labelRect(l: NlLabel, est: Est): Rect {
  const w = est(l.text, l.font) + 2;
  const x1 = l.anchor === "middle" ? l.x - w / 2 : l.anchor === "end" ? l.x - w : l.x;
  return { x1: x1 - 2, x2: x1 + w + 2, y1: l.y - l.font - 1, y2: l.y + 3 };
}

/** Отрезок x = const от yFrom до yTo без кусков, лежащих внутри прямоугольников подписей. */
export function cutSegments(yFrom: number, yTo: number, x: number, rects: Rect[]): [number, number][] {
  let segs: [number, number][] = [[yFrom, yTo]];
  for (const q of rects) {
    if (x < q.x1 || x > q.x2) continue;
    const next: [number, number][] = [];
    for (const [a, b] of segs) {
      if (q.y2 <= a || q.y1 >= b) next.push([a, b]);
      else {
        if (q.y1 > a) next.push([a, q.y1]);
        if (q.y2 < b) next.push([q.y2, b]);
      }
    }
    segs = next;
  }
  return segs.filter(([a, b]) => b - a > 1);
}

export function layoutNumberline(input: NlInput, est: Est = estimateTextWidth): NlLayout {
  const { min, max } = input;
  const labels = input.rows.map((r) => r.label ?? "");
  const maxLabelW = Math.max(0, ...labels.map((s) => (s ? est(s, LABEL_FONT) : 0)));
  const hasLabels = maxLabelW > 0;
  const leftLabels = hasLabels && maxLabelW <= LEFT_LABEL_MAX;
  const x0 = leftLabels ? PAD + Math.ceil(maxLabelW) + 8 + ARROW : PAD + ARROW + 6;
  const x1 = NL_W - PAD - ARROW - 6;
  const unit = (x1 - x0) / (max - min);
  const xOf = (v: number) => x0 + (v - min) * unit;
  const R = dotRadius(unit);
  const sw = dotStroke(R);

  // деления: обязательные подписи не теряются (при тесноте уходят на второй уровень), остальные — если есть место
  let required: number[];
  let optional: number[] = [];
  if (Array.isArray(input.ticks)) required = input.ticks.filter((v) => inRange(input, v)).sort((a, b) => a - b);
  else {
    required = requiredValues(input);
    if (input.ticks === "all") {
      const req = new Set(required);
      if (min <= 0 && max >= 0) req.add(0);
      required = [...req].sort((a, b) => a - b);
      optional = pickAllStep(min, max, xOf, est, req);
    } else optional = jumpNumbers(input);
  }
  const { levels } = placeTickLabels(required, optional, xOf, min, max, est);
  const tickVals = new Set<number>([...required, ...optional]);
  if (max - min <= 40) for (let v = min; v <= max; v++) tickVals.add(v);
  const ticks: NlTick[] = [...tickVals]
    .sort((a, b) => a - b)
    .map((v) => ({ v, x: xOf(v), label: levels.has(v) ? fmtNum(v) : undefined, level: levels.get(v) ?? 0 }));
  const tickLevels = Math.max(-1, ...ticks.filter((t) => t.label).map((t) => t.level));

  // строки
  let cursor = 6;
  const rows: NlRowLayout[] = [];
  const allRects: Rect[] = [];
  for (const r of input.rows) {
    const tone = r.tone ?? "primary";
    const aboveLabel = !leftLabels && r.label ? 18 : 0;
    const pts = r.points ?? [];
    const placed = placePointLabelsFan(
      pts.map((p) => ({ x: xOf(p.at), text: p.label ?? "" })).filter((_, i) => !!pts[i].label),
      est,
      NL_W,
      pts.map((p) => xOf(p.at)),
    );
    const levels = placed.length ? Math.max(...placed.map((p) => p.level)) + 1 : 0;
    const jv = r.jumps ? jumpValues(r.jumps.start, r.jumps.stop, r.jumps.step) : [];
    let arcSpace = 0;
    if (r.jumps) {
      const step = Math.abs(r.jumps.step) * unit;
      arcSpace = arcPath(0, step, 0).height + 8;
    }
    const y = cursor + aboveLabel + levels * LEVEL_H + arcSpace + R + 4;
    const row: NlRowLayout = { y, tone, base: [x0 - ARROW, x1 + ARROW], ranges: [], points: [] };

    if (r.label) {
      if (leftLabels) row.label = { text: r.label, x: PAD, y: y + 4.5, anchor: "start", font: LABEL_FONT };
      else {
        const wFull = est(r.label, LABEL_FONT);
        const font = wFull > NL_W - 2 * PAD ? Math.max(10, Math.floor((LABEL_FONT * (NL_W - 2 * PAD)) / wFull)) : LABEL_FONT;
        row.label = { text: r.label, x: PAD, y: cursor + 13, anchor: "start", font };
      }
      allRects.push(labelRect(row.label, est));
    }

    for (const g of r.ranges ?? []) {
      let a = g.from === null ? x0 - ARROW : xOf(g.from);
      let b = g.to === null ? x1 + ARROW : xOf(g.to);
      const heads: string[] = [];
      if (g.from === null) {
        heads.push(arrowHead(a, y, -1));
        a += 8;
      }
      if (g.to === null) {
        heads.push(arrowHead(b, y, 1));
        b -= 8;
      }
      const dots: NlDot[] = [];
      const drops: number[] = [];
      if (g.from !== null) {
        dots.push({ x: xOf(g.from), open: !g.fromIn });
        drops.push(xOf(g.from));
      }
      if (g.to !== null) {
        dots.push({ x: xOf(g.to), open: !g.toIn });
        drops.push(xOf(g.to));
      }
      row.ranges.push({ x1: a, x2: b, heads, dots, drops: drops.map((x) => ({ x, segs: [[y + R + 1, 0]] })) });
    }

    let li = 0;
    for (const p of pts) {
      const x = xOf(p.at);
      let label: NlLabel | undefined;
      if (p.label) {
        const pl = placed[li++];
        const ly = y - R - 5 - pl.level * LEVEL_H - (r.jumps ? arcSpace : 0);
        label = { text: p.label, x: pl.x, y: ly, anchor: "middle", font: POINT_FONT };
        // подпись поднята выше точки (или сдвинута вбок настолько, что стоит не над ней): выноска показывает, чья она
        if (pl.leader) label.leader = { x, y1: ly + 4, y2: y - R - 2 };
        allRects.push(labelRect(label, est));
      }
      row.points.push({ x, open: !!p.open, label });
    }

    if (r.jumps) {
      const { stop, step } = r.jumps;
      const dots: NlDot[] = jv.map((v) => ({ x: xOf(v), open: false }));
      // пустой ход (range(5, 2)): start всё равно виден — выколотым кружком
      if (!jv.length) dots.push({ x: xOf(r.jumps.start), open: true });
      const arcs: NlArc[] = [];
      const yb = y - R - 2;
      for (let i = 0; i + 1 < jv.length; i++) {
        const a = arcPath(xOf(jv[i]), xOf(jv[i + 1]), yb);
        arcs.push({ d: a.d, head: a.head, dashed: false });
      }
      if (jv.length) {
        const last = jv[jv.length - 1];
        if (last + step === stop) {
          const a = arcPath(xOf(last), xOf(stop), yb);
          arcs.push({ d: a.d, head: a.head, dashed: true });
        }
      }
      dots.push({ x: xOf(stop), open: true });
      row.jumps = { dots, arcs, values: jv };
    }

    rows.push(row);
    cursor = y + R + 8;
  }

  const axisY = cursor + 10;
  const h = axisY + (tickLevels >= 0 ? 24 + tickLevels * TICK_LEVEL_H : 12);
  // пунктиры рвём там, где поперёк идут подписи строк и точек
  for (const row of rows) {
    for (const g of row.ranges) {
      for (const d of g.drops) d.segs = cutSegments(d.segs[0][0], axisY, d.x, allRects);
    }
  }
  return { w: NL_W, h, x0, x1, axisY, leftLabels, r: R, sw, xOf, ticks, rows };
}

// ---------- Описание для экранного диктора ----------

type Tr = (key: DictKey, params?: Record<string, string | number>) => string;

export function numberlineAria(input: NlInput, t: Tr): string {
  const parts = [t("scene.numberline.aria", { min: fmtNum(input.min), max: fmtNum(input.max) })];
  input.rows.forEach((r, i) => {
    const state = (inside: boolean | undefined) => t(inside ? "scene.numberline.in" : "scene.numberline.out");
    const items: string[] = [];
    for (const g of r.ranges ?? []) {
      const from = g.from === null ? t("scene.numberline.infNeg") : t("scene.numberline.end", { value: fmtNum(g.from), state: state(g.fromIn) });
      const to = g.to === null ? t("scene.numberline.infPos") : t("scene.numberline.end", { value: fmtNum(g.to), state: state(g.toIn) });
      items.push(t("scene.numberline.range", { from, to }));
    }
    for (const p of r.points ?? []) {
      const base = t("scene.numberline.point", { at: fmtNum(p.at), state: state(!p.open) });
      items.push(p.label ? t("scene.numberline.pointLabel", { point: base, label: p.label }) : base);
    }
    if (r.jumps) {
      const list = jumpValues(r.jumps.start, r.jumps.stop, r.jumps.step).map(fmtNum).join(", ");
      items.push(
        t("scene.numberline.jumps", {
          step: fmtNum(r.jumps.step),
          start: fmtNum(r.jumps.start),
          stop: fmtNum(r.jumps.stop),
          list: list || t("scene.numberline.none"),
        }),
      );
    }
    const name = r.label || t("scene.numberline.row", { n: i + 1 });
    parts.push(t("scene.numberline.rowLine", { name, parts: items.join("; ") }));
  });
  return parts.join(" ");
}
