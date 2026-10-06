import { matchAction } from "@/server/duel/actions";

// «Доиграл» (кончились часы или задания): POST → MatchView; оба доиграли — матч завершается сразу.

export const maxDuration = 10;

export async function POST(req: Request, ctx: RouteContext<"/api/duel/m/[id]/done">) {
  return matchAction(req, (await ctx.params).id, "done");
}
