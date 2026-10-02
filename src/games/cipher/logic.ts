import { LEVEL_MULT, NORMAL_SEC, pickTask, resolveSkills, stepKey, taskBudgetMs, taskLevel, type TowerStep } from "@/games/tower/logic";
import type { GameMode } from "@/games/types";
import { hashString, seeded, shuffle } from "@/lib/text";
import type { Lang, Level, QuestionStep, SkillId } from "@/lib/types";
import { PHRASES, type Phrase } from "./strings";

// Чистая логика «Шифровки»: секретная фраза, открытие букв, угадывание, очки. Без React.

export { resolveSkills, stepKey, taskBudgetMs, taskLevel, LEVEL_MULT, NORMAL_SEC };
export type CipherStep = TowerStep;

/** Блиц: общее время, мс. */
export const BLITZ_MS = 180_000;
/** Сколько вопросов на одну фразу: спокойно — 10, обычный — 12, блиц — 8 (фраз в блице несколько). */
export const ROUND_QUESTIONS: Record<GameMode, number> = { calm: 10, normal: 12, blitz: 8 };
/** Очки за верный ответ (× множитель уровня). */
export const ANSWER_POINTS = 10;
/** Бонус за каждую ещё скрытую букву при верно угаданной фразе. */
export const GUESS_BONUS_PER_LETTER = 3;
/** Штраф за неверно выбранную фразу (очки не уходят ниже нуля). */
export const GUESS_PENALTY = 25;
/** Угадывать можно, когда открыта хотя бы эта доля букв (иначе выбор из 4 — просто лотерея). */
export const GUESS_MIN_FRACTION = 0.25;
/** Сколько вариантов в «Знаю фразу». */
export const GUESS_OPTIONS = 4;

const LETTER = /[\p{L}\p{N}]/u;

/** Символы фразы по кодовым точкам. */
export function chars(text: string): string[] {
  return Array.from(text);
}

/** Индексы букв и цифр (пробелы и знаки всегда видны). */
export function letterIndices(text: string): number[] {
  const out: number[] = [];
  chars(text).forEach((c, i) => {
    if (LETTER.test(c)) out.push(i);
  });
  return out;
}

export function letterCount(text: string): number {
  return letterIndices(text).length;
}

/**
 * Сколько букв должно быть открыто после c верных ответов из q: равномерно, на последнем вопросе — все.
 * Монотонно, с каждым верным ответом открывается хотя бы одна буква, если букв не меньше, чем вопросов.
 */
export function revealTarget(c: number, q: number, total: number): number {
  if (q <= 0 || c >= q) return total;
  if (c <= 0) return 0;
  return Math.min(total, Math.round((total * c) / q));
}

export interface CipherState {
  lang: Lang;
  mode: GameMode;
  phraseId: string;
  /** Индексы букв фразы в порядке открытия (перемешаны). */
  order: number[];
  total: number;
  /** Сколько букв открыто. */
  revealed: number;
  /** Вопросов задано / верно в этой фразе. */
  asked: number;
  right: number;
  /** Варианты «Знаю фразу» (id фраз) и уже отвергнутые. */
  options: string[];
  rejected: string[];
  solved: boolean;
  /** Фраз завершено. */
  rounds: number;
  usedPhrases: string[];
  score: number;
  correct: number;
  answered: number;
  attempts: { skill: SkillId; correct: boolean }[];
  used: string[];
  taskNo: number;
  lastKey?: string;
}

export function phraseById(id: string): Phrase {
  const p = PHRASES.find((x) => x.id === id);
  if (!p) throw new Error(`cipher: нет фразы ${id}`);
  return p;
}

export function phraseText(state: CipherState): string {
  return phraseById(state.phraseId).text[state.lang];
}

/**
 * Четыре варианта для «Знаю фразу»: верная и три похожие по длине (чтобы длиной не угадать), порядок — от seed.
 */
export function guessOptions(phraseId: string, lang: Lang, seed: number): string[] {
  const own = letterCount(phraseById(phraseId).text[lang]);
  const rand = seeded(hashString(`${seed}:opts:${phraseId}`));
  const others = shuffle(
    PHRASES.filter((p) => p.id !== phraseId),
    rand,
  ).sort((a, b) => Math.abs(letterCount(a.text[lang]) - own) - Math.abs(letterCount(b.text[lang]) - own));
  const near = shuffle(others.slice(0, GUESS_OPTIONS + 2), rand).slice(0, GUESS_OPTIONS - 1);
  return shuffle([phraseId, ...near.map((p) => p.id)], rand);
}

interface RoundOpts {
  lang: Lang;
  mode: GameMode;
  seed: number;
}

