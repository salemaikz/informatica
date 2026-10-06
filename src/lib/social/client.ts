import type { CosmeticId } from "../cosmetics";
import { sanitizeCard, sanitizeCards, sanitizeInbox, sanitizePlayer, sanitizeTop, type InboxItem, type MyPlayer, type TopRowView } from "./view";
import type { PublicCard } from "../duel/types";

// Запросы соцчасти с клиента (этап 16Д, Ф3): профиль игрока, друзья, приглашения, топ друзей, жалобы. Лёгкий модуль
// (только fetch и разбор). Никогда не бросает: сеть упала — status 0. Ответы — недоверенные (view.ts).

export interface Res<T> {
  ok: boolean;
  /** HTTP-код; 0 — сети нет. */
  status: number;
  data: T | null;
  /** Код ошибки сервера (social_disabled, social_unavailable, no_player, rate_limited …). */
  error?: string;
}

/** Соцчасть: включена, выключена на сервере («Скоро»), временно недоступна (503 social_unavailable / нет сети). */
export type SocialState = "on" | "off" | "down";

export function socialStateOf(r: Res<unknown>): SocialState {
  if (r.ok) return "on";
  if (r.error === "social_disabled") return "off";
  if (r.status === 0 || r.error === "social_unavailable") return "down";
  return "on";
}

