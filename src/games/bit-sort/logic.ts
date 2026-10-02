import type { L, SkillId } from "@/lib/types";
import type { GameMode } from "@/games/types";
import { toBinary } from "@/lib/check";
import { fmt, hashString } from "@/lib/text";
import { seeded } from "@/lib/text";
import { S } from "./strings";

export type Tier = 0 | 1 | 2;
export type RuleId = "parity" | "digits" | "shape" | "base" | "compare";

/** Вес правила = насколько оно трудное (больше — дольше падает карточка). Всё про разряды — самое трудное. */
export const RULE_WEIGHT: Record<RuleId, number> = {
  parity: 1, // смотрим на последнюю цифру
  base: 1.2, // проверяем каждую цифру
  compare: 1.2, // считаем сумму весов и сравниваем
  shape: 1.4, // «1 и нули» / «все единицы» среди двойников
  digits: 1.5, // сколько разрядов у десятичного числа в двоичной записи
};
/** Порядок «от лёгкого к трудному» (обычный и спокойный режимы играют все правила в этом порядке). */
export const RULE_BY_DIFFICULTY: RuleId[] = ["parity", "base", "compare", "shape", "digits"];

export interface ModeConfig {
  /** Общие часы раунда, сек (0 — часов нет, игра кончается по числу правил). */
  roundSeconds: number;
  /** Страховка по реальному времени, сек (0 — нет). */
  wallCapSeconds: number;
  /** Сколько правил в игре (0 — сколько успеешь за часы). */
  rulesPerGame: number;
  cardsPerRule: number;
  /** true — правила по порядку сложности, false — взвешенный выбор по освоению. */
  byDifficulty: boolean;
  /** Карточка падает (иначе ждёт посередине, пока ученик не разложит). */
  falls: boolean;
  /** Базовое время падения, сек: старт, пол, множитель ускорения и «через сколько верных». */
  fallStart: number;
  fallMin: number;
  fallFactor: number;
  speedUpEvery: number;
  /** Насколько вес правила влияет на время: время × (1 + (вес − 1) × weightScale). */
  weightScale: number;
  /** Каждые N верных — уровень вверх (до maxTier). */
  tierEvery: number;
  maxTier: Tier;
  /** Объявление нового правила, мс (null — ждёт нажатия «Понятно»). */
  bannerMs: number | null;
  /** Объявление можно пропустить нажатием (в блице нельзя — там всё быстро). */
  bannerSkippable: boolean;
  /** Разбор ошибки, мс (null — ждёт «Далее»). */
  explainMs: number | null;
  /** Есть кнопка паузы (поле на паузе скрыто). */
  pausable: boolean;
}

export const MODE_CONFIG: Record<GameMode, ModeConfig> = {
  // Спокойно: без таймеров, все 5 правил по 4 карточки = 20 карточек, после ошибки ждём «Далее».
  calm: {
    roundSeconds: 0,
    wallCapSeconds: 0,
    rulesPerGame: 5,
    cardsPerRule: 4,
    byDifficulty: true,
    falls: false,
    fallStart: 0,
    fallMin: 0,
    fallFactor: 1,
    speedUpEvery: 1,
    weightScale: 0,
    tierEvery: 8,
    maxTier: 1,
    bannerMs: null,
    bannerSkippable: true,
    explainMs: null,
    pausable: false,
  },
  // Обычный: без часов, 5 правил по 8 карточек = 40, время падения 8 с × вес правила (трудные ≈ 11–12 с).
  normal: {
    roundSeconds: 0,
    wallCapSeconds: 0,
    rulesPerGame: 5,
    cardsPerRule: 8,
    byDifficulty: true,
    falls: true,
    fallStart: 8,
    fallMin: 4.5,
    fallFactor: 0.95,
    speedUpEvery: 4,
    weightScale: 1,
    tierEvery: 8,
    maxTier: 1,
    bannerMs: 2500,
    bannerSkippable: true,
    explainMs: 2500,
    pausable: true,
  },
  // Блиц: как раньше (75 с, 5 → 2,2 с), но трудные правила падают дольше (×1,3) и начинаем с лёгких.
  blitz: {
    roundSeconds: 75,
    wallCapSeconds: 110,
    rulesPerGame: 0,
    cardsPerRule: 8,
    byDifficulty: false,
    falls: true,
    fallStart: 5,
    fallMin: 2.2,
    fallFactor: 0.92,
    speedUpEvery: 4,
    weightScale: 0.75,
    tierEvery: 6,
    maxTier: 2,
    bannerMs: 1200,
    bannerSkippable: false,
    explainMs: 2000,
    pausable: false,
  },
};

