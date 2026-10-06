import { createChallenge, openStart, parseAnswers } from "@/server/duel/challenge";
import { badRequest, objectBody, rateLimited } from "@/server/social/http";
import { overLimit, SOCIAL_RATE } from "@/server/social/limit";
import { noPlayer, socialJson, socialRoute } from "@/server/social/route";

// Записать вызов другу (docs/specs/duels.md §6, Ф3): сервер пересобирает набор из подписанного старта, сам проверяет ответы
// (plausible.ts) и сохраняет du:ch:{id} на 30 дней. Тот же старт второй раз — тот же вызов.
//   POST { start, answers: {i, a, ms}[] } → { id, url: "/duel/c/<id>", res: {score, correct, answered, timeMs} }
// Ошибки: 400 bad_start / bad_request / empty, 410 expired (окно старта прошло), 409 stale (вышла новая сборка заданий), 429.

export const maxDuration = 10;
/** До 50 ответов по ~40 байт + токен старта. */
const BODY_MAX = 8 * 1024;

export async function POST(req: Request) {
  return socialRoute(req, "duel.challenge", async (ctx) => {
    if (!ctx.pid) return noPlayer();
    const body = await objectBody(req, BODY_MAX);
    if (!body.ok) return body.res;
    const claims = openStart(body.value.start, ctx.pid, ctx.now, null);
    if (claims === "bad") return socialJson({ error: "bad_start" }, 400);
    if (claims === "expired") return socialJson({ error: "expired" }, 410);
    if (claims === "stale") return socialJson({ error: "stale" }, 409);
    const answers = parseAnswers(body.value.answers, claims.n);
    if (!answers) return badRequest();
    if (!answers.length) return socialJson({ error: "empty" }, 400);
    if (await overLimit(ctx.kv, `ch:${ctx.pid}`, SOCIAL_RATE.challengePid, ctx.now)) return rateLimited();
    const res = await createChallenge(ctx.kv, ctx.pid, body.value.start as string, claims, answers, ctx.now);
    if (!res) return socialJson({ error: "deck_short" }, 503);
    return socialJson({ id: res.id, url: `/duel/c/${res.id}`, res: res.res });
  });
}
