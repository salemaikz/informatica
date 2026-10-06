import { DECK_TAG } from "@/lib/duel/deck";
import { roomPath } from "@/lib/duel/live";
import { DUEL_MODES, isDuelMode } from "@/lib/duel/modes";
import { isDuelTopic } from "@/lib/duel/topics";
import { bodyOf, createLimited, deckTagOk, duelRoute, levelOf, updateNeeded } from "@/server/duel/http";
import { createRoom } from "@/server/duel/room";
import { socialJson } from "@/server/social/route";

// Комната для живого боя с другом (docs/specs/duels.md §6): POST {mode, topic?, lv, deckTag} →
// {code, url:"/duel/r/<код>", matchId, expiresAt}. Хозяин ждёт друга опросом GET /api/duel/m/[id] (2 с).

export const maxDuration = 10;

export async function POST(req: Request) {
  return duelRoute(req, "duel.room", async (ctx) => {
    const body = await bodyOf(req);
    if (!body.ok) return body.res;
    const { mode, topic, deckTag } = body.value;
    if (!isDuelMode(mode)) return socialJson({ error: "bad_mode" }, 400);
    if (DUEL_MODES[mode].needsTopic && !isDuelTopic(topic)) return socialJson({ error: "bad_topic" }, 400);
    if (!deckTagOk(deckTag)) return updateNeeded();
    if (await createLimited(ctx.kv, req, ctx.pid, ctx.now)) return socialJson({ error: "rate_limited" }, 429);
    const room = await createRoom(
      ctx.kv,
      { pid: ctx.pid, lv: levelOf(body.value.lv) },
      { mode, ...(DUEL_MODES[mode].needsTopic ? { topic: topic as string } : {}), deckTag: DECK_TAG },
      ctx.now,
    );
    return socialJson({ ...room, url: roomPath(room.code) });
  });
}
