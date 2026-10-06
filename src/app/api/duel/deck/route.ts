import { randomInt } from "node:crypto";
import type { NextRequest } from "next/server";
import { buildDeck, DECK_TAG } from "@/lib/duel/deck";
import { DUEL_MODES, isDuelBand, isDuelMode } from "@/lib/duel/modes";
import { isDuelTopic } from "@/lib/duel/topics";
import type { DuelDeckResponse } from "@/lib/duel/api";

// Набор заданий дуэли с ботом (этап 16Д, Ф1; docs/specs/duels.md §5). Набор собирает сервер: deck.ts тянет весь банк,
// в клиентский бандл он не попадает. Ответ — задания вместе с верными ответами: для матча с ботом это допустимо (§3,
// seed и так у клиента; топа у бота нет). Без ИИ, секретов и записи в хранилище; одинаковые параметры — одинаковый
// ответ, поэтому с seed ответ кэшируется.
//   GET /api/duel/deck?mode=blitz|truth|ten|topic&band=1..4&seed=<uint32>&topic=<тема для mode=topic>
//   → { mode, band, seed, topic?, deckTag, items: DuelItem[] }; без seed сервер выбирает его сам (no-store).
// Ошибки: 400 bad_mode / bad_band / bad_seed / bad_topic; 503 deck_short — банк не набрал задания (не должно случаться).

export const maxDuration = 10;

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

const UINT32_MAX = 0xffff_ffff;

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("mode");
  if (!isDuelMode(mode)) return fail(400, "bad_mode");
  const band = Number(sp.get("band"));
  if (!isDuelBand(band)) return fail(400, "bad_band");
  const meta = DUEL_MODES[mode];
  let topic: string | undefined;
  if (meta.needsTopic) {
    const raw = sp.get("topic");
    if (!isDuelTopic(raw)) return fail(400, "bad_topic");
    topic = raw;
  }
  const rawSeed = sp.get("seed");
  let seed: number;
  if (rawSeed === null || rawSeed === "") seed = randomInt(0, UINT32_MAX);
  else if (/^\d{1,10}$/.test(rawSeed) && Number(rawSeed) <= UINT32_MAX) seed = Number(rawSeed);
  else return fail(400, "bad_seed");

  const items = buildDeck(mode, seed, band, topic);
  if (items.length !== meta.n) {
    console.error(`[duel] deck_short mode=${mode} band=${band} topic=${topic ?? "-"} n=${items.length}`);
    return fail(503, "deck_short");
  }
  const body: DuelDeckResponse = { mode, band, seed, deckTag: DECK_TAG, items, ...(topic ? { topic } : {}) };
  // Детерминированный ответ: при заданном seed — кэшируем (браузер час, CDN сутки); новый seed — не кэшируем.
  const cache = rawSeed ? "public, max-age=3600, s-maxage=86400" : "no-store";
  return Response.json(body, { headers: { "Cache-Control": cache } });
}
