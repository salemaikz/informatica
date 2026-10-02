import type { LessonVia } from "./types";

// Интервальное повторение уроков и «честный» XP за повтор (этап 3, docs/specs/stage3.md).
// Тема «остывает»: после урока повторяем через 1, 3, 7, 14, 30, 60 дней. Хорошо повторил — интервал растёт,
// плохо — возвращается к началу. Повтор вне расписания даёт меньше XP: фармить один урок невыгодно.

export const DAY_MS = 86_400_000;

/** Интервалы повторения по ступеням, дней. */
export const REVIEW_DAYS = [1, 3, 7, 14, 30, 60] as const;

export interface LessonStat {
  completions: number;
  bestAccuracy: number;
  lastAt: number;
  totalXp: number;
  /** Когда урок засчитан впервые. */
  firstAt?: number;
  /** Как урок засчитан впервые (полностью, проверкой себя, игрой, экстерном). */
  via?: LessonVia;
  /** Ступень повторения 0..5 (индекс REVIEW_DAYS). */
  stage?: number;
  /** Когда повторить (мс). */
  dueAt?: number;
}

/** Множители XP за повтор урока. */
export const REPLAY_XP = {
  /** Второй раз (вне расписания). */
  second: 0.5,
  /** Третий и дальше. */
  later: 0.3,
  /** Плановое повторение (тема «остыла») — почти полный XP: повторять полезно. */
  review: 0.75,
} as const;

/** Множитель XP для прохождения урока сейчас: первый раз — 1, повтор — меньше. */
export function lessonXpFactor(stat: LessonStat | undefined, now: number): number {
  if (!stat || stat.completions <= 0) return 1;
  // Старые сохранения без расписания: повторять пора через день после прохождения (как в dueLessons).
  if (now >= (stat.dueAt ?? stat.lastAt + DAY_MS)) return REPLAY_XP.review;
  return stat.completions === 1 ? REPLAY_XP.second : REPLAY_XP.later;
}

/** XP с учётом множителя (целое, не меньше 1 за ненулевой XP). */
export function scaleXp(xp: number, factor: number): number {
  if (xp <= 0) return 0;
  return Math.max(1, Math.round(xp * factor));
}

/**
 * Новая ступень и дата повторения после прохождения урока с точностью accuracy (0..1).
 * - первый раз: ступень 0, повторить через 1 день;
 * - повтор по расписанию: ≥ 80% — ступень вверх, 60–80% — та же, < 60% — с начала;
 * - повтор раньше срока: ступень не растёт, но при < 60% — с начала.
 */
export function scheduleAfter(stat: LessonStat | undefined, accuracy: number, now: number): { stage: number; dueAt: number } {
  const last = REVIEW_DAYS.length - 1;
  let stage: number;
  if (!stat || stat.completions <= 0 || stat.stage === undefined) {
    stage = 0;
  } else {
    const due = stat.dueAt === undefined || now >= stat.dueAt;
    const cur = Math.min(Math.max(stat.stage, 0), last);
    if (accuracy < 0.6) stage = 0;
    else if (!due) stage = cur;
    else stage = accuracy >= 0.8 ? Math.min(cur + 1, last) : cur;
  }
  // Слабый первый результат — повторить уже завтра (как и ступень 0).
  return { stage, dueAt: now + REVIEW_DAYS[stage] * DAY_MS };
}

/** Уроки, которые пора повторить: от самых «остывших». */
export function dueLessons(lessons: Record<string, LessonStat>, now: number): { id: string; overdueDays: number }[] {
  const out: { id: string; overdueDays: number }[] = [];
  for (const [id, s] of Object.entries(lessons)) {
    if (!s || s.completions <= 0) continue;
    // Старые сохранения без расписания: считаем, что повторить нужно через день после прохождения.
    const dueAt = s.dueAt ?? s.lastAt + DAY_MS;
    if (now >= dueAt) out.push({ id, overdueDays: Math.floor((now - dueAt) / DAY_MS) });
  }
  return out.sort((a, b) => b.overdueDays - a.overdueDays || a.id.localeCompare(b.id));
}
