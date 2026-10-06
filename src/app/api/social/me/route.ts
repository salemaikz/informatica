import { readJsonBody } from "@/server/body";
import { ipHash } from "@/server/ip-hash";
import { kvRateLimit } from "@/server/rate-limit";
import { clearPlayerCookie, deletePlayer, loadProfile, parseProfileInput, playerCookie, saveProfile } from "@/server/social/player";
import { socialJson, socialRoute } from "@/server/social/route";

// Профиль игрока соцчасти (docs/specs/duels.md §6, Ф2).
//   GET    → { player: MyProfile | null }
//   POST   { name, lang, lv, cosmetics: { frame, title }, ft } → { player, nameState, hint? } (+ Set-Cookie inf_pl нового игрока)
//   DELETE → { ok: true } — профиль, карточка, код, друзья с обеих сторон, топ; cookie снимается.
// Имя проверяет сервер (формат + стоп-корни); причину-слово не называем, hint — только код отказа.

export const maxDuration = 10;

/** Потолок тела: имя ≤ 200 знаков сырого ввода и несколько коротких полей. */
const BODY_MAX = 2048;
/** Всплеск сохранений профиля с одного IP-хеша за 10 минут (класс за одним адресом). */
const BURST = { limit: 60, windowMs: 10 * 60_000 };

export async function GET(req: Request) {
  return socialRoute(req, "me.get", async (ctx) => {
    if (!ctx.pid) return socialJson({ player: null });
    return socialJson({ player: await loadProfile(ctx.kv, ctx.pid) });
  });
}

export async function POST(req: Request) {
  return socialRoute(req, "me.post", async (ctx) => {
    ctx.kv.addCmds(2);
    if (!(await kvRateLimit(`social:me:${ipHash(req)}`, BURST.limit, BURST.windowMs, ctx.now))) return socialJson({ error: "rate_limited" }, 429);
    const body = await readJsonBody(req, BODY_MAX);
    if (!body.ok) return socialJson({ error: body.error }, body.status);
    const input = parseProfileInput(body.value);
    if (!input) return socialJson({ error: "bad_request" }, 400);
    const res = await saveProfile(ctx.kv, req, ctx.pid, input, ctx.now);
    if (!res.ok) return socialJson({ error: res.error }, res.status);
    const isNew = !!res.pid && res.pid !== ctx.pid;
    if (res.pid) ctx.pid = res.pid;
    const cookie = isNew && res.pid ? playerCookie(res.pid, ctx.secret) : null;
    return socialJson({ player: res.player, nameState: res.player.nameState, ...(res.hint ? { hint: res.hint } : {}) }, 200, cookie);
  });
}

export async function DELETE(req: Request) {
  return socialRoute(req, "me.delete", async (ctx) => {
    if (ctx.pid) await deletePlayer(ctx.kv, ctx.pid, ctx.now);
    return socialJson({ ok: true }, 200, clearPlayerCookie());
  });
}
