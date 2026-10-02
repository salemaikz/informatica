// Чистая логика сцен и песочниц (без React). Покрыта tests/scenes.test.ts.
// Правильные числа — суммы, веса, остатки — всегда считает код, а не контент.

import { divisionLadder } from "@/lib/check";

export const MIN_LAMPS = 1;
export const MAX_LAMPS = 8;

const HEX = "0123456789ABCDEF";

/** Цифра по значению: 11 → «B». */
export function digitChar(v: number): string {
  return HEX[v] ?? String(v);
}

/** Только цифры 0/1 из строки («1011», «10 11» → «1011»). */
export function parseBits(bits: string): ("0" | "1")[] {
  return bits.split("").filter((c): c is "0" | "1" => c === "0" || c === "1");
}

/** Веса разрядов слева направо в правильном порядке: 4 цифры → [8, 4, 2, 1]. */
export function weightsRtl(n: number): number[] {
  return Array.from({ length: n }, (_, i) => 2 ** (n - 1 - i));
}

/** Веса, расставленные неверно — слева направо: 4 цифры → [1, 2, 4, 8]. */
export function weightsWrong(n: number): number[] {
  return Array.from({ length: n }, (_, i) => 2 ** i);
}

export function chipWeights(n: number, wrong: boolean): number[] {
  return wrong ? weightsWrong(n) : weightsRtl(n);
}

/** Индексы (слева направо), под которыми стоит 0 — их веса зачёркиваются. */
export function crossedColumns(bits: string): number[] {
  return parseBits(bits).flatMap((d, i) => (d === "0" ? [i] : []));
}

/** Слагаемые суммы: веса под единицами, слева направо. */
export function sumTerms(bits: string, wrong = false): number[] {
  const digits = parseBits(bits);
  const ws = chipWeights(digits.length, wrong);
  return digits.flatMap((d, i) => (d === "1" ? [ws[i]] : []));
}

/** Верное значение двоичной записи. */
export function binarySum(bits: string): number {
  return sumTerms(bits).reduce((a, b) => a + b, 0);
}

/** Значение, которое получится, если подписать веса слева направо (ошибка-ловушка). */
export function wrongSum(bits: string): number {
  return sumTerms(bits, true).reduce((a, b) => a + b, 0);
}

/** Разряды десятичного числа: «345» → [{digit 3, place 100, value 300}, …]. Нецифры игнорируются. */
export function decimalParts(number: string): { digit: number; place: number; value: number }[] {
  const ds = number.replace(/\D/g, "").split("").map(Number);
  return ds.map((digit, i) => {
    const place = 10 ** (ds.length - 1 - i);
    return { digit, place, value: digit * place };
  });
}

export function decimalTotal(number: string): number {
  return decimalParts(number).reduce((a, p) => a + p.value, 0);
}

/** Размеры плиток под число цифр: 7–8 цифр должны помещаться в 328 px. */
export function tileMetrics(n: number): { max: number; h: number; font: number; chip: number; lamp: number } {
  if (n <= 4) return { max: 60, h: 60, font: 40, chip: 15, lamp: 56 };
  if (n <= 6) return { max: 52, h: 56, font: 36, chip: 14, lamp: 48 };
  if (n === 7) return { max: 44, h: 50, font: 30, chip: 13, lamp: 40 };
  if (n === 8) return { max: 38, h: 46, font: 26, chip: 12, lamp: 34 };
  return { max: 32, h: 42, font: 22, chip: 11, lamp: 28 };
}

// ---------- Лесенка ----------

export interface LadderRowView {
  value: number;
  quotient: number;
  remainder: number;
}

export function ladderRows(number: number, base = 2): LadderRowView[] {
  return divisionLadder(Math.max(0, Math.floor(number)), base);
}

/** Сколько строк показывать: undefined = все; readUp всегда показывает все. */
export function visibleLadderRows(total: number, rows: number | undefined, readUp: boolean | undefined): number {
  if (readUp || rows === undefined) return total;
  return Math.max(0, Math.min(total, Math.floor(rows)));
}