// Псевдонимы блиц-констант (так их знали тесты и документация).
export const ROUND_SECONDS = MODE_CONFIG.blitz.roundSeconds;
export const WALL_CAP_SECONDS = MODE_CONFIG.blitz.wallCapSeconds;
export const CARDS_PER_RULE = MODE_CONFIG.blitz.cardsPerRule;
export const D_START = MODE_CONFIG.blitz.fallStart;
export const D_MIN = MODE_CONFIG.blitz.fallMin;
export const D_FACTOR = MODE_CONFIG.blitz.fallFactor;
export const REQUEUE_GAP = 3;
/** Объявление правила в обычном режиме нельзя пропустить первые мс (чтобы не смахнуть случайно). */
export const BANNER_SKIP_AFTER_MS = 800;
/** Блиц: первые правила только лёгкие (вес ≤ RAMP_MAX_WEIGHT), дальше любые. */
export const RAMP_SESSIONS = 2;
export const RAMP_MAX_WEIGHT = 1.2;

/** Множитель времени падения для правила в режиме. */
export function ruleTimeFactor(rule: RuleId, mode: GameMode): number {
  return 1 + (RULE_WEIGHT[rule] - 1) * MODE_CONFIG[mode].weightScale;
}

/**
 * Время падения карточки правила, мс: базовое (по умолчанию стартовое) × вес правила.
 * Спокойный режим — без лимита (Infinity).
 */
export function taskTimeMs(rule: RuleId, mode: GameMode, baseSeconds: number = MODE_CONFIG[mode].fallStart): number {
  if (!MODE_CONFIG[mode].falls) return Infinity;
  return Math.round(baseSeconds * ruleTimeFactor(rule, mode) * 1000);
}

export interface Item {
  label: string;
  value: number;
  extra?: Record<string, number | string>;
}

export interface Session {
  id: number;
  rule: RuleId;
  skill: SkillId;
  tier: Tier;
  /** digits: наименьшее число разрядов; base: 2 или 8; compare: порог T; иначе 0. */
  param: number;
  title: L;
  bins: L[];
}

export interface Card {
  id: number;
  rule: RuleId;
  sessionId: number;
  skill: SkillId;
  item: Item;
  /** Индекс верной корзины (вычислен кодом). */
  bin: number;
  explain: L;
  retry: boolean;
}

type Rand = () => number;
const int = (rand: Rand, lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

/** Подставляет параметры в двуязычный шаблон; значения-L берутся на соответствующем языке. */
export function fillL(tpl: L, params: Record<string, string | number | L>): L {
  const pick = (lang: "ru" | "kk") => {
    const o: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params)) o[k] = typeof v === "object" ? v[lang] : v;
    return fmt(tpl[lang], o);
  };
  return { ru: pick("ru"), kk: pick("kk") };
}

const sub2 = (bin: string) => `${bin}₂`;
const randBits = (rand: Rand, len: number) => {
  let s = "1";
  for (let i = 1; i < len; i++) s += rand() < 0.5 ? "0" : "1";
  return s;
};

// ---------- shape ----------

export type ShapeKind = 0 | 1 | 2; // 0: 2ⁿ, 1: 2ⁿ−1, 2: другое

export function shapeOf(bin: string): ShapeKind {
  if (/^10+$/.test(bin)) return 0;
  if (/^1+$/.test(bin)) return 1;
  return 2;
}

function flipBit(bin: string, i: number): string {
  return bin.slice(0, i) + (bin[i] === "1" ? "0" : "1") + bin.slice(i + 1);
}

// ---------- наборы правил ----------

interface RuleDef {
  id: RuleId;
  skill: SkillId;
  makeSession(rand: Rand, tier: Tier): { param: number; title: L; bins: L[] };
  gen(rand: Rand, tier: Tier, param: number): Item;
  classify(item: Item, param: number): number;
  explain(item: Item, param: number): L;
}

const PARITY_BITS: Record<Tier, [number, number]> = { 0: [4, 5], 1: [5, 6], 2: [7, 8] };
const SHAPE_LEN: Record<Tier, [number, number]> = { 0: [3, 5], 1: [4, 6], 2: [5, 8] };
const DIGITS_MIN_K: Record<Tier, number> = { 0: 4, 1: 5, 2: 6 };
const COMPARE_T: Record<Tier, [number, number]> = { 0: [8, 20], 1: [20, 50], 2: [50, 120] };

