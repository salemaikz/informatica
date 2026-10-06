import { rateLimit } from "@/server/rate-limit";
import { challengeResult, openStart, parseAnswers } from "@/server/duel/challenge";
import { badRequest, objectBody, rateLimited } from "@/server/social/http";
import { noPlayer, socialJson, socialRoute } from "@/server/social/route";

// Итог игры против записи (docs/specs/duels.md §6, §8): сервер проверяет ответы, сохраняет итог (один раз на игрока),
// кладёт его во входящие вызвавшего и начисляет принявшему очки недели (+1 за принятый, +1 за победу; потолки пары и суток).
//   POST { start, answers } → { you, rival, result: "win"|"loss"|"draw", stored, counted, why?, weekPts }

export const maxDuration = 10;
const BODY_MAX = 8 * 1024;

export async function POST(req: Request, ctx: RouteContext<"/api/duel/challenge/[id]/result">) {
  const { id } = await ctx.params;
  return socialRoute(req, "duel.challenge.result", async (c) => {
    if (!c.pid) return noPlayer();
    const body = await objectBody(req, BODY_MAX);
    if (!body.ok) return body.res;
    const claims = openStart(body.value.start, c.pid, c.now, id);
    if (claims === "bad") return socialJson({ error: "bad_start" }, 400);
    if (claims === "expired") return socialJson({ error: "expired" }, 410);
    const answers = parseAnswers(body.value.answers, claims.n);
    if (!answers) return badRequest();
    if (!rateLimit(`duel-result:${c.pid}`, 30, 10 * 60_000)) return rateLimited();
    const res = await challengeResult(c.kv, id, c.pid, claims, answers, c.now);
    if (res === "not_found") return socialJson({ error: "not_found" }, 404);
    if (!res) return socialJson({ error: "deck_short" }, 503);
    return socialJson(res);
  });
}
