import { ENT_POOL } from "@/content/ent";
import { entRef, entStepFromRef } from "./ent-steps";
import { shuffleEntItem } from "./exam";
import { isQuestion } from "./evaluate";
import { hashString } from "./text";
import type { EntItem, EntMatch, EntMulti, Lesson, Step } from "./types";

// «Босс урока» в настоящем формате ЕНТ (этап 14, решение #84): в каждый урок кодом вставляем одно «соответствие»
// (2 пункта × 4 описания, 2/1/0 балла) и, если в уроке нет, одно «несколько верных» из 6 вариантов.
// Задания берём из банка ЕНТ урока — файлы уроков не трогаем. Чистая логика без React (тесты — tests/ent-boss.test.ts).

/** «Несколько верных» в формате ЕНТ — шаг multi с пометкой ЕНТ и ровно 6 вариантами. */
const isEntMulti = (s: Step): boolean => s.type === "multi" && !!s.ent && s.options.length === 6;

const byId = (a: EntItem, b: EntItem): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Задание из кандидатов одного вида: сначала собственные задания урока (id «<урок>:…»), иначе любое с навыком урока.
 * Выбор детерминирован: задание с наименьшим hash(урок + задание) — новые задания в банке почти никогда не меняют выбор,
 * и незаконченные прохождения не сбрасываются с каждым пополнением банка. Уже стоящие в уроке (ent:<id>) пропускаем.
 */
function pickFor<T extends EntMatch | EntMulti>(lesson: Lesson, items: readonly T[], taken: ReadonlySet<string>): T | undefined {
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
const bossStep = (lesson: Lesson, item: EntMatch | EntMulti) => entStepFromRef(entRef(item.id), [shuffleEntItem(item, hashString(lesson.id))]);

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
 * из банка ЕНТ, нет `multi` с ЕНТ на 6 вариантов — добавляем «несколько верных». Исходный урок не меняется;
 * если добавлять нечего (задание уже есть или в банке нет подходящего) — возвращается тот же объект.
 */
export function withEntBoss(lesson: Lesson, pool: readonly EntItem[] = ENT_POOL): Lesson {
  if (lesson.micro) return lesson;
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
  if (!add.length) return lesson;

  const at = entBossIndex(lesson.steps);
  return { ...lesson, steps: [...lesson.steps.slice(0, at), ...add, ...lesson.steps.slice(at)] };
}
