// Чистая логика расширений сцен binary и decimal (этап 16Б, волна 3): группы, сдвиг, пропуск середины, поразрядное И,
// веса по основанию, «отрываем цифру». Старые сцены (без новых полей) этот файл не затрагивает.

import { superscript } from "@/lib/calc";
import type { Scene } from "@/lib/types";
import { digitChar, parseBits } from "./logic";
import { estimateTextWidth } from "./text-width";

type BinaryData = Extract<Scene, { kind: "binary" }>;
type DecimalData = Extract<Scene, { kind: "decimal" }>;

/** Рабочая ширина рисунка (viewBox): экран 360 px минус поля 16 + 16. */
export const NUM_W = 328;
/** Сколько плиток в одной строке максимум: 16 плиток на 328 px — это ≈ 17 px на плитку. */
export const MAX_ROW_TILES = 16;
export const CELL_GAP = 3;
export const UNIT_GAP = 10;

/** Нужна ли новая отрисовка binary. Старые параметры (bits, weights, cross, sum, wrongDirection, highlight) — старый компонент. */
export function isBinaryExt(s: BinaryData): boolean {
  return !!(s.groups || s.shift || s.gap || s.and !== undefined);
}

/** Нужна ли новая отрисовка decimal. */
export function isDecimalExt(s: DecimalData): boolean {
  return s.base !== undefined || (s.peel !== undefined && s.peel !== false);
}

// ---------- Двоичные цепочки ----------

/** Поразрядное И двух строк из 0/1 (короткая слева дополняется нулями). */
export function andBits(a: string, b: string): string {
  const n = Math.max(a.length, b.length);
  const x = a.padStart(n, "0");
  const y = b.padStart(n, "0");
  return x
    .split("")
    .map((c, i) => (c === "1" && y[i] === "1" ? "1" : "0"))
    .join("");
}

/** Значение двоичной строки (до 32 разрядов — без потери точности). */
export function bitsValue(bits: string): number {
  return parseBits(bits).reduce((acc, d) => acc * 2 + (d === "1" ? 1 : 0), 0);
}

/** Результат сдвига: влево — справа приписан 0 (×2), вправо — правый разряд отброшен (:2, у «0»/«1» остаётся «0»). */
export function shiftBits(bits: string, dir: "left" | "right"): string {
  return dir === "left" ? bits + "0" : bits.length > 1 ? bits.slice(0, -1) : "0";
}

/** Индексы разрядов (слева направо), которые остаются на экране при пропуске середины. */
export function gapVisible(n: number, gap: [number, number]): number[] {
  return Array.from({ length: n }, (_, i) => i).filter((i) => i < gap[0] || i >= gap[1]);
}

/** Верхний индекс степени: 31 → «³¹». */
export function sup(n: number): string {
  return superscript(n);
}

export type CellKind = "digit" | "gap" | "extra";

export interface CellSpec {
  /** Стабильный ключ: по степени разряда справа — при смене числа разрядов существующие плитки не пересоздаются. */
  key: string;
  kind: CellKind;
  ch: string;
  /** Бледный ведущий ноль, дописанный до целой группы. */
  pad?: boolean;
  /** Индекс разряда слева направо в исходной записи (−1 — служебные и дописанные нули). */
  index: number;
  /** Степень двойки (вес) разряда; у служебных — undefined. */
  exp?: number;
  /** "dropped" — отброшенный сдвигом разряд, "added" — приписанный. */
  mark?: "dropped" | "added";
}

export interface UnitSpec {
  key: string;
  cells: CellSpec[];
  /** Скобка под группой: цифра 8-й / 16-й системы либо номер и значение байта. */
  bracket?: { text: string; byte?: number; value?: number };
}

