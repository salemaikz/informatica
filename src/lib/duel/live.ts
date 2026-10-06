import { FRIEND_CODE_ALPHABET } from "../friend-code";
import { hashString } from "../text";
import { DUEL_MODES, isDuelBand, isDuelMode } from "./modes";
import type { RunState } from "./run";
import type { AnswerIn, DuelEvent, DuelModeId, DuelTopic, MatchJoin, MatchView, PublicCard } from "./types";

// Живые матчи на клиенте (этап 16Д, Ф4; docs/specs/duels.md §5, §10): запросы к /api/duel/{queue,room,m}, сдвиг часов,
// интервалы опроса, место в матче в sessionStorage, код комнаты. Лёгкий модуль без React и без банка: им пользуются
// хук useDuel и экраны (сервер берёт отсюда только разбор кода комнаты).

// ---------- версия набора ----------

/** Тег версии набора этой сборки (тот же, что у сервера этой сборки): старый клиент получит 409 «Обнови страницу». */
export const CLIENT_DECK_TAG: string = process.env.NEXT_PUBLIC_DECK_TAG || "dev";

// ---------- интервалы (§5) ----------

export const POLL = {
  /** Поиск: опрос билета. */
  searchMs: 1_500,
  /** Поиск: попытка захвата — каждый второй опрос (≈ 3 с), с дрожанием, чтобы двое не совпадали шаг в шаг. */
  captureEvery: 2,
  /** Лобби комнаты и ожидание готовности. */
  lobbyMs: 2_000,
  /** В игре: ответы уходят пачкой до 5 или через столько после первого неотправленного. */
  flushMs: 1_500,
  batchMax: 5,
  /** В игре: отдельный опрос, если столько ничего не отправлялось. */
  idleMs: 3_000,
  /** Итоги и ожидание соперника: опрос каждые 2 с, не дольше 15 с (потом — как в игре, 3 с). */
  resultsMs: 2_000,
  resultsMaxMs: 15_000,
} as const;

/** Поиск соперника (§1 таблица, §10): кнопка Бита — с 3 с, карточка-предложение — на 12-й, поиск — до 30 с. Без автостарта. */
export const SEARCH = { botButtonMs: 3_000, offerMs: 12_000, maxMs: 30_000 } as const;

/** Пауза после ошибки сети: 2 → 4 → 8 с. */
export function backoffMs(failures: number): number {
  if (failures <= 0) return 0;
  return Math.min(8_000, 2_000 * 2 ** (failures - 1));
}

// ---------- часы ----------

export interface ClockSync {
  /** serverNow − локальное время, мс. */
  offset: number;
  /** Круг запроса, по которому взят сдвиг, мс. */
  rtt: number;
}

/** Сдвиг по одному ответу: serverNow − (отправка + приём) / 2. */
export function clockSample(serverNow: number, sentAt: number, recvAt: number): ClockSync {
  return { offset: serverNow - (sentAt + recvAt) / 2, rtt: Math.max(0, recvAt - sentAt) };
}

/**
 * Новый сдвиг: большой скачок (> 1 с — первый ответ, перевод часов, тестовый крючок) берём сразу; мелкий шум — сглаживаем,
 * и только по быстрым ответам (круг < 1 с), чтобы медленный ответ не уводил часы.
 */
export function nextClock(prev: ClockSync | null, s: ClockSync): ClockSync {
  if (!prev || Math.abs(s.offset - prev.offset) > 1_000) return s;
  if (s.rtt > 1_000 && s.rtt > prev.rtt) return prev;
  return { offset: Math.round(prev.offset * 0.7 + s.offset * 0.3), rtt: Math.round(prev.rtt * 0.7 + s.rtt * 0.3) };
}

// ---------- ответы ----------

/**
 * Время на задание k по событиям матча (часы матча): от открытия задания (ответ на предыдущее, после ошибки — плюс пауза
 * режима) до ответа. Так же считает сервер (plausible.ts: t = прошлое t + пауза + ms).
 */
export function itemMs(events: readonly DuelEvent[], k: number, errorPauseMs: number): number {
  const prev = k > 0 ? events[k - 1] : null;
  const openedAt = prev ? prev.t + (prev.ok ? 0 : errorPauseMs) : 0;
  return Math.max(0, Math.round(events[k].t - openedAt));
}