export async function call<T>(path: string, init?: { method?: string; body?: unknown; signal?: AbortSignal; headers?: Record<string, string> }): Promise<Res<T>> {
  try {
    const headers = { ...(init?.body !== undefined ? { "content-type": "application/json" } : {}), ...init?.headers };
    const res = await fetch(path, {
      method: init?.method ?? "GET",
      headers: Object.keys(headers).length ? headers : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init?.signal,
      cache: "no-store",
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    const error = !res.ok && data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : undefined;
    return { ok: res.ok, status: res.status, data: res.ok ? (data as T) : null, ...(error ? { error } : {}) };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

// ---------- профиль ----------

export interface ProfileInput {
  name: string | null;
  lang: "ru" | "kk";
  lv: number;
  cosmetics: { frame: CosmeticId | null; title: CosmeticId | null };
  ft: boolean;
}

export async function getMe(signal?: AbortSignal): Promise<Res<MyPlayer | null>> {
  const r = await call<{ player?: unknown }>("/api/social/me", { signal });
  return { ...r, data: r.ok ? sanitizePlayer(r.data?.player) : null };
}

/** Сохранить профиль. hint — код отказа имени (сам отклонённый текст не возвращается и не показывается). */
export async function saveMe(input: ProfileInput): Promise<Res<{ player: MyPlayer; hint?: string }>> {
  const r = await call<{ player?: unknown; hint?: unknown }>("/api/social/me", { method: "POST", body: input });
  const player = r.ok ? sanitizePlayer(r.data?.player) : null;
  return { ...r, ok: r.ok && !!player, data: player ? { player, ...(typeof r.data?.hint === "string" ? { hint: r.data.hint } : {}) } : null };
}

/** Отметка вкладки «профиль игрока на сервере свежий» (lib/duel/live.ts → ensurePlayer). */
export const PLAYER_MARK = "informatica-duel-player";

export function forgetPlayerMark(): void {
  try {
    sessionStorage.removeItem(PLAYER_MARK);
  } catch {
    // нет хранилища — отметки и не было
  }
}

/** Удалить профиль соревнований; отметка «профиль свежий» снимается сразу (иначе живой вход час считал бы его живым). */
export async function deleteMe() {
  forgetPlayerMark();
  const r = await call<{ ok: true }>("/api/social/me", { method: "DELETE" });
  forgetPlayerMark();
  return r;
}

export interface HomeData {
  player: MyPlayer | null;
  inbox: InboxItem[];
  requests: number;
}

export async function getHome(signal?: AbortSignal): Promise<Res<HomeData>> {
  const r = await call<{ player?: unknown; inbox?: unknown; requests?: unknown }>("/api/social/home", { signal });
  if (!r.ok) return { ...r, data: null };
  const requests = typeof r.data?.requests === "number" ? Math.max(0, Math.min(99, Math.floor(r.data.requests))) : 0;
  return { ...r, data: { player: sanitizePlayer(r.data?.player), inbox: sanitizeInbox(r.data?.inbox), requests } };
}

// ---------- друзья ----------

export interface FriendLists {
  friends: PublicCard[];
  requests: PublicCard[];
  blocked: PublicCard[];
}

export async function getFriends(signal?: AbortSignal): Promise<Res<FriendLists>> {
  const r = await call<Record<string, unknown>>("/api/social/friends", { signal });
  return { ...r, data: r.ok ? { friends: sanitizeCards(r.data?.friends), requests: sanitizeCards(r.data?.requests), blocked: sanitizeCards(r.data?.blocked) } : null };
}

export type RequestStatus = "sent" | "accepted" | "already" | "self" | "not_found" | "limit";

export async function requestFriend(code: string): Promise<Res<RequestStatus>> {
  const r = await call<{ status?: RequestStatus }>("/api/social/friends/request", { method: "POST", body: { code } });
  if (r.ok) invalidateTop();
  return { ...r, data: r.data?.status ?? null };
}

export async function respondFriend(code: string, accept: boolean): Promise<Res<string>> {
  const r = await call<{ status?: string }>("/api/social/friends/respond", { method: "POST", body: { code, accept } });
  if (r.ok) invalidateTop();
  return { ...r, data: r.data?.status ?? null };
}

export async function removeFriend(code: string): Promise<Res<unknown>> {
  const r = await call(`/api/social/friends/${encodeURIComponent(code)}`, { method: "DELETE" });
  if (r.ok) invalidateTop();
  return r;
}

/** Заблокировать (off — снять блок). live — живой матч: цель сервер находит по подписанному месту (у случайного соперника кода нет). */
export async function blockPlayer(code: string, off = false, live?: { matchId: string; seat: string }): Promise<Res<unknown>> {
  const r = live
    ? await call("/api/social/block", { method: "POST", body: { matchId: live.matchId }, headers: { "x-duel-seat": live.seat } })
    : await call("/api/social/block", { method: "POST", body: off ? { code, off: true } : { code } });
  if (r.ok) invalidateTop();
  return r;
}

export async function createInvite(): Promise<Res<string>> {
  const r = await call<{ url?: unknown }>("/api/social/invite-link", { method: "POST" });
  const url = typeof r.data?.url === "string" && /^\/f\/[A-Za-z0-9_-]{22}$/.test(r.data.url) ? r.data.url : null;
  return { ...r, ok: r.ok && !!url, data: url };
}

export async function getInvite(token: string, signal?: AbortSignal): Promise<Res<{ from: PublicCard; self: boolean }>> {
  const r = await call<{ from?: unknown; self?: unknown }>(`/api/social/invite-link/${encodeURIComponent(token)}`, { signal });
  const from = r.ok ? sanitizeCard(r.data?.from) : null;
  return { ...r, ok: r.ok && !!from, data: from ? { from, self: r.data?.self === true } : null };
}

export type JoinStatus = "accepted" | "already" | "self" | "expired" | "limit";

export async function acceptInvite(token: string): Promise<Res<JoinStatus>> {
  const r = await call<{ status?: JoinStatus }>(`/api/social/invite-link/${encodeURIComponent(token)}/accept`, { method: "POST" });
  if (r.ok) invalidateTop();
  return { ...r, data: r.data?.status ?? null };
}

// ---------- топ друзей (кэш 60 с в памяти вкладки) ----------

export const TOP_CACHE_MS = 60_000;
let topCache: { at: number; rows: TopRowView[] } | null = null;

/** Сбросить кэш топа (после изменений дружбы и сыгранного вызова). */
export function invalidateTop(): void {
  topCache = null;
}

export async function getTop(now: number, signal?: AbortSignal): Promise<Res<TopRowView[]>> {
  if (topCache && now - topCache.at < TOP_CACHE_MS) return { ok: true, status: 200, data: topCache.rows };
  const r = await call<unknown>("/api/social/top/friends", { signal });
  if (!r.ok) return { ...r, data: null };
  const rows = sanitizeTop(r.data);
  topCache = { at: now, rows };
  return { ...r, data: rows };
}

// ---------- жалоба ----------

export type ReportReason = "name" | "cheat" | "other";
export type ReportWhere = "friend" | "request" | "top" | "challenge" | "result" | "match" | "invite";

/**
 * Жалоба. Живой матч (Ф4): seat — подписанное место в матче (заголовок x-duel-seat); адресата сервер находит сам по матчу
 * и месту, код в теле не нужен (у случайного соперника его и нет — только «~метка»).
 */
export const reportPlayer = (code: string, reason: ReportReason, where: ReportWhere, matchId?: string, seat?: string) =>
  call<{ ok: true }>("/api/social/report", {
    method: "POST",
    body: { ...(seat ? {} : { code }), reason, where, ...(matchId ? { matchId } : {}) },
    ...(seat ? { headers: { "x-duel-seat": seat } } : {}),
  });
