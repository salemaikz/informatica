import "server-only";
import { DECK_TAG } from "@/lib/duel/deck";
import { readJsonBody } from "@/server/body";
import { ipHash } from "@/server/ip-hash";
import { kvRateLimit, rateLimit } from "@/server/rate-limit";
import type { CountingKv } from "@/server/social/kv";
import { noPlayer, socialJson, socialRoute, type SocialCtx } from "@/server/social/route";
import { readSeat, type SeatClaims } from "./seat";

// Обвязка маршрутов живых дуэлей /api/duel/{queue,room,m}/* (docs/specs/duels.md §6): поверх socialRoute (origin, 503,
// лог `[social] route=… cmds=N`) — обязательный игрок (cookie inf_pl), процессный лимит частоты на игрока (горячие опросы
// без лишних команд Redis), лимиты создания в общем хранилище (kvRateLimit), проверка версии набора (409 «Обнови страницу»).
// В имя маршрута в логе входит id матча («duel.answers m=abc123»): расход команд на матч собирается из логов.

export interface DuelCtx extends SocialCtx {
  pid: string;
}

/** Опросов и отправок на игрока за 10 с (опрос 1,5–3 с + ответы пачками: с запасом на две вкладки). */
const BURST = { limit: 40, windowMs: 10_000 };
/** Создать поиск, комнату, войти в комнату: на игрока и на IP-хеш за 10 минут. */
export const CREATE_LIMITS = { perPlayer: 30, perIp: 600, windowMs: 10 * 60_000 };

export const MAX_DUEL_BODY = 2048;

export function duelRoute(req: Request, route: string, run: (ctx: DuelCtx) => Promise<Response>): Promise<Response> {
  return socialRoute(req, route, async (ctx) => {
    const pid = ctx.pid;
    if (!pid) return noPlayer();
    if (!rateLimit(`duel:${pid}`, BURST.limit, BURST.windowMs)) return socialJson({ error: "rate_limited" }, 429);
    return run({ ...ctx, pid });
  });
}

/** Лимит создания (поиск, комната, вход) в общем хранилище: INCRBY + EXPIRE на ключ = 2 команды. */
export async function createLimited(kv: CountingKv, req: Request, pid: string, now: number): Promise<boolean> {
  kv.addCmds(4);
  const [mine, ip] = await Promise.all([
    kvRateLimit(`duel:new:${pid}`, CREATE_LIMITS.perPlayer, CREATE_LIMITS.windowMs, now),
    kvRateLimit(`duel:new:ip:${ipHash(req)}`, CREATE_LIMITS.perIp, CREATE_LIMITS.windowMs, now),
  ]);
  return !(mine && ip);
}

/**
 * Выключатель случайных соперников (3-safety §8: запуск под флагом до ответа юриста): SOCIAL_RANDOM=0 — очередь «Блица»
 * отвечает 503 random_disabled (клиент показывает «временно недоступно» и Бита); комнаты с друзьями работают.
 */
export const randomEnabled = (): boolean => process.env.SOCIAL_RANDOM !== "0";
export const randomDisabled = (): Response => socialJson({ error: "random_disabled" }, 503);

/** Тело запроса-объект; иначе готовый ответ 400/413. */
export async function bodyOf(req: Request): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; res: Response }> {
  const body = await readJsonBody(req, MAX_DUEL_BODY);
  if (!body.ok) return { ok: false, res: socialJson({ error: body.error }, body.status) };
  const v = body.value;
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, res: socialJson({ error: "bad_request" }, 400) };
  return { ok: true, value: v as Record<string, unknown> };
}

/** Версия набора клиента не совпала с сервером: другая сборка строит другие задания из того же seed. */
export const updateNeeded = (): Response => socialJson({ error: "update_needed" }, 409);
export const deckTagOk = (tag: unknown): boolean => tag === DECK_TAG;

/** Место из заголовка x-duel-seat для этого матча и этого игрока; null — нет или чужое. */
export function seatFor(req: Request, ctx: DuelCtx, matchId: string): SeatClaims | null {
  const c = readSeat(req, ctx.secret);
  return c && c.m === matchId && c.pid === ctx.pid ? c : null;
}

/** Уровень игрока из тела: 1…999. */
export function levelOf(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? Math.min(999, Math.max(1, Math.floor(n))) : 1;
}

/** Короткая метка для лога (6 знаков id). */
export const tag6 = (id: string): string => id.slice(0, 6);