const parity: RuleDef = {
  id: "parity",
  skill: "ns.props",
  makeSession: () => ({ param: 0, title: S.parityTitle, bins: [S.binEven, S.binOdd] }),
  gen(rand, tier) {
    const [lo, hi] = PARITY_BITS[tier];
    const bin = randBits(rand, int(rand, lo, hi));
    return { label: sub2(bin), value: parseInt(bin, 2), extra: { bin } };
  },
  classify: (item) => (String(item.extra?.bin).endsWith("1") ? 1 : 0),
  explain(item) {
    const bin = String(item.extra?.bin);
    const odd = bin.endsWith("1");
    return fillL(S.explainParity, { bin, d: bin[bin.length - 1], res: odd ? S.resOdd : S.resEven });
  },
};

const digits: RuleDef = {
  id: "digits",
  skill: "ns.props",
  makeSession(_rand, tier) {
    const k0 = DIGITS_MIN_K[tier];
    return {
      param: k0,
      title: S.digitsTitle,
      bins: [0, 1, 2].map((i) => fillL(S.binDigits, { n: k0 + i })),
    };
  },
  gen(rand, tier) {
    const k0 = DIGITS_MIN_K[tier];
    const k = k0 + int(rand, 0, 2);
    const n = int(rand, 2 ** (k - 1), 2 ** k - 1);
    return { label: String(n), value: n };
  },
  classify: (item, param) => toBinary(item.value).length - param,
  explain(item) {
    const k = toBinary(item.value).length;
    return fillL(S.explainDigits, { n: item.value, bin: toBinary(item.value), k, lo: 2 ** (k - 1), hi: 2 ** k });
  },
};

const shape: RuleDef = {
  id: "shape",
  skill: "ns.props",
  makeSession: () => ({ param: 0, title: S.shapeTitle, bins: [S.binPow, S.binPowMinus, S.binOther] }),
  gen(rand, tier) {
    const [lo, hi] = SHAPE_LEN[tier];
    const len = int(rand, lo, hi);
    const kind = int(rand, 0, 2) as ShapeKind;
    let bin: string;
    if (kind === 0) bin = "1" + "0".repeat(len - 1);
    else if (kind === 1) bin = "1".repeat(len);
    else {
      bin = "";
      for (let tries = 0; tries < 50 && (bin === "" || shapeOf(bin) !== 2); tries++) {
        if (rand() < 0.5) {
          // «двойник»: степень двойки или 2ⁿ−1 с одним перевёрнутым битом (без ведущего нуля)
          const base = rand() < 0.5 ? "1" + "0".repeat(len - 1) : "1".repeat(len);
          bin = flipBit(base, int(rand, 1, len - 1));
        } else bin = randBits(rand, len);
      }
      if (shapeOf(bin) !== 2) bin = "1" + "01".repeat(Math.ceil(len / 2)).slice(0, len - 1);
    }
    return { label: sub2(bin), value: parseInt(bin, 2), extra: { bin } };
  },
  classify: (item) => shapeOf(String(item.extra?.bin)),
  explain(item) {
    const bin = String(item.extra?.bin);
    const k = shapeOf(bin);
    const tpl = k === 0 ? S.explainPow : k === 1 ? S.explainPowMinus : S.explainOther;
    return fillL(tpl, { bin });
  },
};

/** Первая цифра строки, недопустимая в системе base (или null). */
export function badDigit(str: string, base: number): string | null {
  for (const ch of str) if (Number(ch) >= base) return ch;
  return null;
}

const baseRule: RuleDef = {
  id: "base",
  skill: "ns.base",
  makeSession(rand, tier) {
    const octal = tier >= 1 && rand() < 0.5;
    return {
      param: octal ? 8 : 2,
      title: octal ? S.base8Title : S.base2Title,
      bins: [S.binCan, S.binCannot],
    };
  },
  gen(rand, _tier, base) {
    const len = int(rand, 3, 5);
    const valid = rand() < 0.5;
    const digs: number[] = [];
    for (let i = 0; i < len; i++) digs.push(int(rand, i === 0 ? 1 : 0, base - 1));
    if (!valid) {
      const pos = int(rand, 0, len - 1);
      digs[pos] = base === 2 ? int(rand, 2, 9) : int(rand, 8, 9);
    }
    const str = digs.join("");
    return { label: str, value: Number(str) };
  },
  classify: (item, base) => (badDigit(item.label, base) === null ? 0 : 1),
  explain(item, base) {
    const d = badDigit(item.label, base);
    if (d === null) return fillL(base === 2 ? S.explainOk2 : S.explainOk8, { s: item.label });
    return fillL(base === 2 ? S.explainBad2 : S.explainBad8, { s: item.label, d });
  },
};

