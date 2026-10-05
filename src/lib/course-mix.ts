import type { QuestionStep } from "./types";
import type { SkillStat } from "./mastery";
import type { LessonStat } from "./review";
import type { CourseGroup } from "@/content/groups";

// ЗАГЛУШКА каркаса этапа 14 — реализует пакет P2 (docs/specs/stage14.md, раздел P2).
// Практика после группы и повторение раздела собираются кодом из банков: 50% текущая группа (раздел),
// 30% две-три предыдущие группы, 20% всё с начала курса; слабые и давние навыки — чаще (#46).
// stats — уже с затуханием (decaySkills). Чистая логика без React.

/** Заданий в «Практике», «Повторении» и мини-тесте. */
export const PRACTICE_COUNT = 12;
export const RECAP_COUNT = 15;
export const MINITEST_COUNT = 6;

/** «Практика» после группы уроков. */
export function buildPractice(group: CourseGroup, lessons: Record<string, LessonStat>, stats: Record<string, SkillStat>, seed: number): QuestionStep[] {
  void group;
  void lessons;
  void stats;
  void seed;
  return [];
}

/** «Повторение» в конце раздела unitId: текущий раздел 50%, три группы перед ним 30%, всё раньше 20%. */
export function buildRecap(unitId: string, lessons: Record<string, LessonStat>, stats: Record<string, SkillStat>, seed: number): QuestionStep[] {
  void unitId;
  void lessons;
  void stats;
  void seed;
  return [];
}

/** Мини-тест группы: задания ЕНТ навыков группы в настоящем формате (single, multi на 6, «соответствие» 2×4). */
export function buildMiniTest(group: CourseGroup, seed: number): QuestionStep[] {
  void group;
  void seed;
  return [];
}
