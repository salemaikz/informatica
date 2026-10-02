import type { SkillId } from "@/lib/types";
import type { GameMode } from "@/games/types";
import { hashString, seeded, shuffle } from "@/lib/text";
import { toBinary } from "@/lib/check";

export type Mode = "build" | "read" | "property";
export type Tier = 0 | 1 | 2;

export type Goal =
  | { kind: "evenOnes"; k: number }
  | { kind: "pow"; k: number }
  | { kind: "powMinus"; k: number }
  | { kind: "smallest"; n: number }
  | { kind: "oddGreater"; m: number };

export type ReasonKey =
  | "reasonOdd"
  | "reasonEven"
  | "reasonOnes"
  | "reasonDigits"
  | "reasonNotSmallest"
  | "reasonNotGreater"
  | "reasonNotEqual";

export interface Reason {
  key: ReasonKey;
  params: Record<string, string | number>;
}

export interface Task {
  id: number;
  mode: Mode;
  skill: SkillId;
  tier: Tier;
  bits: number;
  /** BUILD/READ: целевое число. PROPERTY: наименьший подходящий пример. */
  answer: number;
  goal?: Goal;
  /** READ: три варианта (включая верный). */
  options?: number[];
  isRetry: boolean;
}

export const PRIMARY_TASKS = 10;
export const ROUND_SECONDS = 90;
export const MAX_RETRIES = 3;
/** Максимум очков за остаток времени в обычном темпе (шкала, не секунды). */
export const TIME_BONUS_MAX = 20;

export const BITS_BY_TIER: Record<Tier, number> = { 0: 4, 1: 6, 2: 8 };

type Limits = Record<Mode, Record<Tier, number>>;

/** Блиц — как было: чем сложнее, тем меньше времени. */
const BLITZ_LIMITS: Limits = {
  build: { 0: 20, 1: 16, 2: 12 },
  property: { 0: 20, 1: 16, 2: 12 },
  read: { 0: 10, 1: 8, 2: 6 },
};
/** Обычный темп: время растёт с числом бит (4 → 25 с, 6 → 35 с, 8 → 45 с); условие читать дольше (+10 с). */
const NORMAL_LIMITS: Limits = {
  build: { 0: 25, 1: 35, 2: 45 },
  read: { 0: 25, 1: 35, 2: 45 },
  property: { 0: 35, 1: 45, 2: 55 },
};

export interface ModeConfig {
  /** Секунд на задание по виду и уровню; null — без таймера. */
  taskSeconds: Limits | null;
  /** Общие часы раунда, сек; null — нет. */
  roundSeconds: number | null;
  /** Основных заданий в раунде. */
  primaryTasks: number;
  /** Сколько ошибочных заданий вернётся в конце раунда. */
  maxRetries: number;
  /** «Слепые» задания старшего уровня: сумма или веса скрыты. */
  blind: boolean;
  /** Очки за остаток времени: нет / секунды как есть / шкала от бюджета задания. */
  timeBonus: "none" | "seconds" | "scaled";
  /** Кнопка паузы (доски скрывается). */
  pausable: boolean;
  /** Через сколько мс перейти дальше после верного ответа. */
  correctAdvanceMs: number;
  /** Через сколько мс перейти дальше после ошибки/таймаута; null — ждать нажатия «Далее». */
  wrongAdvanceMs: number | null;
  /** После ошибки показать правильную комбинацию на самих переключателях. */
  revealOnSwitches: boolean;
  /** Крупные веса разрядов и бегущая сумма включённых весов. */
  runningSum: boolean;
}

export const MODE_CONFIG: Record<GameMode, ModeConfig> = {
  calm: {
    taskSeconds: null,
    roundSeconds: null,
    primaryTasks: PRIMARY_TASKS,
    maxRetries: 0,
    blind: false,
    timeBonus: "none",
    pausable: false,
    correctAdvanceMs: 1300,
    wrongAdvanceMs: null,
    revealOnSwitches: true,
    runningSum: true,
  },
  normal: {
    taskSeconds: NORMAL_LIMITS,
    roundSeconds: null,
    primaryTasks: PRIMARY_TASKS,
    maxRetries: MAX_RETRIES,
    blind: true,
    timeBonus: "scaled",
    pausable: true,
    correctAdvanceMs: 1100,
    wrongAdvanceMs: 3500,
    revealOnSwitches: true,
    runningSum: false,
  },
  blitz: {
    taskSeconds: BLITZ_LIMITS,
    roundSeconds: ROUND_SECONDS,
    primaryTasks: PRIMARY_TASKS,
    maxRetries: MAX_RETRIES,
    blind: true,
    timeBonus: "seconds",
    pausable: false,
    correctAdvanceMs: 900,
    wrongAdvanceMs: 2500,
    revealOnSwitches: false,
    runningSum: false,
  },
};
const BASE_WEIGHTS: Record<Mode, number> = { build: 0.45, read: 0.3, property: 0.25 };
const MODE_SKILL: Record<Mode, SkillId> = { build: "ns.dec2bin", read: "ns.bin2dec", property: "ns.props" };

