import type { Lesson } from "@/lib/types";
import { LESSONS } from "./lessons/all";

// Полное содержимое уроков (шаги, конспекты) — тяжёлое: импортировать только там, где урок проходят или разбирают
// (урок, тренировка, игра, пробник). Карте, профилю и меню хватает лёгкой карты и каталога (content/course-map.ts,
// content/catalog.ts) — этап 16.
export { UNITS, lessonNumber, unlockedSkills } from "./course-map";
export { LESSONS };

export function getLesson(id: string): Lesson | undefined {
  // Только свои ключи: «constructor» или «toString» из адреса не должны находить «урок» в прототипе объекта.
  return Object.hasOwn(LESSONS, id) ? LESSONS[id] : undefined;
}

/** Ищет шаг урока по id (для работы над ошибками). */
export function findStep(lessonId: string | undefined, stepId: string) {
  if (!lessonId) return undefined;
  return getLesson(lessonId)?.steps.find((s) => s.id === stepId);
}
