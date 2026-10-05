import { ENT_POOL } from "@/content/ent";
import { readKindOf } from "./code-read";
import { entRef, entStepFromRef, parseEntRef } from "./ent-steps";
import { REVIEW_LESSON_RE } from "./lesson-size";
import { shuffleEntItem } from "./exam";
import { isQuestion } from "./evaluate";
import { hashString } from "./text";
import type { EntItem, EntMatch, EntMulti, EntSingle, Lesson, ReadKind, Step } from "./types";

// «Босс урока» в настоящем формате ЕНТ (этап 14, решение #84): в каждый урок кодом вставляем одно «соответствие»
// (2 пункта × 4 описания, 2/1/0 балла) и, если в уроке нет, одно «несколько верных» из 6 вариантов.
// Этап 15 (#87): в урок по коду, SQL, таблицам и вебу (REVIEW_LESSON_RE) — ещё одно «чтение кода» как на ЕНТ: где ошибка,
// что поменять, что вставить, зачем строка.
// Задания берём из банка ЕНТ урока — файлы уроков не трогаем. Чистая логика без React (тесты — tests/ent-boss.test.ts).

/** «Несколько верных» в формате ЕНТ — шаг multi с пометкой ЕНТ и ровно 6 вариантами. */
const isEntMulti = (s: Step): boolean => s.type === "multi" && !!s.ent && s.options.length === 6;

const byId = (a: EntItem, b: EntItem): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Задание из кандидатов одного вида: сначала собственные задания урока (id «<урок>:…»), иначе любое с навыком урока.
 * Выбор детерминирован: задание с наименьшим hash(урок + задание) — новые задания в банке почти никогда не меняют выбор,
 * и незаконченные прохождения не сбрасываются с каждым пополнением банка. Уже стоящие в уроке (ent:<id>) пропускаем.
 */
function pickFor<T extends EntMatch | EntMulti | EntSingle>(lesson: Lesson, items: readonly T[], taken: ReadonlySet<string>): T | undefined {
  const free = items.filter((i) => !taken.has(entRef(i.id)));
  const own = free.filter((i) => i.id.startsWith(`${lesson.id}:`));
  const bySkill = free.filter((i) => lesson.skills.includes(i.skill));
  const from = own.length ? own : bySkill;
  let best: T | undefined;
  let bestKey = Infinity;
  for (const i of [...from].sort(byId)) {
    const key = hashString(`${lesson.id}|${i.id}`);
    if (key < bestKey) {
      best = i;
      bestKey = key;
    }
  }
  return best;
}

/**
 * Шаг из задания с перемешанными вариантами: в банке ЕНТ верный ответ чаще стоит первым (у «соответствия» A — 1, B — 2
 * в 39% заданий) — без перемешивания ответ угадывается по шаблону. Порядок постоянный для урока (seed — id урока).
 */
const bossStep = (lesson: Lesson, item: EntMatch | EntMulti | EntSingle) => entStepFromRef(entRef(item.id), [shuffleEntItem(item, hashString(lesson.id))]);

/** Виды «чтения», которых в уроках почти не было (#87): «что выведет» в уроках и так в избытке. */
export const REVIEW_KINDS: readonly ReadKind[] = ["bug", "fix", "fill", "purpose"];

const isReview = (item: EntItem): boolean => {
  const k = item.kind === "single" ? readKindOf(item) : null;
  return k !== null && REVIEW_KINDS.includes(k);
};

/** В уроке уже есть задание ЕНТ «где ошибка / что поменять / что вставить / зачем строка» (повторный вызов ничего не добавит). */
const hasReviewStep = (lesson: Lesson, pool: readonly EntItem[]): boolean =>
  lesson.steps.some((s) => {
    const parsed = parseEntRef(s.id, pool);
    return !!parsed && parsed.n === undefined && isReview(parsed.item);
  });

/** Куда вставлять: сразу после последнего задания ЕНТ, а если таких нет — перед хвостом из шагов без ответа. */
export function entBossIndex(steps: readonly Step[]): number {
  let lastEnt = -1;
  steps.forEach((s, i) => {
    if (isQuestion(s) && s.ent) lastEnt = i;
  });
  if (lastEnt >= 0) return lastEnt + 1;
  let tail = steps.length;
  while (tail > 0 && !isQuestion(steps[tail - 1])) tail--;
  // В уроке нет ни одного задания — просто в конец.
  return tail === 0 ? steps.length : tail;
}

/**
 * Урок с «боссом» в формате ЕНТ. Микроурок (`micro`) — как есть. Нет шага `entmatch` — добавляем «соответствие»
 * из банка ЕНТ, нет `multi` с ЕНТ на 6 вариантов — добавляем «несколько верных»; урок по коду, SQL, таблицам или вебу
 * получает ещё одно «чтение кода» (#87) — задание, которого в уроке ещё нет. Исходный урок не меняется;
 * если добавлять нечего (задание уже есть или в банке нет подходящего) — возвращается тот же объект.
 */
export function withEntBoss(lesson: Lesson, pool: readonly EntItem[] = ENT_POOL): Lesson {
  if (lesson.micro || lesson.school) return lesson;
  const taken = new Set(lesson.steps.map((s) => s.id));
  const add: Step[] = [];

  if (!lesson.steps.some((s) => s.type === "entmatch")) {
    const item = pickFor(lesson, pool.filter((i): i is EntMatch => i.kind === "match"), taken);
    const step = item && bossStep(lesson, item);
    if (step) add.push(step);
  }
  if (!lesson.steps.some(isEntMulti)) {
    const item = pickFor(lesson, pool.filter((i): i is EntMulti => i.kind === "multi"), taken);
    const step = item && item.options.length === 6 ? bossStep(lesson, item) : undefined;
    if (step) add.push(step);
  }
  if (REVIEW_LESSON_RE.test(lesson.id) && !hasReviewStep(lesson, pool)) {
    const item = pickFor(lesson, pool.filter((i): i is EntSingle => i.kind === "single" && isReview(i)), taken);
    const step = item && bossStep(lesson, item);
    if (step) add.push(step);
  }
  if (!add.length) return lesson;

  const at = entBossIndex(lesson.steps);
  return { ...lesson, steps: [...lesson.steps.slice(0, at), ...add, ...lesson.steps.slice(at)] };
}
