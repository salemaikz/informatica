import type { NextRequest } from "next/server";
import { DECK_TAG } from "@/lib/duel/deck";
import { duelRoute, randomDisabled, randomEnabled, tag6 } from "@/server/duel/http";
import { attempt, cancel, peek, verifyTicket } from "@/server/duel/matchmaking";
import { socialJson } from "@/server/social/route";

// Билет поиска (docs/specs/duels.md §2.1, §5): GET — опрос (1 команда); с ?try=1 — попытка захвата (раз в ~3 с).
// DELETE — отмена или «Сыграть с Битом»: если меня уже забрали, ответ «matched» — вхожу в живой матч (§10).
// Билет подписан для игрока (matchmaking.ts → verifyTicket): чужой, самодельный или старый — 404 bad_ticket.

export const maxDuration = 10;

const bad = () => socialJson({ error: "bad_ticket" }, 404);

export async function GET(req: NextRequest, ctx: RouteContext<"/api/duel/queue/[ticket]">) {
  const { ticket: raw } = await ctx.params;
  const capture = req.nextUrl.searchParams.get("try") === "1";
  return duelRoute(req, `duel.queue.${capture ? "try" : "poll"} t=${tag6(raw)}`, async (c) => {
    if (!randomEnabled()) return randomDisabled();
    const t = verifyTicket(raw, c.pid, c.secret, c.now);
    if (!t) return bad();
    if (!capture) return socialJson(await peek(c.kv, t, c.pid, c.secret));
    return socialJson(await attempt(c.kv, { pid: c.pid, lv: t.band, t, deckTag: DECK_TAG }, c.now, c.secret, false));
  });
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/duel/queue/[ticket]">) {
  const { ticket: raw } = await ctx.params;
  return duelRoute(req, `duel.queue.cancel t=${tag6(raw)}`, async (c) => {
    const t = verifyTicket(raw, c.pid, c.secret, c.now);
    if (!t) return bad();
    return socialJson(await cancel(c.kv, t, c.pid, DECK_TAG, c.secret));
  });
}
