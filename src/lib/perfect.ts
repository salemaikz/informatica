// «Идеальный урок» и серия идеальных подряд (этап 16Б, R2). Чистая логика без React; тесты — tests/perfect.test.ts.
// Поле стора `perfectRun` (тип и санитайзер — lib/rewards-state.ts) меняет только finishSession.

import type { SessionResult } from "./types";
import type { PerfectRun } from "./rewards-state";

/** Достижение «5 идеальных подряд». */
export const PERFECT_RUN_GOAL = 5;

/** Серию показываем на итогах с этого значения («Идеальных подряд: 3», с 2-го). */
export const PERFECT_RUN_SHOW_FROM = 2;

/** Идеально: все задания с первой попытки верно и сам — без подсказок, ничего не пропущено; хотя бы одно задание было. */
export function isPerfectSession(r: Pick<SessionResult, "answers" | "skipped">): boolean {
  const firstTry = r.answers.filter((a) => !a.retry);
  return firstTry.length > 0 && firstTry.every((a) => a.correct && !a.hinted) && !r.skipped;
}

/**
 * Серия после урока. Тренировки её не трогают (вызывать только для уроков).
 * - первое прохождение идеальное — серия растёт;
 * - первое прохождение с ошибкой или пропуском — серия сбрасывается;
 * - повтор урока (уже пройден раньше) серию не меняет: повторами «накрутить» серию нельзя, а ошибка в повторе её не рушит.
 */
export function nextPerfectRun(run: PerfectRun, o: { perfect: boolean; first: boolean }): PerfectRun {
  if (!o.first) return run;
  if (!o.perfect) return run.current === 0 ? run : { ...run, current: 0 };
  const current = run.current + 1;
  return { current, best: Math.max(run.best, current) };
}