/** Слагаемые весов: 22 → «16 + 4 + 2». */
export function weightTerms(n: number): number[] {
  const out: number[] = [];
  for (let k = Math.floor(Math.log2(n)) + 1; k >= 0; k--) if (n & (1 << k)) out.push(1 << k);
  return out;
}

const compare: RuleDef = {
  id: "compare",
  skill: "ns.bin2dec",
  makeSession(rand, tier) {
    const [lo, hi] = COMPARE_T[tier];
    const t = int(rand, lo, hi);
    return {
      param: t,
      title: fillL(S.compareTitle, { t }),
      bins: [fillL(S.binLess, { t }), fillL(S.binGreater, { t })],
    };
  },
  gen(rand, tier, t) {
    let v = t;
    while (v === t) {
      if (tier === 2) v = Math.max(1, t + (rand() < 0.5 ? -1 : 1) * int(rand, 1, 6));
      else v = int(rand, Math.max(1, Math.floor(t / 3)), t * 2 - Math.floor(t / 3));
    }
    return { label: sub2(toBinary(v)), value: v };
  },
  classify: (item, t) => (item.value < t ? 0 : 1),
  explain(item, t) {
    const terms = weightTerms(item.value);
    // «16 + 4 + 2 = 22»; для степени двойки сумма из одного слагаемого — просто «16»
    const calc = terms.length > 1 ? `${terms.join(" + ")} = ${item.value}` : String(item.value);
    return fillL(S.explainCompare, { bin: toBinary(item.value), calc, cmp: item.value < t ? "<" : ">", t });
  },
};

export const RULES: Record<RuleId, RuleDef> = { parity, digits, shape, base: baseRule, compare };
export const RULE_ORDER: RuleId[] = ["parity", "digits", "shape", "base", "compare"];

/**
 * Взвешенный выбор следующего правила: (1.1 − освоение)², не два раза подряд.
 * maxWeight ограничивает трудность (разгон в начале блица): правила тяжелее не берём.
 */
export function pickRule(
  rand: Rand,
  mastery: (skill: SkillId) => number,
  prev: RuleId | null,
  maxWeight = Infinity,
): RuleId {
  let cands = RULE_ORDER.filter((r) => r !== prev && RULE_WEIGHT[r] <= maxWeight);
  if (cands.length === 0) cands = RULE_ORDER.filter((r) => r !== prev);
  const w = cands.map((r) => (1.1 - Math.min(1, Math.max(0, mastery(RULES[r].skill)))) ** 2);
  const total = w.reduce((a, b) => a + b, 0);
  let x = rand() * total;
  for (let i = 0; i < cands.length; i++) {
    x -= w[i];
    if (x < 0) return cands[i];
  }
  return cands[cands.length - 1];
}

// ---------- очки, множитель ----------

export function multiplierFor(streak: number): number {
  if (streak >= 12) return 4;
  if (streak >= 8) return 3;
  if (streak >= 4) return 2;
  return 1;
}

/** Очки за верный выбор; streak — серия верных ДО этой карточки. */
export function cardPoints(fallProgress: number, streak: number): number {
  const fp = Math.min(1, Math.max(0, fallProgress));
  return (10 + Math.round(5 * (1 - fp))) * multiplierFor(streak);
}

export function newSeed(): number {
  return hashString(`bit-sort:${Date.now()}:${Math.random()}`);
}

// ---------- движок раунда ----------

export interface Resolution {
  correct: boolean;
  points: number;
  mult: number;
}

export class SortEngine {
  readonly rand: Rand;
  readonly mastery: (skill: SkillId) => number;
  readonly mode: GameMode;
  readonly cfg: ModeConfig;
  tier: Tier = 0;
  session: Session;
  /** Базовое время падения, сек; время карточки = базовое × вес правила (см. fallMs). */
  fallSeconds: number;
  score = 0;
  streak = 0;
  correctTotal = 0;
  wrongRow = 0;
  resolvedInSession = 0;
  /** Сколько карточек разобрано за игру (с повторами ошибок). */
  resolvedTotal = 0;
  private sessionCounter = 0;
  private cardCounter = 0;
  private drawn = 0;
  private used = new Set<string>();
  private queue: { card: Card; due: number }[] = [];
  private lastLabel = "";

  constructor(seed: number, mastery: (skill: SkillId) => number = () => 0.3, mode: GameMode = "blitz") {
    this.rand = seeded(seed);
    this.mastery = mastery;
    this.mode = mode;
    this.cfg = MODE_CONFIG[mode];
    this.fallSeconds = this.cfg.fallStart;
    // первое правило всегда самое лёгкое (чётность)
    this.session = this.makeSession(RULE_BY_DIFFICULTY[0]);
  }