export function newSeed(): number {
  return hashString(`bit-flip:${Date.now()}:${Math.random()}`);
}

export function tierForCorrect(correctCount: number): Tier {
  return correctCount >= 6 ? 2 : correctCount >= 3 ? 1 : 0;
}

/** Секунд на задание в данном темпе; null — без лимита. */
export function taskSeconds(gameMode: GameMode, kind: Mode, tier: Tier): number | null {
  const table = MODE_CONFIG[gameMode].taskSeconds;
  return table ? table[kind][tier] : null;
}

/** Время на задание, мс; null — без лимита (спокойный темп). */
export function taskTimeMs(task: Pick<Task, "mode" | "tier">, gameMode: GameMode): number | null {
  const sec = taskSeconds(gameMode, task.mode, task.tier);
  return sec === null ? null : sec * 1000;
}

export function popcount(n: number): number {
  let c = 0;
  let v = n;
  while (v > 0) {
    c += v & 1;
    v = Math.floor(v / 2);
  }
  return c;
}

export function bitLength(n: number): number {
  return n > 0 ? n.toString(2).length : 0;
}

/** Биты числа старшим разрядом вперёд, ровно `bits` штук. */
export function bitsOf(n: number, bits: number): number[] {
  return toBinary(n, bits).slice(-bits).split("").map(Number);
}

export function valueOfBits(bits: readonly number[]): number {
  return bits.reduce((acc, b) => acc * 2 + (b ? 1 : 0), 0);
}

/** Веса разрядов старшим вперёд: [8, 4, 2, 1]. */
export function weights(bits: number): number[] {
  return Array.from({ length: bits }, (_, i) => 2 ** (bits - 1 - i));
}

/** Веса включённых битов старшим вперёд: [1,0,1,1] → [8, 2, 1]. */
export function onWeights(bits: readonly number[]): number[] {
  const ws = weights(bits.length);
  return ws.filter((_, i) => bits[i] === 1);
}

/** «64 + 8 + 4 + 1 = 77». */
export function breakdown(n: number): string {
  if (n <= 0) return "0";
  const parts: number[] = [];
  let p = 1;
  while (p * 2 <= n) p *= 2;
  for (; p >= 1; p /= 2) if (n & p) parts.push(p);
  return `${parts.join(" + ")} = ${n}`;
}

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};
export function superscript(n: number): string {
  return String(n).split("").map((d) => SUP[d] ?? d).join("");
}

export function goalExpr(goal: Goal): string {
  if (goal.kind === "pow") return `2${superscript(goal.k)}`;
  if (goal.kind === "powMinus") return `2${superscript(goal.k)} − 1`;
  return "";
}

/** Наименьший подходящий пример для цели. */
export function goalExample(goal: Goal): number {
  switch (goal.kind) {
    case "evenOnes":
      return 2 ** (goal.k + 1) - 2;
    case "pow":
      return 2 ** goal.k;
    case "powMinus":
      return 2 ** goal.k - 1;
    case "smallest":
      return 2 ** (goal.n - 1);
    case "oddGreater":
      return goal.m % 2 === 0 ? goal.m + 1 : goal.m + 2;
  }
}

/** У целей b, c, d ответ единственный (нужен для бонуса «идеально»). */
export function goalIsUnique(goal: Goal): boolean {
  return goal.kind === "pow" || goal.kind === "powMinus" || goal.kind === "smallest";
}

export function goalKey(goal: Goal): string {
  const p = goal.kind === "evenOnes" ? goal.k : goal.kind === "pow" || goal.kind === "powMinus" ? goal.k : goal.kind === "smallest" ? goal.n : goal.m;
  return `p:${goal.kind}:${p}`;
}

export interface Check {
  ok: boolean;
  reason?: Reason;
}

