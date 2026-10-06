import { acceptInvite } from "@/server/social/friends";
import { rateLimited } from "@/server/social/http";
import { overLimit, SOCIAL_RATE } from "@/server/social/limit";
import { noPlayer, socialJson, socialRoute } from "@/server/social/route";

// Добавиться в друзья по ссылке — только POST по кнопке «Добавить в друзья» (docs/specs/duels.md §1: GET ничего не меняет).
//   POST → { status: "accepted" | "already" | "self" | "expired" | "limit", friend?: PublicCard }
// Приглашающий заблокировал меня — «expired» (блокировку не раскрываем).

export const maxDuration = 10;

export async function POST(req: Request, ctx: RouteContext<"/api/social/invite-link/[token]/accept">) {
  const { token } = await ctx.params;
  return socialRoute(req, "invite.accept", async (c) => {
    if (!c.pid) return noPlayer();
    if (await overLimit(c.kv, `join:${c.pid}`, SOCIAL_RATE.joinPid, c.now)) return rateLimited();
    const res = await acceptInvite(c.kv, c.pid, token);
    if (!res) return noPlayer();
    return socialJson({ status: res.status, ...(res.card ? { friend: res.card } : {}) });
  });
}
