import { loadHome } from "@/server/social/player";
import { socialJson, socialRoute } from "@/server/social/route";

// Главная соцчасти (docs/specs/duels.md §6): профиль + входящие + число заявок в друзья — 3 команды Redis.
//   GET → { player: MyProfile | null, inbox: unknown[], requests: number }
// Опрашивается хабом раз в 30 с только на видимой вкладке (клиент), поэтому без лимита по IP.

export const maxDuration = 10;

export async function GET(req: Request) {
  return socialRoute(req, "home", async (ctx) => {
    if (!ctx.pid) return socialJson({ player: null, inbox: [], requests: 0 });
    return socialJson(await loadHome(ctx.kv, ctx.pid));
  });
}
