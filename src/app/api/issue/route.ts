import { ISSUE_ANY_LIMIT, ISSUE_CHANNELS, ISSUE_DAY_MAX, ISSUE_LIMITS, issueChannel, parseIssue } from "@/lib/issue";
import { readBodyText } from "@/server/body";
import { sameOrigin } from "@/server/context";
import { getKv, kzDay } from "@/server/kv";
import { clientIp, kvRateLimit } from "@/server/rate-limit";

// «Сообщить об ошибке» и ошибки с телефонов. Без ИИ и без ключей.
// Сохраняем строку в лог (`[issue] {json}`) и в общий список хранилища. Ни IP, ни имени, ни id устройства.
// Порядок защиты: origin → общий лимит по IP (до чтения тела) → тело потоком, не больше 8000 байт →
// лимит потока (жалобы / ошибки клиента) → разбор → суточный потолок на весь сайт → запись.
// Счётчики — в общем хранилище (server/kv.ts): лимиты общие для всех копий сервера.

export const maxDuration = 10;

const fail = (status: number, code: string) => Response.json({ error: code }, { status });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "forbidden_origin");

  // Общий лимит по IP — до чтения тела: мусорные запросы тоже не должны гонять сервер.
  const ip = clientIp(req);
  if (!(await kvRateLimit(`issue:any:${ip}`, ISSUE_ANY_LIMIT.limit, ISSUE_ANY_LIMIT.windowMs))) return fail(429, "rate_limited");

  // Тело читаем как текст (sendBeacon шлёт text/plain), размер ограничен.
  let raw: unknown;
  try {
    const text = await readBodyText(req, ISSUE_LIMITS.body);
    if (text === null) return fail(413, "too_large");
    raw = JSON.parse(text);
  } catch {
    return fail(400, "bad_json");
  }

  // Лимит потока зависит от типа, а тип — из тела, поэтому он после разбора JSON.
  const channel = issueChannel(raw);
  if (!channel) return fail(400, "bad_type");
  const limit = ISSUE_CHANNELS[channel];
  if (!(await kvRateLimit(`issue:${channel}:${ip}`, limit.limit, limit.windowMs))) return fail(429, "rate_limited");

  const parsed = parseIssue(raw, {
    now: Date.now(),
    version: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "dev",
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!parsed.ok) return fail(400, parsed.code);

  // Суточный потолок на весь сайт (жалобы и ошибки клиента — отдельно): список в хранилище не должен раздуваться
  // и логи не должны заливаться, даже если нападающих много и у каждого свой IP.
  const today = await getKv().incrBy(`issue-day:${kzDay()}:${channel}`, 1, 2 * 86_400);
  if (today > ISSUE_DAY_MAX) return fail(429, "daily_limit");

  const json = JSON.stringify(parsed.record);
  console.log(`[issue] ${json}`);
  try {
    await getKv().pushCapped(limit.list, json, limit.max);
  } catch (e) {
    // Строка в логе уже есть — ученику отвечаем «принято».
    console.error("[issue] kv error", e instanceof Error ? e.message : e);
  }
  return Response.json({ ok: true });
}
