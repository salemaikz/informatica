import type { GameMode } from "@/games/types";
import { generateStep } from "@/lib/generators";
import { seeded, shuffle } from "@/lib/text";
import type { ChoiceStep, InputStep, QuestionStep, SkillId } from "@/lib/types";

// Чистая логика «Бит-спринта»: поток вопросов, уровни сложности, очки. Без React.

export const SKILLS: SkillId[] = ["ns.base", "ns.bin2dec", "ns.dec2bin", "ns.props"];
/** Значение освоения, которое передаётся в generateStep для уровня 0/1/2 (диапазоны 5–15 / 16–63 / 64–255). */
export const TIER_MASTERY = [0.3, 0.65, 0.9] as const;
export const DEFAULT_MASTERY = 0.3;
export const ROUND_MS = 60_000;
export const PENALTY_MS = 4_000;
export const HARD_CAP_MS = 120_000;
export const RETRY_GAP = 3;
export const TIER_EVERY = 5;
export const MAX_TIER = 2;

/**
 * Всё, что зависит от темпа игры. Игра (Game.tsx) читает только отсюда.
 * - calm: без времени, 12 вопросов, после ошибки разбор и «Далее»;
 * - normal: у каждого вопроса свой бюджет времени, 15 вопросов;
 * - blitz: общие часы 60 с, бонус времени растёт с уровнем вопроса.
 */
export interface ModeConfig {
  /** Общие часы раунда, мс (null — часов нет). */
  clockMs: number | null;
  /** Жёсткий предел активной игры, мс (null — нет). */
  hardCapMs: number | null;
  /** Бонус часов за верный ответ по уровню вопроса, мс (только blitz). */
  bonusMs: readonly number[];
  /** Штраф часов за ошибку, мс (только blitz). */
  penaltyMs: number;
  /** Сколько вопросов в игре (null — пока идут часы). */
  questions: number | null;
  /** Бюджет времени на вопрос с вариантами по уровню, мс (null — лимита нет). */
  choiceBudgetMs: readonly number[] | null;
  /** Добавка к бюджету для вопроса с вводом на клавиатуре, мс. */
  inputExtraMs: number;
  /** Истечение времени на вопрос засчитывается как ошибка. */
  questionTimeout: boolean;
  /** Каждые сколько верных ответов растёт уровень. */
  tierEvery: number;
  /** Через сколько мс после ошибки идём дальше само (null — ждём «Далее»). */
  revealAutoMs: number | null;
  /** Пауза после верного ответа, мс. */
  nextDelayMs: number;
  /** Как считаются очки: окно скорости (blitz) / остаток времени (normal) / ровно база (calm). */
  scoring: "window" | "remaining" | "flat";
}

export const MODE_CONFIG: Record<GameMode, ModeConfig> = {
  calm: {
    clockMs: null,
    hardCapMs: null,
    bonusMs: [],
    penaltyMs: 0,
    questions: 12,
    choiceBudgetMs: null,
    inputExtraMs: 0,
    questionTimeout: false,
    tierEvery: 4,
    revealAutoMs: null,
    nextDelayMs: 700,
    scoring: "flat",
  },
  normal: {
    clockMs: null,
    hardCapMs: null,
    bonusMs: [],
    penaltyMs: 0,
    questions: 15,
    choiceBudgetMs: [12_000, 16_000, 20_000],
    inputExtraMs: 8_000,
    questionTimeout: true,
    tierEvery: TIER_EVERY,
    revealAutoMs: 3_500,
    nextDelayMs: 500,
    scoring: "remaining",
  },
  blitz: {
    clockMs: ROUND_MS,
    hardCapMs: HARD_CAP_MS,
    bonusMs: [1_500, 2_500, 3_500],
    penaltyMs: PENALTY_MS,
    questions: null,
    choiceBudgetMs: null,
    inputExtraMs: 0,
    questionTimeout: false,
    tierEvery: TIER_EVERY,
    revealAutoMs: 3_000,
    nextDelayMs: 350,
    scoring: "window",
  },
};

