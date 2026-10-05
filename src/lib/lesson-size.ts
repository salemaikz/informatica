import type { Lesson, Step } from "./types";

// Сколько шагов увидит ученик: шаги урока + «босс» в формате ЕНТ, который вставляет код (lib/ent-boss.ts, #84).
// Отдельный лёгкий модуль: карта не должна грузить весь банк ЕНТ ради подписи «N шагов».
// В банке ЕНТ каждого урока есть «соответствие» и «несколько верных» — кроме навыков без экзаменационных заданий
// (стратегия ЕНТ — как в scripts/check-content.ts); сверку с withEntBoss держит tests/ent-boss.test.ts.

const isEntMulti = (s: Step): boolean => s.type === "multi" && !!s.ent && s.options.length === 6;
/** Навыки без заданий ЕНТ в банке: урок о стратегии сам экзаменационных заданий не даёт. */
const NO_ENT_SKILLS: readonly string[] = ["ent.strategy"];

export function lessonStepCount(lesson: Pick<Lesson, "steps" | "micro" | "skills">): number {
  if (lesson.micro || lesson.skills.every((s) => NO_ENT_SKILLS.includes(s))) return lesson.steps.length;
  const match = lesson.steps.some((s) => s.type === "entmatch") ? 0 : 1;
  const multi = lesson.steps.some(isEntMulti) ? 0 : 1;
  return lesson.steps.length + match + multi;
}
