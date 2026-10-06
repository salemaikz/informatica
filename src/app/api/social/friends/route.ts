import { friendLists } from "@/server/social/friends";
import { noPlayer, socialJson, socialRoute } from "@/server/social/route";

// Друзья, входящие заявки и заблокированные (docs/specs/duels.md §9, экран /duel/friends) — 4 команды Redis.
//   GET → { friends: PublicCard[], requests: PublicCard[], blocked: PublicCard[] }

export const maxDuration = 10;

export async function GET(req: Request) {
  return socialRoute(req, "friends.list", async (ctx) => {
    if (!ctx.pid) return noPlayer();
    return socialJson(await friendLists(ctx.kv, ctx.pid));
  });
}
