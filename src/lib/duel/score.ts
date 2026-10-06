import { DUEL_MODES, LATE_GRACE_MS } from "./modes";
import type { DuelEvent, DuelModeId, MatchView, NotCountedWhy } from "./types";

// Счёт и итог дуэли (docs/specs/duels.md §3, §8): очки, победитель, техническая победа, засчитан ли матч в топ друзей.
// Одна логика для живого матча, записи друга и бота.

export interface SideTotals {
  /** Отвечено заданий. */
  answered: number;
  correct: number;
  /** Очки режима (со штрафом в блице и «верю — не верю»). */
  score: number;
  /** Время до последнего ответа, мс от старта (t последнего события). */
  timeMs: number;
}

/** Ничья по времени: разница меньше этого, мс. */
export const DRAW_TIME_MS = 1_000;

/** Соперник молчит столько — «Соперник не отвечает», мс. */
export const IDLE_NOTICE_MS = 10_000;
/** Соперник молчит столько, а я доиграл, — техническая победа, мс. */
export const IDLE_WIN_MS = 30_000;
/** Очки недели — только если ответил хотя бы на столько заданий. */
export const MIN_ANSWERED_FOR_WEEK = 5;
/** Флагов честной игры столько и больше — матч не идёт в топ. */
export const MAX_FLAGS = 3;
/** Матчей одной пары за сутки (по Астане), которые ещё засчитываются; 3-й и дальше — 0 очков. */
export const PAIR_DAILY_LIMIT = 2;
/** Засчитанных матчей в сутки. */
export const DAILY_COUNTED_LIMIT = 10;

/** Очки недели (только люди, проверено сервером). */
export const WEEK_PTS = { win: 3, draw: 2, played: 1, challengeAccepted: 1, challengeBeat: 1 } as const;

/** Очки за одно событие: верно — pts.ok, неверно — pts.bad. */
export function eventPts(mode: DuelModeId, ok: boolean): number {
  const { pts } = DUEL_MODES[mode];
  return ok ? pts.ok : pts.bad;
}

/** Итоги стороны по её событиям (уже проверенным). */
export function totals(mode: DuelModeId, events: readonly DuelEvent[]): SideTotals {
  let correct = 0;
  let score = 0;
  let timeMs = 0;
  for (const e of events) {
    if (e.ok) correct++;
    score += eventPts(mode, e.ok);
    if (e.t > timeMs) timeMs = e.t;
  }
  return { answered: events.length, correct, score, timeMs };
}

export type Winner = "a" | "b" | "draw";
/** Причина итога по очкам — те же значения, что в MatchView.result.reason (ничья по времени — "time"). */
export type WinReason = Extract<NonNullable<MatchView["result"]>["reason"], "score" | "correct" | "time">;

/**
 * Победитель: больше очков, затем больше верных, затем больше отвечено (не успел — значит, медленнее), затем меньше
 * время; разница во времени < 1 с — ничья. Время сравниваем только при равном числе ответов: иначе в «10 вопросах»
 * сторона без ответов (время 0) обходила бы ответившую на всё.
 */
export function winner(a: SideTotals, b: SideTotals): { winner: Winner; reason: WinReason } {
  if (a.score !== b.score) return { winner: a.score > b.score ? "a" : "b", reason: "score" };
  if (a.correct !== b.correct) return { winner: a.correct > b.correct ? "a" : "b", reason: "correct" };
  if (a.answered !== b.answered) return { winner: a.answered > b.answered ? "a" : "b", reason: "time" };
  const dt = a.timeMs - b.timeMs;
  if (Math.abs(dt) < DRAW_TIME_MS) return { winner: "draw", reason: "time" };
  return { winner: dt < 0 ? "a" : "b", reason: "time" };
}

export interface SideStatus {
  /** Доиграл (ответил на всё или кончилось время). */
  done: boolean;
  /** Ушёл кнопкой «Выйти» после старта. */
  left: boolean;
  /**
   * Сколько молчит, мс: время с последней связи с сервером (опрос view или отправка ответов), а НЕ с последнего ответа —
   * ученик может честно думать над заданием C до 45 с, продолжая опрос.
   */
  idleMs: number;
  /** Лимит задания, на котором сторона сейчас («10 вопросов»), мс; порог молчания не меньше лимита + 3 с. */
  itemLimitMs?: number | null;
}

/** Порог технической победы для молчащей стороны: 30 с, но не меньше лимита её текущего задания + 3 с. */
export function idleWinMs(s: SideStatus): number {
  const lim = s.itemLimitMs;
  return typeof lim === "number" && Number.isFinite(lim) ? Math.max(IDLE_WIN_MS, lim + LATE_GRACE_MS) : IDLE_WIN_MS;
}

/**
 * Техническая победа (§3): ушёл после старта — поражение; соперник молчит ≥ 30 с (idleWinMs), а я доиграл, — победа.
 * null — обычный подсчёт по очкам. Оба ушли — матч аннулируется ("void").
 */
export function technicalResult(
  a: SideStatus,
  b: SideStatus,
  started: boolean,
): { winner: "a" | "b"; reason: "left" | "idle" } | "void" | null {
  if (!started) return null;
  if (a.left && b.left) return "void";
  if (b.left) return { winner: "a", reason: "left" };
  if (a.left) return { winner: "b", reason: "left" };
  if (a.done && !b.done && b.idleMs >= idleWinMs(b)) return { winner: "a", reason: "idle" };
  if (b.done && !a.done && a.idleMs >= idleWinMs(a)) return { winner: "b", reason: "idle" };
  return null;
}

export interface CountInput {
  opponent: "human" | "ghost" | "bot";
  /** Флаги честной игры у этой стороны (plausible). */
  flags: number;
  answered: number;
  /** Сколько матчей этой пары уже засчитано сегодня (до этого). */
  pairToday: number;
  /** Сколько матчей игрока уже засчитано сегодня (до этого). */
  countedToday: number;
}

/** Идёт ли матч в топ друзей; why — для честной плашки на итогах. */
export function countedFor(c: CountInput): { counted: boolean; why?: NotCountedWhy } {
  if (c.opponent === "bot") return { counted: false, why: "bot" };
  if (c.flags >= MAX_FLAGS) return { counted: false, why: "fast" };
  if (c.answered < MIN_ANSWERED_FOR_WEEK) return { counted: false, why: "short" };
  if (c.pairToday >= PAIR_DAILY_LIMIT) return { counted: false, why: "pair_limit" };
  if (c.countedToday >= DAILY_COUNTED_LIMIT) return { counted: false, why: "daily_limit" };
  return { counted: true };
}

/** Очки недели за живой матч или комнату: победа 3, ничья 2, доигранный 1; ушёл — 0; не засчитан — 0. */
export function weekPoints(outcome: "win" | "draw" | "loss" | "left", counted: boolean): number {
  if (!counted) return 0;
  switch (outcome) {
    case "win":
      return WEEK_PTS.win;
    case "draw":
      return WEEK_PTS.draw;
    case "loss":
      return WEEK_PTS.played;
    case "left":
      return 0;
  }
}

/** Очки недели за игру против записи друга (вызов): +1 за принятый, +1 за победу над записью. */
export function challengePoints(beat: boolean, counted: boolean): number {
  if (!counted) return 0;
  return WEEK_PTS.challengeAccepted + (beat ? WEEK_PTS.challengeBeat : 0);
}
