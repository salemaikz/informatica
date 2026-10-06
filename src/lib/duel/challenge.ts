import { call, invalidateTop, type Res } from "../social/client";
import { sanitizeCard, sanitizeRes, type ResView } from "../social/view";
import { DUEL_MODES, isDuelBand, isDuelMode } from "./modes";
import { isValidTimeline } from "./timeline";
import type { AnswerIn, DuelBand, DuelEvent, DuelModeId, NotCountedWhy, PublicCard } from "./types";
import type { RunState } from "./run";

// Вызов другу на клиенте (этап 16Д, Ф3): подписанный старт, запись ответов, карточка вызова, игра против записи.
// Лёгкий модуль: набор заданий берётся тем же GET /api/duel/deck (deck.ts и банк — только на сервере).

/** Подписанный старт (POST /api/duel/start или …/accept). */
export interface StartView {
  start: string;
  mode: DuelModeId;
  seed: number;
  band: DuelBand;
  n: number;
  topic?: string;
  deckTag: string;
  startAt: number;
  endsAt: number;
}

export function sanitizeStart(raw: unknown): StartView | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.start !== "string" || o.start.length > 1024 || !isDuelMode(o.mode) || !isDuelBand(o.band)) return null;
  if (typeof o.seed !== "number" || !Number.isInteger(o.seed) || typeof o.deckTag !== "string") return null;
  if (DUEL_MODES[o.mode].needsTopic && typeof o.topic !== "string") return null;
  return {
    start: o.start,
    mode: o.mode,
    seed: o.seed,
    band: o.band,
    n: DUEL_MODES[o.mode].n,
    ...(typeof o.topic === "string" ? { topic: o.topic } : {}),
    deckTag: o.deckTag,
    startAt: Number(o.startAt) || 0,
    endsAt: Number(o.endsAt) || 0,
  };
}

/**
 * Ответы ученика для сервера: {i, a, ms}. ms — время на задание по часам матча: от открытия задания (после паузы за
 * ошибку) до ответа; сервер восстанавливает накопленное t тем же правилом (plausible.ts). Тайм-аут — a = −1.
 */
export function answersOf(mode: DuelModeId, run: Pick<RunState, "events" | "answers">): AnswerIn[] {
  const pauseMs = DUEL_MODES[mode].errorPauseMs;
  let opened = 0;
  return run.events.map((e) => {
    const a = run.answers[e.i];
    const ms = Math.max(0, Math.round(e.t - opened));
    opened = e.ok ? e.t : e.t + pauseMs;
    return { i: e.i, a: a === null || a === undefined ? -1 : a, ms };
  });
}

/** Тег версии набора у клиента (тот же, что NEXT_PUBLIC_DECK_TAG сборки; deck.ts в клиент не тянем). */
export const CLIENT_DECK_TAG: string = process.env.NEXT_PUBLIC_DECK_TAG || "dev";

const NONCE_RE = /^[a-z0-9]{6,16}$/;
export const isRecNonce = (v: unknown): v is string => typeof v === "string" && NONCE_RE.test(v);

/** Новый nonce записи (в обработчике нажатия или на сервере, не в рендере клиента). */
export function newRecNonce(): string {
  const a = new Uint32Array(2);
  globalThis.crypto.getRandomValues(a);
  return (a[0].toString(36) + a[1].toString(36)).slice(0, 12).padEnd(6, "0");
}

/**
 * Адрес записи вызова (одиночная игра «для друга»). r — nonce записи: перезагрузка страницы продолжает ту же запись
 * (старт хранится во вкладке по nonce), новая запись — новый nonce.
 */
export function recHref(mode: DuelModeId, topic?: string, nonce: string = newRecNonce()): string {
  const p = new URLSearchParams({ mode });
  if (DUEL_MODES[mode].needsTopic && topic) p.set("topic", topic);
  p.set("r", nonce);
  return `/duel/rec?${p}`;
}

export const challengePath = (id: string) => `/duel/c/${id}`;

/** Подписанный старт записи вызова. error stale — другая сборка: «Обнови страницу». */
export async function startSolo(mode: DuelModeId, topic: string | undefined, lv: number, deckTag: string): Promise<Res<StartView>> {
  const r = await call<unknown>("/api/duel/start", { method: "POST", body: { mode, ...(topic ? { topic } : {}), lv, deckTag } });
  const s = r.ok ? sanitizeStart(r.data) : null;
  return { ...r, ok: r.ok && !!s, data: s };
}

export interface Recorded {
  id: string;
  url: string;
  res: ResView;
}

