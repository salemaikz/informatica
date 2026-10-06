import type { DictKey } from "@/i18n/dict";
import type { Scene, SceneTone, Text } from "@/lib/types";
import { estimateTextWidth } from "./text-width";

// Чистая раскладка сцены «лента ячеек» (tape): координаты в системе SVG, срезы как у Python range, уровни подписей.
// Компонент только рисует результат; всё, что может обрезаться на 360 px, считается здесь.

export type TapeData = Extract<Scene, { kind: "tape" }>;
type Tr = (key: DictKey, params?: Record<string, string | number>) => string;

/** Ширина «экрана» по умолчанию (px viewBox): телефон. Если содержимое шире — viewBox растёт, рисунок уменьшается целиком. */
export const TAPE_W = 360;
const PAD = 6;
const MIN_CELL = 18;
const MAX_CELL = 44;
const MIN_FONT = 8;
const MAX_FONT = 18;
const ROW_INDEX = 14;
/** Кегль подписей групп и границы «не включая» (viewBox px). */
export const TAPE_LABEL_FS = 11;
const LABEL_FS = TAPE_LABEL_FS;
/** Запас под «хвосты» букв (қ, у, р) ниже базовой линии подписи, px. */
export const TAPE_LABEL_DESC = 3;
const MONO_EM = 0.6;
/** Рисунок в карточке на телефоне ужимается примерно до 0.82 от viewBox (карточка с полями): 12 px viewBox ≈ 10 px на экране. */
export const TAPE_LEGIBLE_FONT = 12;
/** Кегль содержимого ячейки, когда ячейку можно расширить или перенести текст на две строки. */
const WIDE_FONT = 13;
/** Моноширинный текст длиннее переносится на строки по стольку символов (биты по 4). */
const WRAP_AT = 4;
/** Кегль индексов над и под лентой (viewBox px, ≈ 9 px на экране): не мельче; при тесноте показывается каждый k-й. */
export const TAPE_INDEX_FS = 11;
/** Высота ряда границы «не включая»: подпись и пунктир под ней. */
const STOP_ROW = 19;
/** Насколько конец дуги обмена сдвигается вбок, если на той же ячейке кончается или начинается дуга шага (стрелки не слипаются), px. */
export const TAPE_SWAP_SHIFT = 7;
/** Полуразрыв нижней дуги в месте, где её пересекает верхняя (мост), px вдоль дуги при перпендикулярном пересечении. */
export const TAPE_ARC_GAP = 3.2;
/** Подпись указателя: ширина стебля стрелки не ближе этого к краю чужой подписи, px. */
const PTR_CLEAR = 2;
/** Зазор между подписями указателей одного уровня, px (в ширину подписи уже входят поля по 1 px). */
const PTR_GAP = 0.5;
/** Зазор между подписями указателей на одной ячейке, когда они стоят в ряд, px. */
const PTR_SIDE_GAP = 4;
/** Расстояние между рядами скобок групп (px): ножки верхней скобки не касаются подписи нижней. */
export const TAPE_GROUP_ROW = 24;

/** Индексы ячеек, взятые срезом: как range(start, stop, step), только внутри ленты длины n. */
export function sliceIndices(n: number, slice: { start: number; stop: number; step?: number }): number[] {
  const step = slice.step ?? 1;
  if (!Number.isInteger(step) || step === 0) return [];
  const out: number[] = [];
  // защита от бесконечного цикла: не больше n шагов
  for (let i = slice.start, k = 0; (step > 0 ? i < slice.stop : i > slice.stop) && k <= n + 1; i += step, k++) {
    if (i >= 0 && i < n) out.push(i);
  }
  return out;
}

/** Граница «не включая» в долях ячейки (0..n): при шаге > 0 — слева от ячейки stop, при шаге < 0 — справа от неё. */
export function stopBoundary(n: number, slice: { stop: number; step?: number }): number {
  const b = (slice.step ?? 1) > 0 ? slice.stop : slice.stop + 1;
  return Math.min(n, Math.max(0, b));
}

/** Подпись индекса ячейки. */
export function indexLabel(mode: NonNullable<TapeData["index"]>, i: number, n: number, side: "top" | "bottom"): string | null {
  if (mode === "none") return null;
  if (mode === "one") return side === "top" ? String(i + 1) : null;
  if (mode === "py") return side === "top" ? String(i) : null;
  return side === "top" ? String(i) : `\u2212${n - i}`;
}

