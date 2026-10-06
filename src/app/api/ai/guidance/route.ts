import { STANDARD_INTENTS, type StandardIntent } from '@/lib/standard-guidance';
import { commonGuidance, GUIDANCE_VERSION } from '@/server/guidance';
import { clientIp, rateLimit } from '@/server/rate-limit';

/** Общая библиотека: никаких запросов к OpenAI и никакого персонального контекста. */
export async function POST(req: Request) {
  if (!rateLimit(`guidance:${clientIp(req)}`, 300, 10 * 60_000)) return Response.json({ error: 'rate_limited' }, { status: 429 });
  try {
    const raw = await req.text();
    if (raw.length > 2048) return Response.json({ error: 'too_large' }, { status: 413 });
    const body = JSON.parse(raw);
    if (typeof body?.stepId !== 'string' || body.stepId.length > 200 || !STANDARD_INTENTS.includes(body.intent) || !['ru', 'kk'].includes(body.lang)) return Response.json({ error: 'invalid_guidance' }, { status: 400 });
    const text = commonGuidance(body.stepId, body.lang, body.intent as StandardIntent, body.answered === true);
    if (!text) return Response.json({ error: 'unknown_step' }, { status: 404 });
    return Response.json({ text, source: 'library', version: GUIDANCE_VERSION });
  } catch { return Response.json({ error: 'bad_json' }, { status: 400 }); }
}