/** Ответ для сервера по событию матча; тайм-аут («10 вопросов») — −1 (неверно). */
export function answerIn(mode: DuelModeId, events: readonly DuelEvent[], k: number, a: boolean | number | null): AnswerIn {
  return { i: events[k].i, a: a ?? -1, ms: itemMs(events, k, DUEL_MODES[mode].errorPauseMs) };
}

/**
 * Ход ученика по уже принятым сервером событиям (перезагрузка вкладки посреди матча, §10): следующее задание открывается
 * после последнего ответа (после ошибки — с паузой режима). Сами ответы неизвестны (в разборе — «—»).
 */
export function resumeRun(mode: DuelModeId, events: readonly DuelEvent[], n: number): RunState {
  const last = events[events.length - 1];
  const at = last ? last.t + (last.ok ? 0 : DUEL_MODES[mode].errorPauseMs) : 0;
  return { i: events.length, events: [...events], answers: events.map(() => null), itemAt: at, pauseUntil: at, done: events.length >= n };
}

// ---------- код комнаты ----------

export const ROOM_CODE_LEN = 6;
const ROOM_RE = new RegExp(`^[${FRIEND_CODE_ALPHABET}]{${ROOM_CODE_LEN}}$`);
const LOOK: Record<string, string> = { O: "0", I: "1", L: "1", U: "V" };

/** Код комнаты из ввода или адреса: регистр, пробелы и дефисы, похожие буквы; null — не код. */
export function normalizeRoomCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 20) return null;
  const s = raw
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[OILU]/g, (c) => LOOK[c] ?? c);
  return ROOM_RE.test(s) ? s : null;
}

export const roomPath = (code: string): string => `/duel/r/${code}`;

// ---------- игрок ----------

/** Номер вместо имени («Игрок 4821»): постоянный для кода друга, 1000…9999. */
export function anonNumber(code: string): number {
  return 1000 + (hashString(`pl:${code}`) % 9000);
}

/** Подпись соперника: имя после фильтра или номер на языке зрителя. */
export function playerLabel(card: Pick<PublicCard, "code" | "name">, anon: (n: number) => string): string {
  return card.name?.trim() || anon(anonNumber(card.code || "-"));
}

// ---------- проверка ответов сервера (данные из сети — недоверенные) ----------

export function isMatchJoin(v: unknown): v is MatchJoin {
  if (!v || typeof v !== "object") return false;
  const j = v as Partial<MatchJoin>;
  return (
    typeof j.matchId === "string" &&
    /^[A-Za-z0-9_-]{6,32}$/.test(j.matchId) &&
    typeof j.seat === "string" &&
    typeof j.seed === "number" &&
    isDuelMode(j.mode) &&
    isDuelBand(j.band) &&
    typeof j.n === "number" &&
    typeof j.deckTag === "string" &&
    typeof j.startAt === "number" &&
    typeof j.endsAt === "number" &&
    (j.topic === undefined || typeof j.topic === "string")
  );
}

const STATES = ["lobby", "countdown", "playing", "finished", "cancelled"];

export function isMatchView(v: unknown): v is MatchView {
  if (!v || typeof v !== "object") return false;
  const m = v as Partial<MatchView>;
  return (
    typeof m.id === "string" &&
    typeof m.serverNow === "number" &&
    STATES.includes(m.state as string) &&
    !!m.you &&
    typeof m.you.score === "number" &&
    Array.isArray(m.oppTl) &&
    (m.opp === null || (!!m.opp && typeof m.opp.score === "number"))
  );
}

// ---------- место в sessionStorage (перезагрузка вкладки во время матча, §10) ----------

const SEAT_KEY = "informatica-duel-seat:";

export function saveJoin(join: MatchJoin): void {
  try {
    sessionStorage.setItem(SEAT_KEY + join.matchId, JSON.stringify(join));
  } catch {
    // хранилище недоступно — после перезагрузки место не восстановится
  }
}

export function loadJoin(matchId: string): MatchJoin | null {
  try {
    const v: unknown = JSON.parse(sessionStorage.getItem(SEAT_KEY + matchId) ?? "null");
    return isMatchJoin(v) && v.matchId === matchId ? v : null;
  } catch {
    return null;
  }
}

// ---------- запросы ----------

export interface Timed<T> {
  status: number;
  data: T | null;
  /** Код ошибки сервера ({error}) или null. */
  error: string | null;
  /** Тело ответа как есть (и для ошибок: например, {error:"self", matchId}). */
  raw: unknown;
  sentAt: number;
  recvAt: number;
}

