import { batchFields, EVENTS_TTL_SEC, eventsKey, totalsOnly } from "@/lib/analytics-fields";
import { EVENTS_BODY_MAX, EVENTS_FIELDS_DAY_MAX, EVENTS_IP_DAY_MAX, EVENTS_IP_LIMIT, EVENTS_SITE_DAY_MAX, parseEvents } from "@/lib/analytics-schema";
import { readBodyText } from "@/server/body";
import { sameOrigin } from "@/server/context";
import { ipHash } from "@/server/ip-hash";
import { getKv, kzDay } from "@/server/kv";
import { kvRateLimit } from "@/server/rate-limit";

// Обезличенная статистика (решение #69). Без ИИ и без ключей.
// Принимает пачку событий (до 30), проверяет по белому списку и прибавляет счётчики в суточный хеш `ev:<день>`.
// Событий, идентификаторов, IP и времени события в хранилище нет — только числа по полям (lib/analytics-fields.ts).
// Порядок защиты: выключено → origin → лимит по ХЕШУ IP (до чтения тела) → тело потоком, не больше 4000 байт →
// проверка → суточные потолки (IP и сайт) → запись. Ответ при успехе — 204 без тела.
// Выключено, пока не задано NEXT_PUBLIC_ANALYTICS=1: 204 и ничего не пишется (сбор включаем после обновления политики).

export const maxDuration = 10;

const fail = (status: number, code: string) => Response.json({ error: code }, { status });
const noContent = () => new Response(null, { status: 204 });

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_ANALYTICS !== "1") return noContent();
  if (!sameOrigin(req)) return fail(403, "forbidden_origin");

  // Лимит по хешу IP — до чтения тела: мусорные запросы тоже не должны гонять сервер. Сырой IP в ключ не попадает.
  const ip = ipHash(req);
  const kv = getKv();
  try {
    if (!(await kvRateLimit(`events:${ip}`, EVENTS_IP_LIMIT.limit, EVENTS_IP_LIMIT.windowMs))) return fail(429, "rate_limited");
  } catch (e) {
    // Хранилище недоступно — статистика не повод падать; но и писать некуда.
    console.error("[events] kv error", e instanceof Error ? e.message : e);
    return noContent();
  }

  // Тело читаем как текст (sendBeacon шлёт text/plain), размер ограничен.
  let raw: unknown;
  try {
    const text = await readBodyText(req, EVENTS_BODY_MAX);
    if (text === null) return fail(413, "too_large");
    raw = JSON.parse(text);
  } catch {
    return fail(400, "bad_json");
  }

  const events = parseEvents(raw);
  if (events.length === 0) return noContent();

  try {
    const day = kzDay();
    const [ipDay, siteDay, fieldsUsed] = await Promise.all([
      kv.incrBy(`ev-ip:${day}:${ip}`, events.length, 2 * 86_400),
      kv.incrBy(`ev-site:${day}`, events.length, 2 * 86_400),
      kv.get(`ev-fields:${day}`),
    ]);
    if (ipDay > EVENTS_IP_DAY_MAX || siteDay > EVENTS_SITE_DAY_MAX) return fail(429, "daily_limit");
    // Бюджет новых полей за сутки исчерпан (выдуманные id раздувают хеш) — пишем только счётчики событий.
    const all = batchFields(events);
    const created = await kv.hincrMany(eventsKey(day), fieldsUsed >= EVENTS_FIELDS_DAY_MAX ? totalsOnly(all) : all, EVENTS_TTL_SEC);
    if (created > 0) await kv.incrBy(`ev-fields:${day}`, created, 2 * 86_400);
  } catch (e) {
    console.error("[events] kv error", e instanceof Error ? e.message : e);
  }
  return noContent();
}
