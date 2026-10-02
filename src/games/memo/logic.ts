import type { GameAttempt, GameMode, GameResult } from "@/games/types";
import { draw, skillsWithShape, type Pair } from "@/lib/bank";
import { hashString, shuffle, seeded } from "@/lib/text";
import type { Level, SkillId, Text } from "@/lib/types";

// Чистая логика «Мемо-пар»: раунды по 6 пар из банка, переворот карточек, очки. Без React.

/** Навыки по умолчанию (GameMeta.skills), если игре не передали свои. */
export const DEFAULT_SKILLS: SkillId[] = ["ns.bin2dec", "ns.dec2bin", "ns.base", "ns.props"];

/** Сколько пар в раунде (поле 4×3) и минимум, при котором раунд ещё имеет смысл. */
export const PAIRS_PER_ROUND = 6;
export const MIN_PAIRS = 3;
/** Через сколько мс неверно открытая пара закрывается. */
export const MISS_CLOSE_MS = 900;
/** Блиц: общее время игры, мс. */
export const BLITZ_MS = 90_000;
/** Жёсткий предел блица по настенным часам (на случай бесконечной паузы/фона), мс. */
export const BLITZ_WALL_CAP_MS = 270_000;
/** Штраф за «лишнее» переворачивание (ошибку на уже виденной карточке), очки. */
export const EXTRA_PENALTY = 2;
/** Бонус за раунд совсем без лишних ошибок. */
export const PERFECT_BONUS = 20;

export interface ModeConfig {
  /** Сколько раундов в игре (null — пока идут часы). */
  rounds: number | null;
  /** Общие часы, мс (blitz). */
  clockMs: number | null;
  /** Мягкое время на одну пару по уровню A/B/C, мс; лимит раунда — сумма по его парам (null — без лимита). */
  perPairMs: readonly [number, number, number] | null;
  /** Показывать разбор пар после раунда и ждать «Дальше». */
  review: boolean;
  /** Очки за найденную пару по уровню A/B/C. */
  points: readonly [number, number, number];
}

export const MODE_CONFIG: Record<GameMode, ModeConfig> = {
  calm: { rounds: 1, clockMs: null, perPairMs: null, review: true, points: [10, 15, 20] },
  normal: { rounds: 2, clockMs: null, perPairMs: [30_000, 45_000, 60_000], review: true, points: [10, 15, 20] },
  blitz: { rounds: null, clockMs: BLITZ_MS, perPairMs: null, review: false, points: [10, 15, 20] },
};

/** Диапазон уровней заданий в раунде (номер раунда — с 0). */
export function levelsForRound(mode: GameMode, roundIndex: number): { min: Level; max: Level } {
  if (mode === "calm") return { min: 1, max: 3 };
  return roundIndex === 0 ? { min: 1, max: 2 } : { min: 2, max: 3 };
}

/** Мягкий лимит времени на раунд, мс (null — без лимита). */
export function roundLimitMs(mode: GameMode, pairs: readonly Pair[]): number | null {
  const per = MODE_CONFIG[mode].perPairMs;
  if (!per) return null;
  return pairs.reduce((s, p) => s + per[p.level - 1], 0);
}

/** Очки за найденную пару. */
export function pairPoints(mode: GameMode, level: Level): number {
  return MODE_CONFIG[mode].points[level - 1];
}

/** Навыки, из которых реально можно взять пары (пустой список props → навыки по умолчанию). */
export function resolveSkills(skills?: SkillId[]): SkillId[] {
  const wanted = skills && skills.length ? skills : DEFAULT_SKILLS;
  return skillsWithShape(wanted, "pair");
}

export function newSeed(): number {
  return hashString(`memo:${Date.now()}:${Math.random()}`);
}

/** Строка для сравнения карточек: два одинаковых текста на поле сделали бы пару неоднозначной. */
export function textKey(t: Text): string {
  return typeof t === "string" ? t : `${t.ru}|${t.kk}`;
}

function pairKey(p: Pair): string {
  return `${textKey(p.left)}→${textKey(p.right)}`;
}

/** «Формула»: в тексте нет ни одной буквы — набираем моноширинным шрифтом. */
export function isFormula(text: string): boolean {
  return !/\p{L}/u.test(text.replace(/[₀-₉]/g, ""));
}

export interface PickOptions {
  pool: SkillId[];
  count: number;
  seed: number;
  minLevel: Level;
  maxLevel: Level;
  /** Ключи уже использованных пар (прошлые раунды) — их не берём. */
  exclude?: ReadonlySet<string>;
}

/**
 * Достаёт из банка до count пар для поля: без повторов и без одинаковых надписей на разных карточках.
 * Сначала — как просит ТЗ (draw с нарастанием уровня), потом при нехватке — добор из более широкой выборки.
 */
