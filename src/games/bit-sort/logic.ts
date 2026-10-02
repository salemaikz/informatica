import type { L, SkillId } from "@/lib/types";
import { toBinary } from "@/lib/check";
import { fmt, hashString } from "@/lib/text";
import { seeded } from "@/lib/text";
import { S } from "./strings";

export type Tier = 0 | 1 | 2;
export type RuleId = "parity" | "digits" | "shape" | "base" | "compare";

export const ROUND_SECONDS = 75;
export const WALL_CAP_SECONDS = 110;
export const CARDS_PER_RULE = 8;
export const D_START = 5;
export const D_MIN = 2.2;
export const D_FACTOR = 0.92;
export const REQUEUE_GAP = 3;

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
    return fillL(S.explainParity, { d: bin[bin.length - 1], res: odd ? S.resOdd : S.resEven });
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
    return fillL(S.explainDigits, { n: item.value, bin: toBinary(item.value), k: toBinary(item.value).length });
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
    if (d === null) return base === 2 ? S.explainOk2 : S.explainOk8;
    return fillL(base === 2 ? S.explainBad2 : S.explainBad8, { d });
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
  explain(item) {
    return fillL(S.explainCompare, {
      bin: toBinary(item.value),
      terms: weightTerms(item.value).join(" + "),
      n: item.value,
    });
  },
};

export const RULES: Record<RuleId, RuleDef> = { parity, digits, shape, base: baseRule, compare };
export const RULE_ORDER: RuleId[] = ["parity", "digits", "shape", "base", "compare"];

/** Взвешенный выбор следующего правила: (1.1 − освоение)², не два раза подряд. */
export function pickRule(rand: Rand, mastery: (skill: SkillId) => number, prev: RuleId | null): RuleId {
  const cands = RULE_ORDER.filter((r) => r !== prev);
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
  tier: Tier = 0;
  session: Session;
  fallSeconds = D_START;
  score = 0;
  streak = 0;
  correctTotal = 0;
  wrongRow = 0;
  resolvedInSession = 0;
  private sessionCounter = 0;
  private cardCounter = 0;
  private drawn = 0;
  private used = new Set<string>();
  private queue: { card: Card; due: number }[] = [];
  private lastLabel = "";

  constructor(seed: number, mastery: (skill: SkillId) => number = () => 0.3) {
    this.rand = seeded(seed);
    this.mastery = mastery;
    this.session = this.makeSession("parity");
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

  /** Следующее правило (вызывать между карточками, когда sessionDone()). */
  startSession(): Session {
    const rule = pickRule(this.rand, this.mastery, this.session.rule);
    this.session = this.makeSession(rule);
    return this.session;
  }

  sessionDone(): boolean {
    return this.resolvedInSession >= CARDS_PER_RULE;
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
    this.resolvedInSession++;
    if (correct) {
      const mult = multiplierFor(this.streak);
      const points = cardPoints(fallProgress, this.streak);
      this.score += points;
      this.streak++;
      this.correctTotal++;
      this.wrongRow = 0;
      if (this.correctTotal % 4 === 0) this.fallSeconds = Math.max(D_MIN, this.fallSeconds * D_FACTOR);
      if (this.correctTotal % 6 === 0) this.tier = Math.min(2, this.tier + 1) as Tier;
      return { correct, points, mult };
    }
    this.streak = 0;
    this.wrongRow++;
    if (this.wrongRow >= 2) {
      this.tier = Math.max(0, this.tier - 1) as Tier;
      this.wrongRow = 0;
    }
    this.fallSeconds = Math.min(D_START, this.fallSeconds / D_FACTOR);
    if (!card.retry && card.sessionId === this.session.id) {
      this.queue.push({ card, due: this.drawn + REQUEUE_GAP });
    }
    return { correct, points: 0, mult: 1 };
  }
}
