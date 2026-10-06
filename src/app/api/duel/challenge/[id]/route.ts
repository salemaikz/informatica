import { viewChallenge } from "@/server/duel/challenge";
import { socialJson, socialRoute } from "@/server/social/route";

// Публичная карточка вызова (docs/specs/duels.md §6): кто вызывает (имя после фильтра, уровень, рамка, титул), режим, результат.
// Открыть может и тот, у кого ещё нет профиля игрока. Автор вызова видит ещё и итоги принявших.
//   GET → ChallengeView | 404 not_found

export const maxDuration = 10;

export async function GET(req: Request, ctx: RouteContext<"/api/duel/challenge/[id]">) {
  const { id } = await ctx.params;
  return socialRoute(req, "duel.challenge.view", async (c) => {
    const view = await viewChallenge(c.kv, id, c.pid);
    return view ? socialJson(view) : socialJson({ error: "not_found" }, 404);
  });
}
