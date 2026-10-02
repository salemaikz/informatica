"use client";

import { useApp } from "./store";
import { liveStreak, levelInfo } from "./gamification";
import { todayKey } from "./text";

/** XP за сегодня и прогресс дневной цели. */
export function useDaily() {
  const days = useApp((s) => s.days);
  const goal = useApp((s) => s.profile.dailyGoalXp);
  const xp = days[todayKey()]?.xp ?? 0;
  return { xp, goal, progress: Math.min(1, xp / goal), done: xp >= goal };
}

export function useStreak() {
  const streak = useApp((s) => s.streak);
  const today = todayKey();
  return { current: liveStreak(streak, today), best: streak.best, activeToday: streak.lastDay === today };
}

export function useLevel() {
  const xp = useApp((s) => s.xp);
  return { xp, ...levelInfo(xp) };
}