/** Единицы раскладки (группы или одиночные разряды) для одной двоичной строки. */
export function binaryUnits(bits: string, o: { groups?: 3 | 4 | 8; gap?: [number, number]; shift?: "left" | "right" } = {}): UnitSpec[] {
  const n = bits.length;
  const digit = (i: number): CellSpec => ({
    key: `e${n - 1 - i}`,
    kind: "digit",
    ch: bits[i],
    index: i,
    exp: n - 1 - i,
    mark: o.shift === "right" && i === n - 1 ? "dropped" : undefined,
  });

  if (o.groups) {
    const g = o.groups;
    const pad = (g - (n % g)) % g;
    const cells: CellSpec[] = [
      ...Array.from({ length: pad }, (_, k): CellSpec => ({ key: `e${n + pad - 1 - k}`, kind: "digit", ch: "0", pad: true, index: -1, exp: n + pad - 1 - k })),
      ...Array.from({ length: n }, (_, i) => digit(i)),
    ];
    const units: UnitSpec[] = [];
    const total = cells.length / g;
    for (let u = 0; u < total; u++) {
      const chunk = cells.slice(u * g, (u + 1) * g);
      const value = bitsValue(chunk.map((c) => c.ch).join(""));
      units.push({
        key: `u${total - 1 - u}`,
        cells: chunk,
        bracket: g === 8 ? { text: String(value), byte: u + 1, value } : { text: digitChar(value), value },
      });
    }
    // Приписанный ноль — отдельная единица без скобки: группа и её подпись остаются как были
    if (o.shift === "left") units.push({ key: "x", cells: [{ key: "x", kind: "extra", ch: "0", index: -1, mark: "added" }] });
    return units;
  }

  const idx = o.gap ? gapVisible(n, o.gap) : Array.from({ length: n }, (_, i) => i);
  const units: UnitSpec[] = [];
  for (const i of idx) {
    if (o.gap && i === o.gap[1]) units.push({ key: "gap", cells: [{ key: "gap", kind: "gap", ch: "…", index: -1 }] });
    units.push({ key: `e${n - 1 - i}`, cells: [digit(i)] });
  }
  if (o.shift === "left") units.push({ key: "x", cells: [{ key: "x", kind: "extra", ch: "0", index: -1, mark: "added" }] });
  return units;
}

/**
 * Результат сдвига кусками для показа: числа длиннее 16 разрядов не переносятся посреди записи, а делятся на группы справа налево
 * (как плитки: по `groups`, иначе по 8). Приписанный влево ноль — отдельный последний кусок, как отдельная плитка.
 * Склейка кусков — shiftBits(bits, dir).
 */
export function shiftResultChunks(bits: string, dir: "left" | "right", groups?: 3 | 4 | 8): string[] {
  const body = dir === "left" ? bits : bits.length > 1 ? bits.slice(0, -1) : "0";
  if (groups === undefined && body.length <= 16) return [dir === "left" ? body + "0" : body];
  const size = groups ?? 8;
  const parts: string[] = [];
  for (let end = body.length; end > 0; end -= size) parts.unshift(body.slice(Math.max(0, end - size), end));
  if (dir === "left") parts.push("0");
  return parts;
}

// ---------- Раскладка рядов ----------

export interface PlacedCell extends CellSpec {
  /** Левый край плитки; верх — у ряда (`PlacedRow.top`). */
  x: number;
}
export interface PlacedUnit {
  key: string;
  x1: number;
  x2: number;
  bracket?: UnitSpec["bracket"];
}
export interface PlacedRow {
  top: number;
  cells: PlacedCell[];
  units: PlacedUnit[];
}
export interface RowsLayout {
  tileW: number;
  tileH: number;
  font: number;
  /** Верх ряда весов относительно верха ряда плиток (0 — весов нет). */
  weightsDy: number;
  /** Высота одного яруса подписей весов (WEIGHT_H). */
  weightH: number;
  /** Верх скобок относительно верха ряда плиток (0 — скобок нет). */
  bracketDy: number;
  rows: PlacedRow[];
  /** Высота всего блока. */
  height: number;
  width: number;
}

export const WEIGHT_H = 16;
export const BRACKET_H = 26;
export const BYTE_BRACKET_H = 40;
const ROW_GAP = 10;

