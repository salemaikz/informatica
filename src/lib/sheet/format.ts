// Числа и текст в ячейках: разбор ввода, показ значений, код задачи (JSON ячеек).

import { normalizeAddr, parseAddr } from "./refs";
import { isError, type Value } from "./value";

const NUMBER_RE = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?%?$/;

/** «1,5», «1.5», «-3», «50%», «2e3» → число; не число → null. */
export function parseNumberText(text: string): number | null {
  const s = text.trim();
  if (!NUMBER_RE.test(s)) return null;
  const pct = s.endsWith("%");
  const n = Number((pct ? s.slice(0, -1) : s).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return pct ? n / 100 : n;
}

/** Ввод в ячейку, не формула: число, ИСТИНА/ЛОЖЬ или текст; пустой ввод — пустая ячейка. */
export function parseConstant(raw: string): Value {
  if (raw.trim() === "") return null;
  const n = parseNumberText(raw);
  if (n !== null) return n;
  const up = raw.trim().toUpperCase();
  if (up === "TRUE" || up === "ИСТИНА") return true;
  if (up === "FALSE" || up === "ЛОЖЬ") return false;
  return raw;
}

/** Формула — ввод, начинающийся с «=» и содержащий что-то ещё. */
export const isFormula = (raw: string | undefined | null): boolean => typeof raw === "string" && raw.trim().length > 1 && raw.trim().startsWith("=");

/** Число как в ячейке «Общий» формата: до 11 значащих цифр, десятичная запятая. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const x = Object.is(n, -0) ? 0 : n;
  const s = String(Number(x.toPrecision(11)));
  const m = /^(-?[\d.]+)e([+-])(\d+)$/.exec(s);
  const out = m ? `${m[1]}E${m[2]}${m[3].padStart(2, "0")}` : s;
  return out.replace(".", ",");
}

/** Число при склейке текстов (&): 15 значащих цифр, как в Excel. */
export function numberToText(n: number): string {
  const x = Object.is(n, -0) ? 0 : n;
  return String(Number(x.toPrecision(15))).replace(".", ",");
}

/** Значение для показа в ячейке. */
export function formatValue(v: Value): string {
  if (isError(v)) return v.error;
  if (v === null) return "";
  if (typeof v === "number") return formatNumber(v);
  if (typeof v === "boolean") return v ? "ИСТИНА" : "ЛОЖЬ";
  return v;
}

/** Значение при склейке (&) и в функциях, которым нужен текст. */
export function valueToText(v: Value): string {
  if (isError(v)) return v.error;
  if (v === null) return "";
  if (typeof v === "number") return numberToText(v);
  if (typeof v === "boolean") return v ? "ИСТИНА" : "ЛОЖЬ";
  return v;
}

// ---------- Код задачи: JSON ячеек {"A1":"5","B1":"=A1*2"} ----------

/** Ячейки листа: адрес (верхний регистр) → то, что введено. */
export type SheetCells = Record<string, string>;

const rowMajor = (a: string, b: string) => {
  const x = parseAddr(a)!;
  const y = parseAddr(b)!;
  return x.row - y.row || x.col - y.col;
};

/** JSON → ячейки. Мусор, неверные адреса и пустые ячейки отбрасываются. */
export function parseSheetCode(code: string): SheetCells {
  let data: unknown;
  try {
    data = JSON.parse(code);
  } catch {
    return {};
  }
  const out: SheetCells = {};
  if (typeof data !== "object" || data === null || Array.isArray(data)) return out;
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    const addr = normalizeAddr(k);
    if (!addr || (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean")) continue;
    const s = String(v);
    if (s.trim() !== "") out[addr] = s;
  }
  return out;
}

/** Ячейки → JSON (в порядке строк, без пустых). */
export function serializeSheet(cells: SheetCells): string {
  const keys = Object.keys(cells).filter((k) => cells[k].trim() !== "" && parseAddr(k)).sort(rowMajor);
  const ordered: SheetCells = {};
  for (const k of keys) ordered[k] = cells[k];
  return JSON.stringify(ordered);
}
