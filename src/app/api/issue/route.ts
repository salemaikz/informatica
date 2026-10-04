import { ISSUE_CHANNELS, ISSUE_LIMITS, issueChannel, parseIssue } from "@/lib/issue";
import { sameOrigin } from "@/server/context";
import { getKv } from "@/server/kv";
import { clientIp, rateLimit } from "@/server/rate-limit";

// «Сообщить об ошибке» и ошибки с телефонов. Без ИИ и без ключей.
// Сохраняем строку в лог (`[issue] {json}`) и в общий список хранилища. Ни IP, ни имени, ни id устройства.

export const maxDuration = 10;

const fail = (status: number, code: string) => Response.json({ error: code }, { status });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "forbidden_origin");
  // Тело читаем как текст (sendBeacon шлёт text/plain), размер ограничен.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > ISSUE_LIMITS.body) return fail(413, "too_large");

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > ISSUE_LIMITS.body) return fail(413, "too_large");
    raw = JSON.parse(text);
  } catch {
    return fail(400, "bad_json");
  }

  // Лимит зависит от потока (жалобы / ошибки клиента), а поток — из тела, поэтому лимит после разбора JSON.
  const channel = issueChannel(raw);
  if (!channel) return fail(400, "bad_type");
  const limit = ISSUE_CHANNELS[channel];
  if (!rateLimit(`issue:${channel}:${clientIp(req)}`, limit.limit, limit.windowMs)) return fail(429, "rate_limited");

  const parsed = parseIssue(raw, {
    now: Date.now(),
    version: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "dev",
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!parsed.ok) return fail(400, parsed.code);

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