export function pickRoundPairs(opts: PickOptions): Pair[] {
  const { pool, count, seed, minLevel, maxLevel } = opts;
  const out: Pair[] = [];
  if (!pool.length || count <= 0) return out;
  const usedPairs = new Set(opts.exclude ?? []);
  const usedTexts = new Set<string>();
  const take = (items: Pair[]) => {
    for (const p of items) {
      if (out.length >= count) return;
      const l = textKey(p.left);
      const r = textKey(p.right);
      if (l === r || usedPairs.has(pairKey(p)) || usedTexts.has(l) || usedTexts.has(r)) continue;
      usedPairs.add(pairKey(p));
      usedTexts.add(l);
      usedTexts.add(r);
      out.push(p);
    }
  };
  take(draw("pair", { skills: pool, count, seed, minLevel, maxLevel, ramp: true }));
  for (let k = 1; out.length < count && k <= 4; k++) {
    take(draw("pair", { skills: pool, count: count * 4, seed: hashString(`${seed}:${k}`), minLevel, maxLevel, ramp: false }));
  }
  return out;
}

export type Side = "left" | "right";
export type CardStatus = "down" | "up" | "matched" | "miss";

export interface CardView {
  /** Стабильный ключ карточки в раунде. */
  key: string;
  pairIndex: number;
  side: Side;
  text: Text;
  status: CardStatus;
}

export type FlipResult =
  | { kind: "ignored" }
  | { kind: "first"; index: number }
  | { kind: "match"; pairIndex: number; points: number; roundComplete: boolean }
  | { kind: "miss"; /** была ли ошибка «лишней» (хоть одна карточка уже виденная) */ extra: boolean; penalty: number };

export type PairOutcome = "clean" | "missed" | "notFound";

export interface RoundSummary {
  round: number;
  timedOut: boolean;
  perfect: boolean;
  bonus: number;
  extraMisses: number;
  pairs: { pair: Pair; outcome: PairOutcome }[];
}

interface CardState {
  pairIndex: number;
  side: Side;
  text: Text;
  matched: boolean;
  /** Карточку уже открывали в одном из прошлых ходов (ученик мог её запомнить). */
  seen: boolean;
  up: boolean;
}

interface PairState {
  pair: Pair;
  found: boolean;
  /** Ошибки на карточках этой пары (пара открыта неверно, хотя карточка уже была видена). */
  misses: number;
}

export interface EngineOptions {
  skills?: SkillId[];
  mode: GameMode;
  seed: number;
}

/** Движок игры: раунды, поле, переворот, очки. Один экземпляр на игру. */
export class MemoEngine {
  readonly mode: GameMode;
  readonly cfg: ModeConfig;
  readonly pool: SkillId[];
  score = 0;
  /** Сколько раундов пройдено до конца (все пары найдены). */
  roundsCleared = 0;
  /** Номер текущего раунда, с 1 (0 — раунда нет). */
  round = 0;
  readonly attempts: GameAttempt[] = [];
  private cards: CardState[] = [];
  private pairs: PairState[] = [];
  private open: number[] = [];
  private pendingMiss = false;
  private extraMisses = 0;
  private limitMs: number | null = null;
  private readonly seed: number;
  private readonly usedPairs = new Set<string>();
  private roundClosed = true;

  constructor(opts: EngineOptions) {
    this.mode = opts.mode;
    this.cfg = MODE_CONFIG[opts.mode];
    this.pool = resolveSkills(opts.skills);
    this.seed = opts.seed;
    this.nextRound();
  }

  /** Есть ли открытый раунд (поле на экране). */
  get active(): boolean {
    return this.round > 0 && !this.roundClosed;
  }

  /** Сколько раундов нужно по режиму (null — блиц). */
  get roundsTotal(): number | null {
    return this.cfg.rounds;
  }

  get pairCount(): number {
    return this.pairs.length;
  }

  get foundCount(): number {
    return this.pairs.filter((p) => p.found).length;
  }

  get roundComplete(): boolean {
    return this.pairs.length > 0 && this.pairs.every((p) => p.found);
  }

  /** Лимит времени текущего раунда, мс (null — нет). */
  get roundLimit(): number | null {
    return this.limitMs;
  }

  get hasPendingMiss(): boolean {
    return this.pendingMiss;
  }

  /** Можно ли начать ещё один раунд по режиму (не гарантирует, что в банке хватит пар). */
  get moreRounds(): boolean {
    return this.cfg.rounds === null || this.round < this.cfg.rounds;
  }

  /** Начать следующий раунд. false — раунд начать нельзя (лимит раундов или в банке меньше MIN_PAIRS новых пар). */
  nextRound(): boolean {
    if (!this.moreRounds || !this.pool.length) return false;
    const idx = this.round; // номер нового раунда, с 0
    const { min, max } = levelsForRound(this.mode, idx);
    const picked = pickRoundPairs({
      pool: this.pool,
      count: PAIRS_PER_ROUND,
      seed: hashString(`${this.seed}:${idx}`),
      minLevel: min,
      maxLevel: max,
      exclude: this.usedPairs,
    });
    if (picked.length < MIN_PAIRS) return false;
    for (const p of picked) this.usedPairs.add(pairKey(p));
    this.round = idx + 1;
    this.pairs = picked.map((pair) => ({ pair, found: false, misses: 0 }));
    const cards: CardState[] = [];
    this.pairs.forEach((ps, pairIndex) => {
      cards.push({ pairIndex, side: "left", text: ps.pair.left, matched: false, seen: false, up: false });
      cards.push({ pairIndex, side: "right", text: ps.pair.right, matched: false, seen: false, up: false });
    });
    this.cards = shuffle(cards, seeded(hashString(`${this.seed}:field:${idx}`)));
    this.open = [];
    this.pendingMiss = false;
    this.extraMisses = 0;
    this.limitMs = roundLimitMs(this.mode, picked);
    this.roundClosed = false;
    return true;
  }