/** Максимальный скоростной бонус в обычном темпе (за остаток времени на вопрос). */
export const NORMAL_BONUS_MAX = 10;

/**
 * Сколько верных ответов (или половина выданных вопросов) нужно, чтобы навык вошёл в пул.
 * Порядок «от лёгкого к сложному»: основание/свойства → 2→10 → 10→2.
 */
export const SKILL_UNLOCK: Record<SkillId, number> = {
  "ns.base": 0,
  "ns.props": 0,
  "ns.bin2dec": 2,
  "ns.dec2bin": 4,
};

export type RoundStep = ChoiceStep | InputStep;

export interface Question {
  step: RoundStep;
  tier: number;
  retry: boolean;
}

interface Retry {
  due: number;
  step: RoundStep;
  tier: number;
}

export interface Stream {
  seed: number;
  /** Сколько вопросов уже выдано. */
  index: number;
  masteries: Record<string, number>;
  asked: string[];
  recentSkills: SkillId[];
  queue: Retry[];
  tier: number;
  wrongRow: number;
  correctCount: number;
  streak: number;
  /** Каждые сколько верных ответов растёт уровень (зависит от темпа). */
  tierEvery: number;
}

export function createStream(seed: number, masteries: Record<string, number | undefined>, mode: GameMode = "blitz"): Stream {
  const m: Record<string, number> = {};
  for (const s of SKILLS) m[s] = masteries[s] ?? DEFAULT_MASTERY;
  return {
    seed,
    index: 0,
    masteries: m,
    asked: [],
    recentSkills: [],
    queue: [],
    tier: 0,
    wrongRow: 0,
    correctCount: 0,
    streak: 0,
    tierEvery: MODE_CONFIG[mode].tierEvery,
  };
}

export function isRoundStep(step: QuestionStep): step is RoundStep {
  return step.type === "choice" || step.type === "input";
}

/** Шаг пригоден для игры: варианты уникальны, индекс верного в пределах, ответы непусты. */
export function isValidStep(step: RoundStep): boolean {
  if (step.type === "choice") {
    const texts = step.options.map((o) => (typeof o === "string" ? o : o.ru));
    return (
      step.options.length >= 2 &&
      step.options.length <= 4 &&
      new Set(texts).size === texts.length &&
      Number.isInteger(step.correct) &&
      step.correct >= 0 &&
      step.correct < step.options.length
    );
  }
  return step.answers.length > 0 && step.answers.every((a) => a.length > 0) && (step.mode === "binary" || step.mode === "number");
}

/** Первые 4 части id (g:skill:kind:value) — без сида, для защиты от повторов. */
export function idPrefix(id: string): string {
  return id.split(":").slice(0, 4).join(":");
}

/** Прогресс для открытия навыков: верные ответы, но не медленнее половины выданных вопросов. */
export function rampProgress(stream: Stream): number {
  return Math.max(stream.correctCount, Math.floor(stream.index / 2));
}

/** Навыки, доступные в пуле сейчас: сложные открываются по мере прогресса. */
export function unlockedSkills(stream: Stream): SkillId[] {
  const progress = rampProgress(stream);
  return SKILLS.filter((s) => progress >= (SKILL_UNLOCK[s] ?? 0));
}

/** Вес навыка (1.1 − освоение)² — как в buildDrill. */
export function skillWeight(mastery: number): number {
  return (1.1 - mastery) ** 2;
}

