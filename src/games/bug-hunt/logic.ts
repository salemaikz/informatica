import type { GameMode } from "@/games/types";
import { divisionLadder, toBinary } from "@/lib/check";
import { fmt, shuffle } from "@/lib/text";
import type { L, SkillId } from "@/lib/types";
import { S } from "./strings";

export type TemplateId = "ladder" | "weights" | "props" | "base";
export type Tier = 0 | 1 | 2;
type Rand = () => number;
type Params = Record<string, string | number>;

export interface Fault {
  line: number;
  type: string;
  fixOptions: L[];
  fixCorrect: number;
  explain: L;
}

export interface Puzzle {
  template: TemplateId;
  skill: SkillId;
  header: L;
  lines: L[];
  fault: Fault | null;
}

export const ROUND_MS = 90_000;
export const WALL_CAP_MS = 120_000;
export const FIX_MS = 8_000;
export const FIX_BONUS = 5;
export const TEMPLATES: TemplateId[] = ["ladder", "weights", "props", "base"];
export const SKILL_OF: Record<TemplateId, SkillId> = {
  ladder: "ns.dec2bin",
  weights: "ns.bin2dec",
  props: "ns.props",
  base: "ns.base",
};
export const SKILLS: SkillId[] = TEMPLATES.map((t) => SKILL_OF[t]);

// ---------- helpers ----------

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export function sup(k: number): string {
  return String(k)
    .split("")
    .map((c) => SUP[Number(c)])
    .join("");
}