/** Начинает новую фразу (счёт и история — из prev). null — фразы кончились. */
export function startRound(prev: CipherState | null, o: RoundOpts): CipherState | null {
  const usedPhrases = prev?.usedPhrases ?? [];
  const free = PHRASES.filter((p) => !usedPhrases.includes(p.id));
  if (!free.length) return null;
  const rand = seeded(hashString(`${o.seed}:phrase:${usedPhrases.length}`));
  const phrase = free[Math.floor(rand() * free.length)];
  const text = phrase.text[o.lang];
  const order = shuffle(letterIndices(text), rand);
  return {
    lang: o.lang,
    mode: o.mode,
    phraseId: phrase.id,
    order,
    total: order.length,
    revealed: 0,
    asked: 0,
    right: 0,
    options: guessOptions(phrase.id, o.lang, o.seed + usedPhrases.length),
    rejected: [],
    solved: false,
    rounds: prev ? prev.rounds + 1 : 0,
    usedPhrases: [...usedPhrases, phrase.id],
    score: prev?.score ?? 0,
    correct: prev?.correct ?? 0,
    answered: prev?.answered ?? 0,
    attempts: prev?.attempts ?? [],
    used: prev?.used ?? [],
    taskNo: prev?.taskNo ?? 0,
    lastKey: prev?.lastKey,
  };
}

export function hiddenCount(s: CipherState): number {
  return s.total - s.revealed;
}

/** Открытые индексы букв. */
export function revealedSet(s: CipherState): Set<number> {
  return new Set(s.order.slice(0, s.revealed));
}

/** Фраза с «_» вместо скрытых букв (для озвучки и тестов). */
export function maskedText(s: CipherState, mask = "_"): string {
  const open = revealedSet(s);
  const hidden = new Set(s.order.filter((i) => !open.has(i)));
  return chars(phraseText(s))
    .map((c, i) => (hidden.has(i) ? mask : c))
    .join("");
}

export function fullyRevealed(s: CipherState): boolean {
  return s.revealed >= s.total;
}

/** Можно ли нажать «Знаю фразу». */
export function guessAvailable(s: CipherState): boolean {
  return !s.solved && !fullyRevealed(s) && s.revealed >= Math.ceil(s.total * GUESS_MIN_FRACTION);
}

export function guessBonus(s: CipherState): number {
  return hiddenCount(s) * GUESS_BONUS_PER_LETTER;
}

/** Вопросов в одной фразе для темпа. */
export function roundQuestions(mode: GameMode): number {
  return ROUND_QUESTIONS[mode];
}

/** Фраза закончилась: угадана, раскрыта или вопросы кончились. */
export function roundOver(s: CipherState): boolean {
  return s.solved || fullyRevealed(s) || s.asked >= roundQuestions(s.mode);
}

/** Ступень сложности вопроса (0..9) для подбора задания. */
export function rampFloor(s: CipherState): number {
  if (s.mode === "blitz") return Math.min(9, Math.floor(s.taskNo / 2));
  return Math.min(9, Math.floor((s.asked * 10) / roundQuestions(s.mode)));
}

/** Следующее задание; null — банк исчерпан. */
export function drawNext(s: CipherState, skills: SkillId[], seed: number): { state: CipherState; step: CipherStep } | null {
  const step = pickTask({ skills, floor: rampFloor(s), seed: hashString(`${seed}:${s.taskNo}`), used: s.used, lastKey: s.lastKey });
  if (!step) return null;
  const key = stepKey(step);
  return { state: { ...s, used: [...s.used, key], taskNo: s.taskNo + 1, lastKey: key }, step };
}

export interface QuestionOutcome {
  state: CipherState;
  gained: number;
  opened: number;
}

/** Учитывает ответ: верно — очки и открытые буквы, неверно — ничего не открывается. */
export function applyQuestion(s: CipherState, step: QuestionStep, correct: boolean): QuestionOutcome {
  const attempts = [...s.attempts, { skill: step.skill ?? "", correct }];
  const base: CipherState = { ...s, attempts, answered: s.answered + 1, asked: s.asked + 1 };
  if (!correct) return { state: base, gained: 0, opened: 0 };
  const level: Level = taskLevel(step, rampFloor(s));
  const gained = Math.round(ANSWER_POINTS * LEVEL_MULT[level]);
  const right = s.right + 1;
  const revealed = Math.max(s.revealed, revealTarget(right, roundQuestions(s.mode), s.total));
  return {
    state: { ...base, right, revealed, score: s.score + gained, correct: s.correct + 1 },
    gained,
    opened: revealed - s.revealed,
  };
}

export interface GuessOutcome {
  state: CipherState;
  correct: boolean;
  /** Бонус (верно) или потерянные очки (неверно). */
  delta: number;
}

/** Выбор фразы: верно — бонус за скрытые буквы, фраза раскрыта; неверно — штраф, вариант отпадает. */
export function applyGuess(s: CipherState, optionId: string): GuessOutcome {
  if (s.solved || s.rejected.includes(optionId) || !s.options.includes(optionId)) return { state: s, correct: false, delta: 0 };
  if (optionId === s.phraseId) {
    const bonus = guessBonus(s);
    return { state: { ...s, solved: true, score: s.score + bonus, revealed: s.total }, correct: true, delta: bonus };
  }
  const lost = Math.min(GUESS_PENALTY, s.score);
  return { state: { ...s, score: s.score - lost, rejected: [...s.rejected, optionId] }, correct: false, delta: lost };
}

/** Результат для onFinish. */
export function toResult(s: CipherState) {
  return { score: s.score, correct: s.correct, total: s.answered, attempts: s.attempts.slice() };
}

/** Пустой результат (нет заданий в банке). */
export function emptyResult() {
  return { score: 0, correct: 0, total: 0, attempts: [] };
}
