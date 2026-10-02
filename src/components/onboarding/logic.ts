// Чистая логика онбординга «сначала задание»: три мини-задания про двоичную систему.
// Правильные ответы считает код, а не строки в данных.

import type { Lang } from "@/lib/types";

/** Язык по умолчанию из navigator.language: kk* → kk, иначе ru. */
export function detectLang(navLang: string | undefined | null): Lang {
  return (navLang ?? "").trim().toLowerCase().startsWith("kk") ? "kk" : "ru";
}

/** Значение двоичной записи («1011» → 11). */
export function binToDec(bits: string): number {
  return parseInt(bits, 2);
}

/** Веса четырёх лампочек слева направо: 8, 4, 2, 1. */
export const LAMP_WEIGHTS = [8, 4, 2, 1] as const;

/** Число, которое показывают лампочки (включённые — true). */
export function lampsValue(on: readonly boolean[]): number {
  return on.reduce((sum, v, i) => sum + (v ? (LAMP_WEIGHTS[i] ?? 0) : 0), 0);
}

export type FirstTask =
  | { kind: "lamps"; skill: string; target: number }
  | { kind: "choice"; skill: string; bits: string; options: number[] }
  | { kind: "compare"; skill: string; bits: string; dec: number };

export const FIRST_TASKS: FirstTask[] = [
  { kind: "lamps", skill: "ns.dec2bin", target: 5 },
  { kind: "choice", skill: "ns.bin2dec", bits: "1011", options: [9, 10, 11, 13] },
  { kind: "compare", skill: "ns.bin2dec", bits: "1000", dec: 7 },
];

/** Верно ли решено задание. answer: lamps — число на лампочках, choice — выбранное число, compare — "bin" | "dec". */
export function isCorrect(task: FirstTask, answer: number | "bin" | "dec"): boolean {
  switch (task.kind) {
    case "lamps":
    case "choice":
      return typeof answer === "number" && answer === (task.kind === "lamps" ? task.target : binToDec(task.bits));
    case "compare":
      return answer === (binToDec(task.bits) > task.dec ? "bin" : "dec");
  }
}

/** Верный ответ в виде строки (для записи в статистику). */
export function expectedText(task: FirstTask): string {
  switch (task.kind) {
    case "lamps":
      return String(task.target);
    case "choice":
      return String(binToDec(task.bits));
    case "compare":
      return binToDec(task.bits) > task.dec ? `${task.bits}₂` : `${task.dec}₁₀`;
  }
}

/** XP за задание: с первой попытки — полный, с повторной — половина (как в уроках). */
export function taskXp(firstTry: boolean): number {
  return firstTry ? 10 : 5;
}