export function pickSkill(
  masteries: Record<string, number>,
  recent: SkillId[],
  rand: () => number,
  exclude: SkillId[] = [],
): SkillId | null {
  const lastTwoSame = recent.length >= 2 && recent[recent.length - 1] === recent[recent.length - 2];
  const banned = lastTwoSame ? recent[recent.length - 1] : null;
  const pool = SKILLS.filter((s) => s !== banned && !exclude.includes(s));
  if (!pool.length) return null;
  const weights = pool.map((s) => skillWeight(masteries[s] ?? DEFAULT_MASTERY));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** Перемешивает варианты выбора, пересчитывая индекс верного. Остальные шаги — как есть. */
export function reshuffleChoice(step: RoundStep, rand: () => number): RoundStep {
  if (step.type !== "choice") return step;
  const order = shuffle(
    step.options.map((_, i) => i),
    rand,
  );
  return { ...step, options: order.map((i) => step.options[i]), correct: order.indexOf(step.correct) };
}

/** Генерирует шаг типа choice/input; bits/ladder перебрасываются со сдвигом сида. */
function generateRound(skill: SkillId, tier: number, seed: number): RoundStep | null {
  for (let k = 0; k <= 10; k++) {
    const step = generateStep(skill, TIER_MASTERY[tier], seed + 7919 * k);
    if (isRoundStep(step) && isValidStep(step)) return step;
  }
  return null;
}

export function nextQuestion(stream: Stream): { stream: Stream; question: Question } {
  const index = stream.index + 1;
  const retryAt = stream.queue.findIndex((r) => r.due <= index);
  if (retryAt >= 0) {
    const r = stream.queue[retryAt];
    return {
      stream: {
        ...stream,
        index,
        queue: stream.queue.filter((_, i) => i !== retryAt),
        recentSkills: [...stream.recentSkills, r.step.skill!].slice(-4),
      },
      question: { step: r.step, tier: r.tier, retry: true },
    };
  }
  const baseSeed = (stream.seed + index * 100_003) >>> 0;
  const rand = seeded(baseSeed);
  const asked = new Set(stream.asked);
  const unlocked = unlockedSkills(stream);
  // Сначала доступные по «рампе» навыки без повторов, затем все навыки, затем допускаем повторы.
  const passes: [SkillId[], boolean][] = [
    [unlocked, true],
    [SKILLS, true],
    [unlocked, false],
    [SKILLS, false],
  ];
  for (const [pool, strict] of passes) {
    const tried: SkillId[] = SKILLS.filter((s) => !pool.includes(s));
    for (let s = 0; s < pool.length; s++) {
      const skill = pickSkill(stream.masteries, stream.recentSkills, rand, tried);
      if (!skill) break;
      tried.push(skill);
      const tier = stream.tier;
      for (let attempt = 0; attempt < (strict ? 30 : 1); attempt++) {
        const step = generateRound(skill, tier, baseSeed + attempt * 104_729);
        if (!step) break;
        if (strict && asked.has(idPrefix(step.id))) continue;
        return {
          stream: {
            ...stream,
            index,
            asked: [...stream.asked, idPrefix(step.id)],
            recentSkills: [...stream.recentSkills, skill].slice(-4),
          },
          question: { step, tier, retry: false },
        };
      }
    }
  }
  throw new Error("bit-rush: нет доступных заданий");
}

/** Обновляет счётчики, уровень и очередь повторов после ответа. */
export function recordAnswer(stream: Stream, q: Question, correct: boolean): Stream {
  if (correct) {
    const correctCount = stream.correctCount + 1;
    return {
      ...stream,
      correctCount,
      streak: stream.streak + 1,
      wrongRow: 0,
      tier: correctCount % stream.tierEvery === 0 ? Math.min(MAX_TIER, stream.tier + 1) : stream.tier,
    };
  }
  let tier = stream.tier;
  let wrongRow = stream.wrongRow + 1;
  if (wrongRow >= 2) {
    tier = Math.max(0, tier - 1);
    wrongRow = 0;
  }
  const queue = [...stream.queue];
  if (!q.retry) {
    const rand = seeded((stream.seed ^ (stream.index * 2_654_435_761)) >>> 0);
    queue.push({ due: stream.index + RETRY_GAP, step: reshuffleChoice(q.step, rand), tier: q.tier });
  }
  return { ...stream, streak: 0, wrongRow, tier, queue };
}

// ---------- очки ----------

export function multiplier(streak: number): number {
  if (streak >= 15) return 5;
  if (streak >= 10) return 4;
  if (streak >= 6) return 3;
  if (streak >= 3) return 2;
  return 1;
}

export function baseScore(step: RoundStep): number {
  return step.type === "input" ? 15 : 10;
}

/** Окно скоростного бонуса в блице, сек: 6 (choice) / 9 (input) минус 1 с за уровень, не ниже 4 / 6. */
export function speedWindow(step: RoundStep, tier: number): number {
  return step.type === "input" ? Math.max(6, 9 - tier) : Math.max(4, 6 - tier);
}

export function speedFrac(seconds: number, window: number): number {
  return Math.max(0, 1 - seconds / window);
}

/** Очки за верный ответ в блице; streakAfter — серия уже с учётом этого ответа. */
export function points(step: RoundStep, streakAfter: number, seconds: number, tier: number): number {
  const frac = speedFrac(seconds, speedWindow(step, tier));
  return Math.round(baseScore(step) * multiplier(streakAfter) * (1 + 0.5 * frac));
}

const byTier = (arr: readonly number[], tier: number) => arr[Math.min(Math.max(0, tier), arr.length - 1)];

/**
 * Время на задание, мс.
 * - normal: бюджет по уровню (+ добавка за ввод на клавиатуре) — по истечении ответ неверный;
 * - blitz: окно скоростного бонуса (лимита нет);
 * - calm: null — времени нет.
 */
export function taskTimeMs(step: RoundStep, tier: number, mode: GameMode): number | null {
  const cfg = MODE_CONFIG[mode];
  if (cfg.choiceBudgetMs) return byTier(cfg.choiceBudgetMs, tier) + (step.type === "input" ? cfg.inputExtraMs : 0);
  if (cfg.scoring === "window") return speedWindow(step, tier) * 1000;
  return null;
}

/** Доля оставшегося времени на вопрос (1 → только начали, 0 → вышло). В calm всегда 0. */
export function remainingFraction(step: RoundStep, tier: number, mode: GameMode, elapsedMs: number): number {
  const budget = taskTimeMs(step, tier, mode);
  return budget === null ? 0 : Math.max(0, 1 - elapsedMs / budget);
}

/** Очки за верный ответ в любом темпе. */
export function scoreFor(mode: GameMode, step: RoundStep, streakAfter: number, elapsedMs: number, tier: number): number {
  const cfg = MODE_CONFIG[mode];
  const mult = multiplier(streakAfter);
  if (cfg.scoring === "flat") return baseScore(step) * mult;
  if (cfg.scoring === "remaining") {
    const bonus = Math.round(NORMAL_BONUS_MAX * remainingFraction(step, tier, mode, elapsedMs));
    return (baseScore(step) + bonus) * mult;
  }
  return points(step, streakAfter, elapsedMs / 1000, tier);
}

/** Бонус часов блица за верный ответ на вопрос данного уровня, мс. */
export function bonusMs(tier: number): number {
  return byTier(MODE_CONFIG.blitz.bonusMs, tier);
}

/** Время на часах после ответа (мс): верно → + бонус уровня (не выше ROUND_MS), неверно → − штраф. Только блиц. */
export function clockAfter(remainingMs: number, correct: boolean, tier = 0): number {
  return correct ? Math.min(ROUND_MS, remainingMs + bonusMs(tier)) : remainingMs - PENALTY_MS;
}

export function isFinished(remainingMs: number, activeMs: number): boolean {
  return remainingMs <= 0 || activeMs >= HARD_CAP_MS;
}

/** Игра окончена: в calm/normal — набрано нужное число ответов, в blitz — вышло время. */
export function isRoundOver(mode: GameMode, answered: number, remainingMs: number, activeMs: number): boolean {
  const cfg = MODE_CONFIG[mode];
  if (cfg.questions !== null) return answered >= cfg.questions;
  return isFinished(remainingMs, activeMs);
}

export function isCorrectChoice(step: ChoiceStep, index: number): boolean {
  return index === step.correct;
}

/** Максимум символов в поле ввода. */
export const MAX_INPUT = 9;

export function appendKey(value: string, key: string, mode: InputStep["mode"]): string {
  if (value.length >= MAX_INPUT) return value;
  if (mode === "binary" ? !/^[01]$/.test(key) : !/^[0-9]$/.test(key)) return value;
  return value + key;
}

export function eraseKey(value: string): string {
  return value.slice(0, -1);
}
