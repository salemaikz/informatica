import type { CourseGroup } from "@/content/groups";
import { LESSON_META, entPlainCount } from "@/content/catalog";

// Лёгкая часть «Практики» и «Повторения» (этап 16): числа заданий и размер мини-теста по каталогу,
// без банков и заданий ЕНТ — лист практики на карте не грузит их. Сборка заданий — lib/course-mix.ts.

/** Заданий в «Практике», «Повторении» и мини-тесте. */
export const PRACTICE_COUNT = 12;
export const RECAP_COUNT = 15;
export const MINITEST_COUNT = 6;
/** В мини-тесте меньше стольких заданий ЕНТ быть не может — тогда мини-теста нет. */
export const MINITEST_MIN = 3;
/** Сколько групп перед текущей считаются «недавними». */
export const RECENT_GROUPS = 3;

/** Сколько заданий ЕНТ войдёт в мини-тест группы (как min(MINITEST_COUNT, miniTestPool(group).length)). */
export function miniTestSize(group: Pick<CourseGroup, "lessons">): number {
  const skills = group.lessons.flatMap((id) => LESSON_META[id]?.skills ?? []);
  return Math.min(MINITEST_COUNT, entPlainCount(skills));
}
