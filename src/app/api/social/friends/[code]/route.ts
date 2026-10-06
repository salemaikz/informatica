import { pidOfCode, removeFriend } from "@/server/social/friends";
import { rateLimited } from "@/server/social/http";
import { overLimit, SOCIAL_RATE } from "@/server/social/limit";
import { noPlayer, socialJson, socialRoute } from "@/server/social/route";

// Убрать из друзей (docs/specs/duels.md §6): с обеих сторон, второго не уведомляем.
//   DELETE /api/social/friends/<код> → { ok: true } (нет такого кода — тоже ok: результат тот же)

export const maxDuration = 10;

export async function DELETE(req: Request, ctx: RouteContext<"/api/social/friends/[code]">) {
  const { code } = await ctx.params;
  return socialRoute(req, "friends.delete", async (c) => {
    if (!c.pid) return noPlayer();
    if (await overLimit(c.kv, `frm:${c.pid}`, SOCIAL_RATE.mutatePid, c.now)) return rateLimited();
    const other = await pidOfCode(c.kv, code);
    if (other && other !== c.pid) await removeFriend(c.kv, c.pid, other);
    return socialJson({ ok: true });
  });
}
