// Точность — одно определение для итогов урока, статистики, истории и порогов (решение #66, аудит T4, T6).
// Чистые функции без React.
//
// - Считаются задания, предъявленные ученику: первая попытка (повтор ошибки в конце урока — нет), пропуск — со счётом 0.
// - Точность = сумма баллов / число предъявленных (частичный балл — как есть). Заданий не было — null («—»).
// - «Сам» и «с подсказкой» — раздельно: hinted — до ответа открыта подсказка или вопрос Биту.
// - Игры считаются отдельно (DayStat.games / gameCorrect), в точность ответов не входят.

import type { AnswerRecord } from "./types";
import type { DayStat } from "./store";

export interface Tally {
  /** Предъявлено заданий (первые попытки, включая пропуски). */
  asked: number;
  /** Сумма баллов. */
  score: number;
  skipped: number;
  /** С подсказкой (до ответа). */
  hinted: number;
  /** Самостоятельные: без подсказки и не пропущенные. */
  selfAsked: number;
  selfScore: number;
}

export const EMPTY_TALLY: Tally = { asked: 0, score: 0, skipped: 0, hinted: 0, selfAsked: 0, selfScore: 0 };

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);

/** Итог по ответам сессии: только первые попытки; пропуск — счёт 0. */
export function tallyOf(records: readonly AnswerRecord[]): Tally {
  const t = { ...EMPTY_TALLY };
  for (const r of records) {
    if (r.retry) continue;
    t.asked += 1;
    if (r.skipped) {
      t.skipped += 1;
      continue;
    }
    const s = clamp01(r.score);
    t.score += s;
    if (r.hinted) t.hinted += 1;
    else {
      t.selfAsked += 1;
      t.selfScore += s;
    }
  }
  return t;
}

/** Точность 0..1 или null, если заданий не было. */
export function accuracyOf(t: Pick<Tally, "asked" | "score">): number | null {
  return t.asked > 0 ? Math.min(1, t.score / t.asked) : null;
}

/** Полнота: доля заданий с ответом (не пропущенных); null — заданий не было. */
export function completionOf(t: Pick<Tally, "asked" | "skipped">): number | null {
  return t.asked > 0 ? (t.asked - t.skipped) / t.asked : null;
}

/** Точность сессии для SessionResult: без заданий — 1 (как раньше; пороги и итоги не ломаются). */
export function sessionAccuracy(records: readonly AnswerRecord[]): number {
  return accuracyOf(tallyOf(records)) ?? 1;
}

/** Все первые попытки верны и ничего не пропущено (бонус «без ошибок»). Подсказка не мешает. */
export function isPerfect(t: Tally): boolean {
  return t.asked > 0 && t.skipped === 0 && t.score >= t.asked - 1e-9;
}

export interface DaysAccuracy {
  /** 0..1 или null — данных нет. */
  value: number | null;
  asked: number;
  /** Приблизительно: только дни до #66 (старые поля answers/correct, с повторами и играми). */
  approx: boolean;
  /** Есть и старые дни (до #66), и новые: точность — только по новым, начиная с since. */
  partial: boolean;
  /** Первый день с новыми полями «ГГГГ-ММ-ДД» (для подписи «с …»); null — нет таких дней. */
  since: string | null;
}

/**
 * Точность по дням (статистика): по новым полям asked/score; если за выбранные дни их нет совсем —
 * по старым answers/correct с пометкой «приблизительно».
 */
export function daysAccuracy(days: Record<string, DayStat>, keys?: readonly string[]): DaysAccuracy {
  let asked = 0;
  let score = 0;
  let answers = 0;
  let correct = 0;
  let since: string | null = null;
  for (const k of keys ?? Object.keys(days)) {
    const d = days[k];
    if (!d) continue;
    if (typeof d.asked === "number" && d.asked > 0) {
      asked += d.asked;
      score += typeof d.score === "number" ? d.score : 0;
      if (since === null || k < since) since = k;
    } else {
      answers += d.answers || 0;
      correct += d.correct || 0;
    }
  }
  if (asked > 0) return { value: Math.min(1, score / asked), asked, approx: false, partial: answers > 0, since };
  if (answers > 0) return { value: Math.min(1, correct / answers), asked: answers, approx: true, partial: false, since: null };
  return { value: null, asked: 0, approx: false, partial: false, since: null };
}
