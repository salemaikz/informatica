import { matchKey } from "@/server/duel/match";
import { readSeat, SEAT_HEADER } from "@/server/duel/seat";
import { blockPlayer, pidOfCode } from "@/server/social/friends";
import { badRequest, objectBody, rateLimited } from "@/server/social/http";
import { overLimit, SOCIAL_RATE } from "@/server/social/limit";
import { keys } from "@/server/social/player";
import { noPlayer, socialJson, socialRoute } from "@/server/social/route";

// Блокировка (docs/specs/duels.md §7): заблокированный не может прислать заявку, добавиться по ссылке или принять вызов,
// подбор их не сводит; дружба и заявки с обеих сторон снимаются. Разблокировать — { code, off: true }.
//   POST { code, off?: boolean } → { ok: true }
// Живой матч (как жалоба): заголовок x-duel-seat (подписанное место) + { matchId } — цель сервер находит сам (место проверено
// подписью, принадлежит этому игроку и этому матчу; цель — pid другой стороны). Код из тела игнорируется: у случайного
// соперника клиенту приходит только «~метка». Такой блок в списке «Заблокированные» не виден (кода друга ученик не знает).

export const maxDuration = 10;
const BODY_MAX = 512;
const MATCH_RE = /^[A-Za-z0-9_.-]{1,64}$/;

export async function POST(req: Request) {
  return socialRoute(req, "block", async (ctx) => {
    if (!ctx.pid) return noPlayer();
    const body = await objectBody(req, BODY_MAX);
    if (!body.ok) return body.res;
    const { code, off, matchId } = body.value;
    const live = req.headers.has(SEAT_HEADER);
    if (live) {
      const seat = readSeat(req, ctx.secret);
      if (!seat || typeof matchId !== "string" || !MATCH_RE.test(matchId) || seat.m !== matchId || seat.pid !== ctx.pid || off !== undefined) return badRequest();
      if (await overLimit(ctx.kv, `frm:${ctx.pid}`, SOCIAL_RATE.mutatePid, ctx.now)) return rateLimited();
      const other = await ctx.kv.hget(matchKey(seat.m), seat.s === "a" ? "b" : "a");
      // Матч истёк или цель — сам игрок: ответ тот же, ничего не пишем. Случайным соперником оказался друг (его код ученик
      // знает) — обычный блок, виден в списке и снимается; незнакомец — скрытый.
      if (other && other !== ctx.pid) {
        const friend = await ctx.kv.sismember(keys.friends(ctx.pid), other);
        await blockPlayer(ctx.kv, ctx.pid, other, true, !friend);
      }
      return socialJson({ ok: true });
    }
    if (typeof code !== "string" || (off !== undefined && typeof off !== "boolean")) return badRequest();
    if (await overLimit(ctx.kv, `frm:${ctx.pid}`, SOCIAL_RATE.mutatePid, ctx.now)) return rateLimited();
    const other = await pidOfCode(ctx.kv, code);
    if (other && other !== ctx.pid) await blockPlayer(ctx.kv, ctx.pid, other, off !== true);
    return socialJson({ ok: true });
  });
}
