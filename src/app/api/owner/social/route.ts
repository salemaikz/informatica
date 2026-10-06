import { serverNow } from "@/server/clock";
import { sameOrigin } from "@/server/context";
import { OWNER_COOKIE, ownerSecret, verifyOwnerCookie } from "@/server/owner-auth";
import { readJsonBody } from "@/server/body";
import { cookieValues } from "@/server/signed-id";
import { countingKv, getSocialKv, socialEnabled } from "@/server/social/kv";
import { normalizeFriendCode } from "@/server/social/code";
import { keys } from "@/server/social/player";
import { listCases, moderate } from "@/server/social/report";

// Жалобы на игроков для владельца (docs/specs/duels.md §7, Ф3). Только с cookie владельца (inf_owner, решение #69);
// нет OWNER_SECRET — 404, как у /owner. Соцчасть выключена — 503.
//   GET  → { cases: ModCase[] }   (открытые жалобы, сгруппированы по игроку; настоящее имя видит только владелец)
//   POST { code, action: "allow" | "hide" } → { ok: true } | 404 not_found

export const maxDuration = 10;

function ownerOk(req: Request): boolean {
  const secret = ownerSecret();
  return !!secret && cookieValues(req, OWNER_COOKIE).some((v) => verifyOwnerCookie(v, secret, Date.now()));
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  if (!ownerSecret()) return new Response(null, { status: 404 });
  if (!ownerOk(req)) return json({ error: "unauthorized" }, 401);
  if (!socialEnabled()) return json({ error: "social_disabled" }, 503);
  const kv = countingKv(getSocialKv());
  try {
    const cases = await listCases(kv);
    return json({ cases });
  } catch (e) {
    console.error("[social] route=owner.social kv error", e instanceof Error ? e.message : e);
    return json({ error: "social_unavailable" }, 503);
  } finally {
    console.info(`[social] route=owner.social pid=owner cmds=${kv.cmds()}`);
  }
}

export async function POST(req: Request) {
  if (!ownerSecret()) return new Response(null, { status: 404 });
  if (!sameOrigin(req)) return json({ error: "forbidden_origin" }, 403);
  if (!ownerOk(req)) return json({ error: "unauthorized" }, 401);
  if (!socialEnabled()) return json({ error: "social_disabled" }, 503);
  const body = await readJsonBody(req, 512);
  if (!body.ok) return json({ error: body.error }, body.status);
  const o = (body.value && typeof body.value === "object" ? body.value : {}) as Record<string, unknown>;
  const code = typeof o.code === "string" ? normalizeFriendCode(o.code) : null;
  if (!code || (o.action !== "allow" && o.action !== "hide")) return json({ error: "bad_request" }, 400);
  const kv = countingKv(getSocialKv());
  try {
    const pid = await kv.getStr(keys.code(code));
    if (!pid || !(await moderate(kv, pid, o.action, serverNow()))) return json({ error: "not_found" }, 404);
    return json({ ok: true });
  } catch (e) {
    console.error("[social] route=owner.social.post kv error", e instanceof Error ? e.message : e);
    return json({ error: "social_unavailable" }, 503);
  } finally {
    console.info(`[social] route=owner.social.post pid=owner cmds=${kv.cmds()}`);
  }
}
