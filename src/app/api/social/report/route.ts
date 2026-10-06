import { matchKey } from "@/server/duel/match";
import { readSeat, SEAT_HEADER } from "@/server/duel/seat";
import { pidOfCode } from "@/server/social/friends";
import { badRequest, objectBody, rateLimited } from "@/server/social/http";
import { overIpLimit, overLimit, SOCIAL_RATE } from "@/server/social/limit";
import { isReportReason, isReportWhere, reportPlayer } from "@/server/social/report";
import { noPlayer, socialJson, socialRoute } from "@/server/social/route";

// Жалоба на игрока (docs/specs/duels.md §7): без свободного текста. 3 разных жалобы на имя за 30 дней → имя скрыто у всех
// до решения владельца. Лимит — 10 в сутки на игрока и 40 на IP.
//   POST { code, reason: "name" | "cheat" | "other", where, matchId? } → { ok: true }
// Живой матч (Ф4): заголовок x-duel-seat (подписанное место) + { matchId, reason, where } — адресата сервер находит сам:
// место проверено подписью, принадлежит этому игроку и этому матчу, цель — pid другой стороны (HGET du:m:{id} a|b).
// Код из тела в этой ветке игнорируется: у случайного соперника клиенту приходит только «~метка», pid клиенту не доверяем.

export const maxDuration = 10;
const BODY_MAX = 512;
const MATCH_RE = /^[A-Za-z0-9_.-]{1,64}$/;

export async function POST(req: Request) {
  return socialRoute(req, "report", async (ctx) => {
    if (!ctx.pid) return noPlayer();
    const body = await objectBody(req, BODY_MAX);
    if (!body.ok) return body.res;
    const { code, reason, where, matchId } = body.value;
    if (!isReportReason(reason) || !isReportWhere(where)) return badRequest();
    if (matchId !== undefined && (typeof matchId !== "string" || !MATCH_RE.test(matchId))) return badRequest();
    const live = req.headers.has(SEAT_HEADER);
    // Место в живом матче: подпись, этот игрок, этот матч — иначе 400 (ничего не пишем).
    const seat = live ? readSeat(req, ctx.secret) : null;
    if (live && (!seat || typeof matchId !== "string" || seat.m !== matchId || seat.pid !== ctx.pid)) return badRequest();
    if (!live && typeof code !== "string") return badRequest();
    if (await overLimit(ctx.kv, `rep:${ctx.pid}`, SOCIAL_RATE.reportPid, ctx.now)) return rateLimited();
    if (await overIpLimit(ctx.kv, req, "rep-ip", SOCIAL_RATE.reportIp, ctx.now)) return rateLimited();
    const target = seat ? await ctx.kv.hget(matchKey(seat.m), seat.s === "a" ? "b" : "a") : await pidOfCode(ctx.kv, code as string);
    // Нет такого игрока (матч истёк) или жалоба на себя — отвечаем так же (ничего не раскрываем, ничего не пишем).
    if (target && target !== ctx.pid) {
      await reportPlayer(ctx.kv, { target, reporter: ctx.pid, reason, where, ...(typeof matchId === "string" ? { matchId } : {}) }, ctx.now);
    }
    return socialJson({ ok: true });
  });
}
