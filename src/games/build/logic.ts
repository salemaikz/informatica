import { LESSONS } from "@/content/course";
import type { GameAttempt, GameMode, GameResult } from "@/games/types";
import { hashString, plainText, seeded, shuffle } from "@/lib/text";
import type { L, OrderStep, SkillId } from "@/lib/types";

// Чистая логика «Собери решение»: берём пошаговые разборы (worked) из уроков и превращаем их в задания «расставь по порядку». Без React.

/** Навыки по умолчанию, когда игре не передали свои (в реестре GameMeta.skills — все навыки: разборы есть везде). */
export const DEFAULT_SKILLS: SkillId[] = ["ns.bin2dec", "ns.dec2bin"];
/** Годятся разборы с таким числом шагов. */
export const MIN_STEPS = 3;
export const MAX_STEPS = 7;
/** Сколько решений в раунде: спокойный и обычный темп. */
export const ROUNDS: Record<Exclude<GameMode, "blitz">, number> = { calm: 5, normal: 6 };
/** Обычный темп: секунд на каждый шаг решения. */
export const SEC_PER_STEP = 20;
/** Блиц: общее время, мс. */
export const BLITZ_MS = 180_000;
/** Очки за каждый шаг верно собранного решения. */
export const POINTS_PER_STEP = 10;
/** Бонус за каждое следующее решение подряд без ошибок и его потолок. */
export const STREAK_BONUS = 5;
export const STREAK_CAP = 4;

/** Разбор из урока в удобном виде. */
export interface WorkedRef {
  /** Стабильный ключ: урок + шаг. */
  key: string;
  lessonId: string;
  title: L;
  steps: L[];
  result?: L;
  skill: SkillId;
}

/** Задание-порядок игры: обычный `order` плюс итог разбора и навык. */
export interface BuildTask {
  step: OrderStep & { skill: SkillId };
  title: L;
  result?: L;
}

/** Навыки игры: переданные или по умолчанию. */
export function resolveSkills(skills?: SkillId[]): SkillId[] {
  return skills && skills.length > 0 ? skills : DEFAULT_SKILLS;
}

const stripL = (v: L): L => ({ ru: plainText(v.ru), kk: plainText(v.kk) });

/** Все подходящие разборы уроков, чьи навыки пересекаются с переданными (порядок — как в курсе). */
export function collectWorked(skills: SkillId[]): WorkedRef[] {
  const wanted = new Set(skills);
  const out: WorkedRef[] = [];
  for (const lesson of Object.values(LESSONS)) {
    if (!lesson.skills.some((s) => wanted.has(s))) continue;
    for (const step of lesson.steps) {
      if (step.type !== "worked") continue;
      if (step.steps.length < MIN_STEPS || step.steps.length > MAX_STEPS) continue;
      out.push({
        key: `${lesson.id}:${step.id}`,
        lessonId: lesson.id,
        title: step.title,
        steps: step.steps.map((s) => s.text),
        result: step.result,
        skill: step.skill ?? lesson.skills[0],
      });
    }
  }
  return out;
}

/** Разбор → задание «расставь по порядку» (шаги без разметки: OrderView выводит обычный текст).
 *  salt входит в id шага: OrderView перемешивает карточки по id, так в каждой игре — свой порядок. */
export function toTask(ref: WorkedRef, salt = ""): BuildTask {
  const title = stripL(ref.title);
  const result = ref.result ? stripL(ref.result) : undefined;
  return {
    title,
    result,
    step: {
      id: `build:${ref.key}${salt ? `#${salt}` : ""}`,
      type: "order",
      skill: ref.skill,
      prompt: title,
      items: ref.steps.map(stripL),
      explanation: result ?? title,
    },
  };
}

/** Сколько решений в игре: null — сколько найдётся до конца времени (блиц). */
export function roundCount(mode: GameMode): number | null {
  return mode === "blitz" ? null : ROUNDS[mode];
}

/** Решения раунда: перемешаны по seed, без повторов, не больше нужного числа (мало разборов — сколько есть). */
export function buildRound(skills: SkillId[], mode: GameMode, seed: number): BuildTask[] {
  const refs = shuffle(collectWorked(skills), seeded(hashString(`${seed}:build`)));
  const n = roundCount(mode);
  return (n === null ? refs : refs.slice(0, n)).map((r) => toTask(r, String(seed)));
}

/** Время на решение, мс: только в обычном темпе, 20 с на шаг. */
export function taskBudgetMs(mode: GameMode, stepCount: number): number | null {
  return mode === "normal" ? stepCount * SEC_PER_STEP * 1000 : null;
}

export interface BuildState {
  /** Сколько решений уже проверено. */
  done: number;
  score: number;
  correct: number;
  streak: number;
  attempts: GameAttempt[];
}

export const initialState = (): BuildState => ({ done: 0, score: 0, correct: 0, streak: 0, attempts: [] });

/** Бонус за серию: за второе и каждое следующее решение подряд без ошибок. */
export function streakBonus(streakBefore: number): number {
  return Math.min(streakBefore, STREAK_CAP) * STREAK_BONUS;
}

/** Применяет итог проверки одного решения. Время вышло — это неверно (ответа нет). */
export function applyResult(state: BuildState, task: BuildTask, correct: boolean): { state: BuildState; gained: number; bonus: number } {
  const bonus = correct ? streakBonus(state.streak) : 0;
  const gained = correct ? task.step.items.length * POINTS_PER_STEP + bonus : 0;
  return {
    gained,
    bonus,
    state: {
      done: state.done + 1,
      score: state.score + gained,
      correct: state.correct + (correct ? 1 : 0),
      streak: correct ? state.streak + 1 : 0,
      attempts: [...state.attempts, { skill: task.step.skill, correct }],
    },
  };
}

export const toResult = (s: BuildState): GameResult => ({ score: s.score, correct: s.correct, total: s.done, attempts: s.attempts });