const mk = (l: L, p?: Params): L => ({ ru: fmt(l.ru, p), kk: fmt(l.kk, p) });
const rint = (r: Rand, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const pick = <T>(r: Rand, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
export const sameL = (a: L, b: L) => a.ru === b.ru && a.kk === b.kk;
const rev = (s: string) => s.split("").reverse().join("");

/** Одна мутация: какая строка портится, чем, и как выглядит верный вариант. */
interface Mutation {
  line: number;
  type: string;
  shown: L;
  /** Верный вариант строки (по умолчанию — исходная строка). */
  fixed?: L;
  others: L[];
  explain: L;
}

interface Draft {
  header: L;
  lines: L[];
  mutations: Array<() => Mutation | null>;
}

function buildFault(rand: Rand, lines: L[], m: Mutation): { lines: L[]; fault: Fault } | null {
  const fixed = m.fixed ?? lines[m.line];
  if (sameL(fixed, m.shown)) return null;
  // Дубликат другой строки делает «ту самую» строку неоднозначной.
  if (lines.some((l, i) => i !== m.line && sameL(l, m.shown))) return null;
  const opts: L[] = [];
  for (const o of [fixed, m.shown, ...m.others]) if (!opts.some((x) => sameL(x, o))) opts.push(o);
  if (opts.length < 2) return null;
  const options = shuffle(opts.slice(0, 3), rand);
  const fixCorrect = options.findIndex((o) => sameL(o, fixed));
  const out = lines.slice();
  out[m.line] = m.shown;
  return { lines: out, fault: { line: m.line, type: m.type, fixOptions: options, fixCorrect, explain: m.explain } };
}

// ---------- A. ladder ----------

export function ladderRange(tier: Tier): [number, number] {
  return tier === 0 ? [9, 31] : tier === 1 ? [32, 90] : [91, 127];
}

const ladderRow = (v: number, q: number, r: number) => mk(S.lLadderRow, { v, q, r });

function draftLadder(rand: Rand, tier: Tier): Draft {
  const [lo, hi] = ladderRange(tier);
  const n = rint(rand, lo, hi);
  const bin = toBinary(n);
  const rows = divisionLadder(n);
  const lines = [...rows.map((r) => ladderRow(r.value, r.quotient, r.remainder)), mk(S.lAnswer, { bin })];
  const last = lines.length - 1;
  const reversed = rev(bin);
  const dropped = bin.slice(1);
  return {
    header: mk(S.hLadder, { n }),
    lines,
    mutations: [
      () => {
        const i = rint(rand, 0, rows.length - 1);
        const r = rows[i];
        return {
          line: i,
          type: "remainder",
          shown: ladderRow(r.value, r.quotient, 1 - r.remainder),
          others: [],
          explain: mk(r.value % 2 === 0 ? S.eRemEven : S.eRemOdd, { v: r.value }),
        };
      },
      () => {
        if (reversed === bin) return null;
        return {
          line: last,
          type: "reversed",
          shown: mk(S.lAnswer, { bin: reversed }),
          others: [mk(S.lAnswer, { bin: dropped })],
          explain: mk(S.eReversed, { bin }),
        };
      },
      () => ({
        line: last,
        type: "dropped",
        shown: mk(S.lAnswer, { bin: dropped }),
        others: reversed === bin ? [] : [mk(S.lAnswer, { bin: reversed })],
        explain: mk(S.eDropped, { k: rows.length, bin }),
      }),
    ],
  };
}

// ---------- B. weights ----------

export function weightsRange(tier: Tier, rand: Rand): [number, number] {
  const len = tier === 0 ? 4 : tier === 1 ? rint(rand, 5, 6) : 7;
  return [2 ** (len - 1), 2 ** len - 1];
}

const wRow = (d: string | number, k: number, v: number) => mk(S.lWeightRow, { d, exp: sup(k), v });
const wTotal = (terms: number[], n: number) => mk(S.lTotal, { terms: terms.join(" + "), n });

function draftWeights(rand: Rand, tier: Tier): Draft {
  const [lo, hi] = weightsRange(tier, rand);
  const n = rint(rand, lo, hi);
  const bin = toBinary(n);
  const len = bin.length;
  const digits = bin.split("");
  const kOf = (i: number) => len - 1 - i;
  const terms = digits.flatMap((d, i) => (d === "1" ? [2 ** kOf(i)] : []));
  const lines = [...digits.map((d, i) => wRow(d, kOf(i), Number(d) * 2 ** kOf(i))), wTotal(terms, n)];
  const ones = digits.map((d, i) => (d === "1" ? i : -1)).filter((i) => i >= 0);
  const zeros = digits.map((d, i) => (d === "0" ? i : -1)).filter((i) => i >= 0);
  const totalLine = lines.length - 1;
  const muts: Array<() => Mutation | null> = [];

  const powerCands = ones.filter((i) => kOf(i) >= 3);
  if (powerCands.length)
    muts.push(() => {
      const i = pick(rand, powerCands);
      const k = kOf(i);
      return {
        line: i,
        type: "powerMul",
        shown: wRow(1, k, 2 * k),
        others: [wRow(1, k, 2 ** (k - 1))],
        explain: mk(S.ePowerMul, { exp: sup(k), pow: 2 ** k, k }),
      };
    });
  if (zeros.length)
    muts.push(() => {
      const i = pick(rand, zeros);
      const k = kOf(i);
      return {
        line: i,
        type: "zeroCounted",
        shown: wRow(0, k, 2 ** k),
        others: [wRow(0, k, 1)],
        explain: mk(S.eZero, { exp: sup(k) }),
      };
    });
  muts.push(() => {
    const deltas = [1, -1, 2, -2];
    for (const i of zeros) deltas.push(2 ** kOf(i), -(2 ** kOf(i)));
    const valid = deltas.filter((d) => n + d > 0);
    const d = pick(rand, valid);
    return {
      line: totalLine,
      type: "sum",
      shown: wTotal(terms, n + d),
      others: [wTotal(terms, n + (d > 0 ? -1 : 1))],
      explain: mk(S.eSum, { terms: terms.join(" + "), n }),
    };
  });
  if (tier >= 1 && ones.some((i) => kOf(i) >= 1))
    muts.push(() => {
      const i = pick(
        rand,
        ones.filter((x) => kOf(x) >= 1),
      );
      const k = kOf(i);
      return {
        line: i,
        type: "shift",
        shown: wRow(1, k - 1, 2 ** (k - 1)),
        others: [wRow(1, k + 1, 2 ** (k + 1))],
        explain: mk(S.eShift, { exp: sup(k), pow: 2 ** k }),
      };
    });
  return { header: mk(S.hWeights, { bin }), lines, mutations: muts };
}

// ---------- C. props ----------

export function propsRange(tier: Tier): [number, number] {
  return tier === 0 ? [5, 15] : tier === 1 ? [16, 63] : [64, 255];
}

function parityExplain(odd: boolean): L {
  const word = odd ? S.parityOdd : S.parityEven;
  const b = odd ? 1 : 0;
  return { ru: fmt(S.eParity.ru, { b, res: word.ru }), kk: fmt(S.eParity.kk, { b, res: word.kk }) };
}

type PropKind = "parity" | "len" | "ones" | "pow" | "powMinus";

const countOnes = (s: string) => s.split("").filter((c) => c === "1").length;

function draftProps(rand: Rand, tier: Tier): Draft {
  const [lo, hi] = propsRange(tier);
  const n = rint(rand, lo, hi);
  const bin = toBinary(n);
  const odd = n % 2 === 1;
  const kinds: PropKind[] = ["parity", "len", "ones"];
  const lines: L[] = [
    mk(S.lNumBin, { n, bin }),
    mk(odd ? S.lOdd : S.lEven, { n }),
    mk(S.lLen, { k: bin.length }),
    mk(S.lOnes, { k: countOnes(bin) }),
  ];
  // В 30 % заданий одно из утверждений заменяется утверждением о степени двойки.
  let powK = 0;
  if (rand() < 0.3) {
    const idx = rint(rand, 0, 2);
    if (rand() < 0.5) {
      powK = rint(rand, 2, 7);
      kinds[idx] = "pow";
      lines[idx + 1] = mk(S.lPow, { exp: sup(powK), bin: "1" + "0".repeat(powK) });
    } else {
      powK = rint(rand, 3, 7);
      kinds[idx] = "powMinus";
      lines[idx + 1] = mk(S.lPowMinus, { exp: sup(powK), bin: "1".repeat(powK) });
    }
  }
  const mutFor = (idx: number): Mutation | null => {
    const kind = kinds[idx];
    const line = idx + 1;
    if (kind === "parity") {
      return {
        line,
        type: "parity",
        shown: mk(odd ? S.lOddWrong : S.lEvenWrong, { n }),
        others: [],
        explain: parityExplain(odd),
      };
    }
    if (kind === "len" || kind === "ones") {
      const real = kind === "len" ? bin.length : countOnes(bin);
      const sign = kind === "ones" && real === 1 ? 1 : rand() < 0.5 ? 1 : -1;
      const tpl = kind === "len" ? S.lLen : S.lOnes;
      return {
        line,
        type: kind,
        shown: mk(tpl, { k: real + sign }),
        others: [mk(tpl, { k: real - sign })],
        explain: mk(kind === "len" ? S.eLen : S.eOnes, { bin, k: real }),
      };
    }
    if (kind === "pow") {
      const good = "1" + "0".repeat(powK);
      const more = good + "0";
      const less = good.slice(0, -1);
      const [a, b] = rand() < 0.5 ? [more, less] : [less, more];
      return {
        line,
        type: "pow",
        shown: mk(S.lPow, { exp: sup(powK), bin: a }),
        others: [mk(S.lPow, { exp: sup(powK), bin: b })],
        explain: mk(S.ePow, { exp: sup(powK), k: powK, bin: good }),
      };
    }
    const good = "1".repeat(powK);
    return {
      line,
      type: "powMinus",
      shown: mk(S.lPowMinus, { exp: sup(powK), bin: good + "1" }),
      others: [mk(S.lPowMinus, { exp: sup(powK), bin: good.slice(0, -1) })],
      explain: mk(S.ePowMinus, { exp: sup(powK), k: powK, bin: good }),
    };
  };
  return { header: mk(S.hProps, { n }), lines, mutations: [0, 1, 2].map((i) => () => mutFor(i)) };
}

// ---------- D. base ----------

interface Claim {
  key: string;
  line: L;
  mutate: () => Mutation;
}

const BASES = [2, 3, 5, 8, 10];

function randomBits(rand: Rand): string {
  const len = rint(rand, 4, 6);
  let s = "";
  for (let i = 0; i < len; i++) s += rand() < 0.5 ? "0" : "1";
  return s;
}

function withDigit(rand: Rand, s: string, d: number): string {
  const i = rint(rand, 0, s.length - 1);
  return s.slice(0, i) + d + s.slice(i + 1);
}

function claimPool(rand: Rand): Claim[] {
  const pool: Claim[] = [];
  for (const b of BASES) {
    pool.push({
      key: `range${b}`,
      line: mk(S.lRange, { b, max: b - 1 }),
      mutate: () => ({
        line: 0,
        type: "range",
        shown: mk(S.lRange, { b, max: b }),
        others: [mk(S.lRange, { b, max: b - 2 })],
        explain: mk(S.eRange, { b, max: b - 1 }),
      }),
    });
    pool.push({
      key: `count${b}`,
      line: mk(S.lCount, { b, c: b }),
      mutate: () => {
        const sign = rand() < 0.5 ? 1 : -1;
        return {
          line: 0,
          type: "count",
          shown: mk(S.lCount, { b, c: b + sign }),
          others: [mk(S.lCount, { b, c: b - sign })],
          explain: mk(S.eCount, { b }),
        };
      },
    });
  }
  const sCan = randomBits(rand);
  pool.push({
    key: "canBin",
    line: mk(S.lCanBin, { s: sCan }),
    mutate: () => {
      const d = rint(rand, 2, 9);
      const s = withDigit(rand, sCan, d);
      return {
        line: 0,
        type: "canBin",
        shown: mk(S.lCanBin, { s }),
        fixed: mk(S.lCannotBin, { s }),
        others: [],
        explain: mk(S.eCanBin, { s, d }),
      };
    },
  });
  const sNot = withDigit(rand, randomBits(rand), rint(rand, 2, 9));
  pool.push({
    key: "cannotBin",
    line: mk(S.lCannotBin, { s: sNot }),
    mutate: () => {
      const s = randomBits(rand);
      return {
        line: 0,
        type: "cannotBin",
        shown: mk(S.lCannotBin, { s }),
        fixed: mk(S.lCanBin, { s }),
        others: [],
        explain: mk(S.eCannotBin, { s }),
      };
    },
  });
  pool.push({
    key: "max8",
    line: mk(S.lMax8, { d: 7 }),
    mutate: () => ({
      line: 0,
      type: "max8",
      shown: mk(S.lMax8, { d: 8 }),
      others: [mk(S.lMax8, { d: 6 })],
      explain: mk(S.eMax8),
    }),
  });
  return pool;
}

function draftBase(rand: Rand): Draft {
  const claims = shuffle(claimPool(rand), rand).slice(0, 4);
  return {
    header: S.hBase,
    lines: claims.map((c) => c.line),
    mutations: claims.map((c, i) => () => ({ ...c.mutate(), line: i })),
  };
}

// ---------- generator ----------

/** Собирает одно задание. withFault=true → гарантированно ровно одна ошибка. */
export function generatePuzzle(rand: Rand, tier: Tier, template: TemplateId, withFault: boolean): Puzzle {
  const skill = SKILL_OF[template];
  for (let attempt = 0; attempt < 40; attempt++) {
    const draft =
      template === "ladder"
        ? draftLadder(rand, tier)
        : template === "weights"
          ? draftWeights(rand, tier)
          : template === "props"
            ? draftProps(rand, tier)
            : draftBase(rand);
    if (!withFault) return { template, skill, header: draft.header, lines: draft.lines, fault: null };
    for (const mut of shuffle(draft.mutations, rand)) {
      const m = mut();
      if (!m) continue;
      const built = buildFault(rand, draft.lines, m);
      if (built) return { template, skill, header: draft.header, lines: built.lines, fault: built.fault };
    }
  }
  // Недостижимо на практике: безопасный запасной вариант без ошибки.
  const d = draftBase(rand);
  return { template: "base", skill: SKILL_OF.base, header: d.header, lines: d.lines, fault: null };
}

/** Вес шаблона: чем слабее освоен навык, тем чаще. Тот же шаблон дважды подряд не выпадает. */
export function templateWeight(mastery: number): number {
  const m = Math.min(1, Math.max(0, mastery));
  return (1.1 - m) ** 2;
}

export function pickTemplate(
  rand: Rand,
  masteryOf: (skill: SkillId) => number,
  prev: TemplateId | null,
): TemplateId {
  const cands = TEMPLATES.filter((t) => t !== prev);
  const ws = cands.map((t) => templateWeight(masteryOf(SKILL_OF[t])));
  const total = ws.reduce((a, b) => a + b, 0);
  let x = rand() * total;
  for (let i = 0; i < cands.length; i++) {
    x -= ws[i];
    if (x < 0) return cands[i];
  }
  return cands[cands.length - 1];
}

export function noFaultChance(tier: Tier): number {
  return tier === 2 ? 0.25 : 0.2;
}

export function wantNoFault(rand: Rand, tier: Tier, prevNoFault: boolean): boolean {
  if (prevNoFault) return false;
  return rand() < noFaultChance(tier);
}

// ---------- время, очки, уровень ----------

export function puzzleTimeMs(tier: Tier, lineCount: number): number {
  const [base, per] = tier === 0 ? [8, 2.0] : tier === 1 ? [6, 1.6] : [5, 1.3];
  return Math.round((base + per * lineCount) * 1000);
}

export function multiplier(streak: number): 1 | 2 | 3 {
  return streak >= 6 ? 3 : streak >= 3 ? 2 : 1;
}

/** Очки за верную находку; streak — серия верных находок ДО этой. */
export function findPoints(secondsLeft: number, streak: number): number {
  return (10 + Math.min(10, Math.max(0, Math.floor(secondsLeft)))) * multiplier(streak);
}

export interface TierState {
  tier: Tier;
  correctSinceUp: number;
  wrongRow: number;
}

export const START_TIER: TierState = { tier: 0, correctSinceUp: 0, wrongRow: 0 };
/** Для раундов с лесенкой уровней: «потолок» адаптации открыт, расписание задаёт рост. */
const OPEN_TIER: TierState = { tier: 2, correctSinceUp: 0, wrongRow: 0 };

export function updateTier(s: TierState, correct: boolean): TierState {
  if (correct) {
    const c = s.correctSinceUp + 1;
    if (c >= 3) return { tier: Math.min(2, s.tier + 1) as Tier, correctSinceUp: 0, wrongRow: 0 };
    return { ...s, correctSinceUp: c, wrongRow: 0 };
  }
  const w = s.wrongRow + 1;
  if (w >= 2) return { ...s, tier: Math.max(0, s.tier - 1) as Tier, wrongRow: 0 };
  return { ...s, wrongRow: w };
}

/** Верна ли находка: номер строки с ошибкой или "none". */
export function isCorrectFind(p: Puzzle, choice: number | "none"): boolean {
  return p.fault ? choice === p.fault.line : choice === "none";
}

// ---------- режимы темпа ----------

export interface ModeConfig {
  /** Заданий в раунде; null — раунд идёт по общим часам. */
  puzzles: number | null;
  /** Общие часы раунда, мс (только блиц). */
  roundMs: number | null;
  /** Предел реального времени раунда, мс (защита от простоя в блице). */
  wallCapMs: number | null;
  /** Время на правку строки, мс; null — без таймера. */
  fixMs: number | null;
  /** Через сколько мс разбор сам переходит к следующему заданию; null — только по «Далее». */
  revealMs: number | null;
  /** То же после верного «Ошибок нет». */
  cleanMs: number | null;
  /** Есть ли кнопка паузы. */
  pause: boolean;
  /** Лесенка уровней по номеру задания; null — адаптивно, начиная с уровня 0. */
  tiers: Tier[] | null;
  /** Первое задание всегда с ошибкой (чтобы механика была понятна). */
  firstFault: boolean;
}

export const MODE_CONFIG: Record<GameMode, ModeConfig> = {
  // Как раньше: общие часы 90 с, на строку и правку считанные секунды.
  blitz: {
    puzzles: null,
    roundMs: ROUND_MS,
    wallCapMs: WALL_CAP_MS,
    fixMs: FIX_MS,
    revealMs: 4000,
    cleanMs: 900,
    pause: false,
    tiers: null,
    firstFault: false,
  },
  // 8 заданий без общих часов; время на задание — taskTimeMs.
  normal: {
    puzzles: 8,
    roundMs: null,
    wallCapMs: null,
    fixMs: 15_000,
    revealMs: 5000,
    cleanMs: 1200,
    pause: true,
    tiers: [0, 0, 0, 1, 1, 1, 2, 2],
    firstFault: true,
  },
  // 6 заданий, без таймеров; после каждого — «Далее».
  calm: {
    puzzles: 6,
    roundMs: null,
    wallCapMs: null,
    fixMs: null,
    revealMs: null,
    cleanMs: null,
    pause: false,
    tiers: [0, 0, 1, 1, 2, 2],
    firstFault: true,
  },
};

/** Время на поиск ошибки в «Обычном» по уровню — для задания из NORMAL_REF_LINES строк. */
export const NORMAL_FIND_MS: Record<Tier, number> = { 0: 35_000, 1: 45_000, 2: 55_000 };
export const NORMAL_REF_LINES = 6;
export const NORMAL_PER_LINE_MS = 2000;
export const NORMAL_MIN_MS = 25_000;

/** Время на поиск ошибки, мс: блиц — как раньше, «Обычный» — по уровню и числу строк, «Спокойный» — без лимита (null). */
export function taskTimeMs(tier: Tier, lineCount: number, mode: GameMode): number | null {
  if (mode === "calm") return null;
  if (mode === "blitz") return puzzleTimeMs(tier, lineCount);
  return Math.max(NORMAL_MIN_MS, NORMAL_FIND_MS[tier] + (lineCount - NORMAL_REF_LINES) * NORMAL_PER_LINE_MS);
}

/** Бонус в секундах для findPoints. Блиц — остаток секунд; «Обычный» — доля остатка времени × 10; «Спокойный» — фиксированный. */
export const CALM_BONUS_SEC = 5;
export function bonusSeconds(mode: GameMode, leftMs: number, totalMs: number): number {
  if (mode === "blitz") return leftMs / 1000;
  if (mode === "calm" || totalMs <= 0) return CALM_BONUS_SEC;
  return (Math.max(0, Math.min(totalMs, leftMs)) / totalMs) * 10;
}

/** Начальное состояние адаптации уровня для режима. */
export function startTierState(mode: GameMode): TierState {
  return MODE_CONFIG[mode].tiers ? OPEN_TIER : START_TIER;
}

/** Уровень задания: в блице — адаптивно с нуля; иначе — лесенка по номеру (с 0), но ошибки подряд опускают потолок. */
export function tierFor(mode: GameMode, index: number, adaptive: TierState): Tier {
  const ladder = MODE_CONFIG[mode].tiers;
  if (!ladder) return adaptive.tier;
  const planned = ladder[Math.min(Math.max(0, index), ladder.length - 1)];
  return Math.min(planned, adaptive.tier) as Tier;
}
