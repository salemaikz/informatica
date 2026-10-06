import { rateLimit } from "@/server/rate-limit";
import { rateLimited } from "@/server/social/http";
import { noPlayer, socialJson, socialRoute } from "@/server/social/route";
import { friendsTop } from "@/server/social/tops";

// Топ друзей за неделю (docs/specs/duels.md §5): SMEMBERS + ZMSCORE + MGET = 3 команды. Клиент кэширует ответ 60 с
// (у каждого свой топ — кэш CDN не годится). Очки — только проверенные сервером результаты с людьми.
//   GET → { rows: { card, score: number | null, me?: true }[], week: "2026-W41", resetsAt }

export const maxDuration = 10;

export async function GET(req: Request) {
  return socialRoute(req, "top.friends", async (ctx) => {
    if (!ctx.pid) return noPlayer();
    // Процессный лимит (без команд Redis): обычный клиент читает раз в минуту.
    if (!rateLimit(`top:${ctx.pid}`, 30, 60_000)) return rateLimited();
    return socialJson(await friendsTop(ctx.kv, ctx.pid, ctx.now));
  });
}
