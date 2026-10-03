import type { InputStep } from "./types";

const SUBSCRIPTS: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
};

/**
 * Нормализует ответ ученика:
 * - убирает пробелы и регистр;
 * - срезает обозначение основания: 1011₂, 1011(2), 1011_2;
 * - для чисел убирает ведущие нули (00101 → 101).
 */
export function normalizeAnswer(raw: string, mode: InputStep["mode"]): string {
  let s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (mode === "text") return s.replace(/[.,!?;:]+$/, "");

  s = s
    .replace(/[₀-₉]+$/u, "")
    .replace(/\(\d+\)$/, "")
    .replace(/_\d+$/, "");
  // Всё, кроме цифр/букв (для hex позже), убираем: «1 011», «1.011»
  s = s.replace(/[^0-9a-f-]/g, "");
  if (/^-?0+\d/.test(s)) s = s.replace(/^(-?)0+(?=\d)/, "$1");
  return s;
}

export function toSubscriptBase(n: number): string {
  const rev = Object.fromEntries(Object.entries(SUBSCRIPTS).map(([k, v]) => [v, k]));
  return String(n)
    .split("")
    .map((d) => rev[d] ?? d)
    .join("");
}

export function checkInput(value: string, answers: string[], mode: InputStep["mode"]): boolean {
  const v = normalizeAnswer(value, mode);
  if (!v) return false;
  if (mode === "binary" && !/^[01]+$/.test(v)) return false;
  return answers.some((a) => normalizeAnswer(a, mode) === v);
}

export function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((x, i) => x === sb[i]);
}

/** Строки «лесенки» деления на 2: [число, частное, остаток]. */
export function divisionLadder(n: number, base = 2): { value: number; quotient: number; remainder: number }[] {
  const rows: { value: number; quotient: number; remainder: number }[] = [];
  let v = n;
  if (v === 0) return [{ value: 0, quotient: 0, remainder: 0 }];
  while (v > 0) {
    rows.push({ value: v, quotient: Math.floor(v / base), remainder: v % base });
    v = Math.floor(v / base);
  }
  return rows;
}

export function toBinary(n: number, minBits = 1): string {
  return n.toString(2).padStart(minBits, "0");
}
