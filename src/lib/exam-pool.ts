// Тег текущего банка заданий ЕНТ для вызова другу (#73): тот же seed даёт тот же вариант, только пока не менялись
// банк и алгоритм сборки. Поменяли buildExam или перемешивание (lib/exam.ts) — увеличьте EXAM_BUILD_VERSION
// (сторожевой тест tests/challenge.test.ts напомнит: он сверяет отпечаток варианта с тегом).

import { ENT_POOL } from "@/content/ent";
import { poolTag } from "./challenge";

/** Версия алгоритма сборки варианта. */
export const EXAM_BUILD_VERSION = 1;

let cached: string | null = null;

/** Тег текущего банка (4 знака [a-z0-9]); считается один раз. */
export function currentPoolTag(): string {
  cached ??= poolTag(
    ENT_POOL.map((i) => i.id),
    EXAM_BUILD_VERSION,
  );
  return cached;
}
