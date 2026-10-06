import { DUEL_WIN_XP } from "../economy";
import { GAME_XP } from "../games";
import type { WrongItem } from "../history";
import { ADJ_MAX, nextBotAdj, type DuelOutcome } from "./bot";
import { DUEL_MODES, isDuelMode } from "./modes";
import { winner } from "./score";
import type { DuelModeId } from "./types";

// История дуэлей и «резинка» бота в сторе (срез `duels`, docs/specs/duels.md §4, §8). Чистые функции без React:
// стор их только вызывает (recordDuel), всё из хранилища — недоверенное (sanitizeDuels).

/** Кто был соперником: живой игрок, запись друга (вызов) или бот. */
export type DuelOppKind = "bot" | "human" | "ghost";

/** Итоги одной стороны матча. */
export interface DuelSideStat {
  score: number;
  correct: number;
  /** Отвечено заданий (включая неверные и тайм-ауты «10 вопросов»): нужен для ничьей. */
  answered: number;
  /** Время до последнего ответа, мс от старта. */
  timeMs: number;
}

export interface DuelRecord {
  id: string;
  /** Когда закончен, мс. */
  at: number;
  mode: DuelModeId;
  /** Тема режима «по теме». */
  topic?: string;
  opp: DuelOppKind;
  /** Имя соперника (у бота — нет: подпись «Бит» и чип «бот» даёт интерфейс). */
  oppName?: string;
  oppLevel?: number;
  result: DuelOutcome;
  you: DuelSideStat;
  /** Итоги соперника (поле `opp` занято видом соперника). */
  rival: DuelSideStat;
  /** Начисленный опыт (с бустером). */
  xp: number;
}

export interface DuelsState {
  /** Новые первыми, не больше DUEL_HISTORY_MAX. */
  history: DuelRecord[];
  /** «Резинка» точности бота, −0,1…+0,1 (lib/duel/bot.ts → nextBotAdj). */
  botAdj: number;
}

export const DUEL_HISTORY_MAX = 50;
export const EMPTY_DUELS: DuelsState = { history: [], botAdj: 0 };

const OPP_KINDS: readonly DuelOppKind[] = ["bot", "human", "ghost"];
const RESULTS: readonly DuelOutcome[] = ["win", "loss", "draw"];
const MAX_MS = 24 * 3600_000;

const int = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null;

/** Победа, поражение или ничья игрока по итогам сторон (правило lib/duel/score.ts → winner). */
export function duelOutcome(you: DuelSideStat, rival: DuelSideStat): DuelOutcome {
  const w = winner(you, rival).winner;
  return w === "draw" ? "draw" : w === "a" ? "win" : "loss";
}

/**
 * Сколько ответов матча оплачиваются опытом. «10 вопросов» и «по теме» (штрафа нет) — все верные. На часах (блиц,
 * «верю — не верю») — не больше очков со штрафом: нажатия наугад дают очки около нуля и опыта не приносят.
 */
export function duelXpAnswers(mode: DuelModeId, you: Pick<DuelSideStat, "score" | "correct">): number {
  const right = Math.max(0, Math.floor(you.correct));
  return DUEL_MODES[mode].pts.bad < 0 ? Math.min(right, Math.max(0, Math.floor(you.score))) : right;
}

/**
 * Опыт до бустера — как у мини-игры (§8: «как у мини-игры той же длины»): GAME_XP.perCorrect за оплачиваемый ответ
 * (duelXpAnswers), не больше GAME_XP.cap, плюс бонус за победу (над ботом +2, над человеком +5).
 */
export function duelXpBase(mode: DuelModeId, you: Pick<DuelSideStat, "score" | "correct">, result: DuelOutcome, opp: DuelOppKind): number {
  const base = Math.min(GAME_XP.cap, duelXpAnswers(mode, you) * GAME_XP.perCorrect);
  return base + (result === "win" ? DUEL_WIN_XP[opp === "bot" ? "bot" : "human"] : 0);
}

/** Сколько ошибок одного матча попадает в «Ошибки»: быстрые режимы не должны вытеснять ошибки уроков и пробников. */
export const DUEL_MISTAKES_MAX = 3;

