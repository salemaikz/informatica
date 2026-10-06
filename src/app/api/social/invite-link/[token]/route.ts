import { ipHash } from "@/server/ip-hash";
import { rateLimit } from "@/server/rate-limit";
import { inviteView } from "@/server/social/friends";
import { rateLimited } from "@/server/social/http";
import { socialJson, socialRoute } from "@/server/social/route";

// Кто приглашает по ссылке /f/<token> (только чтение: GET ничего не меняет — превью мессенджера никого не добавит).
//   GET → { from: PublicCard, self } | 404 { error: "expired" } | 429
// Приглашающий заблокировал смотрящего — тоже 404 expired (как и POST: блокировку не раскрываем). Лимит — процессный по хешу IP.

export const maxDuration = 10;
const VIEW_LIMIT = 60;
const VIEW_WINDOW_MS = 10 * 60_000;

export async function GET(req: Request, ctx: RouteContext<"/api/social/invite-link/[token]">) {
  const { token } = await ctx.params;
  return socialRoute(req, "invite.view", async (c) => {
    if (!rateLimit(`invite-view:${ipHash(req)}`, VIEW_LIMIT, VIEW_WINDOW_MS)) return rateLimited();
    const info = await inviteView(c.kv, token, c.pid);
    if (!info) return socialJson({ error: "expired" }, 404);
    return socialJson({ from: info.card, self: info.pid === c.pid });
  });
}
