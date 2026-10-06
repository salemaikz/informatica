import { matchAction } from "@/server/duel/actions";

// Готовность к старту (до 6 с от создания матча): POST → MatchView. Не подтвердил вовремя — матч отменён, сердечко не списано.

export const maxDuration = 10;

export async function POST(req: Request, ctx: RouteContext<"/api/duel/m/[id]/ready">) {
  return matchAction(req, (await ctx.params).id, "ready");
}
