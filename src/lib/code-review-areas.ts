import type { EntTopicId } from "./types";

// Области тренировки «Чтение кода» (#87, этап 15) — лёгкий модуль без банка ЕНТ: его берут страница выбора и экран
// тренировки. Сборка сессии — lib/code-review-drill.ts.

export type ReviewArea = "py" | "db" | "sql" | "sheet" | "web" | "mix";

export interface ReviewAreaInfo {
  id: ReviewArea;
  topics: readonly EntTopicId[];
}

/** Области тренировки: тема ЕНТ → что читаем. «Вперемешку» — все практические темы. */
export const REVIEW_AREAS: readonly ReviewAreaInfo[] = [
  { id: "py", topics: ["t06", "t07"] },
  { id: "db", topics: ["t09"] },
  { id: "sql", topics: ["t10"] },
  { id: "sheet", topics: ["t12"] },
  { id: "web", topics: ["t13"] },
  { id: "mix", topics: ["t06", "t07", "t09", "t10", "t12", "t13"] },
];

export const REVIEW_DRILL_COUNT = 10;
/** Меньше заданий в области — тренировки нет. */
export const REVIEW_MIN_ITEMS = 6;

export function parseReviewArea(v: unknown): ReviewArea | null {
  return REVIEW_AREAS.some((a) => a.id === v) ? (v as ReviewArea) : null;
}
