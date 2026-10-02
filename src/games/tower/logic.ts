import type { GameMode } from "@/games/types";
import { draw, rampLevel, skillsWithShape } from "@/lib/bank";
import { hashString, seeded, shuffle } from "@/lib/text";
import type { ChoiceStep, InputStep, Level, MatchStep, MultiStep, OrderStep, QuestionStep, SkillId } from "@/lib/types";

// Чистая логика «Башни»: подбор заданий по этажам, подсказка 50 на 50, очки, состояние игры. Без React.

export const FLOORS = 10;
/** Навыки по умолчанию (совпадают с GameMeta.skills в реестре). */
export const DEFAULT_SKILLS: SkillId[] = ["ns.bin2dec", "ns.dec2bin", "ns.base", "ns.props"];
/** Блиц: общее время на всю башню, мс. */
export const BLITZ_MS = 120_000;
/** Обычный темп: мягкое время на задание по уровню A/B/C, секунд. */
export const NORMAL_SEC: Record<Level, number> = { 1: 30, 2: 45, 3: 60 };
/** Множитель очков по уровню задания. */
export const LEVEL_MULT: Record<Level, number> = { 1: 1, 2: 1.5, 3: 2 };
/** Бонус за каждый следующий этаж подряд без ошибок (со второго), очки. */
export const STREAK_BONUS = 10;
/** Бонус растёт не дольше, чем на столько этажей подряд. */
export const STREAK_CAP = 5;

/** Типы заданий, которые умеет показывать игра (остальные пропускаем при отборе). */
export type TowerStep = ChoiceStep | MultiStep | InputStep | MatchStep | OrderStep;

const SUPPORTED = new Set<QuestionStep["type"]>(["choice", "multi", "input", "match", "order"]);

export function isSupported(step: QuestionStep): step is TowerStep {
  return SUPPORTED.has(step.type);
}

/** Навыки игры: переданные уроком/темой или по умолчанию — только те, что умеют выдавать вопросы. */
export function resolveSkills(skills?: SkillId[]): SkillId[] {
  const wanted = skills && skills.length > 0 ? skills : DEFAULT_SKILLS;
  return skillsWithShape(wanted, "question");
}

/** Уровень этажа (0-based): задания растут от A к C. */
export function floorLevel(floorIdx: number): Level {
  return rampLevel(floorIdx, FLOORS, 1, 3);
}

/** Уровень задания: свой, если задан, иначе по этажу. */
export function taskLevel(step: QuestionStep, floorIdx: number): Level {
  return step.level ?? floorLevel(floorIdx);
}

/** Время на задание, мс: только в обычном темпе. */
export function taskBudgetMs(mode: GameMode, level: Level): number | null {
  return mode === "normal" ? NORMAL_SEC[level] * 1000 : null;
}

/** Ключ задания для отсева повторов (как в bank.draw: без хвоста уникальности). */
export function stepKey(step: QuestionStep): string {
  return step.id.split("#")[0].split(":").slice(0, 4).join(":");
}

/** Порядок уровней для подбора: нужный, затем ближайшие. */
function levelOrder(level: Level): Level[] {
  const all: Level[] = [1, 2, 3];
  return all.sort((a, b) => Math.abs(a - level) - Math.abs(b - level) || a - b);
}

export interface PickOptions {
  skills: SkillId[];
  /** Этаж 0-based. */
  floor: number;
  seed: number;
  /** Ключи уже показанных заданий. */
  used: readonly string[];
  /** Ключ задания, которое было прямо перед этим (его не повторяем никогда). */
  lastKey?: string;
}

/**
 * Подбирает задание для этажа: сначала нужного уровня и ещё не показанное, затем соседних уровней,
 * затем — повтор ранее показанного (если банк мал), но не то же самое подряд; совсем крошечный банк —
 * хоть то же самое (лучше, чем оборвать игру). null — подходящих нет.
 * Навыки перебираются по одному (порядок — от seed), чтобы задание всегда знало свой навык (для attempts).
 */
export function pickTask(opts: PickOptions): TowerStep | null {
  const pool = skillsWithShape(opts.skills, "question");
  if (!pool.length) return null;
  const order = shuffle(pool, seeded(hashString(`${opts.seed}:${opts.floor}:skills`)));
  const tries = Math.max(order.length, 4);
  const levels = levelOrder(floorLevel(opts.floor));
  const used = new Set(opts.used);
  for (const pass of ["fresh", "repeat", "any"] as const) {
    for (const level of levels) {
      for (let k = 0; k < tries; k++) {
        const skill = order[k % order.length];
        const items = draw("question", {
          skills: [skill],
          count: 4,
          seed: hashString(`${opts.seed}:${opts.floor}:${level}:${k}`),
          minLevel: level,
          maxLevel: level,
          ramp: false,
        });
        const found = items.find((s) => {
          if (!isSupported(s)) return false;
          if (pass === "any") return true;
          const key = stepKey(s);
          if (key === opts.lastKey) return false;
          return pass === "repeat" || !used.has(key);
        });
        if (found) return { ...(found as TowerStep), skill: found.skill ?? skill };
      }
    }
  }
  return null;
}