/** Ширина строки: моноширинный шрифт — по 0.6 em на символ, иначе — оценка Nunito. */
export function textWidth(text: string, fontPx: number, mono: boolean): number {
  return mono ? [...text].length * MONO_EM * fontPx : estimateTextWidth(text, fontPx);
}

/** Центр подписи, прижатый к границам [lo, hi] (если подпись шире — по центру отрезка). */
export function clampCenter(cx: number, halfW: number, lo: number, hi: number): number {
  if (hi - lo < halfW * 2) return (lo + hi) / 2;
  return Math.min(hi - halfW, Math.max(lo + halfW, cx));
}

/**
 * Уровни подписей: жадно, слева направо; подпись идёт на самый нижний уровень, где не пересекается (с зазором gap) с уже стоящими.
 * Возвращает уровень каждого элемента в исходном порядке.
 */
export function assignLevels(items: { x0: number; x1: number }[], gap = 3): number[] {
  const order = items.map((_, i) => i).sort((a, b) => items[a].x0 - items[b].x0 || a - b);
  const ends: number[] = [];
  const levels = new Array<number>(items.length).fill(0);
  for (const i of order) {
    let lv = ends.findIndex((e) => items[i].x0 >= e + gap);
    if (lv < 0) lv = ends.length;
    ends[lv] = items[i].x1;
    levels[i] = lv;
  }
  return levels;
}

/** Точка дуги на параметре t: кубическая кривая (xa, y) → (xb, y) с вершиной на высоте height (концы вертикальны). */
export function arcPoint(a: { xa: number; xb: number; y: number; height: number }, t: number): [number, number] {
  const k = a.height / 0.75;
  return [a.xa + (a.xb - a.xa) * (3 * t * t - 2 * t * t * t), a.y - 3 * k * t * (1 - t)];
}

/** Скорость движения по дуге (px на единицу параметра). */
function arcSpeed(a: { xa: number; xb: number; height: number }, t: number): number {
  const k = a.height / 0.75;
  return Math.hypot((a.xb - a.xa) * (6 * t - 6 * t * t), 3 * k * (1 - 2 * t));
}

type Pt = [number, number];
const lerp = (p: Pt, q: Pt, t: number): Pt => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