/** Ошибки матча для «Ошибок»: без повторов задания, сначала разные навыки, не больше max (порядок матча сохраняется). */
export function pickDuelMistakes(wrong: readonly WrongItem[], max = DUEL_MISTAKES_MAX): WrongItem[] {
  const uniq: WrongItem[] = [];
  const steps = new Set<string>();
  for (const w of wrong) {
    if (steps.has(w.stepId)) continue;
    steps.add(w.stepId);
    uniq.push(w);
  }
  const picked = new Set<WrongItem>();
  const skills = new Set<string>();
  for (const w of uniq) {
    if (picked.size >= max) break;
    const skill = w.skill ?? `step:${w.stepId}`;
    if (skills.has(skill)) continue;
    skills.add(skill);
    picked.add(w);
  }
  for (const w of uniq) {
    if (picked.size >= max) break;
    picked.add(w);
  }
  return uniq.filter((w) => picked.has(w));
}

/** Исходы матчей с ботом от старых к новым (для «резинки»). */
export function botResults(history: readonly DuelRecord[]): DuelOutcome[] {
  return history.filter((r) => r.opp === "bot").map((r) => r.result).reverse();
}

/** Новая «резинка» после матча с ботом с исходом result. */
export function botAdjAfter(state: DuelsState, result: DuelOutcome): number {
  return nextBotAdj(state.botAdj, [...botResults(state.history), result]);
}

/** Добавить запись в начало истории (повтор id заменяет старую), не больше DUEL_HISTORY_MAX. */
export function pushDuel(history: readonly DuelRecord[], rec: DuelRecord): DuelRecord[] {
  return [rec, ...history.filter((r) => r.id !== rec.id)].slice(0, DUEL_HISTORY_MAX);
}

function sanitizeSide(raw: unknown): DuelSideStat | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const score = int(r.score, -10_000, 10_000);
  const correct = int(r.correct, 0, 1_000);
  const timeMs = int(r.timeMs, 0, MAX_MS);
  if (score === null || correct === null || timeMs === null) return null;
  const answered = Math.max(correct, int(r.answered, 0, 1_000) ?? correct);
  return { score, correct, answered, timeMs };
}

function sanitizeRecord(raw: unknown): DuelRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id || r.id.length > 120) return null;
  const at = int(r.at, 0, Number.MAX_SAFE_INTEGER);
  if (at === null || at === 0) return null;
  if (!isDuelMode(r.mode)) return null;
  if (!OPP_KINDS.includes(r.opp as DuelOppKind) || !RESULTS.includes(r.result as DuelOutcome)) return null;
  const you = sanitizeSide(r.you);
  const rival = sanitizeSide(r.rival);
  if (!you || !rival) return null;
  const rec: DuelRecord = { id: r.id, at, mode: r.mode, opp: r.opp as DuelOppKind, result: r.result as DuelOutcome, you, rival, xp: int(r.xp, 0, 100_000) ?? 0 };
  if (typeof r.topic === "string" && r.topic && r.topic.length <= 32) rec.topic = r.topic;
  if (rec.opp !== "bot" && typeof r.oppName === "string" && r.oppName.trim()) rec.oppName = r.oppName.trim().slice(0, 30);
  const lv = int(r.oppLevel, 1, 999);
  if (lv !== null && rec.opp !== "bot") rec.oppLevel = lv;
  return rec;
}

/** Срез из хранилища (недоверенный): корректные записи без повторов id, новые первыми, «резинка» в пределах ±0,1. */
export function sanitizeDuels(raw: unknown): DuelsState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { history: [], botAdj: 0 };
  const r = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const history: DuelRecord[] = [];
  if (Array.isArray(r.history)) {
    for (const item of r.history) {
      const rec = sanitizeRecord(item);
      if (!rec || seen.has(rec.id)) continue;
      seen.add(rec.id);
      history.push(rec);
    }
  }
  history.sort((a, b) => b.at - a.at);
  const adj = typeof r.botAdj === "number" && Number.isFinite(r.botAdj) ? Math.min(ADJ_MAX, Math.max(-ADJ_MAX, r.botAdj)) : 0;
  return { history: history.slice(0, DUEL_HISTORY_MAX), botAdj: Math.round(adj * 100) / 100 };
}
