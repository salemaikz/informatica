import { DECK_TAG } from "@/lib/duel/deck";
import { bodyOf, createLimited, deckTagOk, duelRoute, levelOf, updateNeeded } from "@/server/duel/http";
import { joinRoom } from "@/server/duel/room";
import { socialJson } from "@/server/social/route";

// Вход в комнату друга по ссылке /duel/r/<код> (docs/specs/duels.md §6, §10): POST {lv, deckTag} → {join} |
// 404 expired | 409 full / self (своя комната — {matchId}) / update_needed.

export const maxDuration = 10;

export async function POST(req: Request, ctx: RouteContext<"/api/duel/room/[code]/join">) {
  const { code } = await ctx.params;
  return duelRoute(req, "duel.room.join", async (c) => {
    const body = await bodyOf(req);
    if (!body.ok) return body.res;
    if (!deckTagOk(body.value.deckTag)) return updateNeeded();
    if (await createLimited(c.kv, req, c.pid, c.now)) return socialJson({ error: "rate_limited" }, 429);
    const res = await joinRoom(c.kv, code, { pid: c.pid, lv: levelOf(body.value.lv) }, DECK_TAG, c.now, c.secret);
    if (!res.ok) return socialJson({ error: res.error, ...(res.matchId ? { matchId: res.matchId } : {}) }, res.status);
    return socialJson({ join: res.join });
  });
}