  private makeSession(rule: RuleId): Session {
    const def = RULES[rule];
    const m = def.makeSession(this.rand, this.tier);
    this.sessionCounter++;
    this.used = new Set();
    this.queue = [];
    this.resolvedInSession = 0;
    this.lastLabel = "";
    return { id: this.sessionCounter, rule, skill: def.skill, tier: this.tier, ...m };
  }

  /** Номер текущего правила (с 1) и сколько их всего (0 — блиц, без счёта). */
  get ruleNo(): number {
    return this.sessionCounter;
  }
  get rulesTotal(): number {
    return this.cfg.rulesPerGame;
  }
  /** Сколько карточек в игре (0 — блиц, без счёта). */
  get cardsTotal(): number {
    return this.cfg.rulesPerGame * this.cfg.cardsPerRule;
  }

  /** Следующее правило (вызывать между карточками, когда sessionDone()). */
  startSession(): Session {
    let rule: RuleId;
    if (this.cfg.byDifficulty) {
      rule = RULE_BY_DIFFICULTY[Math.min(this.sessionCounter, RULE_BY_DIFFICULTY.length - 1)];
    } else {
      // блиц: разгон — первые правила только лёгкие, дальше взвешенно по освоению
      const cap = this.sessionCounter < RAMP_SESSIONS ? RAMP_MAX_WEIGHT : Infinity;
      rule = pickRule(this.rand, this.mastery, this.session.rule, cap);
    }
    this.session = this.makeSession(rule);
    return this.session;
  }

  sessionDone(): boolean {
    return this.resolvedInSession >= this.cfg.cardsPerRule;
  }

  /** Игра с фиксированным числом правил закончена (блиц кончается по часам — всегда false). */
  gameDone(): boolean {
    return this.cfg.rulesPerGame > 0 && this.sessionCounter >= this.cfg.rulesPerGame && this.sessionDone();
  }

  /** Время падения текущей карточки, мс (Infinity — не падает). */
  fallMs(): number {
    return taskTimeMs(this.session.rule, this.mode, this.fallSeconds);
  }

  private build(item: Item, retry: boolean): Card {
    const s = this.session;
    const def = RULES[s.rule];
    return {
      id: ++this.cardCounter,
      rule: s.rule,
      sessionId: s.id,
      skill: s.skill,
      item,
      bin: def.classify(item, s.param),
      explain: def.explain(item, s.param),
      retry,
    };
  }

  draw(): Card {
    this.drawn++;
    const s = this.session;
    const qi = this.queue.findIndex((q) => q.due <= this.drawn && q.card.sessionId === s.id && q.card.item.label !== this.lastLabel);
    if (qi >= 0) {
      const [q] = this.queue.splice(qi, 1);
      const card = this.build(q.card.item, true);
      this.lastLabel = card.item.label;
      return card;
    }
    const def = RULES[s.rule];
    let item = def.gen(this.rand, s.tier, s.param);
    for (let i = 0; i < 300; i++) {
      if (!this.used.has(item.label) && item.label !== this.lastLabel) break;
      const next = def.gen(this.rand, s.tier, s.param);
      if (next.label !== this.lastLabel) item = next;
    }
    this.used.add(item.label);
    this.lastLabel = item.label;
    return this.build(item, false);
  }

  /** Фиксирует итог карточки: очки, серию, сложность падения, уровень, повтор ошибки. */
  resolve(card: Card, correct: boolean, fallProgress: number): Resolution {
    const cfg = this.cfg;
    this.resolvedInSession++;
    this.resolvedTotal++;
    if (correct) {
      const mult = multiplierFor(this.streak);
      const points = cardPoints(fallProgress, this.streak);
      this.score += points;
      this.streak++;
      this.correctTotal++;
      this.wrongRow = 0;
      if (cfg.falls && this.correctTotal % cfg.speedUpEvery === 0) {
        this.fallSeconds = Math.max(cfg.fallMin, this.fallSeconds * cfg.fallFactor);
      }
      if (this.correctTotal % cfg.tierEvery === 0) this.tier = Math.min(cfg.maxTier, this.tier + 1) as Tier;
      return { correct, points, mult };
    }
    this.streak = 0;
    this.wrongRow++;
    if (this.wrongRow >= 2) {
      this.tier = Math.max(0, this.tier - 1) as Tier;
      this.wrongRow = 0;
    }
    if (cfg.falls) this.fallSeconds = Math.min(cfg.fallStart, this.fallSeconds / cfg.fallFactor);
    if (!card.retry && card.sessionId === this.session.id) {
      this.queue.push({ card, due: this.drawn + REQUEUE_GAP });
    }
    return { correct, points: 0, mult: 1 };
  }
}
