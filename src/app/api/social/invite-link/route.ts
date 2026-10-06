import { inviteLink } from "@/server/social/friends";
import { rateLimited } from "@/server/social/http";
import { overLimit, SOCIAL_RATE } from "@/server/social/limit";
import { noPlayer, socialJson, socialRoute } from "@/server/social/route";

// Ссылка-приглашение в друзья (docs/specs/duels.md §6): /f/<token>, 7 дней, до 30 добавлений. Живая ссылка переиспользуется.
//   POST → { url: "/f/<token>" }

export const maxDuration = 10;

export async function POST(req: Request) {
  return socialRoute(req, "invite.create", async (ctx) => {
    if (!ctx.pid) return noPlayer();
    if (await overLimit(ctx.kv, `inv:${ctx.pid}`, SOCIAL_RATE.invitePid, ctx.now)) return rateLimited();
    const token = await inviteLink(ctx.kv, ctx.pid);
    if (!token) return noPlayer();
    return socialJson({ url: `/f/${token}` });
  });
}
