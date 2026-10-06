import { pidOfCode, respondFriend } from "@/server/social/friends";
import { badRequest, objectBody, rateLimited } from "@/server/social/http";
import { overLimit, SOCIAL_RATE } from "@/server/social/limit";
import { noPlayer, socialJson, socialRoute } from "@/server/social/route";

// Ответ на заявку в друзья (docs/specs/duels.md §6).
//   POST { code, accept: boolean } → { status: "accepted" | "declined" | "not_found" | "limit" }
// Отказ молчаливый: отправитель ничего не узнаёт.

export const maxDuration = 10;
const BODY_MAX = 512;

export async function POST(req: Request) {
  return socialRoute(req, "friends.respond", async (ctx) => {
    if (!ctx.pid) return noPlayer();
    const body = await objectBody(req, BODY_MAX);
    if (!body.ok) return body.res;
    const { code, accept } = body.value;
    if (typeof code !== "string" || typeof accept !== "boolean") return badRequest();
    if (await overLimit(ctx.kv, `frm:${ctx.pid}`, SOCIAL_RATE.mutatePid, ctx.now)) return rateLimited();
    const other = await pidOfCode(ctx.kv, code);
    if (!other) return socialJson({ status: "not_found" });
    return socialJson({ status: await respondFriend(ctx.kv, ctx.pid, other, accept) });
  });
}
