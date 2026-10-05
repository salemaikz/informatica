import type { Lesson } from "@/lib/types";
import { lessonBinary } from "./ns-1-binary";
import { lessonBits } from "./ns-1-bits";
import { lessonRead } from "./ns-2-read";
import { lessonWrite } from "./ns-3-write";
import { lessonTraps } from "./ns-4-traps";
import { GENERATED_LESSONS } from "./generated";

// Все уроки целиком (шаги, конспекты) — тяжёлый модуль. Отдельно от content/course.ts, чтобы генератор каталога
// (scripts/catalog.ts) не зависел от самого каталога: сломанный catalog.generated.ts (например, конфликт слияния)
// пересобирается одной командой npm run catalog.

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