/** Размеры плитки под ширину: ширина ≥ 12 и ≤ 40, высота ≈ 1.25 ширины, шрифт — по ширине. */
export function tileSizes(tileW: number): { tileH: number; font: number } {
  return { tileH: Math.max(22, Math.min(48, Math.round(tileW * 1.25))), font: Math.max(11, Math.min(28, Math.round(tileW * 0.68))) };
}

/** Раскладка единиц по рядам: единицы переносятся целиком (группа не рвётся), ряды делят единицы поровну. */
export function layoutRows(
  units: UnitSpec[],
  o: { width?: number; maxTiles?: number; unitGap?: number; weights?: boolean; weightTiers?: 1 | 2; brackets?: boolean; top?: number } = {},
): RowsLayout {
  const W = o.width ?? NUM_W;
  const maxTiles = o.maxTiles ?? MAX_ROW_TILES;
  // Приписанный сдвигом ноль («x») не считается ни в ширину группы, ни в число единиц на ряд: он едет в последний ряд
  const extra = units.length > 1 && units[units.length - 1].key === "x" ? units[units.length - 1] : undefined;
  const main = extra ? units.slice(0, -1) : units;
  const maxCells = Math.max(1, ...main.map((u) => u.cells.length));
  // Одиночные разряды (без групп) — обычный зазор; зазор побольше — только между группами.
  const unitGap = o.unitGap ?? (maxCells === 1 ? CELL_GAP : UNIT_GAP);
  const cap = Math.max(1, Math.floor(maxTiles / maxCells));
  const nRows = Math.max(1, Math.ceil(main.length / cap));
  const perRow = Math.max(1, Math.ceil(main.length / nRows));
  const chunks: UnitSpec[][] = [];
  for (let i = 0; i < main.length; i += perRow) chunks.push(main.slice(i, i + perRow));
  if (extra) chunks[chunks.length - 1] = [...chunks[chunks.length - 1], extra];

  const rowCells = (c: UnitSpec[]) => c.reduce((a, u) => a + u.cells.length, 0);
  const fixed = (c: UnitSpec[]) => CELL_GAP * (rowCells(c) - c.length) + unitGap * (c.length - 1);
  const fit = Math.min(...chunks.map((c) => (W - fixed(c)) / Math.max(1, rowCells(c))));
  const tileW = Math.max(12, Math.min(40, Math.floor(fit)));
  const { tileH, font } = tileSizes(tileW);
  const rowW = (c: UnitSpec[]) => rowCells(c) * tileW + fixed(c);
  const x0 = Math.max(0, (W - Math.max(...chunks.map(rowW))) / 2);

  const hasByte = units.some((u) => u.bracket?.byte !== undefined);
  const bracketH = o.brackets ? (hasByte ? BYTE_BRACKET_H : BRACKET_H) : 0;
  // Подписи весов — в один ярус или в два (плотная строка: чётные и нечётные степени на разной высоте, см. weightMode)
  const weightsH = o.weights ? WEIGHT_H * (o.weightTiers ?? 1) : 0;
  const weightsDy = o.weights ? tileH + 3 : 0;
  const bracketDy = o.brackets ? tileH + (o.weights ? 3 + weightsH : 0) + 3 : 0;
  const blockH = tileH + (o.weights ? 3 + weightsH : 0) + (o.brackets ? 3 + bracketH : 0);

  const rows: PlacedRow[] = chunks.map((c, r) => {
    const top = (o.top ?? 0) + r * (blockH + ROW_GAP);
    let x = x0;
    const cells: PlacedCell[] = [];
    const placed: PlacedUnit[] = [];
    c.forEach((u, ui) => {
      const x1 = x;
      u.cells.forEach((cell, k) => {
        cells.push({ ...cell, x });
        x += tileW + (k < u.cells.length - 1 ? CELL_GAP : 0);
      });
      placed.push({ key: u.key, x1, x2: x, bracket: u.bracket });
      if (ui < c.length - 1) x += unitGap;
    });
    return { top, cells, units: placed };
  });

  return { tileW, tileH, font, weightsDy, weightH: WEIGHT_H, bracketDy, rows, height: rows.length * blockH + (rows.length - 1) * ROW_GAP, width: W };
}

