import type { GameMode, GameResult } from "@/games/types";

// Награды за мини-игры. Чистые функции — покрыты тестами.

export const GAME_XP = {
  perCorrect: 2,
  cap: 30,
  newBest: 5,
  /** В спокойном режиме XP вдвое меньше (нет времени и есть помощь). */
  calmPerCorrect: 1,
  calmCap: 15,
} as const;

/** Ключ рекорда: у «Обычного» и «Блица» рекорды раздельные, в «Спокойном» рекорда нет. */
export function gameStatKey(gameId: string, mode: GameMode): string | null {
  if (mode === "calm") return null;
  return mode === "blitz" ? `${gameId}:blitz` : gameId;
}

export interface GameReward {
  xp: number;
  newBest: boolean;
  /** Навык → доля верных действий в игре (обновляет освоение один раз за игру). */
  skillScores: Record<string, number>;
}

export function gameReward(result: GameResult, prevBest: number | undefined, mode: GameMode = "normal"): GameReward {
  const calm = mode === "calm";
  const newBest = !calm && result.score > 0 && (prevBest === undefined || result.score > prevBest);
  const xp = calm
    ? Math.min(GAME_XP.calmCap, result.correct * GAME_XP.calmPerCorrect)
    : Math.min(GAME_XP.cap, result.correct * GAME_XP.perCorrect) + (newBest && prevBest !== undefined ? GAME_XP.newBest : 0);
  const bySkill: Record<string, { c: number; n: number }> = {};
  for (const a of result.attempts) {
    const s = (bySkill[a.skill] ??= { c: 0, n: 0 });
    s.n++;
    if (a.correct) s.c++;
  }
  const skillScores: Record<string, number> = {};
  // Меньше 3 действий по навыку — слишком мало данных, освоение не трогаем.
  for (const [skill, s] of Object.entries(bySkill)) if (s.n >= 3) skillScores[skill] = s.c / s.n;
  return { xp, newBest, skillScores };
}
