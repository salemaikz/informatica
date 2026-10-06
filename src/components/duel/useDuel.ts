"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CLIENT_DECK_TAG,
  POLL,
  SEARCH,
  backoffMs,
  clockSample,
  duelFetch,
  isMatchView,
  isQueueReply,
  matchUrl,
  nextClock,
  queueUrl,
  type ClockSync,
  type QueueReply,
} from "@/lib/duel/live";
import type { AnswerIn, MatchJoin, MatchView } from "@/lib/duel/types";

// Живой матч на клиенте (этап 16Д, Ф4; docs/specs/duels.md §5): опрос по фазам — лобби 2 с; в игре ответы пачкой до 5
// или через 1,5 с, ответ сервера несёт MatchView, отдельный опрос — если 3 с ничего не отправлялось; ожидание и итоги —
// 2 с до 15 с. Сдвиг часов — по serverNow в каждом ответе. Вкладка скрыта — опрос на паузе (часы матча идут).
// Ошибка сети — пауза 2 → 4 → 8 с. Поиск соперника — useDuelSearch: опрос билета 1,5 с, каждая вторая — попытка захвата.

/** off — не опрашивать; lobby — вид раз в 2 с; ready — то же, но сначала «готов» (VS); play / wait / result — см. выше. */
export type DuelPhase = "off" | "lobby" | "ready" | "play" | "wait" | "result";
export type DuelError = "not_found" | "update_needed" | "no_player" | "forbidden" | null;

/** Сколько ошибок подряд, прежде чем показать «Связь потеряна». */
const LOST_AFTER = 4;

const visible = () => typeof document === "undefined" || !document.hidden;

export interface DuelConn {
  view: MatchView | null;
  /** Сеть: ok, сбой (пробуем снова), потеряна (много сбоев подряд). */
  net: "ok" | "retry" | "lost";
  error: DuelError;
  /** Серверное время сейчас (по сдвигу часов), мс. */
  serverNow: () => number;
  /** Серверный момент → локальные часы устройства. */
  toLocal: (serverMs: number) => number;
  /** Поставить ответ в очередь отправки. */
  send: (a: AnswerIn) => void;
  /** Свежий вид (null — сбой); mine — со своими ответами (продолжить матч после перезагрузки). */
  refresh: (mine?: boolean) => Promise<MatchView | null>;
  ready: () => Promise<MatchView | null>;
  /** Отправить всё неотправленное и «доиграл». */
  done: () => Promise<MatchView | null>;
  leave: () => Promise<MatchView | null>;
  rematch: () => Promise<MatchView | null>;
}

/**
 * Связь с живым матчем. join — место (без места — хозяин комнаты в лобби: вид по cookie игрока).
 * phase задаёт частоту опроса; "off" — не опрашивать. onView — каждый свежий вид (из обработчика ответа, не из эффекта:
 * экран может сразу сменить фазу).
 */
