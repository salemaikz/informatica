import type { DuelEvent } from "./types";

// Таймлайн соперника (docs/specs/duels.md §5): один экран матча для трёх видов соперника —
// human (события приходят опросом), ghost (запись друга проигрывается по t), bot (считается кодом, bot.ts).
// Экран не знает, кто соперник: он рисует opponentAt(tl, nowMs).

export type OpponentKind = "human" | "ghost" | "bot";

export interface OpponentTimeline {
  kind: OpponentKind;
  /** События по возрастанию i и t. */
  events: DuelEvent[];
  /** Таймлайн известен целиком (бот, запись): после последнего события соперник «доиграл». */
  complete: boolean;
}

export interface OpponentState {
  answered: number;
  correct: number;
  /** События, которые уже «случились» к nowMs. */
  events: DuelEvent[];
  last: DuelEvent | null;
  /** Соперник доиграл (для complete — все события в прошлом). */
  done: boolean;
}

/** Что видно у соперника к моменту nowMs (мс от старта матча). */
export function opponentAt(tl: OpponentTimeline, nowMs: number): OpponentState {
  const events: DuelEvent[] = [];
  let correct = 0;
  for (const e of tl.events) {
    if (e.t > nowMs) break;
    events.push(e);
    if (e.ok) correct++;
  }
  return {
    answered: events.length,
    correct,
    events,
    last: events[events.length - 1] ?? null,
    done: tl.complete && events.length === tl.events.length,
  };
}

/** Через сколько мс после nowMs случится следующее событие (null — больше не будет / неизвестно). */
export function nextEventIn(tl: OpponentTimeline, nowMs: number): number | null {
  for (const e of tl.events) if (e.t > nowMs) return e.t - nowMs;
  return null;
}

/** Корректен ли таймлайн: i = 0,1,2…, t не убывает и не отрицателен, не больше n событий, t ≤ maxMs. */
export function isValidTimeline(events: readonly DuelEvent[], n: number, maxMs = Infinity): boolean {
  if (events.length > n) return false;
  let prevT = 0;
  for (let k = 0; k < events.length; k++) {
    const e = events[k];
    if (!e || e.i !== k || typeof e.ok !== "boolean" || !Number.isInteger(e.t) || e.t < prevT || e.t > maxMs) return false;
    prevT = e.t;
  }
  return true;
}

/** Добавляет к известным событиям новые с сервера (опрос human): без повторов, по порядку i. */
export function mergeEvents(known: readonly DuelEvent[], incoming: readonly DuelEvent[]): DuelEvent[] {
  const out = [...known];
  for (const e of [...incoming].sort((a, b) => a.i - b.i)) {
    if (e.i === out.length) out.push(e);
  }
  return out;
}

/** Компактная запись для вызова (~300 байт): «1.4210,0.8800» — верно/неверно и t в мс; i — по порядку. */
export function encodeTimeline(events: readonly DuelEvent[]): string {
  return events.map((e) => `${e.ok ? 1 : 0}.${Math.max(0, Math.round(e.t))}`).join(",");
}

/** Разбор записи; null — повреждено или не проходит isValidTimeline. */
export function decodeTimeline(raw: string, n: number, maxMs = Infinity): DuelEvent[] | null {
  if (typeof raw !== "string" || raw.length > 64 * 12) return null;
  if (raw === "") return [];
  const parts = raw.split(",");
  const events: DuelEvent[] = [];
  for (let k = 0; k < parts.length; k++) {
    const m = /^([01])\.(0|[1-9]\d{0,7})$/.exec(parts[k]);
    if (!m) return null;
    events.push({ i: k, ok: m[1] === "1", t: Number(m[2]) });
  }
  return isValidTimeline(events, n, maxMs) ? events : null;
}
