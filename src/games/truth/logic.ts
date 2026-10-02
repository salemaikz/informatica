import type { GameAttempt, GameMode, GameResult } from "@/games/types";
import { draw, skillsWithShape, type Statement } from "@/lib/bank";
import { hashString } from "@/lib/text";
import type { Level, SkillId } from "@/lib/types";

// Чистая логика «Верю — не верю»: колода утверждений из банка, очки, серия. Без React.

/** Навыки по умолчанию (GameMeta.skills), если игре не передали свои. */
export const DEFAULT_SKILLS: SkillId[] = ["ns.bin2dec", "ns.dec2bin", "ns.base", "ns.props"];

/** Блиц: общее время игры, мс. */
export const BLITZ_MS = 60_000;
/** Серия верных ответов, после которой очки удваиваются. */
export const STREAK_FOR_DOUBLE = 5;
/** Блиц: сколько утверждений достаём за раз и когда докладываем. */
export const BLITZ_CHUNK = 12;
export const BLITZ_REFILL_AT = 3;

/** Свайп: путь (px) или скорость (px/с) + минимальный путь. */
export const SWIPE_DISTANCE = 90;
export const SWIPE_VELOCITY = 500;
export const SWIPE_MIN_FOR_VELOCITY = 35;

export interface ModeConfig {
  /** Сколько утверждений в игре (null — пока идут часы). */
  count: number | null;
  /** Общие часы, мс (blitz). */
  clockMs: number | null;
  /** Время на утверждение по уровню A/B/C, мс (null — без лимита). */
  perCardMs: readonly [number, number, number] | null;
  /** Как долго показывается «почему» после ответа: null — до «Дальше»; число — авто-переход, мс. */
  revealMs: number | null;
  /** Блиц: после верного ответа сразу идём дальше, «почему» показываем только после ошибки. */
  skipRevealOnCorrect: boolean;
  /** Очки за верный ответ по уровню A/B/C (до множителя серии). */
  points: readonly [number, number, number];
}

export const MODE_CONFIG: Record<GameMode, ModeConfig> = {
  calm: {
    count: 12,
    clockMs: null,
    perCardMs: null,
    revealMs: null,
    skipRevealOnCorrect: false,
    points: [10, 15, 20],
  },
  normal: {
    count: 15,
    clockMs: null,
    perCardMs: [30_000, 45_000, 60_000],
    revealMs: 2_500,
    skipRevealOnCorrect: false,
    points: [10, 15, 20],
  },
  blitz: {
    count: null,
    clockMs: BLITZ_MS,
    perCardMs: null,
    revealMs: 1_500,
    skipRevealOnCorrect: true,
    points: [1, 1, 1],
  },
};

/** Время на утверждение, мс (null — без лимита). */
export function cardTimeMs(mode: GameMode, level: Level): number | null {
  const per = MODE_CONFIG[mode].perCardMs;
  return per ? per[level - 1] : null;
}

/** Множитель очков; streak — серия верных ответов ДО текущего. */
export function multiplierFor(streak: number): number {
  return streak >= STREAK_FOR_DOUBLE ? 2 : 1;
}

/** Очки за верный ответ. */
export function pointsFor(mode: GameMode, level: Level, streak: number): number {
  return MODE_CONFIG[mode].points[level - 1] * multiplierFor(streak);
}

/** Навыки, из которых реально можно взять утверждения (пустой список props → навыки по умолчанию). */
export function resolveSkills(skills?: SkillId[]): SkillId[] {
  const wanted = skills && skills.length ? skills : DEFAULT_SKILLS;
  return skillsWithShape(wanted, "statement");
}

export function newSeed(): number {
  return hashString(`truth:${Date.now()}:${Math.random()}`);
}

/** «Формула»: в тексте нет ни одной буквы — набираем моноширинным шрифтом. */
export function isFormula(text: string): boolean {
  return !/\p{L}/u.test(text.replace(/[₀-₉]/g, ""));
}

export type SwipeDir = "believe" | "disbelieve";

/** Решение по жесту: offset/velocity по оси X (px, px/с). */
export function swipeDecision(offsetX: number, velocityX: number): SwipeDir | null {
  const dir: SwipeDir | null = offsetX > 0 ? "believe" : offsetX < 0 ? "disbelieve" : null;
  if (!dir) return null;
  const dist = Math.abs(offsetX);
  if (dist >= SWIPE_DISTANCE) return dir;
  if (dist >= SWIPE_MIN_FOR_VELOCITY && Math.abs(velocityX) >= SWIPE_VELOCITY && Math.sign(velocityX) === Math.sign(offsetX)) return dir;
  return null;
}