/** Запрос к API дуэлей: JSON туда и обратно, заголовок места. Сеть упала — status 0. */
export async function duelFetch<T>(method: "GET" | "POST" | "DELETE", url: string, opts: { body?: unknown; seat?: string | null; signal?: AbortSignal } = {}): Promise<Timed<T>> {
  const sentAt = Date.now();
  try {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (opts.seat) headers["x-duel-seat"] = opts.seat;
    const res = await fetch(url, {
      method,
      headers,
      cache: "no-store",
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
    const recvAt = Date.now();
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    const error = !res.ok && data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : null;
    return { status: res.status, data: res.ok ? (data as T) : null, error, raw: data, sentAt, recvAt };
  } catch {
    return { status: 0, data: null, error: null, raw: null, sentAt, recvAt: Date.now() };
  }
}

export type QueueReply = { state: "waiting"; ticket: string } | { state: "matched"; join: MatchJoin } | { state: "cancelled" };

export function isQueueReply(v: unknown): v is QueueReply {
  if (!v || typeof v !== "object") return false;
  const r = v as { state?: unknown; ticket?: unknown; join?: unknown };
  if (r.state === "waiting") return typeof r.ticket === "string";
  if (r.state === "matched") return isMatchJoin(r.join);
  return r.state === "cancelled";
}

export const queueUrl = (ticket?: string, capture = false): string =>
  ticket ? `/api/duel/queue/${encodeURIComponent(ticket)}${capture ? "?try=1" : ""}` : "/api/duel/queue";
export const roomUrl = (code?: string): string => (code ? `/api/duel/room/${encodeURIComponent(code)}/join` : "/api/duel/room");
export const matchUrl = (id: string, action?: "ready" | "answers" | "done" | "leave" | "rematch"): string =>
  `/api/duel/m/${encodeURIComponent(id)}${action ? `/${action}` : ""}`;

/** Адрес экрана живого матча: поиск, новая комната, вход в комнату, возврат в матч. */
export function liveHref(p: { find: true } | { room: DuelModeId; topic?: DuelTopic } | { match: string }): string {
  if ("find" in p) return "/duel/live?find=blitz";
  if ("match" in p) return `/duel/live?m=${encodeURIComponent(p.match)}`;
  const q = new URLSearchParams({ room: p.room });
  if (DUEL_MODES[p.room].needsTopic && p.topic) q.set("topic", p.topic);
  return `/duel/live?${q}`;
}

// ---------- профиль игрока на сервере ----------

export interface PlayerInput {
  name: string;
  lang: "ru" | "kk";
  lv: number;
  frame: string | null;
  title: string | null;
}

const PLAYER_MARK = "informatica-duel-player";
/** Профиль на сервере обновляем не чаще раза в час на вкладку (уровень и украшения), иначе — по ошибке no_player. */
const PLAYER_FRESH_MS = 3_600_000;

/**
 * Игрок соцчасти есть (cookie inf_pl и профиль на сервере): POST /api/social/me с именем, языком, уровнем и украшениями.
 * Повторный вызов в течение часа ничего не отправляет (force — после ответа no_player). false — сервер недоступен.
 */
export async function ensurePlayer(p: PlayerInput, force = false): Promise<boolean> {
  const now = Date.now();
  if (!force) {
    try {
      const at = Number(sessionStorage.getItem(PLAYER_MARK));
      if (at && now - at < PLAYER_FRESH_MS) return true;
    } catch {
      // нет хранилища — просто отправим
    }
  }
  const res = await duelFetch<unknown>("POST", "/api/social/me", {
    body: { name: p.name.trim().slice(0, 30), lang: p.lang, lv: p.lv, cosmetics: { frame: p.frame, title: p.title }, ft: true },
  });
  if (res.status !== 200) return false;
  try {
    sessionStorage.setItem(PLAYER_MARK, String(now));
  } catch {
    // ничего
  }
  return true;
}

/**
 * Соцчасть на сервере (GET /api/social/home): on — работает; off — выключена (нет секрета или общего хранилища: «Скоро»);
 * down — хранилище не ответило или нет сети («Соревнования временно недоступны»).
 */
export async function socialStatus(signal?: AbortSignal): Promise<"on" | "off" | "down"> {
  const res = await duelFetch<unknown>("GET", "/api/social/home", { signal });
  if (res.status === 200) return "on";
  return res.status === 503 && res.error === "social_disabled" ? "off" : "down";
}
