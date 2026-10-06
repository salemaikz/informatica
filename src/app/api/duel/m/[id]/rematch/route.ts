import { matchAction } from "@/server/duel/actions";

// Реванш: оба согласились за 20 с — новый матч, его место в view.rematch.next (новое сердечко). POST → MatchView.

export const maxDuration = 10;

export async function POST(req: Request, ctx: RouteContext<"/api/duel/m/[id]/rematch">) {
  return matchAction(req, (await ctx.params).id, "rematch");
}
