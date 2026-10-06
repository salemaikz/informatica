import { ipHash } from "@/server/ip-hash";
import { rateLimit } from "@/server/rate-limit";
import { viewChallenge } from "@/server/duel/challenge";
import { rateLimited } from "@/server/social/http";
import { socialJson, socialRoute } from "@/server/social/route";

// Публичная карточка вызова (docs/specs/duels.md §6): кто вызывает (имя после фильтра, уровень, рамка, титул), режим, результат.
// Открыть может и тот, у кого ещё нет профиля игрока. Автор вызова видит ещё и итоги принявших.
//   GET → ChallengeView | 404 not_found | 429
// Открыт всем (и без профиля) — поэтому процессный лимит по хешу IP (0 команд Redis): скрипт по ссылке не сожжёт бюджет.

export const maxDuration = 10;
const VIEW_LIMIT = 60;
const VIEW_WINDOW_MS = 10 * 60_000;

export async function GET(req: Request, ctx: RouteContext<"/api/duel/challenge/[id]">) {
  const { id } = await ctx.params;
  return socialRoute(req, "duel.challenge.view", async (c) => {
    if (!rateLimit(`duel-ch-view:${ipHash(req)}`, VIEW_LIMIT, VIEW_WINDOW_MS)) return rateLimited();
    const view = await viewChallenge(c.kv, id, c.pid);
    return view ? socialJson(view) : socialJson({ error: "not_found" }, 404);
  });
}
