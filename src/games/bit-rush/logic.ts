import { generateStep } from "@/lib/generators";
import { seeded, shuffle } from "@/lib/text";
import type { ChoiceStep, InputStep, QuestionStep, SkillId } from "@/lib/types";

// Чистая логика «Бит-спринта»: поток вопросов, уровни сложности, очки. Без React.

export const SKILLS: SkillId[] = ["ns.base", "ns.bin2dec", "ns.dec2bin", "ns.props"];
/** Значение освоения, которое передаётся в generateStep для уровня 0/1/2 (диапазоны 5–15 / 16–63 / 64–255). */
export const TIER_MASTERY = [0.3, 0.65, 0.9] as const;
export const DEFAULT_MASTERY = 0.3;
export const ROUND_MS = 60_000;
export const BONUS_MS = 1_500;
export const PENALTY_MS = 4_000;
export const HARD_CAP_MS = 120_000;
export const RETRY_GAP = 3;
export const TIER_EVERY = 5;
export const MAX_TIER = 2;

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
}

export function createStream(seed: number, masteries: Record<string, number | undefined>): Stream {
  const m: Record<string, number> = {};
  for (const s of SKILLS) m[s] = masteries[s] ?? DEFAULT_MASTERY;
  return { seed, index: 0, masteries: m, asked: [], recentSkills: [], queue: [], tier: 0, wrongRow: 0, correctCount: 0, streak: 0 };
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

export function startTier(mastery: number): number {
  return mastery >= 0.8 ? 1 : 0;
}

export function effectiveTier(stream: Stream, skill: SkillId): number {
  return Math.min(MAX_TIER, Math.max(stream.tier, startTier(stream.masteries[skill] ?? DEFAULT_MASTERY)));
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
  for (const strict of [true, false]) {
    const tried: SkillId[] = [];
    for (let s = 0; s < SKILLS.length; s++) {
      const skill = pickSkill(stream.masteries, stream.recentSkills, rand, tried);
      if (!skill) break;
      tried.push(skill);
      const tier = effectiveTier(stream, skill);
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
      tier: correctCount % TIER_EVERY === 0 ? Math.min(MAX_TIER, stream.tier + 1) : stream.tier,
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

/** Окно скоростного бонуса, сек: 6 (choice) / 9 (input) минус 1 с за уровень, не ниже 4 / 6. */
export function speedWindow(step: RoundStep, tier: number): number {
  return step.type === "input" ? Math.max(6, 9 - tier) : Math.max(4, 6 - tier);
}

export function speedFrac(seconds: number, window: number): number {
  return Math.max(0, 1 - seconds / window);
}

/** Очки за верный ответ; streakAfter — серия уже с учётом этого ответа. */
export function points(step: RoundStep, streakAfter: number, seconds: number, tier: number): number {
  const frac = speedFrac(seconds, speedWindow(step, tier));
  return Math.round(baseScore(step) * multiplier(streakAfter) * (1 + 0.5 * frac));
}

/** Время на часах после ответа (мс), верхняя граница — ROUND_MS. */
export function clockAfter(remainingMs: number, correct: boolean): number {
  return correct ? Math.min(ROUND_MS, remainingMs + BONUS_MS) : remainingMs - PENALTY_MS;
}

export function isFinished(remainingMs: number, activeMs: number): boolean {
  return remainingMs <= 0 || activeMs >= HARD_CAP_MS;
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
