// Раскладка диаграмм (чистая логика, без React): шкала Y, подписи категорий, столбцы, ломаные, секторы.
// Компонент ChartScene только рисует то, что вернул chartLayout. Все размеры — в единицах viewBox шириной CHART_W.

import type { DictKey } from "@/i18n/dict";
import type { SceneTone } from "@/lib/types";
import { estimateTextWidth } from "./text-width";

export const CHART_W = 360;
const PAD_R = 10;
const PLOT_H = 168;
const GAP_IN_GROUP = 2;
const MAX_BAR_W = 46;
const MAX_GROUP_BAR_W = 34;
const THRESHOLD_FONT = 11;

/** Тоны серий по умолчанию (красный — только «неверно», поэтому danger не берём). */
export const DEFAULT_TONES: SceneTone[] = ["primary", "gold", "success", "ai"];

export function toneVar(tone: SceneTone): string {
  return `var(--${tone})`;
}

/** Цвета секторов: 4 чистых тона, затем светлые и тёмные оттенки (соседние всегда различаются). */
export const PIE_COLORS: string[] = (() => {
  const base = ["primary", "gold", "success", "ai"].map((t) => `var(--${t})`);
  return [
    ...base,
    ...base.map((c) => `color-mix(in srgb, ${c} 55%, var(--surface))`),
    ...base.map((c) => `color-mix(in srgb, ${c} 70%, var(--text))`),
  ];
})();

// ---------- Числа ----------

/** Число для подписи: до 2 знаков после запятой, группы разрядов пробелом (≥ 10 000), запятая как у нас принято. */
export function formatNum(v: number): string {
  const r = Math.round(v * 100) / 100;
  const [int, frac] = String(Math.abs(r)).split(".");
  const grouped = int.length >= 5 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : int;
  return `${r < 0 ? "-" : ""}${grouped}${frac ? `,${frac}` : ""}`;
}

export function formatValue(v: number, unit?: string): string {
  const n = formatNum(v);
  if (!unit) return n;
  return unit === "%" ? `${n}%` : `${n} ${unit}`;
}

/**
 * «Круглая» шкала Y от нуля: шаг 1, 2 или 5 · 10ᵏ, 3–5 интервалов (4–6 меток вместе с нулём), верхняя метка ≥ max.
 */
export function niceScale(maxValue: number): { max: number; step: number; ticks: number[] } {
  const m = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 1;
  const exp = Math.floor(Math.log10(m));
  let step = 0;
  // Перебираем шаги по возрастанию: от десятой доли порядка до порядка выше.
  search: for (let e = exp - 2; e <= exp + 1; e++) {
    for (const mant of [1, 2, 5]) {
      const s = mant * Math.pow(10, e);
      if (Math.ceil(m / s - 1e-9) <= 5) {
        step = s;
        break search;
      }
    }
  }
  const n = Math.max(1, Math.ceil(m / step - 1e-9));
  const digits = Math.max(0, 2 - exp + 2);
  const ticks = Array.from({ length: n + 1 }, (_, i) => Number((i * step).toFixed(digits)));
  return { max: ticks[n], step, ticks };
}

// ---------- Подбор текста ----------

export type FittedText = { lines: string[]; font: number };

/** Жадный перенос по словам: null, если не уместилось в maxLines строк шириной maxW. */
export function wrapWords(text: string, maxW: number, font: number, maxLines: number): string[] | null {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (estimateTextWidth(w, font) > maxW) return null;
    const next = cur ? `${cur} ${w}` : w;
    if (!cur || estimateTextWidth(next, font) <= maxW) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  lines.push(cur);
  return lines.length <= maxLines ? lines : null;
}

