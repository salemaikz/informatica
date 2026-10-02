import type { Level } from "./types";

// Правила оценивания ЕНТ (Правила проведения ЕНТ, п. 18; подробности — docs/ENT.md).

/** Баллы за задание «один или несколько верных» / «соответствие» (максимум 2, верных — не больше трёх). */
export function entPoints(totalCorrect: number, chosenCorrect: number, chosenWrong: number): 0 | 1 | 2 {
  if (chosenWrong >= 2 || chosenCorrect === 0) return 0;
  if (chosenCorrect === totalCorrect && chosenWrong === 0) return 2;
  // 1 балл: все верные + один лишний; при двух/трёх верных — хотя бы (верных − 1) без двух лишних.
  // При трёх верных один угаданный — 0.
  return chosenCorrect >= Math.max(1, totalCorrect - 1) ? 1 : 0;
}

/** Баллы ЕНТ за выбор вариантов в задании с несколькими верными ответами. */
export function multiPoints(correct: number[], chosen: number[]): 0 | 1 | 2 {
  const right = new Set(correct);
  const picked = new Set(chosen);
  let c = 0;
  let w = 0;
  for (const i of picked) (right.has(i) ? c++ : w++);
  return entPoints(right.size, c, w);
}

/** Уровень сложности по освоению навыка: новичку — A, уверенному — C. */
export function levelFromMastery(mastery: number): Level {
  if (mastery < 0.5) return 1;
  if (mastery < 0.8) return 2;
  return 3;
}

/** Буква уровня как в спецификации ЕНТ. */
export const LEVEL_LETTER: Record<Level, "A" | "B" | "C"> = { 1: "A", 2: "B", 3: "C" };