export function checkGoal(goal: Goal, v: number): Check {
  const ok = (): Check => ({ ok: true });
  const bad = (key: ReasonKey, params: Record<string, string | number> = {}): Check => ({ ok: false, reason: { key, params } });
  switch (goal.kind) {
    case "evenOnes": {
      if (v % 2 !== 0) return bad("reasonOdd");
      const have = popcount(v);
      if (have !== goal.k) return bad("reasonOnes", { have, need: goal.k });
      return v > 0 ? ok() : bad("reasonOnes", { have, need: goal.k });
    }
    case "pow":
    case "powMinus": {
      const need = goal.kind === "pow" ? 2 ** goal.k : 2 ** goal.k - 1;
      return v === need ? ok() : bad("reasonNotEqual", { v, n: need });
    }
    case "smallest": {
      const have = bitLength(v);
      if (have !== goal.n) return bad("reasonDigits", { have, need: goal.n });
      if (v !== 2 ** (goal.n - 1)) return bad("reasonNotSmallest", { ex: toBinary(2 ** (goal.n - 1), goal.n) });
      return ok();
    }
    case "oddGreater": {
      if (v % 2 !== 1) return bad("reasonEven");
      if (v <= goal.m) return bad("reasonNotGreater", { v, m: goal.m });
      return ok();
    }
  }
}

/** Все цели, выполнимые при B битах (m для «нечётного больше m» — типовой набор). */
export function possibleGoals(B: number, rand: () => number): Goal[] {
  const out: Goal[] = [];
  for (let k = 1; k <= B - 1; k++) out.push({ kind: "evenOnes", k }, { kind: "pow", k });
  for (let k = 2; k <= B; k++) out.push({ kind: "powMinus", k });
  for (let n = 2; n <= B; n++) out.push({ kind: "smallest", n });
  const maxM = 2 ** B - 3;
  if (maxM >= 2) out.push({ kind: "oddGreater", m: 2 + Math.floor(rand() * (maxM - 1)) });
  return out;
}

/** Значение для «идеально» (число переключений должно равняться числу единиц): или null. */
export function perfectValue(task: Task): number | null {
  if (task.mode === "build") return task.answer;
  if (task.mode === "property" && task.goal && goalIsUnique(task.goal)) return task.answer;
  return null;
}

export function isPerfect(task: Task, flips: number): boolean {
  const v = perfectValue(task);
  return v !== null && flips === popcount(v);
}

export function taskPoints(secondsLeft: number, perfect: boolean): number {
  return 10 + Math.ceil(Math.max(0, secondsLeft)) + (perfect ? 5 : 0);
}

/**
 * Очки за верное задание: 10 + бонус за время + 5 за идеальность.
 * Блиц — остаток секунд как есть; обычный — шкала до 20 от доли оставшегося бюджета; спокойный — без бонуса.
 */
export function pointsFor(gameMode: GameMode, secondsLeft: number, budgetSec: number | null, perfect: boolean): number {
  const kind = MODE_CONFIG[gameMode].timeBonus;
  if (kind === "none" || budgetSec === null || budgetSec <= 0) return 10 + (perfect ? 5 : 0);
  if (kind === "seconds") return taskPoints(secondsLeft, perfect);
  const frac = Math.min(1, Math.max(0, secondsLeft / budgetSec));
  return 10 + Math.ceil(TIME_BONUS_MAX * frac) + (perfect ? 5 : 0);
}

export interface Why {
  /** Разбор до ответа: «13 = 8 + 4 + 1 →». */
  lead: string;
  /** Сам ответ (подсвечивается): «1101₂». */
  answer: string;
}

/** Однострочный разбор правильного ответа: BUILD/PROPERTY — число → двоичная запись, READ — двоичная запись → число. */
export function whyParts(task: Pick<Task, "mode" | "answer" | "bits">): Why {
  const n = task.answer;
  const bin = `${bitsOf(n, task.bits).join("")}₂`;
  const parts = onWeights(bitsOf(n, task.bits));
  const sumExpr = parts.length > 1 ? `${parts.join(" + ")}` : "";
  if (task.mode === "read") return { lead: sumExpr ? `${bin} = ${sumExpr} =` : `${bin} =`, answer: String(n) };
  return { lead: sumExpr ? `${n} = ${sumExpr} →` : `${n} →`, answer: bin };
}

export function evaluate(task: Task, value: number): Check {
  if (task.mode === "property" && task.goal) return checkGoal(task.goal, value);
  return { ok: value === task.answer };
}

function reverseBits(n: number, bits: number): number {
  return valueOfBits(bitsOf(n, bits).reverse());
}

