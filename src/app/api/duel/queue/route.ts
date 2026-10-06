import { DECK_TAG } from "@/lib/duel/deck";
import { bandOf } from "@/lib/duel/modes";
import { bodyOf, createLimited, deckTagOk, duelRoute, levelOf, updateNeeded } from "@/server/duel/http";
import { attempt, newTicket } from "@/server/duel/matchmaking";
import { socialJson } from "@/server/social/route";

// Поиск случайного соперника в «Блице» (docs/specs/duels.md §2.1, §6): POST {lv, deckTag} → {state:"matched", join} |
// {state:"waiting", ticket}. Дальше клиент опрашивает GET /api/duel/queue/[ticket] (1,5 с; каждая вторая — попытка захвата).
// 409 update_needed — другая версия набора; 429 — лимит; 401 no_player — сначала профиль (POST /api/social/me).

export const maxDuration = 10;

export async function POST(req: Request) {
  return duelRoute(req, "duel.queue", async (ctx) => {
    const body = await bodyOf(req);
    if (!body.ok) return body.res;
    if (!deckTagOk(body.value.deckTag)) return updateNeeded();
    if (await createLimited(ctx.kv, req, ctx.pid, ctx.now)) return socialJson({ error: "rate_limited" }, 429);
    const lv = levelOf(body.value.lv);
    const seeker = { pid: ctx.pid, lv, t: newTicket(bandOf(lv), ctx.now), deckTag: DECK_TAG };
    return socialJson(await attempt(ctx.kv, seeker, ctx.now, ctx.secret, true));
  });
}
