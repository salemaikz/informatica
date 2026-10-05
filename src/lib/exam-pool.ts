// Тег текущего банка заданий ЕНТ для вызова другу (#73): тот же seed даёт тот же вариант, только пока не менялись
// банк и алгоритм сборки. Поменяли buildExam или перемешивание (lib/exam.ts) — увеличьте EXAM_BUILD_VERSION
// (сторожевой тест tests/challenge.test.ts напомнит: он сверяет отпечаток варианта с тегом).

import { ENT_POOL } from "@/content/ent";
import type { EntItem } from "./types";
import { poolTag } from "./challenge";

/** Версия алгоритма сборки варианта. 2 — подпись задания вместо одного id. */
export const EXAM_BUILD_VERSION = 2;

/** Подпись задания для тега: всё, от чего зависят выбор в вариант и перемешивание (id, вид, тема, уровень, число вариантов). */
export function itemSignature(i: EntItem): string {
  const n = i.kind === "context" ? i.questions.map((q) => q.options.length).join(".") : i.kind === "match" ? `${i.items.length}x${i.choices.length}` : String(i.options.length);
  return `${i.id}:${i.kind}:${i.topic}:${i.level}:${n}`;
}

let cached: string | null = null;

/** Тег текущего банка (4 знака [a-z0-9]); считается один раз. */
export function currentPoolTag(): string {
  cached ??= poolTag(ENT_POOL.map(itemSignature), EXAM_BUILD_VERSION);
  return cached;
}