// ---------- Подписи весов ----------

/** Показатель степени в подписи «2ⁿ» — настоящий нижний/верхний индекс (tspan), а не юникод-надстрочные знаки: те мельче 6 px. */
export const EXP_SCALE = 0.75;
export function expFont(base: number): number {
  return Math.max(7, Math.round(base * EXP_SCALE));
}

/** Ширина подписи веса: число — одной строкой, степень — «2» кеглем font и показатель кеглем expFont(font). */
export function weightWidth(exp: number, mode: "value" | "pow", font: number): number {
  return mode === "value" ? estimateTextWidth(String(2 ** exp), font) : estimateTextWidth("2", font) + estimateTextWidth(String(exp), expFont(font));
}

/** Минимальный зазор между подписями весов соседних плиток, px. */
export const WEIGHT_GAP = 4;

/** Наименьший кегль основания «2» в подписи-степени: показатель при этом не мельче 10 (expFont(13) = 10). */
export const POW_FONT_MIN = 13;
export const POW_FONT_MAX = 14;
/** Наименьший кегль числа-веса («32768»). */
export const VALUE_FONT_MIN = 10;

/**
 * Подписи весов под плитками. Режим (число или «2ⁿ») и ярусы выбираются один раз на всю сцену:
 * 1. число в один ярус, если оно влезает под плитку (кегль ≥ VALUE_FONT_MIN);
 * 2. степень «2ⁿ» в один ярус, если показатель при этом не мельче 10 (кегль основания ≥ POW_FONT_MIN);
 * 3. иначе (плотная строка из 16 плиток по 16–17 px) — два яруса: чётные степени выше, нечётные ниже. Подпись тогда
 *    может занимать две плитки в ширину, и числа остаются крупными (число — как в п. 1, степень — не мельче POW_FONT_MIN),
 *    а не ужимаются до 7–8 px.
 * Подписи одного яруса не касаются друг друга (зазор ≥ WEIGHT_GAP).
 */
export function weightMode(exps: number[], tileW: number): { mode: "value" | "pow"; font: number; tiers: 1 | 2 } {
  const pitch = tileW + CELL_GAP;
  const widest = (mode: "value" | "pow", f: number) => Math.max(0, ...exps.map((e) => weightWidth(e, mode, f)));
  const valueFont = Math.max(VALUE_FONT_MIN, Math.min(13, Math.round(tileW * 0.5)));
  const powFont = (room: number): number | null => {
    for (let f = POW_FONT_MAX; f >= POW_FONT_MIN; f--) if (widest("pow", f) <= room) return f;
    return null;
  };
  for (const tiers of [1, 2] as const) {
    // В двух ярусах соседние подписи одного яруса стоят через плитку: места вдвое больше
    const room = pitch * tiers - WEIGHT_GAP;
    if (widest("value", valueFont) <= room) {
      // место есть с запасом (два яруса): число можно сделать крупнее, до 13
      let f = valueFont;
      while (tiers === 2 && f < 13 && widest("value", f + 1) <= room) f++;
      return { mode: "value", font: f, tiers };
    }
    const f = powFont(room);
    if (f !== null) return { mode: "pow", font: f, tiers };
  }
  // Совсем узкая плитка (меньше 12 px не бывает): степень, самый крупный кегль, при котором подписи яруса разойдутся
  let f = POW_FONT_MIN;
  while (f > 8 && widest("pow", f) > pitch * 2 - WEIGHT_GAP) f--;
  return { mode: "pow", font: f, tiers: 2 };
}

/**
 * Сдвиг подписи веса по горизонтали, чтобы она не выходила за края рисунка (у крайних плиток подпись шире плитки и без сдвига
 * обрезалась бы краем SVG). `center` — абсолютная координата центра плитки, `w` — ширина подписи.
 */
export function weightShift(center: number, w: number, width = NUM_W): number {
  const left = center - w / 2;
  const right = center + w / 2;
  if (left < 0) return -left;
  if (right > width) return width - right;
  return 0;
}

