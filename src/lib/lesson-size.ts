import type { Lesson, Step } from "./types";

// Сколько шагов увидит ученик: шаги урока + «босс» в формате ЕНТ, который вставляет код (lib/ent-boss.ts, #84).
// Отдельный лёгкий модуль: карта не должна грузить весь банк ЕНТ ради подписи «N шагов».
// Оценка: считаем, что в банке ЕНТ урока есть «соответствие» и «несколько верных» (так у всех уроков, кроме стратегии ЕНТ).

const isEntMulti = (s: Step): boolean => s.type === "multi" && !!s.ent && s.options.length === 6;

export function lessonStepCount(lesson: Pick<Lesson, "steps" | "micro">): number {
  if (lesson.micro) return lesson.steps.length;
  const match = lesson.steps.some((s) => s.type === "entmatch") ? 0 : 1;
  const multi = lesson.steps.some(isEntMulti) ? 0 : 1;
  return lesson.steps.length + match + multi;
}