  /** Состояние поля для отрисовки. */
  view(): CardView[] {
    return this.cards.map((c, i) => ({
      key: `${this.round}:${i}`,
      pairIndex: c.pairIndex,
      side: c.side,
      text: c.text,
      status: c.matched ? "matched" : c.up ? (this.pendingMiss ? "miss" : "up") : "down",
    }));
  }

  /** Закрыть неверно открытую пару. Безопасно вызывать, когда закрывать нечего. */
  closeMiss(): void {
    if (!this.pendingMiss) return;
    for (const i of this.open) this.cards[i].up = false;
    this.open = [];
    this.pendingMiss = false;
  }

  /** Перевернуть карточку. Нажатие на уже открытую/найденную карточку и ход после конца раунда игнорируются. */
  flip(index: number): FlipResult {
    if (!this.active || this.roundComplete) return { kind: "ignored" };
    const card = this.cards[index];
    if (!card || card.matched) return { kind: "ignored" };
    if (this.pendingMiss) this.closeMiss(); // нажатие во время «паузы» ускоряет закрытие
    if (card.up) return { kind: "ignored" };
    card.up = true;
    this.open.push(index);
    if (this.open.length === 1) return { kind: "first", index };

    const [ia, ib] = this.open;
    const a = this.cards[ia];
    const b = this.cards[ib];
    if (a.pairIndex === b.pairIndex && a.side !== b.side) {
      a.matched = b.matched = true;
      this.open = [];
      const ps = this.pairs[a.pairIndex];
      ps.found = true;
      const points = pairPoints(this.mode, ps.pair.level);
      this.score += points;
      this.attempts.push({ skill: ps.pair.skill, correct: ps.misses === 0 });
      return { kind: "match", pairIndex: a.pairIndex, points, roundComplete: this.roundComplete };
    }

    // не пара: ошибка «лишняя», если хоть одну из двух карточек ученик уже видел и мог запомнить
    const extra = a.seen || b.seen;
    for (const c of [a, b]) {
      if (c.seen) this.pairs[c.pairIndex].misses++;
      c.seen = true;
    }
    let penalty = 0;
    if (extra) {
      this.extraMisses++;
      penalty = Math.min(EXTRA_PENALTY, this.score);
      this.score -= penalty;
    }
    this.pendingMiss = true;
    return { kind: "miss", extra, penalty };
  }

  /**
   * Время раунда вышло (normal): ненайденные пары засчитываются как ошибка.
   * В блице при конце времени пары, не найденные к этому моменту, не считаются.
   */
  timeoutRound(): RoundSummary {
    for (const ps of this.pairs) {
      if (!ps.found) this.attempts.push({ skill: ps.pair.skill, correct: false });
    }
    return this.closeRound(true);
  }

  /** Раунд закончен (все пары найдены): бонус за чистый раунд и разбор. */
  finishRound(): RoundSummary {
    return this.closeRound(false);
  }

  private closeRound(timedOut: boolean): RoundSummary {
    this.closeMiss();
    const perfect = !timedOut && this.roundComplete && this.extraMisses === 0;
    const bonus = perfect ? PERFECT_BONUS : 0;
    this.score += bonus;
    if (!timedOut && this.roundComplete) this.roundsCleared++;
    this.roundClosed = true;
    return {
      round: this.round,
      timedOut,
      perfect,
      bonus,
      extraMisses: this.extraMisses,
      pairs: this.pairs.map((ps) => ({
        pair: ps.pair,
        outcome: !ps.found ? "notFound" : ps.misses === 0 ? "clean" : "missed",
      })),
    };
  }

  result(): GameResult {
    const correct = this.attempts.filter((a) => a.correct).length;
    return { score: this.score, correct, total: this.attempts.length, attempts: [...this.attempts] };
  }
}

/** Число колонок поля: 4×3 для 6 пар, 3 колонки для совсем маленьких полей. */
export function columnsFor(pairs: number): number {
  return pairs * 2 <= 6 ? 3 : 4;
}

/** Размер шрифта надписи на карточке по её длине (узкое поле 360 px). */
export function cardTextClass(text: string, mono: boolean): string {
  const n = text.length;
  if (mono) return n <= 5 ? "text-xl" : n <= 7 ? "text-base" : n <= 9 ? "text-xs" : "text-[11px]";
  return n <= 6 ? "text-base" : n <= 10 ? "text-sm" : n <= 18 ? "text-xs" : "text-[11px]";
}