/** Грубый перенос по буквам — запасной вариант для очень длинного слова. */
function wrapChars(text: string, maxW: number, font: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of text) {
    if (cur && estimateTextWidth(cur + ch, font) > maxW) {
      lines.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Уменьшает кегль от font0 до minFont, пока текст не уместится в maxLines строк шириной maxW; иначе — перенос по буквам. */
export function fitText(text: string, maxW: number, font0: number, minFont: number, maxLines: number): FittedText {
  for (let f = font0; f >= minFont; f--) {
    const lines = wrapWords(text, maxW, f, maxLines);
    if (lines) return { lines, font: f };
  }
  return { lines: wrapChars(text, maxW, minFont), font: minFont };
}

// ---------- Секторы ----------

export type Sector = { start: number; end: number; mid: number; frac: number };

/** Углы секторов в радианах: старт сверху (−90°), по часовой стрелке. */
export function sectorAngles(values: number[]): Sector[] {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  let a = -Math.PI / 2;
  return values.map((v) => {
    const frac = v / total;
    const start = a;
    const end = a + frac * Math.PI * 2;
    a = end;
    return { start, end, mid: (start + end) / 2, frac };
  });
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Путь сектора (клин). Полный круг (одна категория = 100%) — «circle» рисует компонент. */
export function sectorPath(cx: number, cy: number, r: number, s: Sector): string {
  const x1 = cx + r * Math.cos(s.start);
  const y1 = cy + r * Math.sin(s.start);
  const x2 = cx + r * Math.cos(s.end);
  const y2 = cy + r * Math.sin(s.end);
  const large = s.end - s.start > Math.PI ? 1 : 0;
  return `M${r1(cx)} ${r1(cy)}L${r1(x1)} ${r1(y1)}A${r1(r)} ${r1(r)} 0 ${large} 1 ${r1(x2)} ${r1(y2)}Z`;
}

/** Раздвигает подписи по вертикали, чтобы между соседними было не меньше gap; всё в пределах [min, max]. */
export function spreadLabels(ys: number[], gap: number, min: number, max: number): number[] {
  const idx = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]);
  const out = [...ys];
  let prev = min - gap;
  for (const i of idx) {
    out[i] = Math.max(ys[i], prev + gap);
    prev = out[i];
  }
  let next = max + gap;
  for (const i of [...idx].reverse()) {
    out[i] = Math.min(out[i], next - gap);
    next = out[i];
  }
  return out;
}

// ---------- Вход и выход раскладки ----------

export type ChartInput = {
  type: "bar" | "line" | "pie";
  labels: string[];
  series: { name?: string; values: number[]; tone: SceneTone }[];
  values: boolean;
  unit?: string;
  threshold?: { value: number; label?: string };
  highlight: number[];
  funnel: boolean;
  axes?: { x?: string; y?: string };
  /** Короткая фраза «от предыдущего» (строка словаря) для подписи воронки. */
  funnelFrom: string;
  /** Пояснение под диаграммой, если «от предыдущего» в подписи не влезло: «% — доля от предыдущего столбца». */
  funnelNote: string;
};

export type TextPiece = { lines: string[]; font: number };
export type LegendItem = { x: number; y: number; swatch: string; text: TextPiece };
export type Legend = { items: LegendItem[]; height: number };

export type CatLabel = { x: number; lines: string[] };
type CatLayout = { rotate: boolean; font: number; labels: CatLabel[]; height: number; minLeft: number };

type Frame = {
  w: number;
  h: number;
  padL: number;
  plotTop: number;
  plotW: number;
  plotH: number;
  slot: number;
  scale: { max: number; step: number; ticks: number[] };
  ticks: { v: number; y: number; text: string }[];
  yTitle?: string;
  xTitle?: { text: string; y: number };
  cats: CatLayout;
  legend?: Legend;
  threshold?: { y: number; text: string; font: number; x: number; ty: number; anchor: "start" | "end" };
  band: { x: number; w: number }[];
  highlight: Set<number>;
};

export type BarChartLayout = Frame & {
  type: "bar";
  bars: { key: string; s: number; i: number; x: number; y: number; w: number; h: number; tone: SceneTone; dim: boolean }[];
  valueLabels: { key: string; x: number; y: number; text: string; font: number; dim: boolean }[];
  /** true — значения не подписаны, потому что столбцы слишком узкие (цифры остаются в aria). */
  valuesHidden: boolean;
  funnelChips: { i: number; x: number; y: number; lines: string[]; font: number }[];
  /** Пояснение «% — от предыдущего», если в самой подписи места не хватило. */
  funnelNote?: { text: string; y: number };
};

export type LineChartLayout = Frame & {
  type: "line";
  lines: { s: number; tone: SceneTone; d: string }[];
  points: { key: string; s: number; i: number; x: number; y: number; r: number; tone: SceneTone }[];
  valueLabels: { key: string; x: number; y: number; text: string; font: number }[];
};

export type PieChartLayout = {
  type: "pie";
  w: number;
  h: number;
  cx: number;
  cy: number;
  r: number;
  full: boolean;
  sectors: {
    i: number;
    path: string;
    color: string;
    dx: number;
    dy: number;
    dim: boolean;
    /** Выноска ломаной: от края сектора по радиусу, затем колено к подписи. */
    leader?: { pts: [number, number][] };
    label?: { x: number; y: number; anchor: "start" | "end"; text: string };
  }[];
  labelFont: number;
  legend: Legend;
};

export type ChartLayout = BarChartLayout | LineChartLayout | PieChartLayout;

// ---------- Легенда ----------

/** Легенда: квадратик + название, ряды переносятся по ширине; названия, не влезающие в строку, сжимаются/переносятся. */
export function legendLayout(entries: { text: string; swatch: string }[], top: number, w = CHART_W): Legend {
  const SW = 10;
  const GAP = 5;
  const SEP = 14;
  const maxItemW = w - 16;
  const font = 11;
  const items = entries.map((e) => {
    const text = fitText(e.text, maxItemW - SW - GAP, font, 10, 2);
    const tw = Math.max(...text.lines.map((ln) => estimateTextWidth(ln, text.font)));
    return { e, text, width: SW + GAP + tw };
  });
  // Ряды.
  const rows: (typeof items)[] = [];
  let cur: typeof items = [];
  let curW = 0;
  for (const it of items) {
    const add = it.width + (cur.length ? SEP : 0);
    if (cur.length && curW + add > maxItemW) {
      rows.push(cur);
      cur = [];
      curW = 0;
    }
    curW += it.width + (cur.length ? SEP : 0);
    cur.push(it);
  }
  if (cur.length) rows.push(cur);
  const out: LegendItem[] = [];
  let y = top;
  for (const row of rows) {
    const rowW = row.reduce((a, it, k) => a + it.width + (k ? SEP : 0), 0);
    let x = (w - rowW) / 2;
    const rowH = Math.max(...row.map((it) => it.text.lines.length)) * (font + 3) + 4;
    for (const it of row) {
      out.push({ x, y, swatch: it.e.swatch, text: it.text });
      x += it.width + SEP;
    }
    y += rowH;
  }
  return { items: out, height: y - top };
}

// ---------- Подписи категорий ----------

function categoryLayout(labels: string[], centers: number[], slot: number): CatLayout {
  for (const font of [11, 10]) {
    const wrapped = labels.map((t) => wrapWords(t, slot - 4, font, 2));
    if (wrapped.every((w) => w !== null)) {
      const maxLines = Math.max(...wrapped.map((w) => w!.length));
      return {
        rotate: false,
        minLeft: Infinity,
        font,
        labels: wrapped.map((w, i) => ({ x: centers[i], lines: w! })),
        height: maxLines * (font + 3) + 8,
      };
    }
  }
  // Наклон −45°: одна строка на подпись, конец текста у столбца.
  const font = 10;
  const maxW = Math.max(...labels.map((t) => estimateTextWidth(t, font)));
  // Левый край наклонной подписи: конец у x+3, текст уходит влево-вниз на w·cos45, плюс высота букв.
  const minLeft = Math.min(...labels.map((t, i) => centers[i] + 3 - estimateTextWidth(t, font) * Math.SQRT1_2 - font * 0.55));
  return {
    rotate: true,
    minLeft,
    font,
    labels: labels.map((t, i) => ({ x: centers[i], lines: [t] })),
    height: Math.ceil(maxW * Math.SQRT1_2 + font) + 8,
  };
}

// ---------- Общая рамка (bar, line) ----------

function buildFrame(input: ChartInput): Frame & { headroom: number } {
  const k = input.labels.length;
  const all = input.series.flatMap((s) => s.values);
  const topValue = Math.max(0, ...all, input.threshold?.value ?? 0);
  const scale = niceScale(topValue);
  const tickTexts = scale.ticks.map((v) => formatNum(v));
  const yLabelW = Math.max(...tickTexts.map((t) => estimateTextWidth(t, 11)));
  let padL = Math.max(22, Math.ceil(yLabelW) + 10);
  let plotW = CHART_W - padL - PAD_R;
  let slot = plotW / k;
  let centers = Array.from({ length: k }, (_, i) => padL + slot * (i + 0.5));
  let cats = categoryLayout(input.labels, centers, slot);
  // Наклонные подписи не должны выходить за левый край: при нехватке места сдвигаем рамку вправо.
  for (let n = 0; n < 5 && cats.rotate && cats.minLeft < 2; n++) {
    padL += Math.ceil(2 - cats.minLeft);
    plotW = CHART_W - padL - PAD_R;
    slot = plotW / k;
    centers = Array.from({ length: k }, (_, i) => padL + slot * (i + 0.5));
    cats = categoryLayout(input.labels, centers, slot);
  }

  // Запас над графиком: заголовок оси Y, подписи значений, воронка.
  let headroom = 8;
  if (input.axes?.y) headroom += 14;
  // Подпись порога стоит над линией: если порог у верхней метки шкалы, нужен запас сверху.
  if (input.threshold) {
    const gap = PLOT_H * (1 - Math.min(Math.max(input.threshold.value, 0), scale.max) / scale.max);
    headroom = Math.max(headroom, THRESHOLD_FONT + 8 - gap);
  }
  const plotTop = headroom; // уточняется ниже (bar добавляет место под подписи)

  const f: Frame & { headroom: number } = {
    w: CHART_W,
    h: 0,
    padL,
    plotTop,
    plotW,
    plotH: PLOT_H,
    slot,
    scale,
    ticks: scale.ticks.map((v, i) => ({ v, y: 0, text: tickTexts[i] })),
    yTitle: input.axes?.y,
    cats,
    band: centers.map((c) => ({ x: c - slot / 2, w: slot })),
    highlight: new Set(input.highlight),
    headroom,
  };
  return f;
}

/** Завершает рамку: считает y меток и порога, хвост (подписи категорий, ось X, легенда), общую высоту.
 *  obstacles — рамки подписей значений: подпись порога встаёт туда, где с ними не пересекается. Возвращает рамку подписи порога. */
function finishFrame(f: Frame & { headroom: number }, input: ChartInput, plotTop: number, extraBottom: number, obstacles: Box[] = []): Box | undefined {
  f.plotTop = plotTop;
  const y = (v: number) => plotTop + f.plotH * (1 - Math.min(Math.max(v, 0), f.scale.max) / f.scale.max);
  f.ticks = f.ticks.map((t) => ({ ...t, y: y(t.v) }));
  let thrBox: Box | undefined;
  if (input.threshold) {
    const text = input.threshold.label ?? formatValue(input.threshold.value, input.unit);
    const fit = fitText(text, f.plotW - 6, THRESHOLD_FONT, 10, 1);
    const ty = y(input.threshold.value);
    const str = fit.lines.join(" ");
    const w = estimateTextWidth(str, fit.font);
    const right = f.padL + f.plotW;
    // Варианты места: справа над линией, слева над, справа под, слева под.
    const cands = [
      { anchor: "end" as const, base: ty - 5 },
      { anchor: "start" as const, base: ty - 5 },
      { anchor: "end" as const, base: ty + fit.font + 3 },
      { anchor: "start" as const, base: ty + fit.font + 3 },
    ].map((c) => {
      const x = c.anchor === "end" ? right - 2 : f.padL + 2;
      const box: Box = { x1: c.anchor === "end" ? x - w : x, x2: c.anchor === "end" ? x : x + w, y1: c.base - fit.font, y2: c.base + 2 };
      const inside = box.y1 >= 1 && box.y2 <= plotTop + f.plotH + 1;
      const hits = obstacles.filter((b) => overlaps(box, b)).length;
      return { ...c, x, box, inside, hits };
    });
    const best = cands.find((c) => c.inside && c.hits === 0) ?? [...cands].filter((c) => c.inside).sort((a, b) => a.hits - b.hits)[0] ?? cands[0];
    f.threshold = { y: ty, text: str, font: fit.font, x: best.x, ty: best.base, anchor: best.anchor };
    thrBox = best.box;
  }
  let bottom = plotTop + f.plotH + f.cats.height;
  if (input.axes?.x) {
    f.xTitle = { text: input.axes.x, y: bottom + 8 };
    bottom += 18;
  }
  bottom += extraBottom;
  if (input.series.length > 1) {
    const legend = legendLayout(
      input.series.map((s, i) => ({ text: s.name ?? String(i + 1), swatch: toneVar(s.tone) })),
      bottom + 4,
    );
    f.legend = legend;
    bottom += 4 + legend.height;
  }
  f.h = Math.ceil(bottom + 6);
  return thrBox;
}

// ---------- Столбцы ----------

/** Процент «от предыдущего»: целое, «—» если предыдущее 0. */
export function funnelPercent(prev: number, cur: number): string {
  if (!(prev > 0)) return "—";
  const p = Math.round((cur / prev) * 100);
  return p > 999 ? ">999%" : `${p}%`;
}

function barLayout(input: ChartInput): BarChartLayout {
  const f = buildFrame(input);
  const k = input.labels.length;
  const ns = input.series.length;
  const hl = f.highlight;
  const anyHl = hl.size > 0;

  // Ширина столбцов.
  const groupW = f.slot * 0.78;
  const barW = ns === 1 ? Math.min(groupW, MAX_BAR_W) : Math.min((groupW - (ns - 1) * GAP_IN_GROUP) / ns, MAX_GROUP_BAR_W);
  const pitch = barW + (ns > 1 ? GAP_IN_GROUP : 0);
  const gw = barW * ns + GAP_IN_GROUP * (ns - 1);

  // Подписи значений: кегль, при котором соседние не наезжают друг на друга.
  const texts = input.series.map((s) => s.values.map((v) => formatValue(v, input.unit)));
  let valueFont = 0;
  if (input.values) {
    const widest = Math.max(...texts.flat().map((t) => estimateTextWidth(t, 1)));
    const room = (ns === 1 ? f.slot : pitch) - 3;
    for (const fs of [12, 11, 10]) {
      if (widest * fs <= room) {
        valueFont = fs;
        break;
      }
    }
  }
  const valuesHidden = input.values && valueFont === 0;

  // Воронка: подпись «N%» (и «от предыдущего», если влезает) над каждым столбцом, кроме первого.
  let chipFont = 0;
  let chipTwoLines = false;
  const pcts = input.funnel ? input.series[0].values.map((v, i) => (i === 0 ? "" : funnelPercent(input.series[0].values[i - 1], v))) : [];
  if (input.funnel) {
    const widest = Math.max(...pcts.map((p) => estimateTextWidth(p, 1)));
    for (const fs of [11, 10]) {
      if (widest * fs <= f.slot - 2) {
        chipFont = fs;
        break;
      }
    }
    chipTwoLines = chipFont > 0 && estimateTextWidth(input.funnelFrom, chipFont) <= f.slot - 2;
  }
  const chipLines = chipTwoLines ? 2 : 1;
  const chipH = chipFont ? chipLines * (chipFont + 2) + 4 : 0;
  const valueH = valueFont ? valueFont + 5 : 0;
  const plotTop = f.headroom + valueH + chipH;

  const yOf = (v: number) => plotTop + f.plotH * (1 - v / f.scale.max);
  const base = plotTop + f.plotH;

  const bars: BarChartLayout["bars"] = [];
  const valueLabels: BarChartLayout["valueLabels"] = [];
  for (let i = 0; i < k; i++) {
    const cx = f.padL + f.slot * (i + 0.5);
    const x0 = cx - gw / 2;
    for (let s = 0; s < ns; s++) {
      const v = input.series[s].values[i];
      const top = yOf(v);
      const x = x0 + s * pitch;
      bars.push({ key: `${s}-${i}`, s, i, x, y: top, w: barW, h: Math.max(0, base - top), tone: input.series[s].tone, dim: anyHl && !hl.has(i) });
      if (valueFont) valueLabels.push({ key: `${s}-${i}`, x: x + barW / 2, y: top - 4, text: texts[s][i], font: valueFont, dim: anyHl && !hl.has(i) });
    }
  }

  const funnelChips: BarChartLayout["funnelChips"] = [];
  if (chipFont) {
    for (let i = 1; i < k; i++) {
      const cx = f.padL + f.slot * (i + 0.5);
      const top = yOf(input.series[0].values[i]) - 4 - (valueFont ? valueFont + 3 : 0);
      funnelChips.push({
        i,
        x: cx,
        y: top - (chipLines - 1) * (chipFont + 2),
        lines: chipTwoLines ? [pcts[i], input.funnelFrom] : [pcts[i]],
        font: chipFont,
      });
    }
  }
  const needNote = input.funnel && !chipTwoLines;

  const vBox = (v: { x: number; y: number; text: string; font: number }): Box => {
    const hw = estimateTextWidth(v.text, v.font) / 2;
    return { x1: v.x - hw, x2: v.x + hw, y1: v.y - v.font, y2: v.y + 2 };
  };
  const cBox = (c: BarChartLayout["funnelChips"][number]): Box => {
    const hw = Math.max(...c.lines.map((ln) => estimateTextWidth(ln, c.font))) / 2;
    return { x1: c.x - hw, x2: c.x + hw, y1: c.y - c.font, y2: c.y + (c.lines.length - 1) * (c.font + 2) + 2 };
  };
  // Подпись порога не ложится на столбцы и на подписи значений: ищем место без наложений.
  const barBoxes: Box[] = bars.map((b) => ({ x1: b.x, x2: b.x + b.w, y1: b.y, y2: b.y + b.h }));
  const thr = finishFrame(f, input, plotTop, needNote ? 16 : 0, [...valueLabels.map(vBox), ...funnelChips.map(cBox), ...barBoxes]);
  // Если место для подписи порога так и не нашлось без наложений, прячем конфликтующие подписи значений (цифры остаются в aria).
  if (thr) {
    for (let n = valueLabels.length - 1; n >= 0; n--) if (overlaps(thr, vBox(valueLabels[n]))) valueLabels.splice(n, 1);
    for (let n = funnelChips.length - 1; n >= 0; n--) if (overlaps(thr, cBox(funnelChips[n]))) funnelChips.splice(n, 1);
  }
  const noteY = f.xTitle ? f.xTitle.y + 14 : plotTop + f.plotH + f.cats.height + 12;
  return {
    ...f,
    type: "bar",
    bars,
    valueLabels,
    valuesHidden,
    funnelChips,
    funnelNote: needNote ? { text: input.funnelNote, y: noteY } : undefined,
  };
}

// ---------- Линии ----------

type Box = { x1: number; y1: number; x2: number; y2: number };
const overlaps = (a: Box, b: Box) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

function lineLayout(input: ChartInput): LineChartLayout {
  const f = buildFrame(input);
  const k = input.labels.length;
  const ns = input.series.length;
  const plotTop = f.headroom + (input.values ? 14 : 0);
  const yOf = (v: number) => plotTop + f.plotH * (1 - v / f.scale.max);
  const r = k > 8 ? 3 : 4;

  const lines: LineChartLayout["lines"] = [];
  const points: LineChartLayout["points"] = [];
  for (let s = 0; s < ns; s++) {
    const pts = input.series[s].values.map((v, i) => ({ x: f.padL + f.slot * (i + 0.5), y: yOf(v) }));
    lines.push({ s, tone: input.series[s].tone, d: pts.map((p, i) => `${i ? "L" : "M"}${r1(p.x)} ${r1(p.y)}`).join("") });
    pts.forEach((p, i) => points.push({ key: `${s}-${i}`, s, i, x: p.x, y: p.y, r: f.highlight.has(i) ? r + 1.5 : r, tone: input.series[s].tone }));
  }

  // Подписи значений: над точкой, иначе под ней; пересекающиеся с уже поставленными не рисуем.
  const valueLabels: LineChartLayout["valueLabels"] = [];
  if (input.values) {
    const font = k > 8 || ns > 2 ? 10 : 11;
    const placed: Box[] = points.map((p) => ({ x1: p.x - p.r, y1: p.y - p.r, x2: p.x + p.r, y2: p.y + p.r }));
    for (const p of points) {
      const text = formatValue(input.series[p.s].values[p.i], input.unit);
      const w = estimateTextWidth(text, font);
      const x = Math.min(CHART_W - 2 - w / 2, Math.max(f.padL + w / 2, p.x));
      for (const dir of [-1, 1]) {
        const base = dir < 0 ? p.y - p.r - 3 : p.y + p.r + font + 1;
        const box = { x1: x - w / 2, x2: x + w / 2, y1: base - font, y2: base + 2 };
        if (box.y1 < 0 || box.y2 > plotTop + f.plotH + 2) continue;
        if (placed.some((b) => b !== undefined && overlaps(box, b))) continue;
        placed.push(box);
        valueLabels.push({ key: p.key, x, y: base, text, font });
        break;
      }
    }
  }

  const thr = finishFrame(f, input, plotTop, 0, [
    ...points.map((p) => ({ x1: p.x - p.r, y1: p.y - p.r, x2: p.x + p.r, y2: p.y + p.r })),
    ...valueLabels.map((v) => {
      const hw = estimateTextWidth(v.text, v.font) / 2;
      return { x1: v.x - hw, x2: v.x + hw, y1: v.y - v.font, y2: v.y + 2 };
    }),
  ]);
  if (thr) {
    for (let n = valueLabels.length - 1; n >= 0; n--) {
      const v = valueLabels[n];
      const hw = estimateTextWidth(v.text, v.font) / 2;
      if (overlaps(thr, { x1: v.x - hw, x2: v.x + hw, y1: v.y - v.font, y2: v.y + 2 })) valueLabels.splice(n, 1);
    }
  }
  return { ...f, type: "line", lines, points, valueLabels };
}

// ---------- Круг ----------

function pieLayout(input: ChartInput): PieChartLayout {
  const vals = input.series[0].values;
  const total = vals.reduce((a, b) => a + b, 0);
  const secs = sectorAngles(vals);
  const hl = new Set(input.highlight);
  const anyHl = hl.size > 0;
  const texts = vals.map((v) => (input.values ? formatValue(v, input.unit) : `${Math.round((v / total) * 100)}%`));
  let labelFont = 12;
  let maxLabelW = Math.max(...texts.map((t) => estimateTextWidth(t, labelFont)));
  while (maxLabelW > 100 && labelFont > 10) {
    labelFont -= 1;
    maxLabelW = Math.max(...texts.map((t) => estimateTextWidth(t, labelFont)));
  }
  const EXPLODE = 7;
  const r = Math.max(44, Math.min(80, 150 - maxLabelW));
  const cx = CHART_W / 2;
  const top = EXPLODE + 12;
  const cy = top + r;
  const areaH = 2 * (r + EXPLODE + 12);
  const full = vals.filter((v) => v > 0).length === 1;

  type Pending = { i: number; side: 1 | -1; y: number };
  const pending: Pending[] = [];
  secs.forEach((s, i) => {
    if (vals[i] <= 0) return;
    const ex = hl.has(i) ? EXPLODE : 0;
    pending.push({ i, side: Math.cos(s.mid) >= 0 ? 1 : -1, y: cy + Math.sin(s.mid) * (r + ex + 16) });
  });
  const ys = new Map<number, number>();
  for (const side of [1, -1] as const) {
    const grp = pending.filter((p) => p.side === side);
    const spread = spreadLabels(grp.map((p) => p.y), labelFont + 3, 8, areaH - 8);
    grp.forEach((p, n) => ys.set(p.i, spread[n]));
  }
  // Радиус «колонки» подписей: от центра, с запасом над самым выдвинутым сектором.
  const R = r + EXPLODE + 14;
  const halfH = labelFont * 0.5 + 1;

  const sectors: PieChartLayout["sectors"] = secs.map((s, i) => {
    const ex = hl.has(i) ? EXPLODE : 0;
    const dx = Math.cos(s.mid) * ex;
    const dy = Math.sin(s.mid) * ex;
    const color = PIE_COLORS[i % PIE_COLORS.length];
    const out: PieChartLayout["sectors"][number] = { i, path: vals[i] > 0 && !full ? sectorPath(cx, cy, r, s) : "", color, dx, dy, dim: anyHl && !hl.has(i) };
    if (vals[i] > 0) {
      const side = Math.cos(s.mid) >= 0 ? 1 : -1;
      const ly = ys.get(i) ?? cy;
      // x подписи от её новой y: ближний к центру угол рамки лежит на окружности радиуса R (над кругом — у вертикали).
      const dyNear = Math.max(0, Math.abs(ly - cy) - halfH);
      const lx = cx + side * Math.max(6, Math.sqrt(Math.max(0, R * R - dyNear * dyNear)));
      const ax = cx + Math.cos(s.mid) * (r + 2) + dx;
      const ay = cy + Math.sin(s.mid) * (r + 2) + dy;
      const kx = cx + Math.cos(s.mid) * (r + 12) + dx;
      const ky = cy + Math.sin(s.mid) * (r + 12) + dy;
      const endX = lx - side * 3;
      // Выноска: радиальный отрезок от края сектора, затем колено к подписи.
      out.leader = { pts: [[ax, ay], [kx, ky], [endX, ly]] };
      out.label = { x: lx, y: ly, anchor: side === 1 ? "start" : "end", text: texts[i] };
    }
    return out;
  });

  const legend = legendLayout(
    input.labels.map((t, i) => ({ text: t, swatch: PIE_COLORS[i % PIE_COLORS.length] })),
    areaH + 2,
  );
  return { type: "pie", w: CHART_W, h: Math.ceil(areaH + 2 + legend.height + 6), cx, cy, r, full, sectors, labelFont, legend };
}

export function chartLayout(input: ChartInput): ChartLayout {
  if (input.type === "pie") return pieLayout(input);
  return input.type === "line" ? lineLayout(input) : barLayout(input);
}

// ---------- Описание для экранного диктора ----------

type Tr = (key: DictKey, params?: Record<string, string | number>) => string;

export function chartAria(input: ChartInput, t: Tr): string {
  const items = input.labels
    .map((label, i) => {
      if (input.type === "pie" && !input.values) {
        const tot = input.series[0].values.reduce((a, b) => a + b, 0) || 1;
        return `${label}: ${formatValue(input.series[0].values[i], input.unit)} (${Math.round((input.series[0].values[i] / tot) * 100)}%)`;
      }
      if (input.series.length === 1 && input.series[0].name === undefined) return `${label}: ${formatValue(input.series[0].values[i], input.unit)}`;
      const parts = input.series.map((s) => `${s.name ? `${s.name} ` : ""}${formatValue(s.values[i], input.unit)}`);
      return `${label}: ${parts.join(", ")}`;
    })
    .join("; ");
  const key: DictKey = input.type === "bar" ? "scene.chart.ariaBar" : input.type === "line" ? "scene.chart.ariaLine" : "scene.chart.ariaPie";
  const out = [t(key, { items })];
  if (input.threshold) out.push(t("scene.chart.ariaThreshold", { value: input.threshold.label ?? formatValue(input.threshold.value, input.unit) }));
  if (input.funnel) out.push(t("scene.chart.ariaFunnel"));
  if (input.highlight.length) out.push(t("scene.chart.ariaHighlight", { items: input.highlight.map((i) => input.labels[i]).join(", ") }));
  return out.join(" ");
}
