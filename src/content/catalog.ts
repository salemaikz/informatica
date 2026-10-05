import type { Shape } from "@/lib/bank/types";
import { unitPaperSizeOf } from "@/lib/exam";
import type { LessonMeta, SkillId } from "@/lib/types";
import { BANK_SHAPES, ENT_SKILL_COUNTS, LESSON_META, WORKED_SKILLS } from "./catalog.generated";

// Лёгкий доступ к курсу без содержимого уроков и банков (этап 16, скорость).
// Полный урок (шаги, конспект) — getLesson из content/course.ts, только на страницах, где урок проходят.

export { ENT_TOPIC_COUNTS, LESSON_META } from "./catalog.generated";

/** Урок без шагов и конспекта: название, навыки, длительность, число шагов. */
export function lessonMeta(id: string): LessonMeta | undefined {
  return LESSON_META[id];
}

/** У навыка есть банк заданий (его можно тренировать). */
export const hasBank = (skill: SkillId): boolean => !!BANK_SHAPES[skill];

/** Банк навыка умеет выдавать задания этой формы. */
export const hasShape = (skill: SkillId, shape: Shape): boolean => !!BANK_SHAPES[skill]?.includes(shape);

/** Навыки из списка, которые умеют выдавать задания нужной формы. */
export function skillsWithShape(skills: SkillId[], shape: Shape): SkillId[] {
  return skills.filter((s) => hasShape(s, shape));
}

const WORKED = new Set(WORKED_SKILLS);

/** Навыки, по которым в уроках есть пошаговые разборы для игры «Собери решение». */
export function skillsWithWorked(skills: SkillId[]): SkillId[] {
  return skills.filter((s) => WORKED.has(s));
}

/** Сколько заданий войдёт в контрольную по этим навыкам (как unitPaperSize, но без загрузки банка ЕНТ). */
export function entUnitPaperSize(skillIds: readonly SkillId[]): number {
  let plain = 0;
  let contexts = 0;
  for (const s of new Set(skillIds)) {
    const c = ENT_SKILL_COUNTS[s];
    if (c) {
      plain += c[0];
      contexts += c[1];
    }
  }
  return unitPaperSizeOf(plain, contexts > 0);
}

/** Обычных (не контекстных) заданий ЕНТ по этим навыкам: мини-тест группы (как miniTestPool(…).length). */
export function entPlainCount(skillIds: readonly SkillId[]): number {
  let n = 0;
  for (const s of new Set(skillIds)) n += ENT_SKILL_COUNTS[s]?.[0] ?? 0;
  return n;
}
