import { ENT_POOL } from "@/content/ent";
import { isReadItem, leastUsedRead, readKindOf } from "./code-read";
import { entRef, entStepFromRef } from "./ent-steps";
import { shuffleEntItem } from "./exam";
import { seeded, shuffle } from "./text";
import type { EntItem, EntTopicId, Level, QuestionStep, ReadKind } from "./types";

// Тренировка «Чтение кода» (#87, этап 15): 10 заданий ЕНТ «на чтение» одной области — что выведет, где ошибка, что
// поменять, что вставить, зачем строка, где ключ. Бесплатно, как любая тренировка. Программу здесь не запускаем:
// на ЕНТ её тоже не запустить, а запуск выдал бы ответ «где ошибка». Чистая логика без React (tests/code-review-drill.test.ts).

export type ReviewArea = "py" | "db" | "sql" | "sheet" | "web" | "mix";

export interface ReviewAreaInfo {
  id: ReviewArea;
  topics: readonly EntTopicId[];
}

/** Области тренировки: тема ЕНТ → что читаем. «Вперемешку» — все практические темы. */
export const REVIEW_AREAS: readonly ReviewAreaInfo[] = [
  { id: "py", topics: ["t06", "t07"] },
  { id: "db", topics: ["t09"] },
  { id: "sql", topics: ["t10"] },
  { id: "sheet", topics: ["t12"] },
  { id: "web", topics: ["t13"] },
  { id: "mix", topics: ["t06", "t07", "t09", "t10", "t12", "t13"] },
];

export const REVIEW_DRILL_COUNT = 10;
/** Меньше заданий в области — тренировки нет. */
export const REVIEW_MIN_ITEMS = 6;

export function parseReviewArea(v: unknown): ReviewArea | null {
  return REVIEW_AREAS.some((a) => a.id === v) ? (v as ReviewArea) : null;
}

/** Задания «на чтение» области (без контекстных — у них своя тренировка), по id — порядок банка не влияет. */
export function reviewItems(area: ReviewArea, pool: readonly EntItem[] = ENT_POOL): EntItem[] {
  const topics = REVIEW_AREAS.find((a) => a.id === area)?.topics ?? [];
  return pool.filter((i) => topics.includes(i.topic) && isReadItem(i)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Сколько заданий каждого вида «чтения» в области (для карточек). */
export function reviewCounts(area: ReviewArea, pool: readonly EntItem[] = ENT_POOL): { total: number; byKind: Partial<Record<ReadKind, number>> } {
  const byKind: Partial<Record<ReadKind, number>> = {};
  const items = reviewItems(area, pool);
  for (const i of items) {
    const k = readKindOf(i);
    if (k) byKind[k] = (byKind[k] ?? 0) + 1;
  }
  return { total: items.length, byKind };
}

/** Уровни 50/30/20 на 10 заданий — от лёгкого к сложному, как в тренировке. */
const LEVELS: readonly Level[] = [1, 1, 1, 1, 1, 2, 2, 2, 3, 3];

/**
 * Сессия: 10 заданий области, уровни A → B → C, виды «чтения» по очереди (сначала те, что встречались реже;
 * «что выведет» стартует со штрафом — его в банке больше всего, а ЕНТ проверяет и ошибки, и правки).
 * Варианты перемешаны по seed. Заданий меньше REVIEW_MIN_ITEMS — пусто.
 */
export function buildReviewDrill(area: ReviewArea, seed: number, pool: readonly EntItem[] = ENT_POOL): QuestionStep[] {
  const items = reviewItems(area, pool);
  if (items.length < REVIEW_MIN_ITEMS) return [];
  const rand = seeded(seed);
  const left = shuffle(items, rand);
  const used = new Map<ReadKind, number>([["output", 1]]);
  const picked: EntItem[] = [];
  for (const want of LEVELS.slice(0, Math.min(REVIEW_DRILL_COUNT, items.length))) {
    const best = Math.min(...left.map((i) => Math.abs(i.level - want)));
    const tied = leastUsedRead(
      left.filter((i) => Math.abs(i.level - want) === best),
      used,
    );
    const item = tied[0];
    if (!item) break;
    left.splice(left.indexOf(item), 1);
    const k = readKindOf(item);
    if (k) used.set(k, (used.get(k) ?? 0) + 1);
    picked.push(item);
  }
  const steps: QuestionStep[] = [];
  for (const item of picked) {
    const step = entStepFromRef(entRef(item.id), [shuffleEntItem(item, seed)]);
    if (step) steps.push(step);
  }
  return steps;
}
