import { pidOfCode } from "@/server/social/friends";
import { badRequest, objectBody, rateLimited } from "@/server/social/http";
import { overIpLimit, overLimit, SOCIAL_RATE } from "@/server/social/limit";
import { isReportReason, isReportWhere, reportPlayer } from "@/server/social/report";
import { noPlayer, socialJson, socialRoute } from "@/server/social/route";

// Жалоба на игрока (docs/specs/duels.md §7): без свободного текста. 3 разных жалобы на имя за 30 дней → имя скрыто у всех
// до решения владельца. Лимит — 10 в сутки на игрока и 40 на IP.
//   POST { code, reason: "name" | "cheat" | "other", where, matchId? } → { ok: true }

export const maxDuration = 10;
const BODY_MAX = 512;
const MATCH_RE = /^[A-Za-z0-9_.-]{1,64}$/;

export async function POST(req: Request) {
  return socialRoute(req, "report", async (ctx) => {
    if (!ctx.pid) return noPlayer();
    const body = await objectBody(req, BODY_MAX);
    if (!body.ok) return body.res;
    const { code, reason, where, matchId } = body.value;
    if (typeof code !== "string" || !isReportReason(reason) || !isReportWhere(where)) return badRequest();
    if (matchId !== undefined && (typeof matchId !== "string" || !MATCH_RE.test(matchId))) return badRequest();
    if (await overLimit(ctx.kv, `rep:${ctx.pid}`, SOCIAL_RATE.reportPid, ctx.now)) return rateLimited();
    if (await overIpLimit(ctx.kv, req, "rep-ip", SOCIAL_RATE.reportIp, ctx.now)) return rateLimited();
    const target = await pidOfCode(ctx.kv, code);
    // Нет такого игрока или жалоба на себя — отвечаем так же (ничего не раскрываем, ничего не пишем).
    if (target && target !== ctx.pid) {
      await reportPlayer(ctx.kv, { target, reporter: ctx.pid, reason, where, ...(typeof matchId === "string" ? { matchId } : {}) }, ctx.now);
    }
    return socialJson({ ok: true });
  });
}
