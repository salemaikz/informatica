import "server-only";
import { DECK_TAG } from "@/lib/duel/deck";
import { LATE_GRACE_MS } from "@/lib/duel/modes";
import type { AnswerIn } from "@/lib/duel/types";
import { socialJson } from "@/server/social/route";
import { bodyOf, duelRoute, seatFor, tag6, updateNeeded, type DuelCtx } from "./http";
import {
  MATCH_ID_RE,
  READY_MS,
  START_MS,
  createRematch,
  judgeBatch,
  matchKey,
  parseMatch,
  phaseOf,
  rematchDue,
  seatWritable,
  settled,
  sideFor,
  viewFor,
  withAnswers,
  type MatchData,
} from "./match";
import type { SeatClaims, SeatSide } from "./seat";
import { withinWindow } from "./seat";

// Действия с живым матчем (docs/specs/duels.md §6): GET вид, POST ready / answers / done / leave / rematch.
// Кто я в матче — по подписанному месту (x-duel-seat) или, без места (хозяин комнаты до входа друга), по cookie игрока.
// Запись по месту идёт без предварительного чтения (ключ матча точно жив: seatWritable); отметка «на связи» (_seen) —
// при каждом запросе по месту. Каждый ответ клиенту несёт MatchView (опрос «на попутке»); лениво завершает матч тот,
// кто первым увидел конец (match.ts → settled).

export type MatchAction = "view" | "ready" | "answers" | "done" | "leave" | "rematch";

const notFound = () => socialJson({ error: "not_found" }, 404);

/** Прочитать матч (с отметками стороны по месту одним конвейером). null — нет матча или я не участник. */
async function load(
  ctx: DuelCtx,
  id: string,
  seat: SeatClaims | null,
  marks: Record<string, string | number>,
  nx?: { field: string; value: number },
): Promise<{ m: MatchData; side: SeatSide } | null> {
  const key = matchKey(id);
  let h: Record<string, string>;
  if (seat && seatWritable(seat, ctx.now)) {
    const ops = [
      ...(nx ? [{ op: "hsetnx" as const, key, field: nx.field, value: nx.value }] : []),
      { op: "hset" as const, key, fields: { [`${seat.s}_seen`]: ctx.now, ...marks } },
      { op: "hgetAllStr" as const, key },
    ];
    const res = await ctx.kv.pipeline(ops);
    h = res[res.length - 1] as Record<string, string>;
  } else {
    h = await ctx.kv.hgetAllStr(key);
  }
  const m = parseMatch(id, h);
  if (!m) return null;
  const side = sideFor(m, ctx.pid);
  if (!side || (seat && seat.s !== side)) return null;
  return { m, side };
}

const viewRes = (ctx: DuelCtx, m: MatchData, side: SeatSide, extra?: Record<string, unknown>, mine = false) => {
  const view = viewFor(m, side, ctx.now, ctx.secret, mine);
  return socialJson(extra ? { view, ...extra } : view);
};

export function matchAction(req: Request, id: string, action: MatchAction): Promise<Response> {
  return duelRoute(req, `duel.${action} m=${tag6(id)}`, async (ctx) => {
    if (!MATCH_ID_RE.test(id)) return notFound();
    const seat = seatFor(req, ctx, id);
    // Набор другой сборки: сервер не сможет проверить ответы этого места.
    if (seat && seat.deckTag !== DECK_TAG && action === "answers") return updateNeeded();
    const now = ctx.now;
    switch (action) {
      case "view": {
        const got = await load(ctx, id, seat, {});
        if (!got) return notFound();
        const mine = new URL(req.url).searchParams.get("me") === "1";
        return viewRes(ctx, await settled(ctx.kv, got.m, now), got.side, undefined, mine);
      }
      case "ready": {
        if (!seat) return socialJson({ error: "no_seat" }, 403);
        // Готовность принимаем до срока (6 с от создания): позже матч уже отменён.
        const before = now < seat.startAt - (START_MS - READY_MS);
        const got = await load(ctx, id, seat, before ? { [`${seat.s}_rdy`]: now } : {});
        if (!got) return notFound();
        return viewRes(ctx, got.m, got.side);
      }
      case "answers": {
        if (!seat) return socialJson({ error: "no_seat" }, 403);
        const body = await bodyOf(req);
        if (!body.ok) return body.res;
        const list = body.value.answers;
        if (!Array.isArray(list) || list.length > 5) return socialJson({ error: "bad_request" }, 400);
        const got = await load(ctx, id, seat, {});
        if (!got) return notFound();
        let m = got.m;
        let accepted: { i: number; ok: boolean }[] = [];
        if (withinWindow(seat, now, LATE_GRACE_MS) && phaseOf(m, now).state === "playing" && !m.res) {
          const batch = judgeBatch(m, got.side, list as AnswerIn[], now);
          if (batch.ops.length) {
            const wrote = (await ctx.kv.pipeline(batch.ops)) as boolean[];
            m = withAnswers(m, got.side, batch.accepted, wrote);
            accepted = batch.accepted.filter((_, k) => wrote[k]).map((j) => ({ i: j.i, ok: j.ok }));
          }
        }
        return viewRes(ctx, await settled(ctx.kv, m, now), got.side, { accepted });
      }
      case "done": {
        if (!seat) return socialJson({ error: "no_seat" }, 403);
        const got = await load(ctx, id, seat, now >= seat.startAt ? { [`${seat.s}_done`]: now } : {});
        if (!got) return notFound();
        return viewRes(ctx, await settled(ctx.kv, got.m, now), got.side);
      }
      case "leave": {
        if (seat) {
          // Первое время выхода сохраняется (HSETNX): до старта — отмена, после — поражение.
          const got = await load(ctx, id, seat, {}, { field: `${seat.s}_left`, value: now });
          if (!got) return notFound();
          const m = got.m;
          const side = got.side;
          const mine = side === "a" ? m.a : m.b;
          const marked = mine && !mine.left ? (side === "a" ? { ...m, a: { ...m.a, left: now } } : { ...m, b: { ...mine, left: now } }) : m;
          return viewRes(ctx, await settled(ctx.kv, marked, now), side);
        }
        // Хозяин комнаты до входа друга (места ещё нет): закрыть комнату.
        const got = await load(ctx, id, null, {});
        if (!got) return notFound();
        if (got.side === "a" && !got.m.b) {
          await ctx.kv.hsetnx(matchKey(id), "a_left", now);
          return viewRes(ctx, { ...got.m, a: { ...got.m.a, left: now } }, "a");
        }
        return viewRes(ctx, got.m, got.side);
      }
      case "rematch": {
        if (!seat) return socialJson({ error: "no_seat" }, 403);
        const got = await load(ctx, id, seat, { [`${seat.s}_rm`]: now });
        if (!got) return notFound();
        let m = got.m;
        if (rematchDue(m, now)) m = await createRematch(ctx.kv, m, now);
        return viewRes(ctx, m, got.side);
      }
    }
  });
}
