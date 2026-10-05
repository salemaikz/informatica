// Состояние наград волны 1Б (этап 16Б, docs/specs/stage16b-wave1b.md): серия идеальных уроков (R2) и неоткрытые кейсы за уровень (R3).
// Чистая логика без React: поля стора и их санитайзеры. Тесты — tests/rewards-state.test.ts.

/** Серия идеальных уроков подряд (без ошибок, с первой попытки, без пропусков; только первое прохождение урока). */
export interface PerfectRun {
  current: number;
  best: number;
}

export const EMPTY_PERFECT_RUN: PerfectRun = { current: 0, best: 0 };

const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

export function sanitizePerfectRun(raw: unknown): PerfectRun {
  if (!raw || typeof raw !== "object") return { ...EMPTY_PERFECT_RUN };
  const r = raw as Record<string, unknown>;
  const current = count(r.current);
  return { current, best: Math.max(current, count(r.best)) };
}

/** Больше стольких неоткрытых кейсов не копим (ученик, пропустивший окна, не получает ленту из 20 кейсов). */
export const MAX_PENDING_CASES = 5;

/** Неоткрытые кейсы — номера уровней (по возрастанию, без повторов, целые ≥ 2). */
export function sanitizePendingCases(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const levels = raw.filter((v): v is number => typeof v === "number" && Number.isInteger(v) && v >= 2 && v <= 1000);
  return [...new Set(levels)].sort((a, b) => a - b).slice(-MAX_PENDING_CASES);
}