/** Ярус подписи веса: чётные степени — верхний (0), нечётные — нижний (1); при одном ярусе — всегда 0. Степень стабильна при смене числа разрядов. */
export function weightTier(exp: number, tiers: 1 | 2): 0 | 1 {
  return tiers === 2 && exp % 2 === 1 ? 1 : 0;
}

export function weightLabel(exp: number, mode: "value" | "pow"): string {
  return mode === "value" ? String(2 ** exp) : `2${sup(exp)}`;
}

// ---------- Режим «адрес / маска / И» ----------

export interface AndLine {
  key: "a" | "b" | "c";
  bits: string;
  /** Индексы разрядов под единицами маски («сетевая часть»). */
  mask: boolean[];
}

/** Три строки режима and: первая, маска, результат (поразрядное И). */
export function andLines(a: string, b: string): AndLine[] {
  const c = andBits(a, b);
  const mask = b.split("").map((ch) => ch === "1");
  return [
    { key: "a", bits: a, mask },
    { key: "b", bits: b, mask },
    { key: "c", bits: c, mask },
  ];
}

// ---------- decimal: основание и «отрываем цифру» ----------

/** Значение числа, записанного цифрами основания base. */
export function valueInBase(number: string, base: number): number {
  return [...number].reduce((acc, ch) => acc * base + "0123456789ABCDEF".indexOf(ch), 0);
}

export interface BasePart {
  digit: number;
  ch: string;
  exp: number;
  /** Вес разряда: base^exp. */
  place: number;
  /** digit × place. */
  value: number;
}

/** Разряды слева направо: «7E3», 16 → [7·256, 14·16, 3·1]. */
export function baseParts(number: string, base: number): BasePart[] {
  const n = number.length;
  return [...number].map((ch, i) => {
    const digit = "0123456789ABCDEF".indexOf(ch);
    const exp = n - 1 - i;
    const place = base ** exp;
    return { digit, ch, exp, place, value: digit * place };
  });
}

/** Слагаемые суммы «7·256 + 14·16 + 3»: нулевые пропускаются, у веса 1 — только цифра; пустая сумма — «0». */
export function baseSumTerms(parts: BasePart[]): { id: string; text: string }[] {
  const terms = parts.filter((p) => p.digit !== 0).map((p) => ({ id: `e${p.exp}`, text: p.place === 1 ? String(p.digit) : `${p.digit}·${p.place}` }));
  return terms.length ? terms : [{ id: "z", text: "0" }];
}

export interface PeelStep {
  /** Номер шага с 1. */
  n: number;
  /** Число до шага. */
  cur: number;
  q: number;
  /** cur % q — отрываемая цифра. */
  digit: number;
  /** Цифра в записи основания: 14 → «E». */
  ch: string;
  /** cur // q — число без последней цифры. */
  next: number;
}

/** Шаги «отрывания»: peel=true — все до нуля, число — столько шагов (не больше, чем цифр). Основание по умолчанию — 10. */
export function peelSteps(number: string, base: number | undefined, peel: boolean | number): PeelStep[] {
  const q = base ?? 10;
  let cur = valueInBase(number, q);
  const limit = typeof peel === "number" ? Math.max(1, Math.floor(peel)) : Infinity;
  const steps: PeelStep[] = [];
  do {
    const digit = cur % q;
    const next = Math.floor(cur / q);
    steps.push({ n: steps.length + 1, cur, q, digit, ch: digitChar(digit), next });
    cur = next;
  } while (cur > 0 && steps.length < limit);
  return steps;
}

/** Ширина колонки десятичной сцены (px) при n цифрах: как у ColumnRow (flex-1 с потолком max, зазор 5, справа 16 под «₁₆»). */
export function baseColumnWidth(n: number, max: number): number {
  return Math.min(max, Math.floor((NUM_W - 16 - 5 * (n - 1)) / Math.max(1, n)));
}

/** Помещаются ли значения весов (256, 4096 …) в колонки при кегле font. */
export function placesFit(parts: BasePart[], colW: number, font: number): boolean {
  return parts.every((p) => estimateTextWidth(String(p.place), font) + 8 <= colW);
}
