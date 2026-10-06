import { matchAction } from "@/server/duel/actions";

// Вид живого матча (docs/specs/duels.md §5–§6): GET → MatchView. Опрос: лобби 2 с, в игре — только если 3 с ничего
// не отправлялось, итоги — 2 с до 15 с. Место — заголовок x-duel-seat (без него — по cookie игрока, без отметки «на связи»).

export const maxDuration = 10;

export async function GET(req: Request, ctx: RouteContext<"/api/duel/m/[id]">) {
  return matchAction(req, (await ctx.params).id, "view");
}
