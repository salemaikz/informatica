import type { GameMode } from "@/games/types";
import { draw, rampLevel, skillsWithShape } from "@/lib/bank";
import { hashString, seeded, shuffle } from "@/lib/text";
import type { ChoiceStep, Level, SkillId } from "@/lib/types";

// Чистая логика «Ставки»: подбор choice-заданий, очки со ставкой, карта уверенности и вывод. Без React.

export type Bet = 1 | 2 | 3;
export const BETS: readonly Bet[] = [1, 2, 3];
/** Вопросов в спокойном и обычном темпе. */
export const CALM_QUESTIONS = 10;
export const NORMAL_QUESTIONS = 12;
/** Блиц: общее время, мс. */
export const BLITZ_MS = 150_000;
/** Обычный темп: время на вопрос по уровню A/B/C, секунд. */
export const NORMAL_SEC: Record<Level, number> = { 1: 25, 2: 35, 3: 45 };
/** Навыки по умолчанию (совпадают с GameMeta.skills). */
export const DEFAULT_SKILLS: SkillId[] = ["ns.bin2dec", "ns.dec2bin", "ns.base", "ns.props"];
/** Минимум ответов, чтобы делать вывод по карте. */
export const MIN_FOR_VERDICT = 3;

/** Сколько вопросов в игре; null — без лимита (блиц, до конца времени). */
export function questionLimit(mode: GameMode): number | null {
  return mode === "calm" ? CALM_QUESTIONS : mode === "normal" ? NORMAL_QUESTIONS : null;
}

export function taskBudgetMs(mode: GameMode, level: Level): number | null {
  return mode === "normal" ? NORMAL_SEC[level] * 1000 : null;
}

export function resolveSkills(skills?: SkillId[]): SkillId[] {
  const wanted = skills && skills.length > 0 ? skills : DEFAULT_SKILLS;
  return skillsWithShape(wanted, "question");
}

/** Уровень вопроса по номеру (0-based): растёт от A к C. */
export function questionLevel(idx: number, total: number): Level {
  return rampLevel(idx, total, 1, 3);
}

export function stepKey(step: ChoiceStep): string {
  return step.id.split("#")[0].split(":").slice(0, 4).join(":");
}

export interface PickOptions {
  skills: SkillId[];
  /** Номер вопроса, 0-based. */
  idx: number;
  /** Сколько вопросов планируется (для роста сложности). */
  total: number;
  seed: number;
  used: readonly string[];
  lastKey?: string;
}

/**
 * Подбирает choice-задание: нужного уровня и ещё не показанное, затем соседних уровней,
 * затем повтор (но не подряд), в крайнем случае — любое. null — у навыков нет choice-заданий.
 * Навыки перебираются по одному, чтобы у задания всегда был навык (для attempts).
 */
export function pickTask(o: PickOptions): ChoiceStep | null {
  const pool = skillsWithShape(o.skills, "question");
  if (!pool.length) return null;
  const order = shuffle(pool, seeded(hashString(`${o.seed}:${o.idx}:skills`)));
  const want = questionLevel(o.idx, o.total);
  const levels = ([1, 2, 3] as Level[]).sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || a - b);
  const tries = Math.max(order.length, 4);
  const used = new Set(o.used);
  for (const pass of ["fresh", "repeat", "any"] as const) {
    for (const level of levels) {
      for (let k = 0; k < tries; k++) {
        const skill = order[k % order.length];
        const items = draw("question", {
          skills: [skill],
          count: 4,
          seed: hashString(`${o.seed}:${o.idx}:${level}:${k}`),
          minLevel: level,
          maxLevel: level,
          ramp: false,
        });
        const found = items.find((s): s is ChoiceStep => {
          if (s.type !== "choice" || s.options.length < 2) return false;
          if (pass === "any") return true;
          const key = stepKey(s);
          if (key === o.lastKey) return false;
          return pass === "repeat" || !used.has(key);
        });
        if (found) return { ...found, skill: found.skill ?? skill };
      }
    }
  }
  return null;
}

/** Очки за ответ: верно +ставка, неверно −ставка. */
export function betDelta(bet: Bet, correct: boolean): number {
  return correct ? bet : -bet;
}

export interface BetAnswer {
  skill: SkillId;
  bet: Bet;
  correct: boolean;
  /** Время вышло (обычный темп): ставку ученик не выбирал — в очки и attempts идёт, в карту уверенности нет. */
  timedOut?: boolean;
}

export interface BetState {
  /** Сырая сумма (может уйти ниже нуля по ходу игры). */
  raw: number;
  answers: BetAnswer[];
  used: string[];
  lastKey?: string;
}

export function initialState(): BetState {
  return { raw: 0, answers: [], used: [] };
}

/** Очки для рекорда: не ниже 0. */
export function finalScore(state: BetState): number {
  return Math.max(0, state.raw);
}

export function applyAnswer(state: BetState, skill: SkillId, bet: Bet, correct: boolean, timedOut = false): BetState {
  const a: BetAnswer = timedOut ? { skill, bet, correct, timedOut } : { skill, bet, correct };
  return { ...state, raw: state.raw + betDelta(bet, correct), answers: [...state.answers, a] };
}

/** Берёт следующее задание и отмечает его показанным. null — заданий нет. */
export function drawNext(state: BetState, skills: SkillId[], seed: number, total: number): { state: BetState; step: ChoiceStep } | null {
  const step = pickTask({ skills, idx: state.answers.length, total, seed, used: state.used, lastKey: state.lastKey });
  if (!step) return null;
  const key = stepKey(step);
  return { state: { ...state, used: [...state.used, key], lastKey: key }, step };
}

export function toResult(state: BetState) {
  return {
    score: finalScore(state),
    correct: state.answers.filter((a) => a.correct).length,
    total: state.answers.length,
    attempts: state.answers.map((a) => ({ skill: a.skill, correct: a.correct })),
  };
}

// ---------- карта уверенности ----------

export interface BetStat {
  bet: Bet;
  total: number;
  right: number;
}

/** Ответы, где ставку выбрал сам ученик (без таймаутов). */
export function betAnswers(answers: readonly BetAnswer[]): BetAnswer[] {
  return answers.filter((a) => !a.timedOut);
}

export function confidenceMap(answers: readonly BetAnswer[]): BetStat[] {
  const own = betAnswers(answers);
  return BETS.map((bet) => {
    const of = own.filter((a) => a.bet === bet);
    return { bet, total: of.length, right: of.filter((a) => a.correct).length };
  });
}

export type ConfidenceVerdict = "few" | "good" | "over" | "under";

const acc = (s: { total: number; right: number }) => (s.total ? s.right / s.total : 0);

/**
 * Вывод по карте:
 * - few — меньше MIN_FOR_VERDICT ответов со ставкой (таймауты не считаются);
 * - over — на высоких ставках (2–3) точность ниже половины, либо заметно хуже, чем на ставке 1;
 * - under — на ставке 1 почти всё верно и таких ответов не меньше, чем высоких;
 * - good — иначе (уверенность оправдана).
 */
export function confidenceVerdict(answers: readonly BetAnswer[]): ConfidenceVerdict {
  if (betAnswers(answers).length < MIN_FOR_VERDICT) return "few";
  const [low, mid, top] = confidenceMap(answers);
  const high = { total: mid.total + top.total, right: mid.right + top.right };
  if (high.total >= 2 && (acc(high) < 0.5 || (low.total >= 2 && acc(high) < acc(low) - 0.25))) return "over";
  if (low.total >= 2 && acc(low) >= 0.8 && low.total >= high.total) return "under";
  return "good";
}
