import type { DictKey } from "@/i18n/dict";
import { superscript } from "@/lib/calc";

// Данные шпаргалки: чистая логика без React. Числа и таблицы считает код, тексты — словарь `cheat.*`.

export type CheatSectionId = "units" | "powers" | "formulas" | "ns" | "logic" | "python";

/** Порядок секций; первая раскрыта при открытии. */
export const CHEAT_SECTIONS: CheatSectionId[] = ["units", "powers", "formulas", "ns", "logic", "python"];
export const CHEAT_OPEN_FIRST: CheatSectionId = "units";

export const CHEAT_TITLE: Record<CheatSectionId, DictKey> = {
  units: "cheat.units.title",
  powers: "cheat.powers.title",
  formulas: "cheat.formulas.title",
  ns: "cheat.ns.title",
  logic: "cheat.logic.title",
  python: "cheat.python.title",
};

/** Строка-правило: f — крупный моноширинный текст (формула), note — пояснение, warn — «не перепутай». */
export type CheatRow = { f: DictKey; note?: DictKey; warn?: boolean };

export const UNITS_ROWS: CheatRow[] = [
  { f: "cheat.units.bit", note: "cheat.units.bit.n" },
  { f: "cheat.units.byte", note: "cheat.units.byte.n" },
  { f: "cheat.units.char1", note: "cheat.units.char1.n" },
  { f: "cheat.units.char2", note: "cheat.units.char2.n" },
  { f: "cheat.units.kb", note: "cheat.units.kb.n" },
  { f: "cheat.units.mb", note: "cheat.units.mb.n" },
  { f: "cheat.units.gb", note: "cheat.units.gb.n" },
  { f: "cheat.units.tb", note: "cheat.units.tb.n" },
  { f: "cheat.units.x8", note: "cheat.units.x8.n" },
  { f: "cheat.units.x1024", note: "cheat.units.x1024.n" },
];

export const FORMULA_ROWS: CheatRow[] = [
  { f: "cheat.f.alphabet", note: "cheat.f.alphabet.n" },
  { f: "cheat.f.volume", note: "cheat.f.volume.n" },
  { f: "cheat.f.raster", note: "cheat.f.raster.n" },
  { f: "cheat.f.palette", note: "cheat.f.palette.n" },
  { f: "cheat.f.sound", note: "cheat.f.sound.n" },
  { f: "cheat.f.time", note: "cheat.f.time.n" },
  { f: "cheat.f.bits", note: "cheat.f.bits.n", warn: true },
];

export const NS_ROWS: CheatRow[] = [
  { f: "cheat.ns.digits", note: "cheat.ns.digits.n" },
  { f: "cheat.ns.to10", note: "cheat.ns.to10.n" },
  { f: "cheat.ns.from10", note: "cheat.ns.from10.n" },
  { f: "cheat.ns.to8", note: "cheat.ns.to8.n" },
  { f: "cheat.ns.to16", note: "cheat.ns.to16.n" },
];

export const LOGIC_ROWS: CheatRow[] = [
  { f: "cheat.logic.order", note: "cheat.logic.order.n" },
  { f: "cheat.logic.dm1", note: "cheat.logic.dm.n" },
  { f: "cheat.logic.dm2" },
  { f: "cheat.logic.impl", note: "cheat.logic.impl.n" },
];

export const PYTHON_ROWS: CheatRow[] = [
  { f: "cheat.py.div", note: "cheat.py.div.n" },
  { f: "cheat.py.mod", note: "cheat.py.mod.n" },
  { f: "cheat.py.pow", note: "cheat.py.pow.n" },
  { f: "cheat.py.range", note: "cheat.py.range.n" },
  { f: "cheat.py.slice", note: "cheat.py.slice.n" },
  { f: "cheat.py.len", note: "cheat.py.len.n" },
  { f: "cheat.py.input", note: "cheat.py.input.n" },
];

/** Раскрыть/свернуть секцию: возвращает новое множество (состояние аккордеона). */
export function toggleSection(open: ReadonlySet<CheatSectionId>, id: CheatSectionId): Set<CheatSectionId> {
  const next = new Set(open);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Число с неразрывными пробелами между тысячами: 65 536. */
export function groupDigits(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// --- Степени двойки ---

export const POWER_MAX = 16;

export type PowerCell = { exp: number; label: string; value: number; text: string; mark: boolean };

/** Ключевые степени, которые подсвечиваем: 2⁸ (значений в байте), 2¹⁰ (байт в Кбайте), 2¹⁶ (символов в UTF-16). */
export const POWER_MARKS: readonly number[] = [8, 10, 16];

export function powerCells(max = POWER_MAX): PowerCell[] {
  return Array.from({ length: max + 1 }, (_, exp) => ({
    exp,
    label: `2${superscript(exp)}`,
    value: 2 ** exp,
    text: groupDigits(2 ** exp),
    mark: POWER_MARKS.includes(exp),
  }));
}

// --- Системы счисления ---

export type NsRow = { dec: string; bin: string; oct: string; hex: string };

/** Таблица 0–15 в системах 10, 2, 8, 16 (двоичная запись — тетрада из 4 бит). */
export function nsRows(): NsRow[] {
  return Array.from({ length: 16 }, (_, n) => ({
    dec: String(n),
    bin: n.toString(2).padStart(4, "0"),
    oct: n.toString(8),
    hex: n.toString(16).toUpperCase(),
  }));
}

/** Триады: восьмеричная цифра 0–7 → три бита. */
export function triads(): { digit: string; bits: string }[] {
  return Array.from({ length: 8 }, (_, n) => ({ digit: String(n), bits: n.toString(2).padStart(3, "0") }));
}

// --- Логика ---

export const LOGIC_COLUMNS = ["A", "B", "¬A", "A ∧ B", "A ∨ B", "A → B", "A ≡ B"] as const;

/** Таблица истинности для двух переменных: строки A, B, ¬A, A∧B, A∨B, A→B, A≡B (0/1). */
export function truthTable(): (0 | 1)[][] {
  const rows: (0 | 1)[][] = [];
  for (const a of [0, 1] as const) {
    for (const b of [0, 1] as const) {
      rows.push([a, b, a ? 0 : 1, a && b ? 1 : 0, a || b ? 1 : 0, !a || b ? 1 : 0, a === b ? 1 : 0]);
    }
  }
  return rows;
}