export async function recordChallenge(start: string, answers: AnswerIn[]): Promise<Res<Recorded>> {
  const r = await call<{ id?: unknown; url?: unknown; res?: unknown }>("/api/duel/challenge", { method: "POST", body: { start, answers } });
  const id = typeof r.data?.id === "string" && /^[A-Za-z0-9_-]{10}$/.test(r.data.id) ? r.data.id : null;
  const res = sanitizeRes(r.data?.res);
  return { ...r, ok: r.ok && !!id && !!res, data: id && res ? { id, url: challengePath(id), res } : null };
}

/** Итог принявшего (видит автор вызова). */
export interface ChallengeResultRow {
  card: PublicCard;
  score: number;
  correct: number;
  /** Итог для автора вызова. */
  w: "win" | "loss" | "draw";
  at: number;
}

export interface ChallengeView {
  id: string;
  mode: DuelModeId;
  topic?: string;
  band: DuelBand;
  by: PublicCard;
  res: ResView;
  stale: boolean;
  mine: boolean;
  played: boolean;
  results: ChallengeResultRow[];
  expiresAt: number;
}

export function sanitizeChallenge(raw: unknown): ChallengeView | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const by = sanitizeCard(o.by);
  const res = sanitizeRes(o.res);
  if (typeof o.id !== "string" || !isDuelMode(o.mode) || !isDuelBand(o.band) || !by || !res) return null;
  const results = Array.isArray(o.results)
    ? o.results.flatMap((x) => {
        const r = x as Record<string, unknown> | null;
        const card = sanitizeCard(r?.card);
        if (!r || !card) return [];
        const w = r.w === "win" || r.w === "loss" ? r.w : "draw";
        return [{ card, score: Number(r.score) || 0, correct: Number(r.correct) || 0, w, at: Number(r.at) || 0 } as ChallengeResultRow];
      })
    : [];
  return {
    id: o.id,
    mode: o.mode,
    ...(typeof o.topic === "string" ? { topic: o.topic } : {}),
    band: o.band,
    by,
    res,
    stale: o.stale === true,
    mine: o.mine === true,
    played: o.played === true,
    results: results.slice(0, 20),
    expiresAt: Number(o.expiresAt) || 0,
  };
}

export async function getChallenge(id: string, signal?: AbortSignal): Promise<Res<ChallengeView>> {
  const r = await call<unknown>(`/api/duel/challenge/${encodeURIComponent(id)}`, { signal });
  const v = r.ok ? sanitizeChallenge(r.data) : null;
  return { ...r, ok: r.ok && !!v, data: v };
}

export interface Accepted {
  start: StartView;
  tl: DuelEvent[];
  by: PublicCard;
  res: ResView;
}

/** «Принять вызов». error: self | stale | already | not_found. */
export async function acceptChallenge(id: string): Promise<Res<Accepted>> {
  const r = await call<{ start?: unknown; tl?: unknown; by?: unknown; res?: unknown }>(`/api/duel/challenge/${encodeURIComponent(id)}/accept`, { method: "POST" });
  if (!r.ok) return { ...r, data: null };
  const start = sanitizeStart(r.data?.start);
  const by = sanitizeCard(r.data?.by);
  const res = sanitizeRes(r.data?.res);
  const tl = Array.isArray(r.data?.tl) ? (r.data.tl as DuelEvent[]) : null;
  if (!start || !by || !res || !tl || !isValidTimeline(tl, start.n)) return { ...r, ok: false, data: null };
  return { ...r, data: { start, tl, by, res } };
}

export interface GhostResult {
  you: ResView;
  rival: ResView;
  result: "win" | "loss" | "draw";
  stored: boolean;
  counted: boolean;
  why?: NotCountedWhy;
  weekPts: number;
}

const WHY: readonly NotCountedWhy[] = ["bot", "fast", "short", "pair_limit", "daily_limit"];

export async function sendGhostResult(id: string, start: string, answers: AnswerIn[]): Promise<Res<GhostResult>> {
  const r = await call<Record<string, unknown>>(`/api/duel/challenge/${encodeURIComponent(id)}/result`, { method: "POST", body: { start, answers } });
  if (!r.ok || !r.data) return { ...r, data: null };
  const you = sanitizeRes(r.data.you);
  const rival = sanitizeRes(r.data.rival);
  const result = r.data.result === "win" || r.data.result === "loss" ? r.data.result : "draw";
  if (!you || !rival) return { ...r, ok: false, data: null };
  invalidateTop();
  const why = WHY.find((w) => w === r.data?.why);
  return {
    ...r,
    data: {
      you,
      rival,
      result,
      stored: r.data.stored === true,
      counted: r.data.counted === true,
      ...(why ? { why } : {}),
      weekPts: typeof r.data.weekPts === "number" ? Math.max(0, Math.floor(r.data.weekPts)) : 0,
    },
  };
}