/**
 * Подсказка «50 на 50»: убирает два неверных варианта. Нужно минимум 4 варианта (остаётся верный и один неверный).
 * Возвращает новое задание (индексы пересчитаны) или null.
 */
export function fiftyFifty(step: ChoiceStep, rand: () => number = Math.random): ChoiceStep | null {
  if (step.options.length < 4) return null;
  const wrong = step.options.map((_, i) => i).filter((i) => i !== step.correct);
  const drop = new Set<number>();
  const pool = [...wrong];
  while (drop.size < 2 && pool.length > 0) {
    const k = Math.floor(rand() * pool.length);
    drop.add(pool[k]);
    pool.splice(k, 1);
  }
  const keep = step.options.map((_, i) => i).filter((i) => !drop.has(i));
  return {
    ...step,
    options: keep.map((i) => step.options[i]),
    correct: keep.indexOf(step.correct),
    whyWrong: step.whyWrong ? keep.map((i) => step.whyWrong?.[i] ?? null) : undefined,
  };
}

/** Можно ли применить 50 на 50 к заданию. */
export function canFiftyFifty(step: QuestionStep | undefined): step is ChoiceStep {
  return !!step && step.type === "choice" && step.options.length >= 4;
}

/** Очки за этаж: номер этажа × 10 × множитель уровня + бонус за этажи без ошибок подряд (streak включает этот этаж). */
export function floorPoints(floorNo: number, level: Level, streak: number): number {
  const base = Math.round(floorNo * 10 * LEVEL_MULT[level]);
  return base + streakBonus(streak);
}

export function streakBonus(streak: number): number {
  return streak >= 2 ? STREAK_BONUS * Math.min(streak - 1, STREAK_CAP) : 0;
}

export interface TowerAttempt {
  skill: SkillId;
  correct: boolean;
}

export interface TowerState {
  /** Сколько этажей пройдено (0..FLOORS); игрок стоит на этаже floor + 1. */
  floor: number;
  score: number;
  correct: number;
  total: number;
  attempts: TowerAttempt[];
  /** Этажей подряд пройдено с первой попытки. */
  cleanStreak: number;
  /** На текущем этаже ошибок пока не было. */
  floorClean: boolean;
  /** Подсказка 50 на 50 уже использована. */
  hintUsed: boolean;
  used: string[];
  /** Сколько заданий показано (для уникальных сидов). */
  taskNo: number;
  lastKey?: string;
}

export function initialState(): TowerState {
  return { floor: 0, score: 0, correct: 0, total: 0, attempts: [], cleanStreak: 0, floorClean: true, hintUsed: false, used: [], taskNo: 0 };
}

export function isTop(state: TowerState): boolean {
  return state.floor >= FLOORS;
}

/** Берёт следующее задание для текущего этажа и отмечает его показанным. null — банк исчерпан. */
export function drawNext(state: TowerState, skills: SkillId[], seed: number): { state: TowerState; step: TowerStep } | null {
  const step = pickTask({ skills, floor: Math.min(state.floor, FLOORS - 1), seed: hashString(`${seed}:${state.taskNo}`), used: state.used, lastKey: state.lastKey });
  if (!step) return null;
  const key = stepKey(step);
  return { state: { ...state, used: [...state.used, key], taskNo: state.taskNo + 1, lastKey: key }, step };
}

export interface AnswerOutcome {
  state: TowerState;
  /** Начисленные очки (0 при ошибке). */
  gained: number;
  /** Бонус за серию этажей без ошибок (часть gained). */
  bonus: number;
  climbed: boolean;
}

/** Учитывает ответ: верно — поднимаемся на этаж, неверно — остаёмся (этаж не падает) и серия прерывается. */
export function applyAnswer(state: TowerState, step: QuestionStep, correct: boolean): AnswerOutcome {
  const attempts = [...state.attempts, { skill: step.skill ?? "", correct }];
  const base = { ...state, attempts, total: state.total + 1 };
  if (!correct) {
    return { state: { ...base, floorClean: false, cleanStreak: 0 }, gained: 0, bonus: 0, climbed: false };
  }
  const streak = state.floorClean ? state.cleanStreak + 1 : 0;
  const level = taskLevel(step, state.floor);
  const bonus = streakBonus(streak);
  const gained = floorPoints(state.floor + 1, level, streak);
  return {
    state: {
      ...base,
      floor: state.floor + 1,
      score: state.score + gained,
      correct: state.correct + 1,
      cleanStreak: streak,
      floorClean: true,
    },
    gained,
    bonus,
    climbed: true,
  };
}

/** Результат для onFinish. */
export function toResult(state: TowerState) {
  return { score: state.score, correct: state.correct, total: state.total, attempts: state.attempts.slice() };
}
