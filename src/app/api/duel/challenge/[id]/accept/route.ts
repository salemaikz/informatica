import { rateLimit } from "@/server/rate-limit";
import { acceptChallenge } from "@/server/duel/challenge";
import { rateLimited } from "@/server/social/http";
import { noPlayer, socialJson, socialRoute } from "@/server/social/route";

// «Принять вызов» (docs/specs/duels.md §6): подписанный старт против записи вызвавшего (призрак) — ничего не пишет.
//   POST → { start: StartView, tl: DuelEvent[], by: PublicCard, res }
// Ошибки: 404 not_found (нет, истёк, автор блокирует), 409 self / stale (задания обновились) / already (уже сыграно).

export const maxDuration = 10;

export async function POST(req: Request, ctx: RouteContext<"/api/duel/challenge/[id]/accept">) {
  const { id } = await ctx.params;
  return socialRoute(req, "duel.challenge.accept", async (c) => {
    if (!c.pid) return noPlayer();
    if (!rateLimit(`duel-accept:${c.pid}`, 30, 10 * 60_000)) return rateLimited();
    const res = await acceptChallenge(c.kv, id, c.pid, c.now);
    if (!res.ok) return socialJson({ error: res.error }, res.error === "not_found" ? 404 : 409);
    return socialJson({ start: res.start, tl: res.tl, by: res.by, res: res.res });
  });
}
