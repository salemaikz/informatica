import { streakAtRisk, type Streak } from "@/lib/gamification";
import { dueLessons, type LessonStat } from "@/lib/review";

/** Число на значке иконки: уроки «пора повторить» + 1, если серия под угрозой. 0 — значок убрать. */
export function badgeCount(lessons: Record<string, LessonStat>, streak: Streak, today: string, now: number): number {
  return dueLessons(lessons, now).length + (streakAtRisk(streak, today) ? 1 : 0);
}
