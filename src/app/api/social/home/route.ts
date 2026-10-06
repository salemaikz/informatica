import { resolveInbox } from "@/server/social/inbox";
import { loadHome } from "@/server/social/player";
import { socialJson, socialRoute } from "@/server/social/route";

// Главная соцчасти (docs/specs/duels.md §6): профиль + входящие (≤ 20) + число заявок в друзья — 3 команды Redis,
// + 1 MGET карточек авторов входящих (Ф3: имя автора всегда свежее, скрытое модерацией — скрыто).
//   GET → { player: MyProfile | null, inbox: unknown[], requests: number }
// Опрашивается хабом раз в 30 с только на видимой вкладке (клиент), поэтому без лимита по IP.

export const maxDuration = 10;

export async function GET(req: Request) {
  return socialRoute(req, "home", async (ctx) => {
    if (!ctx.pid) return socialJson({ player: null, inbox: [], requests: 0 });
    const home = await loadHome(ctx.kv, ctx.pid);
    return socialJson({ ...home, inbox: await resolveInbox(ctx.kv, home.inbox) });
  });
}
