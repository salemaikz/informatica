import { blockPlayer, pidOfCode } from "@/server/social/friends";
import { badRequest, objectBody, rateLimited } from "@/server/social/http";
import { overLimit, SOCIAL_RATE } from "@/server/social/limit";
import { noPlayer, socialJson, socialRoute } from "@/server/social/route";

// Блокировка (docs/specs/duels.md §7): заблокированный не может прислать заявку, добавиться по ссылке или принять вызов;
// дружба и заявки с обеих сторон снимаются. Разблокировать — { code, off: true }.
//   POST { code, off?: boolean } → { ok: true }

export const maxDuration = 10;
const BODY_MAX = 512;

export async function POST(req: Request) {
  return socialRoute(req, "block", async (ctx) => {
    if (!ctx.pid) return noPlayer();
    const body = await objectBody(req, BODY_MAX);
    if (!body.ok) return body.res;
    const { code, off } = body.value;
    if (typeof code !== "string" || (off !== undefined && typeof off !== "boolean")) return badRequest();
    if (await overLimit(ctx.kv, `frm:${ctx.pid}`, SOCIAL_RATE.mutatePid, ctx.now)) return rateLimited();
    const other = await pidOfCode(ctx.kv, code);
    if (other && other !== ctx.pid) await blockPlayer(ctx.kv, ctx.pid, other, off !== true);
    return socialJson({ ok: true });
  });
}