/** Разбиение кубической кривой по де Кастельжо: [левая, правая] часть. */
function splitCubic(c: [Pt, Pt, Pt, Pt], t: number): [[Pt, Pt, Pt, Pt], [Pt, Pt, Pt, Pt]] {
  const [p0, p1, p2, p3] = c;
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  const d = lerp(p2, p3, t);
  const e = lerp(a, b, t);
  const f = lerp(b, d, t);
  const g = lerp(e, f, t);
  return [[p0, a, e, g], [g, f, d, p3]];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Пути видимых кусков дуги: вся кривая минус вырезы (мосты). Без вырезов — один путь. */
export function arcSegments(a: Pick<TapeArc, "xa" | "xb" | "y" | "height" | "cuts">): string[] {
  const k = a.height / 0.75;
  const whole: [Pt, Pt, Pt, Pt] = [[a.xa, a.y], [a.xa, a.y - k], [a.xb, a.y - k], [a.xb, a.y]];
  const pieces: [number, number][] = [];
  let from = 0;
  for (const [c0, c1] of a.cuts) {
    if (c0 > from) pieces.push([from, c0]);
    from = c1;
  }
  if (from < 1) pieces.push([from, 1]);
  return pieces.map(([t0, t1]) => {
    const right = t0 > 0 ? splitCubic(whole, t0)[1] : whole;
    const c = t1 < 1 ? splitCubic(right, (t1 - t0) / (1 - t0))[0] : right;
    return `M ${r2(c[0][0])} ${r2(c[0][1])} C ${r2(c[1][0])} ${r2(c[1][1])}, ${r2(c[2][0])} ${r2(c[2][1])}, ${r2(c[3][0])} ${r2(c[3][1])}`;
  });
}

const ARC_SAMPLES = 48;

/**
 * Мосты: где поверх дуги проходит другая (дуга обмена над дугой шага, длинный обмен над коротким), в нижней делается разрыв.
 * Пересечения ищутся по ломаным (ARC_SAMPLES звеньев) и пересчитываются в параметр кривой; у самых ячеек (3 px) разрывов не бывает —
 * там стоят острия стрелок. Разрыв шире при косом пересечении.
 */
export function withBridges(arcs: Omit<TapeArc, "cuts">[]): TapeArc[] {
  const pts = arcs.map((a) => Array.from({ length: ARC_SAMPLES + 1 }, (_, i) => arcPoint(a, i / ARC_SAMPLES)));
  const above = (b: Omit<TapeArc, "cuts">, a: Omit<TapeArc, "cuts">) => (b.kind === "swap" && a.kind === "jump") || (b.kind === a.kind && b.height > a.height);
  return arcs.map((a, i) => {
    const raw: [number, number][] = [];
    arcs.forEach((b, j) => {
      if (i === j || !above(b, a)) return;
      for (let s = 0; s < ARC_SAMPLES; s++) {
        const [p, p2] = [pts[i][s], pts[i][s + 1]];
        for (let u = 0; u < ARC_SAMPLES; u++) {
          const [q, q2] = [pts[j][u], pts[j][u + 1]];
          const r = [p2[0] - p[0], p2[1] - p[1]];
          const v = [q2[0] - q[0], q2[1] - q[1]];
          const den = r[0] * v[1] - r[1] * v[0];
          if (Math.abs(den) < 1e-9) continue;
          const ta = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / den;
          const tb = ((q[0] - p[0]) * r[1] - (q[1] - p[1]) * r[0]) / den;
          if (ta < 0 || ta >= 1 || tb < 0 || tb >= 1) continue;
          const t = (s + ta) / ARC_SAMPLES;
          if (a.y - arcPoint(a, t)[1] < 3) continue;
          const sin = Math.abs(den) / (Math.hypot(r[0], r[1]) * Math.hypot(v[0], v[1]));
          const d = (TAPE_ARC_GAP - 1 + 1 / Math.max(0.4, sin)) / arcSpeed(a, t);
          raw.push([Math.max(0, t - d), Math.min(1, t + d)]);
        }
      }
    });
    raw.sort((x, y) => x[0] - y[0]);
    const cuts: [number, number][] = [];
    for (const c of raw) {
      const last = cuts[cuts.length - 1];
      if (last && c[0] <= last[1]) last[1] = Math.max(last[1], c[1]);
      else cuts.push([c[0], c[1]]);
    }
    return { ...a, cuts };
  });
}

export interface TapeCell {
  i: number;
  x: number;
  y: number;
  text: string;
  /** Строки текста в ячейке: одна, а у длинных битов — по 4 символа на строку. */
  lines: string[];
  /** sliceHl — ячейка и в срезе, и подсвечена: заливка среза, обводка подсветки (приоритет: срез задаёт заливку, подсветка не теряется). */
  state: "slice" | "sliceHl" | "highlight" | "dim" | "plain";
}
export interface TapeArc {
  key: string;
  /** Концы по x (у обмена — со сдвигом TAPE_SWAP_SHIFT, если на ячейке стоит дуга шага) и нижняя линия дуги. */
  xa: number;
  xb: number;
  y: number;
  height: number;
  kind: "jump" | "swap";
  /** Вырезы (интервалы параметра кривой 0..1): мост там, где поверх дуги проходит дуга выше (обмен над шагом, длинный обмен над коротким). */
  cuts: [number, number][];
}
export interface TapeLabelBox {
  /** Центр подписи и её ширина (оценка). */
  cx: number;
  w: number;
  y: number;
  text: string;
}

export interface TapeLayout {
  vbW: number;
  vbH: number;
  cellW: number;
  cellH: number;
  cellFs: number;
  mono: boolean;
  x0: number;
  cells: TapeCell[];
  /** Вторая лента («после»): ячейки и стрелка между лентами. */
  after: { cells: TapeCell[]; arrow: { x: number; y1: number; y2: number }; empty: { x: number; y: number; text: string } | null } | null;
  indexTop: { x: number; y: number; text: string }[];
  indexBottom: { x: number; y: number; text: string }[];
  indexFs: number;
  /** Подписывается каждая stride-я ячейка (1 — все): на узких ячейках соседние подписи не слипаются. */
  indexStrideTop: number;
  indexStrideBottom: number;
  /** Строк текста в ячейке и высота строки (px). */
  textLines: number;
  lineH: number;
  arcs: TapeArc[];
  groups: { key: string; x1: number; x2: number; y: number; label: TapeLabelBox; level: number }[];
  /**
   * Стрелка указателя — одна на всех: остриё (треугольник) у ячейки и стебель вниз до подписи; выше нулевого уровня стебель просто длиннее.
   * x — стебель и остриё (у подписи, мешающей стеблю, сдвинут к краю ячейки), yEnd — низ стебля. arrow=false — крайний случай:
   * стебель негде провести (чужая подпись шире ячейки), остаётся только подпись.
   */
  pointers: { key: string; at: number; x: number; yTop: number; yEnd: number; label: TapeLabelBox; tone: SceneTone; level: number; arrow: boolean }[];
  stop: { x: number; y1: number; y2: number; label: TapeLabelBox } | null;
  empty: { x: number; y: number; text: string } | null;
  names: { text: string; x: number; y: number; rowCy: number }[];
  /** Короткая стрелка от имён к ленте (если есть alias): x от..до, y. */
  nameArrows: { x1: number; x2: number; y: number }[];
  taken: number[];
}

const NAME_FS = 13;

/** Раскладка сцены. `txt` превращает Text в строку на языке ученика; `t` — словарь (подписи «не включая», «пусто»). */
export function tapeLayout(scene: TapeData, txt: (v: Text) => string, t: Tr): TapeLayout {
  const n = scene.cells.length;
  const after = scene.after ?? null;
  const mono = scene.mono ?? false;
  const mode = scene.index ?? "py";
  const cols = Math.max(n, after?.length ?? 0);
  const allTexts = [...scene.cells, ...(after ?? [])];

  // ---- имена слева ----
  const nameTexts = [scene.name, scene.alias].filter((s): s is string => !!s).map((s) => `${s} =`);
  const nameW = nameTexts.length ? Math.max(...nameTexts.map((s) => textWidth(s, NAME_FS, true))) : 0;
  const leftW = nameTexts.length ? nameW + (scene.alias ? 26 : 8) : 0;

  // ---- размер ячейки и шрифта ----
  const avail = TAPE_W - 2 * PAD - leftW;
  let cellW = Math.min(MAX_CELL, Math.max(MIN_CELL, Math.floor(avail / cols)));
  const baseCellW = cellW;
  const fits = (fs: number, w: number) => allTexts.every((s) => textWidth(s, fs, mono) <= w - 4);
  // Желаемый кегль: от ширины ячейки, но не мельче читаемого — одиночные знаки и короткие числа в узких ячейках (16 в ряд) тоже крупные,
  // если помещаются; иначе кегль убавляется до влезающего.
  const idealFs = Math.min(MAX_FONT, Math.max(Math.floor(cellW * 0.52), TAPE_LEGIBLE_FONT));
  let cellFs = idealFs;
  while (cellFs > MIN_FONT && !fits(cellFs, cellW)) cellFs--;
  let textLines = 1;
  if (cellFs < TAPE_LEGIBLE_FONT) {
    // Содержимое мельче читаемого: сначала расширяем ячейку (место на экране есть), иначе биты — на две строки по 4.
    const capW = Math.floor(avail / cols);
    // у расширенной ячейки поля пошире (по 5 px с каждой стороны), чтобы текст не упирался в рамку
    const need = (fs: number) => Math.ceil(Math.max(...allTexts.map((s) => textWidth(s, fs, mono))) + 10);
    let done = false;
    for (let fs = WIDE_FONT; fs >= TAPE_LEGIBLE_FONT && !done; fs--) {
      if (need(fs) <= capW) {
        cellW = Math.max(cellW, need(fs));
        cellFs = fs;
        done = true;
      }
    }
    if (!done && mono && allTexts.some((s) => [...s].length > WRAP_AT)) {
      for (let fs = WIDE_FONT; fs >= TAPE_LEGIBLE_FONT && !done; fs--) {
        const w = Math.ceil(WRAP_AT * MONO_EM * fs + 8);
        if (w <= Math.max(cellW, capW)) {
          cellW = Math.max(cellW, w);
          cellFs = fs;
          textLines = 2;
          done = true;
        }
      }
    }
  }
  if (!fits(cellFs, cellW) && textLines === 1) {
    // Даже самый мелкий шрифт не влезает — ячейка становится прямоугольной (высота прежняя, ширина по тексту);
    // рисунок целиком уменьшится вместе с viewBox. Такие сцены validate.ts не пропускает (tapeLegible: кегль не мельче 12).
    cellW = Math.ceil(Math.max(...allTexts.map((s) => textWidth(s, cellFs, mono))) + 4);
  }
  const lineH = Math.ceil(cellFs * 1.2);
  const cellH = Math.max(Math.min(MAX_CELL, Math.max(MIN_CELL, baseCellW)), textLines > 1 ? textLines * lineH + 10 : 0);
  const linesOf = (text: string): string[] => {
    if (textLines === 1 || [...text].length <= WRAP_AT) return [text];
    const chars = [...text];
    const out: string[] = [];
    for (let i = 0; i < chars.length; i += WRAP_AT) out.push(chars.slice(i, i + WRAP_AT).join(""));
    return out;
  };
  const vbW = Math.max(TAPE_W, Math.ceil(2 * PAD + leftW + cols * cellW));
  // лента выравнивается по центру свободного места, но не левее имён
  const x0 = PAD + leftW + Math.max(0, Math.floor((vbW - 2 * PAD - leftW - cols * cellW) / 2));
  const cx = (i: number) => x0 + i * cellW + cellW / 2;

  const taken = scene.slice ? sliceIndices(n, scene.slice) : [];
  const takenSet = new Set(taken);
  const hl = new Set(scene.highlight ?? []);
  const dim = new Set(scene.dim ?? []);
  const stateOf = (i: number): TapeCell["state"] => (takenSet.has(i) ? (hl.has(i) ? "sliceHl" : "slice") : hl.has(i) ? "highlight" : dim.has(i) ? "dim" : "plain");

  // ---- дуги ----
  const arcSpec: Omit<TapeArc, "cuts" | "y">[] = [];
  const step = scene.slice?.step ?? 1;
  if (scene.slice && taken.length >= 2 && step !== 1) {
    for (let k = 0; k + 1 < taken.length; k++) arcSpec.push({ key: `j${taken[k]}-${taken[k + 1]}`, xa: cx(taken[k]), xb: cx(taken[k + 1]), kind: "jump", height: 12 });
  }
  const jumpH = arcSpec.length ? 12 : 0;
  // Конец дуги обмена на ячейке, где кончается или начинается дуга шага, сдвигается на свободную сторону: острия стрелок не слипаются.
  // Свободно: у первой взятой ячейки — против хода (дуга шага уходит вперёд), у остальных — по ходу.
  const travel = step > 0 ? 1 : -1;
  const takenPos = new Map(taken.map((c, k) => [c, k]));
  const swapX = (cell: number) => {
    const k = takenPos.get(cell);
    if (!jumpH || k === undefined) return cx(cell);
    const side = k === 0 ? -travel : travel;
    return cx(cell) + side * Math.min(TAPE_SWAP_SHIFT, cellW * 0.4);
  };
  const swaps = (scene.swaps ?? []).map(([a, b], k) => ({ a, b, k, span: Math.abs(cx(a) - cx(b)) }));
  [...swaps]
    .sort((p, q) => p.span - q.span || p.k - q.k)
    .forEach((s, level) => {
      arcSpec.push({ key: `s${s.a}-${s.b}-${s.k}`, xa: swapX(s.a), xb: swapX(s.b), kind: "swap", height: (jumpH ? jumpH + 4 : 0) + 14 + 9 * level + Math.min(10, s.span * 0.1) });
    });
  const arcZone = arcSpec.length ? Math.ceil(Math.max(...arcSpec.map((a) => a.height)) + 8) : 0;

  // ---- группы (скобки с подписью) ----
  const groupItems = (scene.groups ?? []).map((g, k) => {
    const text = txt(g.label);
    const w = textWidth(text, LABEL_FS, false) + 4;
    const mid = (cx(g.from) + cx(g.to)) / 2;
    const c = clampCenter(mid, w / 2, 2, vbW - 2);
    const bx1 = cx(g.from) - cellW / 2 + 2;
    const bx2 = cx(g.to) + cellW / 2 - 2;
    return { k, g, text, w, c, bx1, bx2 };
  });
  // уровень считаем по объединению скобки и подписи: чужая скобка не повисает над соседней подписью
  const groupLevels = assignLevels(groupItems.map((it) => ({ x0: Math.min(it.bx1, it.c - it.w / 2), x1: Math.max(it.bx2, it.c + it.w / 2) })));
  const groupLv = groupItems.length ? Math.max(...groupLevels) + 1 : 0;
  const GROUP_ROW = TAPE_GROUP_ROW;
  const groupZone = groupLv * GROUP_ROW;

  // ---- вертикаль ----
  // граница «не включая» не нужна, если совпадает с краем ленты (ничего не исключено)
  const stopB = scene.slice ? stopBoundary(n, scene.slice) : 0;
  const hasStop = !!scene.slice && !((scene.slice.step ?? 1) > 0 ? stopB === n : stopB === 0);
  let y = 4;
  const stopRowY = y;
  if (hasStop) y += STOP_ROW;
  const arcBase = y + arcZone; // нижняя линия дуг
  y = arcBase;
  const groupTop = y;
  y += groupZone;
  const indexTopY = y;
  if (mode !== "none") y += ROW_INDEX;
  const cellsY = y;
  y += cellH;
  const bottomIdx = mode === "both";
  const indexBottomY = y;
  if (bottomIdx) y += ROW_INDEX;

  // ---- указатели ----
  // Два указателя и больше на одной ячейке: если подписи помещаются рядом в ширину ячейки, встают в ряд (стрелка над каждой подписью);
  // иначе — друг под другом (ниже), а стебель нижней сдвигается за край верхней подписи.
  // Уровни — по порядку ячеек (при одной ячейке — по порядку в сцене): ближе к ленте встаёт тот, кто раньше.
  const ptrItems = (scene.pointers ?? []).map((p, k) => {
    const w = textWidth(p.label, 12, true) + 2;
    const ax = cx(p.at);
    return { k, p, w, ax, c: clampCenter(ax, w / 2, 2, vbW - 2) };
  });
  const onCell = new Map<number, number[]>();
  ptrItems.forEach((it, i) => onCell.set(it.p.at, [...(onCell.get(it.p.at) ?? []), i]));
  for (const [at, ids] of onCell) {
    if (ids.length < 2) continue;
    const total = ids.reduce((sum, i) => sum + ptrItems[i].w, 0) + (ids.length - 1) * PTR_SIDE_GAP;
    if (total > cellW - 2) continue;
    let x = cx(at) - total / 2;
    for (const i of ids) {
      ptrItems[i].ax = x + ptrItems[i].w / 2;
      ptrItems[i].c = ptrItems[i].ax;
      x += ptrItems[i].w + PTR_SIDE_GAP;
    }
  }
  const ptrLevels = new Array<number>(ptrItems.length).fill(0);
  const placed: { lv: number; x0: number; x1: number }[] = [];
  for (const i of ptrItems.map((_, k) => k).sort((a, b) => ptrItems[a].p.at - ptrItems[b].p.at || a - b)) {
    const it = ptrItems[i];
    let lv = 0;
    while (placed.some((o) => o.lv === lv && it.c - it.w / 2 < o.x1 + PTR_GAP && it.c + it.w / 2 > o.x0 - PTR_GAP)) lv++;
    ptrLevels[i] = lv;
    placed.push({ lv, x0: it.c - it.w / 2, x1: it.c + it.w / 2 });
  }
  const ptrLv = ptrItems.length ? Math.max(...ptrLevels) + 1 : 0;
  // Стебель стрелки нижнего уровня не должен проходить сквозь подпись более близкого уровня. Если проходит — стрелка сдвигается к краю
  // ячейки (за край чужой подписи), и подпись встаёт под ней; если и так не выходит (подпись шире ячейки) — остаётся одна подпись.
  const ptrPos = new Map<number, { x: number; c: number; arrow: boolean }>();
  const byLevel = ptrItems.map((_, k) => k).sort((a, b) => ptrLevels[a] - ptrLevels[b] || ptrItems[a].p.at - ptrItems[b].p.at || a - b);
  for (const i of byLevel) {
    const it = ptrItems[i];
    const home = it.ax;
    if (ptrLevels[i] === 0) {
      ptrPos.set(i, { x: home, c: it.c, arrow: true });
      continue;
    }
    const lower = byLevel.filter((j) => ptrLevels[j] < ptrLevels[i]);
    const blocked = (x: number) => lower.some((j) => Math.abs(x - ptrPos.get(j)!.c) < ptrItems[j].w / 2 + PTR_CLEAR - 0.01);
    if (!blocked(home)) {
      ptrPos.set(i, { x: home, c: it.c, arrow: true });
      continue;
    }
    // кандидаты: сразу за краем каждой мешающей подписи, не дальше края ячейки (остриё остаётся над своей ячейкой)
    const limit = cellW / 2 - 2.5;
    const sameLevel = byLevel.filter((j) => j !== i && ptrLevels[j] === ptrLevels[i] && ptrPos.has(j));
    const cands = lower
      .flatMap((j) => [ptrPos.get(j)!.c - ptrItems[j].w / 2 - PTR_CLEAR, ptrPos.get(j)!.c + ptrItems[j].w / 2 + PTR_CLEAR])
      .filter((x) => Math.abs(x - cx(it.p.at)) <= limit && !blocked(x))
      .sort((a, b) => Math.abs(a - home) - Math.abs(b - home) || b - a);
    const free = (c: number) =>
      sameLevel.every((j) => c + it.w / 2 + PTR_GAP <= ptrPos.get(j)!.c - ptrItems[j].w / 2 || c - it.w / 2 - PTR_GAP >= ptrPos.get(j)!.c + ptrItems[j].w / 2);
    const found = cands.map((x) => ({ x, c: clampCenter(x, it.w / 2, 2, vbW - 2) })).find((o) => free(o.c));
    ptrPos.set(i, found ? { x: found.x, c: found.c, arrow: true } : { x: home, c: it.c, arrow: false });
  }
  const ptrTop = y + 1;
  const PTR_ARROW = 10;
  const PTR_ROW = 15;
  if (ptrLv) y += PTR_ARROW + ptrLv * PTR_ROW + 2;

  let empty: TapeLayout["empty"] = null;
  if (scene.slice && taken.length === 0) {
    empty = { x: x0 + (n * cellW) / 2, y: y + 9, text: t("scene.tape.empty") };
    y += 18;
  }

  // ---- вторая лента ----
  let afterBlock: TapeLayout["after"] = null;
  const afterCells: TapeCell[] = [];
  let afterY = 0;
  if (after) {
    const gap = 26;
    const arrow = { x: x0 + (cols * cellW) / 2, y1: y + 4, y2: y + gap - 4 };
    y += gap;
    afterY = y;
    after.forEach((text, i) => afterCells.push({ i, x: x0 + i * cellW, y: afterY, text, lines: linesOf(text), state: "plain" }));
    const emptyAfter = after.length === 0 ? { x: arrow.x, y: afterY + cellH / 2, text: t("scene.tape.empty") } : null;
    y += cellH;
    afterBlock = { cells: afterCells, arrow, empty: emptyAfter };
  }
  const vbH = y + 4;

  // ---- имена ----
  const names: TapeLayout["names"] = [];
  const nameArrows: TapeLayout["nameArrows"] = [];
  const nameX = PAD + nameW; // правый край подписей (text-anchor end)
  const addNames = (rowY: number) => {
    const rc = rowY + cellH / 2;
    if (scene.name && scene.alias) {
      names.push({ text: `${scene.name} =`, x: nameX, y: rc - 8, rowCy: rc });
      names.push({ text: `${scene.alias} =`, x: nameX, y: rc + 8, rowCy: rc });
      nameArrows.push({ x1: nameX + 3, x2: x0 - 3, y: rc - 8 }, { x1: nameX + 3, x2: x0 - 3, y: rc + 8 });
    } else if (scene.name) {
      names.push({ text: `${scene.name} =`, x: nameX, y: rc, rowCy: rc });
    }
  };
  if (scene.name) {
    addNames(cellsY);
    if (after) {
      // у кадра «после» — только основное имя
      const rc = afterY + cellH / 2;
      names.push({ text: `${scene.name} =`, x: nameX, y: rc, rowCy: rc });
    }
  }

  // ---- итог ----
  const cells: TapeCell[] = scene.cells.map((text, i) => ({ i, x: x0 + i * cellW, y: cellsY, text, lines: linesOf(text), state: stateOf(i) }));
  // индексы: кегль не мельче TAPE_INDEX_FS; на узких ячейках подписывается каждая 2-я (3-я), а не мельчает шрифт
  const indexFs = TAPE_INDEX_FS;
  const strideFor = (worst: string) => {
    const w = estimateTextWidth(worst, indexFs);
    for (let k = 1; k <= 3; k++) if (w <= k * cellW - 4) return k;
    return 3;
  };
  const indexStrideTop = mode === "none" ? 1 : strideFor(String(mode === "one" ? n : n - 1));
  const indexStrideBottom = bottomIdx ? strideFor(`\u2212${n}`) : 1;

  let stop: TapeLayout["stop"] = null;
  if (scene.slice && hasStop) {
    const text = t("scene.tape.stop");
    const w = textWidth(text, LABEL_FS, false);
    const bx = x0 + stopB * cellW;
    stop = {
      x: bx,
      // пунктир начинается ниже «хвостов» букв подписи (қ, у, р): не режет её
      y1: stopRowY + 7 + TAPE_LABEL_FS * 0.35 + TAPE_LABEL_DESC + 3,
      y2: cellsY + cellH + 2,
      label: { cx: clampCenter(bx, w / 2, 2, vbW - 2), w, y: stopRowY + 7, text },
    };
  }

  return {
    vbW,
    vbH,
    cellW,
    cellH,
    cellFs,
    mono,
    x0,
    cells,
    after: afterBlock,
    indexTop: mode === "none" ? [] : cells.filter((c) => c.i % indexStrideTop === 0).map((c) => ({ x: c.x + cellW / 2, y: indexTopY + 8, text: indexLabel(mode, c.i, n, "top") ?? "" })),
    indexBottom: bottomIdx ? cells.filter((c) => c.i % indexStrideBottom === 0).map((c) => ({ x: c.x + cellW / 2, y: indexBottomY + 9, text: indexLabel(mode, c.i, n, "bottom") ?? "" })) : [],
    indexFs,
    indexStrideTop,
    indexStrideBottom,
    textLines,
    lineH,
    arcs: withBridges(arcSpec.map((a) => ({ ...a, y: arcBase - 1 }))),
    groups: groupItems.map((it) => {
      const lv = groupLevels[it.k];
      // уровень 0 — ближе к ленте
      const bottom = groupTop + groupZone - lv * GROUP_ROW;
      return {
        key: `g${it.k}`,
        x1: it.bx1,
        x2: it.bx2,
        y: bottom - 6, // горизонтальная линия скобки; засечки идут вниз, к ячейкам, подпись — над линией
        level: lv,
        label: { cx: it.c, w: it.w, y: bottom - 14, text: it.text },
      };
    }),
    pointers: ptrItems.map((it) => {
      const lv = ptrLevels[it.k];
      const pos = ptrPos.get(it.k)!;
      const labelY = ptrTop + PTR_ARROW + lv * PTR_ROW + 8;
      return {
        key: `p:${it.p.label}:${ptrItems.filter((o) => o.k < it.k && o.p.label === it.p.label).length}`,
        at: it.p.at,
        arrow: pos.arrow,
        x: pos.x,
        yTop: ptrTop,
        yEnd: labelY - 8,
        level: lv,
        tone: it.p.tone ?? "primary",
        label: { cx: pos.c, w: it.w, y: labelY, text: it.p.label },
      };
    }),
    stop,
    empty,
    names,
    nameArrows,
    taken,
  };
}

/**
 * Читаемо ли сцену на телефоне: эффективный шрифт ячеек (с учётом сжатия viewBox к 360 px) не меньше TAPE_LEGIBLE_FONT (≈ 10 px на экране) —
 * содержимое ячеек главное в рисунке. 16 ячеек по три знака в 360 px так не поместятся: короче текст или меньше ячеек. Для validate.ts.
 */
export function tapeLegible(scene: TapeData): boolean {
  const L = tapeLayout(scene, (v) => (typeof v === "string" ? v : v.ru), () => "");
  return (L.cellFs * TAPE_W) / Math.max(TAPE_W, L.vbW) >= TAPE_LEGIBLE_FONT - 0.01;
}

/** Текст для aria-label: что лежит в ленте, срез, обмены, указатели, группы, кадр «после». Номера — как на рисунке (при index "one" с 1). */
export function tapeAria(scene: TapeData, txt: (v: Text) => string, t: Tr): string {
  const n = scene.cells.length;
  const off = scene.index === "one" ? 1 : 0;
  const parts = [t("scene.tape.aria", { n, cells: scene.cells.join(", ") })];
  if (scene.name) parts.push(t("scene.tape.ariaName", { name: scene.name }));
  if (scene.alias) parts.push(t("scene.tape.ariaAlias", { alias: scene.alias }));
  if (scene.slice) {
    const taken = sliceIndices(n, scene.slice);
    parts.push(taken.length ? t("scene.tape.ariaSlice", { cells: taken.map((i) => scene.cells[i]).join(", ") }) : t("scene.tape.ariaEmpty"));
  }
  if (scene.highlight?.length) parts.push(t("scene.tape.ariaHighlight", { cells: scene.highlight.map((i) => scene.cells[i]).join(", ") }));
  if (scene.dim?.length) parts.push(t("scene.tape.ariaDim", { cells: scene.dim.map((i) => scene.cells[i]).join(", ") }));
  for (const [a, b] of scene.swaps ?? []) parts.push(t("scene.tape.ariaSwap", { a: a + off, b: b + off }));
  for (const p of scene.pointers ?? []) parts.push(t("scene.tape.ariaPointer", { label: p.label, at: p.at + off }));
  for (const g of scene.groups ?? []) parts.push(t("scene.tape.ariaGroup", { from: g.from + off, to: g.to + off, label: txt(g.label) }));
  if (scene.after) parts.push(t("scene.tape.ariaAfter", { cells: scene.after.length ? scene.after.join(", ") : t("scene.tape.empty") }));
  return parts.join(" ");
}
