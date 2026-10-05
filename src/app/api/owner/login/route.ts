import { readBodyText } from "@/server/body";
import { sameOrigin } from "@/server/context";
import { ipHash } from "@/server/ip-hash";
import { kvRateLimit } from "@/server/rate-limit";
import { OWNER_BODY_MAX, OWNER_LOGIN_LIMIT, ownerCookieHeader, ownerSecret, passwordMatches, signOwnerCookie } from "@/server/owner-auth";

// Вход владельца (форма на /owner). Нет OWNER_SECRET — 404, как будто маршрута нет.
// Порядок: секрет → origin → лимит попыток по ХЕШУ IP (до чтения тела; считается каждая попытка) → тело потоком, не больше OWNER_BODY_MAX (1000) байт →
// пароль (сравнение за постоянное время) → cookie `inf_owner` (HMAC, 12 часов). Ответ всегда редирект на /owner:
// `?e=1` — неверный пароль, `?e=2` — слишком много попыток, `?e=3` — запрос не принят.

export const maxDuration = 10;

const back = (query = "", cookie?: string) => {
  const headers = new Headers({ Location: `/owner${query}`, "Cache-Control": "no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
};

/** Пароль из тела: форма (application/x-www-form-urlencoded) или JSON `{ password }`. */
function passwordFrom(text: string, contentType: string): unknown {
  if (contentType.includes("application/json")) {
    try {
      return (JSON.parse(text) as { password?: unknown })?.password;
    } catch {
      return undefined;
    }
  }
  return new URLSearchParams(text).get("password") ?? undefined;
}

export async function POST(req: Request) {
  const secret = ownerSecret();
  if (!secret) return new Response(null, { status: 404 });
  if (!sameOrigin(req)) return new Response(null, { status: 403 });

  // Лимит — до чтения тела; успешный вход тоже считается: перебирать по кругу нельзя.
  if (!(await kvRateLimit(`owner-login:${ipHash(req)}`, OWNER_LOGIN_LIMIT.limit, OWNER_LOGIN_LIMIT.windowMs))) return back("?e=2");

  const text = await readBodyText(req, OWNER_BODY_MAX).catch(() => null);
  if (text === null) return back("?e=3");
  const password = passwordFrom(text, req.headers.get("content-type") ?? "");
  if (!passwordMatches(password, secret)) return back("?e=1");

  return back("", ownerCookieHeader(signOwnerCookie(secret, Date.now())));
}
