import type { Lesson } from "@/lib/types";
import { lessonBinary } from "./lessons/ns-1-binary";
import { lessonBits } from "./lessons/ns-1-bits";
import { lessonRead } from "./lessons/ns-2-read";
import { lessonWrite } from "./lessons/ns-3-write";
import { lessonTraps } from "./lessons/ns-4-traps";
import { GENERATED_LESSONS } from "./lessons/generated";

// Полное содержимое уроков (шаги, конспекты) — тяжёлое: импортировать только там, где урок проходят или разбирают
// (урок, тренировка, игра, пробник). Карте, профилю и меню хватает лёгкой карты и каталога (content/course-map.ts,
// content/catalog.ts) — этап 16.
export { UNITS, lessonNumber, unlockedSkills } from "./course-map";

export const LESSONS: Record<string, Lesson> = {
  [lessonBits.id]: lessonBits,
  [lessonRead.id]: lessonRead,
  [lessonWrite.id]: lessonWrite,
  [lessonTraps.id]: lessonTraps,
  // Старый урок 1 (до серии из 4 уроков): не на карте, но нужен для прогресса,
  // открытых навыков и «работы над ошибками» тех, кто его уже прошёл.
  [lessonBinary.id]: lessonBinary,
  // Уроки контент-потока (этап 3): подключаются скриптом scripts/register-content.mjs.
  ...Object.fromEntries(GENERATED_LESSONS.map((l) => [l.id, l])),
};

export function getLesson(id: string): Lesson | undefined {
  return LESSONS[id];
}

/** Ищет шаг урока по id (для работы над ошибками). */
export function findStep(lessonId: string | undefined, stepId: string) {
  if (!lessonId) return undefined;
  return LESSONS[lessonId]?.steps.find((s) => s.id === stepId);
}
