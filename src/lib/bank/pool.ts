import type { Level, QuestionStep, SkillId } from "../types";
import { seeded, shuffle } from "../text";
import type { Pair, ShortQuestion, SkillBank, Statement } from "./types";

// Банк из готовых (статичных) заданий — для тем «на знание», где задание не сгенерировать кодом:
// устройства, ПО, сети, безопасность, современные IT. Варианты ответа перемешиваются по seed,
// поэтому одно и то же задание в разных тренировках выглядит по-разному.

export interface PoolInput {
  skill: SkillId;
  /** Задания с обязательным level; id уникальны. */
  questions: QuestionStep[];
  statements?: Statement[];
  pairs?: Pair[];
  shorts?: ShortQuestion[];
}

/**
 * Перемешивает варианты choice/multi (вместе с whyWrong и индексами верных) и описания «соответствия» ЕНТ (entmatch,
 * с пересчётом answer). Остальные типы — без изменений.
 */
export function shuffleOptions(step: QuestionStep, seed: number): QuestionStep {
  if (step.type === "entmatch") {
    const order = shuffle(
      step.choices.map((_, i) => i),
      seeded(seed),
    );
    return { ...step, choices: order.map((i) => step.choices[i]), answer: step.answer.map((a) => order.indexOf(a)) };
  }
  if (step.type !== "choice" && step.type !== "multi") return step;
  const rand = seeded(seed);
  const order = shuffle(
    step.options.map((_, i) => i),
    rand,
  );
  const options = order.map((i) => step.options[i]);
  const whyWrong = step.whyWrong ? order.map((i) => step.whyWrong![i]) : undefined;
  if (step.type === "choice") return { ...step, options, whyWrong, correct: order.indexOf(step.correct) };
  return { ...step, options, whyWrong, correct: step.correct.map((c) => order.indexOf(c)).sort((a, b) => a - b) };
}

/** Элементы нужного уровня; если таких нет — ближайшего уровня. */
function byLevel<T extends { level?: Level }>(items: T[], level: Level): T[] {
  for (const d of [0, -1, 1, -2, 2]) {
    const l = level + d;
    const found = items.filter((x) => (x.level ?? 1) === l);
    if (found.length) return found;
  }
  return items;
}

function pickBy<T>(items: T[], seed: number): T {
  return items[Math.floor(seeded(seed)() * items.length)];
}

export function poolBank(input: PoolInput): SkillBank {
  const { skill } = input;
  if (!input.questions.length) throw new Error(`poolBank ${skill}: пустой список заданий`);
  const bank: SkillBank = {
    skill,
    question(level, seed) {
      const base = pickBy(byLevel(input.questions, level), seed);
      // Уровень берём у самого задания (ближайший доступный). Хвост «#seed» делает id уникальным в тренировке,
      // а отсев повторов (bank/index.ts) его отбрасывает — одно и то же задание дважды не попадётся.
      return shuffleOptions({ ...base, skill, id: `${base.id}#${seed % 100000}` }, seed + 1);
    },
  };
  if (input.statements?.length) bank.statement = (level, seed) => pickBy(byLevel(input.statements!, level), seed);
  if (input.pairs?.length) bank.pair = (level, seed) => pickBy(byLevel(input.pairs!, level), seed);
  if (input.shorts?.length) bank.short = (level, seed) => pickBy(byLevel(input.shorts!, level), seed);
  return bank;
}
