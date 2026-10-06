import { DUEL_MODES } from "./modes";
import type { DuelAnswer, DuelItem } from "./types";

// Проверка ответа на задание дуэли (docs/specs/duels.md §5). Лёгкий модуль без банка: им пользуется экран матча
// на клиенте, а набор (deck.ts, тяжёлый — тянет весь банк) и сервер берут те же функции отсюда.

/** Верен ли ответ на задание (без учёта времени). */
export function isCorrect(item: DuelItem, answer: DuelAnswer): boolean {
  if (item.shape === "statement") return typeof answer === "boolean" && answer === item.statement.value;
  return typeof answer === "number" && Number.isInteger(answer) && answer === item.step.correct;
}

/** Проверка ответа и очки режима (без учёта времени — время проверяет plausible.ts). */
export function checkAnswer(item: DuelItem, answer: DuelAnswer): { ok: boolean; pts: number } {
  const ok = isCorrect(item, answer);
  const { pts } = DUEL_MODES[item.mode];
  return { ok, pts: ok ? pts.ok : pts.bad };
}

/** Правильный ответ (для разбора на итогах и тестовых помощников e2e). */
export function correctAnswer(item: DuelItem): DuelAnswer {
  return item.shape === "statement" ? item.statement.value : item.step.correct;
}

/** Число вариантов ответа (утверждение — 2). */
export function optionCount(item: DuelItem): number {
  return item.shape === "statement" ? 2 : item.step.options.length;
}