/** Уровни блица по номеру порции: сначала A–B, потом B–C. */
export function blitzLevels(chunk: number): { min: Level; max: Level } {
  if (chunk <= 0) return { min: 1, max: 2 };
  return { min: 2, max: 3 };
}

export interface Verdict {
  correct: boolean;
  timedOut: boolean;
  points: number;
  mult: number;
  statement: Statement;
  /** Что ответил ученик (null — время вышло). */
  answer: boolean | null;
}

export interface EngineOptions {
  /** Навыки из props (необязательно). */
  skills?: SkillId[];
  mode: GameMode;
  seed: number;
}

/** Движок раунда: колода, ответы, очки. Один экземпляр на игру. */
export class TruthEngine {
  readonly mode: GameMode;
  readonly cfg: ModeConfig;
  readonly pool: SkillId[];
  /** Сколько утверждений в игре; null — блиц (пока идёт время). */
  total: number | null;
  score = 0;
  streak = 0;
  bestStreak = 0;
  correct = 0;
  /** Сколько утверждений уже разобрано. */
  done = 0;
  readonly attempts: GameAttempt[] = [];
  private deck: Statement[] = [];
  private index = 0;
  private chunk = 0;
  private seeds: number;
  private seen = new Set<string>();
  private exhausted = false;
  private answered = true;

  constructor(opts: EngineOptions) {
    this.mode = opts.mode;
    this.cfg = MODE_CONFIG[opts.mode];
    this.pool = resolveSkills(opts.skills);
    this.seeds = opts.seed;
    if (this.cfg.count !== null) {
      this.deck = this.pool.length
        ? draw("statement", { skills: this.pool, count: this.cfg.count, seed: this.seeds, ramp: true })
        : [];
      this.total = this.deck.length;
      this.exhausted = true;
    } else {
      this.total = null;
      this.refill();
    }
    this.answered = false;
  }

  /** Блиц: достаёт следующую порцию утверждений, которых ещё не было. */
  private refill() {
    if (this.exhausted || !this.pool.length) {
      this.exhausted = true;
      return;
    }
    const { min, max } = blitzLevels(this.chunk);
    const seed = hashString(`${this.seeds}:${this.chunk}`);
    const items = draw("statement", { skills: this.pool, count: BLITZ_CHUNK, seed, minLevel: min, maxLevel: max, ramp: true });
    this.chunk++;
    const fresh = items.filter((s) => !this.seen.has(s.text.ru));
    for (const s of fresh) this.seen.add(s.text.ru);
    this.deck.push(...fresh);
    // порция не дала ничего нового — банк исчерпан, дальше не просим
    if (!fresh.length) this.exhausted = true;
  }

  /** Текущее утверждение (null — игра окончена по счёту/колоде). */
  current(): Statement | null {
    return this.deck[this.index] ?? null;
  }

  /** Номер текущего утверждения, с 1. */
  get position(): number {
    return this.index + 1;
  }

  /** Принять ответ: true — «Верю», false — «Не верю», null — время вышло. Повторный ответ на то же утверждение игнорируется. */
  answer(value: boolean | null): Verdict | null {
    const st = this.current();
    if (!st || this.answered) return null;
    this.answered = true;
    const correct = value !== null && value === st.value;
    const mult = multiplierFor(this.streak);
    const points = correct ? pointsFor(this.mode, st.level, this.streak) : 0;
    this.attempts.push({ skill: st.skill, correct });
    this.done++;
    if (correct) {
      this.correct++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.score += points;
    } else {
      this.streak = 0;
    }
    return { correct, timedOut: value === null, points, mult: correct ? mult : 1, statement: st, answer: value };
  }

  /** Перейти к следующему утверждению. null — утверждения кончились. */
  next(): Statement | null {
    this.index++;
    this.answered = false;
    if (this.cfg.count === null && this.deck.length - this.index < BLITZ_REFILL_AT) this.refill();
    return this.current();
  }

  /** Игра окончена по колоде: все утверждения разобраны (для блица — когда не осталось новых). */
  get deckDone(): boolean {
    return this.current() === null;
  }

  /** Время на текущее утверждение, мс (null — без лимита). */
  currentTimeMs(): number | null {
    const st = this.current();
    return st ? cardTimeMs(this.mode, st.level) : null;
  }

  result(): GameResult {
    return { score: this.score, correct: this.correct, total: this.attempts.length, attempts: [...this.attempts] };
  }
}
