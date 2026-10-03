import type { L } from "@/lib/types";
import { evaluateSheet, formatValue, isError, isFormula, parseNumberText, parseSheetCode, type SheetCells, type Value } from "@/lib/sheet";
import type { CheckResult, IdeCheck } from "../types";

export type ExcelCheck = Extract<IdeCheck, { kind: "excel" }>;

/** Допуск при сравнении чисел (после пересчёта остаются хвосты двоичной дроби). */
const EPS = 1e-9;

/** Допустимые тексты ожидаемого значения: «сдал|тапсырды» — любой из вариантов (регистр и крайние пробелы не важны). */
const alternatives = (expected: string) => expected.split("|").map((s) => s.trim());

/** Подходит ли вычисленное значение под ожидаемое (число — с допуском, текст — любой из вариантов). */
export function matchesExpected(expected: string | number, got: Value): boolean {
  if (isError(got) || got === null) return false;
  if (typeof expected === "number") return typeof got === "number" && Math.abs(got - expected) <= EPS * Math.max(1, Math.abs(expected));
  return alternatives(expected).some((alt) => {
    if (typeof got === "string") return got.trim().toLowerCase() === alt.toLowerCase();
    if (typeof got === "number") {
      const n = parseNumberText(alt);
      return n !== null && Math.abs(got - n) <= EPS * Math.max(1, Math.abs(n));
    }
    const up = alt.toUpperCase();
    return got ? up === "TRUE" || up === "ИСТИНА" : up === "FALSE" || up === "ЛОЖЬ";
  });
}

/** Как показать ожидаемое значение на языке ученика (у текстовых — вариант того же языка, если он есть). */
function showExpected(expected: string | number, lang: "ru" | "kk"): string {
  if (typeof expected === "number") return formatValue(expected);
  const alts = alternatives(expected);
  return alts[lang === "kk" ? 1 : 0] ?? alts[0];
}

const showGot = (v: Value, lang: "ru" | "kk") => (v === null ? (lang === "ru" ? "пусто" : "бос") : formatValue(v));

/**
 * Проверка Excel-задачи: код — JSON ячеек, значения считаются движком (src/lib/sheet).
 * Сначала проверяются ячейки, где обязательна формула (число, введённое вручную, не засчитывается),
 * затем значения ячеек из `cells`. В сообщении — первая непройденная проверка.
 */
export function checkExcel(check: ExcelCheck, code: string): CheckResult {
  const cells = parseSheetCode(code);
  const result = evaluateSheet(cells);
  const formulas = check.formulas ?? [];
  const expected = Object.entries(check.cells);
  const total = formulas.length + expected.length;
  let passed = 0;
  let message: L | undefined;
  let sample: CheckResult["sample"];

  for (const addr of formulas) {
    if (isFormula(cells[addr])) passed++;
    else if (!message) {
      message = {
        ru: `В ячейке ${addr} должна быть формула: начните ввод со знака «=», а не вводите число вручную.`,
        kk: `${addr} ұяшығында формула болуы керек: енгізуді «=» белгісінен бастаңыз, санды қолмен жазбаңыз.`,
      };
    }
  }
  for (const [addr, want] of expected) {
    const got = result.get(addr);
    if (matchesExpected(want, got)) passed++;
    else if (!message) {
      message = {
        ru: `Ячейка ${addr}: ожидалось ${showExpected(want, "ru")}, получилось ${showGot(got, "ru")}.`,
        kk: `${addr} ұяшығы: күтілгені ${showExpected(want, "kk")}, шыққаны ${showGot(got, "kk")}.`,
      };
      sample = { input: addr, expected: showExpected(want, "ru"), got: showGot(got, "ru") };
    }
  }
  return { ok: passed === total, passed, total, message, sample };
}

/** Первая ячейка с ошибкой для кнопки «Объясни ошибку»: «B2 (=A1/0) → #ДЕЛ/0!»; нет ошибок — null. */
export function describeSheetError(cells: SheetCells): string | null {
  const r = evaluateSheet(cells);
  for (const [addr, v] of Object.entries(r.values)) {
    if (!isError(v)) continue;
    const raw = (cells[addr] ?? "").slice(0, 80);
    return `${addr} (${raw}) → ${v.error}`;
  }
  return null;
}
