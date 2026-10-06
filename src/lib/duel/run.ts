import { isCorrect } from "./check";
import { DUEL_MODES } from "./modes";
import { totals } from "./score";
import type { DuelSideStat } from "./record";
import type { DuelAnswer, DuelEvent, DuelItem, DuelModeId } from "./types";

// Ход матча у самого ученика (экран DuelRun): чистый автомат без React и без времени устройства — время передаёт экран
// («часы матча», мс от старта). Те же правила, что у бота и сервера: штраф и пауза после ошибки (modes.ts), лимит на
// задание в «10 вопросах» (выборка за лимитом — тайм-аут, неверно), общие часы в блице и «верю — не верю».

export interface RunState {
  /** Номер текущего задания. */
  i: number;
  /** Свои события {i, ok, t}: t — мс часов матча. */
  events: DuelEvent[];
  /** Ответы по номерам заданий; null — не успел (тайм-аут). */
  answers: (DuelAnswer | null)[];
  /** Когда открылось текущее задание, мс часов матча. */
  itemAt: number;
  /** До этого момента ответ не принимается (пауза после ошибки), мс часов матча. */
  pauseUntil: number;
  done: boolean;
}

export const startRun = (): RunState => ({ i: 0, events: [], answers: [], itemAt: 0, pauseUntil: 0, done: false });

const modeOf = (items: readonly DuelItem[]) => (items[0] ? DUEL_MODES[items[0].mode] : null);

function advance(s: RunState, items: readonly DuelItem[], ev: DuelEvent, answer: DuelAnswer | null, pauseMs: number): RunState {
  const answers = [...s.answers];
  answers[ev.i] = answer;
  const next = s.i + 1;
  const pauseUntil = ev.ok ? ev.t : ev.t + pauseMs;
  return { i: next, events: [...s.events, ev], answers, itemAt: pauseUntil, pauseUntil, done: next >= items.length };
}

/**
 * Ответ на текущее задание в момент now (мс часов матча). Не принимается: матч окончен, идёт пауза после ошибки,
 * общие часы вышли. Неверный ответ ставит паузу режима (errorPauseMs).
 */
export function runAnswer(s: RunState, items: readonly DuelItem[], answer: DuelAnswer, now: number): RunState {
  const mode = modeOf(items);
  const item = items[s.i];
  if (s.done || !mode || !item || now < s.pauseUntil) return s;
  if (mode.clockMs != null && now >= mode.clockMs) return { ...s, done: true };
  const last = s.events[s.events.length - 1]?.t ?? 0;
  const t = Math.max(last, Math.round(now));
  return advance(s, items, { i: s.i, ok: isCorrect(item, answer), t }, answer, mode.errorPauseMs);
}

/** Время идёт: тайм-ауты заданий с лимитом (каждый — неверно, t = открытие + лимит) и конец общих часов. */
export function runTick(s: RunState, items: readonly DuelItem[], now: number): RunState {
  const mode = modeOf(items);
  if (!mode) return s.done ? s : { ...s, done: true };
  let cur = s;
  // Несколько тайм-аутов подряд (вкладка спала) — все по очереди.
  for (let guard = 0; !cur.done && guard <= items.length; guard++) {
    if (mode.clockMs != null && now >= mode.clockMs) return { ...cur, done: true };
    const item = items[cur.i];
    if (!item) return { ...cur, done: true };
    if (item.limitMs == null || now < cur.itemAt + item.limitMs) break;
    cur = advance(cur, items, { i: cur.i, ok: false, t: cur.itemAt + item.limitMs }, null, mode.errorPauseMs);
  }
  return cur;
}

/** Сколько осталось на текущее задание, мс (null — у режима общие часы). */
export function itemLeftMs(s: RunState, items: readonly DuelItem[], now: number): number | null {
  const item = items[s.i];
  if (!item || item.limitMs == null) return null;
  return Math.max(0, s.itemAt + item.limitMs - now);
}

/** Сколько осталось на общих часах, мс (null — у режима лимит на задание). */
export function clockLeftMs(mode: DuelModeId, now: number): number | null {
  const clock = DUEL_MODES[mode].clockMs;
  return clock == null ? null : Math.max(0, clock - now);
}

/** Итоги стороны по событиям (очки со штрафом режима). */
export function sideStat(mode: DuelModeId, events: readonly DuelEvent[]): DuelSideStat {
  const t = totals(mode, events);
  return { score: t.score, correct: t.correct, answered: t.answered, timeMs: t.timeMs };
}

/**
 * Часы матча: идут от старта, но в «10 вопросах» стоят, пока ученик смотрит разбор своего ответа (бот этого времени
 * тоже не тратит). Реальное время передаёт экран (Date.now() в обработчиках и таймерах).
 */
export interface MatchClock {
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
}

export const clockStart = (real: number): MatchClock => ({ startedAt: real, pausedAt: null, pausedMs: 0 });

export const clockNow = (c: MatchClock, real: number): number => Math.max(0, (c.pausedAt ?? real) - c.startedAt - c.pausedMs);

export const clockPause = (c: MatchClock, real: number): MatchClock => (c.pausedAt != null ? c : { ...c, pausedAt: real });

export const clockResume = (c: MatchClock, real: number): MatchClock =>
  c.pausedAt == null ? c : { ...c, pausedMs: c.pausedMs + Math.max(0, real - c.pausedAt), pausedAt: null };
