import { advanceClock, clockHooksEnabled, clockOffset, resetClock, serverNow, setClockOffset } from "@/server/clock";
import { readJsonBody } from "@/server/body";
import { sameOrigin } from "@/server/context";

// Тестовый крючок часов для e2e (docs/specs/duels.md §6, §11): «перемотать» матч к итогам. Только при DUEL_TEST_HOOKS=1
// и никогда на Vercel (VERCEL=1) — иначе 404, как будто маршрута нет. POST {advanceMs} | {offsetMs} | {reset:true}.

export const maxDuration = 10;

const notFound = () => new Response(null, { status: 404 });

export async function POST(req: Request) {
  if (!clockHooksEnabled()) return notFound();
  if (!sameOrigin(req)) return Response.json({ error: "forbidden_origin" }, { status: 403 });
  const body = await readJsonBody(req, 256);
  if (!body.ok) return Response.json({ error: body.error }, { status: body.status });
  const v = (body.value ?? {}) as { advanceMs?: unknown; offsetMs?: unknown; reset?: unknown };
  if (v.reset === true) resetClock();
  else if (typeof v.advanceMs === "number") advanceClock(v.advanceMs);
  else if (typeof v.offsetMs === "number") setClockOffset(v.offsetMs);
  else return Response.json({ error: "bad_request" }, { status: 400 });
  return Response.json({ offsetMs: clockOffset(), now: serverNow() }, { headers: { "Cache-Control": "no-store" } });
}
