import { inviteInfo } from "@/server/social/friends";
import { socialJson, socialRoute } from "@/server/social/route";

// Кто приглашает по ссылке /f/<token> (только чтение: GET ничего не меняет — превью мессенджера никого не добавит).
//   GET → { from: PublicCard } | 404 { error: "expired" }

export const maxDuration = 10;

export async function GET(req: Request, ctx: RouteContext<"/api/social/invite-link/[token]">) {
  const { token } = await ctx.params;
  return socialRoute(req, "invite.view", async (c) => {
    const info = await inviteInfo(c.kv, token);
    if (!info) return socialJson({ error: "expired" }, 404);
    return socialJson({ from: info.card, self: info.pid === c.pid });
  });
}