export function useDuel(matchId: string | null, join: MatchJoin | null, phase: DuelPhase, onView?: (v: MatchView) => void): DuelConn {
  const [view, setView] = useState<MatchView | null>(null);
  const [net, setNet] = useState<DuelConn["net"]>("ok");
  const [error, setError] = useState<DuelError>(null);
  const s = useRef({
    sync: null as ClockSync | null,
    answers: [] as AnswerIn[],
    /** Сервер принял ответы до этого номера. */
    acked: 0,
    firstPendingAt: 0,
    lastSendAt: 0,
    failures: 0,
    inflight: false,
    phaseAt: 0,
    rematchAt: 0,
    alive: true,
    /** Матч, о готовности к которому уже сообщили. */
    readyFor: null as string | null,
  });
  const seat = join?.seat ?? null;
  const seatRef = useRef(seat);
  const onViewRef = useRef(onView);
  useEffect(() => {
    seatRef.current = seat;
    onViewRef.current = onView;
  });

  const serverNow = useCallback(() => Date.now() + (s.current.sync?.offset ?? 0), []);
  const toLocal = useCallback((ms: number) => ms - (s.current.sync?.offset ?? 0), []);

  /** Запрос к матчу; обновляет часы, вид и счётчик сбоев. */
  const call = useCallback(
    async (method: "GET" | "POST", action?: "ready" | "answers" | "done" | "leave" | "rematch", body?: unknown, mine = false): Promise<MatchView | null> => {
      if (!matchId) return null;
      const st = s.current;
      st.lastSendAt = Date.now();
      const url = matchUrl(matchId, action) + (mine ? "?me=1" : "");
      const res = await duelFetch<unknown>(method, url, { body, seat: seatRef.current });
      if (!st.alive) return null;
      if (res.status === 200 && res.data) {
        const raw = action === "answers" && typeof res.data === "object" ? (res.data as { view?: unknown }).view : res.data;
        if (!isMatchView(raw)) return null;
        st.sync = nextClock(st.sync, clockSample(raw.serverNow, res.sentAt, res.recvAt));
        st.failures = 0;
        st.acked = Math.max(st.acked, raw.you.answered);
        setNet("ok");
        setView(raw);
        onViewRef.current?.(raw);
        return raw;
      }
      if (res.status === 404) setError("not_found");
      else if (res.status === 409) setError("update_needed");
      else if (res.status === 401) setError("no_player");
      else if (res.status === 403) setError("forbidden");
      else {
        st.failures++;
        setNet(st.failures >= LOST_AFTER ? "lost" : "retry");
      }
      return null;
    },
    [matchId],
  );

  /** Отправить пачку неотправленных ответов (не больше 5). */
  const flush = useCallback(async (): Promise<MatchView | null> => {
    const st = s.current;
    const batch = st.answers.filter((a) => a.i >= st.acked).slice(0, POLL.batchMax);
    if (!batch.length || st.inflight) return null;
    st.inflight = true;
    try {
      const v = await call("POST", "answers", { answers: batch });
      // Принятое и окончательно отвергнутое (поздно, вне набора) больше не шлём; сеть упала — пошлём снова.
      if (v) st.acked = Math.max(st.acked, v.you.answered, batch[batch.length - 1].i + 1);
      const left = st.answers.filter((a) => a.i >= st.acked);
      st.answers = left;
      st.firstPendingAt = left.length ? Date.now() : 0;
      return v;
    } finally {
      st.inflight = false;
    }
  }, [call]);

  const send = useCallback((a: AnswerIn) => {
    const st = s.current;
    if (st.answers.some((x) => x.i === a.i) || a.i < st.acked) return;
    st.answers.push(a);
    if (!st.firstPendingAt) st.firstPendingAt = Date.now();
  }, []);

  // Новый матч (реванш, вход из лобби): очередь ответов и счётчики — с нуля (сдвиг часов остаётся: сервер тот же).
  useEffect(() => {
    const st = s.current;
    st.answers = [];
    st.acked = 0;
    st.firstPendingAt = 0;
    st.failures = 0;
    st.rematchAt = 0;
  }, [matchId]);

  // Смена фазы: отметка времени (окна «2 с до 15 с»).
  useEffect(() => {
    s.current.phaseAt = Date.now();
  }, [phase]);

  useEffect(() => {
    const st = s.current;
    st.alive = true;
    return () => {
      st.alive = false;
    };
  }, []);

  // Опрос. Таймер — один на фазу; решения принимаются в обработчике таймера (не в рендере и не синхронно в эффекте).
  useEffect(() => {
    if (!matchId || phase === "off") return;
    let stopped = false;
    let timer = 0;
    const st = s.current;
    const schedule = (ms: number | null) => {
      if (stopped || ms == null) return;
      timer = window.setTimeout(tick, ms);
    };
    const tick = async () => {
      if (stopped) return;
      if (!visible()) return; // продолжит visibilitychange
      const now = Date.now();
      if (st.failures > 0 && now - st.lastSendAt < backoffMs(st.failures)) return schedule(backoffMs(st.failures) - (now - st.lastSendAt));
      if (phase === "play") {
        const pending = st.answers.some((a) => a.i >= st.acked);
        if (pending && (st.answers.length >= POLL.batchMax || now - st.firstPendingAt >= POLL.flushMs)) await flush();
        else if (now - st.lastSendAt >= POLL.idleMs) await call("GET");
        return schedule(250);
      }
      if (phase === "lobby" || phase === "ready") {
        if (phase === "ready" && seatRef.current && st.readyFor !== matchId) {
          if (await call("POST", "ready")) st.readyFor = matchId;
        } else await call("GET");
        return schedule(POLL.lobbyMs);
      }
      if (phase === "wait") {
        if (st.answers.some((a) => a.i >= st.acked)) await flush();
        else await call("GET");
        return schedule(now - st.phaseAt < POLL.resultsMaxMs ? POLL.resultsMs : POLL.idleMs);
      }
      // Итоги: 2 с до 15 с (видно запрос реванша соперника); после своего «Реванш» — до 20 с.
      const rematchOpen = st.rematchAt > 0 && now - st.rematchAt < 22_000;
      if (now - st.phaseAt < POLL.resultsMaxMs || rematchOpen) {
        await call("GET");
        return schedule(POLL.resultsMs);
      }
    };
    const onVis = () => {
      if (!visible() || stopped) return;
      window.clearTimeout(timer);
      void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    schedule(phase === "play" ? 250 : 0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [matchId, phase, call, flush]);

  const refresh = useCallback((mine = false) => call("GET", undefined, undefined, mine), [call]);
  const ready = useCallback(() => call("POST", "ready"), [call]);
  const done = useCallback(async () => {
    const st = s.current;
    for (let k = 0; k < 12 && st.answers.some((a) => a.i >= st.acked); k++) {
      while (st.inflight) await new Promise((r) => setTimeout(r, 50));
      const v = await flush();
      if (!v && st.answers.some((a) => a.i >= st.acked)) break;
    }
    return call("POST", "done");
  }, [call, flush]);
  const leave = useCallback(() => call("POST", "leave"), [call]);
  const rematch = useCallback(() => {
    s.current.rematchAt = Date.now();
    return call("POST", "rematch");
  }, [call]);

  return { view, net, error, serverNow, toLocal, send, refresh, ready, done, leave, rematch };
}

// ---------- поиск ----------

export type SearchState =
  | { name: "idle" }
  | { name: "searching"; ticket: string | null; startedAt: number }
  | { name: "matched"; join: MatchJoin; late: boolean }
  | { name: "none" }
  | { name: "error"; error: "update_needed" | "no_player" | "unavailable" | "rate_limited" };

/** Ошибка поиска → состояние экрана. */
function searchFail(status: number): SearchState {
  if (status === 409) return { name: "error", error: "update_needed" };
  if (status === 401) return { name: "error", error: "no_player" };
  if (status === 429) return { name: "error", error: "rate_limited" };
  return { name: "error", error: "unavailable" };
}

/**
 * Поиск соперника в «Блице»: POST /api/duel/queue → опрос билета каждые 1,5 с (каждый второй — попытка захвата, с дрожанием),
 * до 30 с; потом билет снимается и показывается «никого нет». Бот сам не запускается никогда.
 * stop() — отмена или «Сыграть с Битом»: если нас уже забрали, возвращает место (вход в живой матч с пояснением).
 */
export function useDuelSearch(lv: number, onMatched?: (join: MatchJoin, late: boolean) => void) {
  const [state, setState] = useState<SearchState>({ name: "idle" });
  const r = useRef({ ticket: null as string | null, polls: 0, failures: 0, timer: 0, run: 0, startedAt: 0 });
  const matchedRef = useRef(onMatched);
  useEffect(() => {
    matchedRef.current = onMatched;
  });

  const finish = useCallback((next: SearchState) => {
    const st = r.current;
    st.run++;
    window.clearTimeout(st.timer);
    st.ticket = null;
    setState(next);
    if (next.name === "matched") matchedRef.current?.(next.join, next.late);
  }, []);

  const loop = useCallback(
    (run: number) => {
      const st = r.current;
      const tick = async () => {
        if (st.run !== run || !st.ticket) return;
        if (!visible()) {
          st.timer = window.setTimeout(tick, 500);
          return;
        }
        // Время поиска вышло — снимаем билет.
        if (Date.now() - st.startedAt >= SEARCH.maxMs) {
          const t = st.ticket;
          const res = await duelFetch<unknown>("DELETE", queueUrl(t));
          if (st.run !== run) return;
          if (res.status === 200 && isQueueReply(res.data) && res.data.state === "matched") finish({ name: "matched", join: res.data.join, late: false });
          else finish({ name: "none" });
          return;
        }
        st.polls++;
        const capture = st.polls % POLL.captureEvery === 0;
        const res = await duelFetch<unknown>("GET", queueUrl(st.ticket, capture));
        if (st.run !== run) return;
        if (res.status === 200 && isQueueReply(res.data)) {
          st.failures = 0;
          if (res.data.state === "matched") return finish({ name: "matched", join: res.data.join, late: false });
          if (res.data.state === "cancelled") return finish({ name: "none" });
        } else if (res.status === 0 || res.status >= 500) {
          st.failures++;
          if (st.failures >= LOST_AFTER) return finish(searchFail(res.status));
        } else return finish(searchFail(res.status));
        const jitter = capture ? Math.round((Math.random() - 0.5) * 600) : 0;
        st.timer = window.setTimeout(tick, Math.max(POLL.searchMs + jitter, backoffMs(st.failures)));
      };
      st.timer = window.setTimeout(tick, POLL.searchMs);
    },
    [finish],
  );

  const start = useCallback(async () => {
    const st = r.current;
    const run = ++st.run;
    window.clearTimeout(st.timer);
    st.polls = 0;
    st.failures = 0;
    st.ticket = null;
    st.startedAt = Date.now();
    setState({ name: "searching", ticket: null, startedAt: st.startedAt });
    const res = await duelFetch<unknown>("POST", queueUrl(), { body: { lv, deckTag: CLIENT_DECK_TAG } });
    if (st.run !== run) return;
    if (res.status !== 200 || !isQueueReply(res.data)) return finish(searchFail(res.status));
    const reply: QueueReply = res.data;
    if (reply.state === "matched") return finish({ name: "matched", join: reply.join, late: false });
    if (reply.state !== "waiting") return finish({ name: "none" });
    st.ticket = reply.ticket;
    setState({ name: "searching", ticket: reply.ticket, startedAt: st.startedAt });
    loop(run);
  }, [lv, finish, loop]);

  /** Отмена поиска. Уже забрали — место (вход в живой матч), иначе null. */
  const stop = useCallback(async (): Promise<MatchJoin | null> => {
    const st = r.current;
    const t = st.ticket;
    st.run++;
    window.clearTimeout(st.timer);
    st.ticket = null;
    if (!t) {
      setState({ name: "idle" });
      return null;
    }
    const res = await duelFetch<unknown>("DELETE", queueUrl(t));
    if (res.status === 200 && isQueueReply(res.data) && res.data.state === "matched") {
      setState({ name: "matched", join: res.data.join, late: true });
      return res.data.join;
    }
    setState({ name: "idle" });
    return null;
  }, []);

  // Ушли со страницы посреди поиска — снимаем билет (keepalive: запрос переживёт закрытие вкладки).
  useEffect(() => {
    const st = r.current;
    return () => {
      st.run++;
      window.clearTimeout(st.timer);
      const t = st.ticket;
      if (t) {
        try {
          void fetch(queueUrl(t), { method: "DELETE", keepalive: true });
        } catch {
          // ничего: билет сам выпадет из очереди через 9 с
        }
      }
    };
  }, []);

  return { state, start, stop };
}