/** Три варианта для READ: верный + два уникальных отвлекающих, все в 1..2^B−1. */
export function readOptions(n: number, B: number, rand: () => number): number[] {
  const max = 2 ** B - 1;
  const picked: number[] = [];
  const valid = (c: number) => c > 0 && c <= max && c !== n && !picked.includes(c);
  const sources: (() => number[])[] = [
    () => [reverseBits(n, B)],
    () => [n ^ (1 << Math.floor(rand() * B))],
    () => (rand() < 0.5 ? [n + 1, n - 1] : [n - 1, n + 1]),
  ];
  for (const src of shuffle(sources, rand)) {
    for (const c of src()) {
      if (picked.length < 2 && valid(c)) {
        picked.push(c);
        break;
      }
    }
  }
  for (const d of [2, -2, 3, -3, 4, -4]) {
    if (picked.length >= 2) break;
    if (valid(n + d)) picked.push(n + d);
  }
  for (let c = 1; picked.length < 2 && c <= max; c++) if (valid(c)) picked.push(c);
  return shuffle([n, ...picked], rand);
}

function randInt(rand: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

const BOUNDARY: Record<Tier, number[]> = { 0: [], 1: [16, 31, 32, 63], 2: [127, 128, 255] };
const RANGE: Record<Tier, [number, number]> = { 0: [1, 15], 1: [16, 63], 2: [64, 255] };

export function pickTarget(tier: Tier, rand: () => number, used: ReadonlySet<string>): number {
  const [lo, hi] = RANGE[tier];
  const free = (n: number) => !used.has(`n:${n}`);
  const bound = BOUNDARY[tier].filter(free);
  if (bound.length > 0 && rand() < 0.3) return bound[Math.floor(rand() * bound.length)];
  for (let i = 0; i < 60; i++) {
    const n = randInt(rand, lo, hi);
    if (free(n)) return n;
  }
  for (let n = lo; n <= hi; n++) if (free(n)) return n;
  return randInt(rand, lo, hi);
}

export function pickMode(
  masteryOf: (skill: SkillId) => number,
  history: readonly Mode[],
  rand: () => number,
): Mode {
  const modes: Mode[] = ["build", "read", "property"];
  const n = history.length;
  const banned = n >= 2 && history[n - 1] === history[n - 2] ? history[n - 1] : null;
  const pool = modes.filter((m) => m !== banned);
  const w = pool.map((m) => BASE_WEIGHTS[m] * (1.1 - Math.min(1, Math.max(0, masteryOf(MODE_SKILL[m])))) ** 2);
  const sum = w.reduce((a, b) => a + b, 0);
  let r = rand() * sum;
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** Состояние раунда: ленивая выдача заданий, повторы ошибок, уровни. */
export class RoundEngine {
  private rand: () => number;
  private issued = 0;
  private nextId = 1;
  private used = new Set<string>();
  private history: Mode[] = [];
  private retries: Task[] = [];
  private cfg: ModeConfig;
  correctCount = 0;
  retriesUsed = 0;

  constructor(seed: number, gameMode: GameMode = "blitz") {
    this.rand = seeded(seed);
    this.cfg = MODE_CONFIG[gameMode];
  }

  /** Сколько заданий в раунде на данный момент (основные + поставленные на повтор). */
  get total(): number {
    return this.cfg.primaryTasks + this.retriesUsed;
  }

  get tier(): Tier {
    return tierForCorrect(this.correctCount);
  }

  next(masteryOf: (skill: SkillId) => number): Task | null {
    if (this.issued < this.cfg.primaryTasks) {
      const idx = this.issued;
      this.issued++;
      const tier: Tier = idx < 2 ? 0 : this.tier;
      const mode: Mode = idx < 2 ? "build" : pickMode(masteryOf, this.history, this.rand);
      this.history.push(mode);
      return this.make(mode, tier);
    }
    return this.retries.shift() ?? null;
  }

  /** Фиксирует результат; возвращает true, если задание вернётся позже. */
  resolve(task: Task, correct: boolean): boolean {
    if (correct) {
      this.correctCount++;
      return false;
    }
    if (task.isRetry || this.retriesUsed >= this.cfg.maxRetries) return false;
    this.retriesUsed++;
    this.retries.push({ ...task, id: this.nextId++, isRetry: true });
    return true;
  }

  private make(mode: Mode, tier: Tier): Task {
    const B = BITS_BY_TIER[tier];
    const base = { id: this.nextId++, mode, skill: MODE_SKILL[mode], tier, bits: B, isRetry: false };
    if (mode === "property") {
      const goals = possibleGoals(B, this.rand);
      const fresh = goals.filter((g) => !this.used.has(goalKey(g)));
      const pool = fresh.length > 0 ? fresh : goals;
      const goal = pool[Math.floor(this.rand() * pool.length)];
      this.used.add(goalKey(goal));
      return { ...base, goal, answer: goalExample(goal) };
    }
    const target = pickTarget(tier, this.rand, this.used);
    this.used.add(`n:${target}`);
    if (mode === "read") return { ...base, answer: target, options: readOptions(target, B, this.rand) };
    return { ...base, answer: target };
  }
}