/** Остатки снизу вверх — результат перевода: 19 → «10011». */
export function readUpDigits(rows: LadderRowView[]): string[] {
  return rows
    .map((r) => digitChar(r.remainder))
    .reverse();
}

// ---------- Монеты ----------

/** Сумма выбранных монет (учитываются только значения, которые есть среди монет). */
export function coinSum(values: number[], picked: number[] = []): number {
  const set = new Set(picked);
  return values.reduce((acc, v) => acc + (set.has(v) ? v : 0), 0);
}

/** Двоичный код набора: от большей монеты к меньшей, 1 — взята. */
export function coinCode(values: number[], picked: number[] = []): string {
  const set = new Set(picked);
  return [...values]
    .sort((a, b) => b - a)
    .map((v) => (set.has(v) ? "1" : "0"))
    .join("");
}

/** Раскладка монет по строкам: до 5 — в одну, больше — в две (поровну), чтобы монеты оставались крупными. */
export function coinRows<T>(items: T[]): T[][] {
  if (items.length <= 5) return [items];
  const first = Math.ceil(items.length / 2);
  return [items.slice(0, first), items.slice(first)];
}

/** Монеты размера size: 2^(size-1) … 1 (большая слева). */
export function coinValues(size: number): number[] {
  const n = clampLamps(size);
  return Array.from({ length: n }, (_, i) => 2 ** (n - 1 - i));
}

// ---------- Песочница «лампы / веса» ----------
// Состояние — массив boolean, индекс 0 — младший разряд (вес 1). Так у лампы стабильный ключ при добавлении слева.

export function clampLamps(n: number): number {
  return Math.max(MIN_LAMPS, Math.min(MAX_LAMPS, Math.round(Number.isFinite(n) ? n : MIN_LAMPS)));
}

export function newLamps(size: number): boolean[] {
  return Array.from({ length: clampLamps(size) }, () => false);
}

export function addLamp(bits: boolean[]): boolean[] {
  return bits.length >= MAX_LAMPS ? bits : [...bits, false];
}

export function removeLamp(bits: boolean[]): boolean[] {
  return bits.length <= MIN_LAMPS ? bits : bits.slice(0, -1);
}

export function toggleLamp(bits: boolean[], i: number): boolean[] {
  return bits.map((b, k) => (k === i ? !b : b));
}

/** Значение: старший разряд — последний элемент. */
export function lampsValue(bits: boolean[]): number {
  return bits.reduce((acc, b, i) => acc + (b ? 2 ** i : 0), 0);
}

/** Слагаемые включённых ламп от большего к меньшему: [8, 4, 1]. */
export function lampsTerms(bits: boolean[]): number[] {
  return bits.flatMap((b, i) => (b ? [2 ** i] : [])).reverse();
}

/** Узор, старший разряд слева: «1011». */
export function lampsPattern(bits: boolean[]): string {
  return [...bits]
    .reverse()
    .map((b) => (b ? "1" : "0"))
    .join("");
}

/** Сколько разных сигналов даёт n ламп. */
export function signalsCount(n: number): number {
  return 2 ** n;
}

/** Число столбцов сетки сигналов: 2^⌈n/2⌉ — сетка получается почти квадратной. */
export function signalGridColumns(n: number): number {
  return 2 ** Math.ceil(n / 2);
}

/** Задана ли цель: лампы — число ламп; веса и монеты — набранная сумма. */
export function goalReached(tool: "lamps" | "weights" | "coins", target: number, state: { lamps: number; sum: number }): boolean {
  return tool === "lamps" ? state.lamps === target : state.sum === target;
}

// ---------- Шаблоны строк ----------

export const MARK = "\u0001";

/** Режет строку-шаблон с подставленной меткой на «до» и «после»: так число можно показать крупно между ними. */
export function splitMark(s: string): [string, string] {
  const i = s.indexOf(MARK);
  return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)];
}

/** Размер шрифта моноширинного шрифта под цифру, чтобы строка из len символов влезла в width px. */
export function monoFit(len: number, width: number, max: number): number {
  if (len <= 0) return max;
  return Math.max(6, Math.min(max, Math.floor(width / (len * 0.62))));
}
