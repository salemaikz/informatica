import { matchAction } from "@/server/duel/actions";

// Выход: до старта — отмена матча, после — поражение (§3). POST → MatchView.

export const maxDuration = 10;

export async function POST(req: Request, ctx: RouteContext<"/api/duel/m/[id]/leave">) {
  return matchAction(req, (await ctx.params).id, "leave");
}
