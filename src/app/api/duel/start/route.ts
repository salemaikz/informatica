import { DECK_TAG } from "@/lib/duel/deck";
import { rateLimit } from "@/server/rate-limit";
import { bandForLevel, issueStart, parseStartInput } from "@/server/duel/challenge";
import { badRequest, objectBody, rateLimited } from "@/server/social/http";
import { noPlayer, socialJson, socialRoute } from "@/server/social/route";

// Подписанный старт одиночной игры — записи вызова другу (docs/specs/duels.md §5–§6, Ф3). 0 команд Redis: всё, чтобы потом
// пересобрать набор и проверить ответы, — в подписи (seat.ts). Задания клиент берёт тем же GET /api/duel/deck по seed.
//   POST { mode, topic?, lv, deckTag } → { start, mode, seed, band, n, topic?, deckTag, startAt, endsAt }
// Другая сборка (тег набора не совпал) — 409 stale: «Обнови страницу».

export const maxDuration = 10;
const BODY_MAX = 512;

export async function POST(req: Request) {
  return socialRoute(req, "duel.start", async (ctx) => {
    if (!ctx.pid) return noPlayer();
    const body = await objectBody(req, BODY_MAX);
    if (!body.ok) return body.res;
    const input = parseStartInput(body.value);
    if (!input) return badRequest();
    if (input.deckTag !== DECK_TAG) return socialJson({ error: "stale" }, 409);
    // Процессный лимит (0 команд Redis): старт без записи ничего не стоит хранилищу.
    if (!rateLimit(`duel-start:${ctx.pid}`, 30, 10 * 60_000)) return rateLimited();
    return socialJson(issueStart(ctx.pid, { mode: input.mode, topic: input.topic, band: bandForLevel(input.lv) }, ctx.now));
  });
}
