import { pidOfCode, requestFriend } from "@/server/social/friends";
import { badRequest, objectBody, rateLimited } from "@/server/social/http";
import { overIpLimit, overLimit, SOCIAL_RATE } from "@/server/social/limit";
import { noPlayer, socialJson, socialRoute } from "@/server/social/route";

// Заявка в друзья по коду (docs/specs/duels.md §6).
//   POST { code } → { status: "sent" | "accepted" | "already" | "self" | "not_found" | "limit" }
// Блокировку не раскрываем: заблокированный видит «sent». Лимиты: 20 в час на игрока и 60 на IP; неудачный поиск кода —
// 30 в час на IP (перебор кодов).

export const maxDuration = 10;
const BODY_MAX = 512;

export async function POST(req: Request) {
  return socialRoute(req, "friends.request", async (ctx) => {
    if (!ctx.pid) return noPlayer();
    const body = await objectBody(req, BODY_MAX);
    if (!body.ok) return body.res;
    if (typeof body.value.code !== "string") return badRequest();
    if (await overLimit(ctx.kv, `frq:${ctx.pid}`, SOCIAL_RATE.requestPid, ctx.now)) return rateLimited();
    if (await overIpLimit(ctx.kv, req, "frq-ip", SOCIAL_RATE.requestIp, ctx.now)) return rateLimited();
    const other = await pidOfCode(ctx.kv, body.value.code);
    if (!other) {
      if (await overIpLimit(ctx.kv, req, "frq-miss", SOCIAL_RATE.missIp, ctx.now)) return rateLimited();
      return socialJson({ status: "not_found" });
    }
    const status = await requestFriend(ctx.kv, ctx.pid, other);
    if (status === null) return noPlayer();
    return socialJson({ status });
  });
}
