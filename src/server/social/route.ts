import "server-only";
import { serverNow } from "@/server/clock";
import { sameOrigin } from "@/server/context";
import { countingKv, getSocialKv, requireSocialSecret, socialEnabled, type CountingKv } from "@/server/social/kv";
import { readPlayerId } from "@/server/social/player";

// Общая обвязка маршрутов /api/social/* и /api/duel/* (docs/specs/duels.md §6):
// - изменения (POST/DELETE) — только с нашего сайта (sameOrigin), чтения (GET) — без чужого Origin и Sec-Fetch-Site;
// - соцчасть выключена → 503 social_disabled (раздел показывает бота и «Скоро»);
// - хранилище не ответило → 503 social_unavailable («Соревнования временно недоступны, учёба работает»);
// - лог `[social] route=… pid=xxxxxx cmds=N` (6 знаков pid, число команд Redis) — без IP и имён.

export interface SocialCtx {
  kv: CountingKv;
  secret: string;
  /** pid из подписанной cookie или null; маршрут, создавший игрока, записывает сюда новый pid (для лога). */
  pid: string | null;
  /** Серверное время запроса (server/clock.ts). */
  now: number;
}

const NO_STORE = { "Cache-Control": "no-store" };

/** JSON-ответ соцчасти (никогда не кэшируется). */
export function socialJson(body: unknown, status = 200, setCookie?: string | null): Response {
  const headers = new Headers(NO_STORE);
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return Response.json(body, { status, headers });
}

/** Чтение (GET): чужой сайт не должен получить ответ с cookie игрока. Без Origin и Sec-Fetch-Site — пропускаем. */
function readAllowed(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site")?.toLowerCase();
  if (site && site !== "same-origin" && site !== "none") return false;
  return req.headers.get("origin") ? sameOrigin(req) : true;
}

export async function socialRoute(req: Request, route: string, run: (ctx: SocialCtx) => Promise<Response>): Promise<Response> {
  const read = req.method === "GET" || req.method === "HEAD";
  if (!(read ? readAllowed(req) : sameOrigin(req))) return socialJson({ error: "forbidden_origin" }, 403);
  if (!socialEnabled()) return socialJson({ error: "social_disabled" }, 503);
  const secret = requireSocialSecret();
  const ctx: SocialCtx = { kv: countingKv(getSocialKv()), secret, pid: readPlayerId(req, secret), now: serverNow() };
  let res: Response;
  try {
    res = await run(ctx);
  } catch (e) {
    console.error(`[social] route=${route} kv error`, e instanceof Error ? e.message : e);
    res = socialJson({ error: "social_unavailable" }, 503);
  }
  console.info(`[social] route=${route} pid=${ctx.pid ? ctx.pid.slice(0, 6) : "-"} cmds=${ctx.kv.cmds()}`);
  return res;
}

/** Маршрут требует игрока (cookie inf_pl), а её нет — 401 no_player: клиент сначала сохраняет профиль (POST /api/social/me). */
export function noPlayer(): Response {
  return socialJson({ error: "no_player" }, 401);
}
