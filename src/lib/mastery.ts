// Модель освоения навыка: экспоненциальное сглаживание по ответам.
// Первый ответ задаёт стартовую оценку, дальше каждый ответ сдвигает её на ALPHA.

export interface SkillStat {
  attempts: number;
  correct: number;
  /** 0..1 */
  mastery: number;
  lastSeen: number;
}

export const ALPHA = 0.3;
export const WEAK_BELOW = 0.6;
export const MASTERED_FROM = 0.8;

export function emptySkillStat(): SkillStat {
  return { attempts: 0, correct: 0, mastery: 0, lastSeen: 0 };
}

/** score: 1 — верно, 0 — неверно, промежуточное — частично верно. */
export function updateSkill(stat: SkillStat | undefined, score: number, now = Date.now()): SkillStat {
  const s = stat ?? emptySkillStat();
  const outcome = Math.max(0, Math.min(1, score));
  const mastery = s.attempts === 0 ? 0.2 + 0.5 * outcome : s.mastery + ALPHA * (outcome - s.mastery);
  return {
    attempts: s.attempts + 1,
    correct: s.correct + (outcome >= 0.99 ? 1 : 0),
    mastery: Math.round(mastery * 1000) / 1000,
    lastSeen: now,
  };
}

export type MasteryLevel = "new" | "weak" | "progress" | "mastered";

export function masteryLevel(stat: SkillStat | undefined): MasteryLevel {
  if (!stat || stat.attempts === 0) return "new";
  if (stat.mastery < WEAK_BELOW) return "weak";
  if (stat.mastery < MASTERED_FROM) return "progress";
  return "mastered";
}

/** Слабые навыки — от самого слабого к сильному. */
export function weakSkills(stats: Record<string, SkillStat>): string[] {
  return Object.entries(stats)
    .filter(([, s]) => masteryLevel(s) === "weak")
    .sort((a, b) => a[1].mastery - b[1].mastery)
    .map(([id]) => id);
}
