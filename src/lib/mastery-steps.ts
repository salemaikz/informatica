import { DAY_MS, type LessonStat } from "./review";

// Ступени освоения урока: от «начато» до «закреплено». Чистая логика, без React.
// Строится на данных повторения (stage/dueAt) и точности — отдельного состояния в сторе не нужно.

export type LessonStep = "new" | "started" | "familiar" | "skilled" | "mastered";

/** Ступени с отметками на карте, по возрастанию. */
export const STEPS = ["started", "familiar", "skilled", "mastered"] as const;
export type MarkedStep = (typeof STEPS)[number];

/**
 * Ступень урока.
 * - new — не пройден;
 * - started — засчитан игрой/экстерном/«проверкой себя» (один раз) или точность < 60%;
 * - familiar — пройден, ступень повторения 0–1;
 * - skilled — ступень повторения 2–3 и лучшая точность ≥ 80%;
 * - mastered — ступень повторения ≥ 4 (повторён через 14+ дней).
 * `now` пока не влияет на ступень (просроченное повторение ступень не снижает), параметр оставлен под единый вызов.
 */
export function lessonStep(stat: LessonStat | undefined, now: number = Date.now()): LessonStep {
  void now;
  // Данные из localStorage — недоверенные: нечисловые поля считаем нулём.
  if (!stat || !(num(stat.completions) > 0)) return "new";
  const acc = num(stat.bestAccuracy);
  if (acc < 0.6) return "started";
  const stage = num(stat.stage);
  if (stage >= 4) return "mastered";
  if (stage >= 2 && acc >= 0.8) return "skilled";
  if (stat.via && stat.via !== "learn" && num(stat.completions) <= 1) return "started";
  return "familiar";
}

/** Сколько отметок закрашено: 0 (new) … 4 (mastered). */
export function stepLevel(step: LessonStep): number {
  return step === "new" ? 0 : STEPS.indexOf(step) + 1;
}

/** Семантика цвета: янтарный — в процессе, зелёный — освоено. */
export function stepTone(step: LessonStep): "warning" | "success" | null {
  if (step === "new") return null;
  return step === "started" || step === "familiar" ? "warning" : "success";
}

/** Через сколько дней повторять; null — не пройден. 0 — пора. */
export function stepReviewDays(stat: LessonStat | undefined, now: number): number | null {
  if (!stat || !(num(stat.completions) > 0)) return null;
  const due = Number.isFinite(stat.dueAt) ? stat.dueAt! : num(stat.lastAt) + DAY_MS;
  const days = Math.ceil((due - now) / DAY_MS);
  return Number.isFinite(days) ? Math.max(0, days) : 0;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
