import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Вход владельца на /owner (решение #69): секрет OWNER_SECRET из окружения, cookie `inf_owner` с подписью HMAC и сроком 12 часов.
// Нет секрета (или он короче OWNER_SECRET_MIN) — страница отвечает 404: её как будто нет.
// Сравнение пароля и подписи — за постоянное время (timingSafeEqual). Чистые функции покрыты tests/owner-auth.test.ts.

export const OWNER_COOKIE = "inf_owner";
/** Срок входа: 12 часов. */
export const OWNER_TTL_MS = 12 * 3_600_000;
/** Попыток входа с одного IP (хеш) за окно. */
export const OWNER_LOGIN_LIMIT = { limit: 10, windowMs: 10 * 60_000 } as const;
/** Короче этого секрет не принимается: слабый пароль на странице с данными учеников — хуже, чем её отсутствие. */
export const OWNER_SECRET_MIN = 12;
/** Пароль в форме длиннее этого — отказ без проверки. */
export const OWNER_PASSWORD_MAX = 200;

let warned = false;

/** Секрет владельца из окружения или null (нет, пусто или слишком короткий — тогда в лог один раз за жизнь копии). */
export function ownerSecret(env: Record<string, string | undefined> = process.env): string | null {
  const s = env.OWNER_SECRET?.trim() ?? "";
  if (!s) return null;
  if (s.length < OWNER_SECRET_MIN) {
    if (!warned) {
      warned = true;
      console.warn(`[owner] OWNER_SECRET короче ${OWNER_SECRET_MIN} знаков — страница владельца выключена`);
    }
    return null;
  }
  return s;
}

/** Ключ подписи: производный от секрета (сам пароль в HMAC напрямую не используется). */
function signKey(secret: string): Buffer {
  return createHmac("sha256", "informatica-owner-cookie-v1").update(secret).digest();
}

function sign(exp: number, secret: string): string {
  return createHmac("sha256", signKey(secret)).update(`owner|${exp}`).digest("base64url");
}

const COOKIE_RE = /^(\d{10,15})\.([A-Za-z0-9_-]{43})$/;

/** Значение cookie для входа, действующего до now + 12 часов: `<конец срока, мс>.<подпись>`. */
export function signOwnerCookie(secret: string, now: number): string {
  const exp = now + OWNER_TTL_MS;
  return `${exp}.${sign(exp, secret)}`;
}

/** Cookie верна: подпись совпала с секретом, срок не вышел и не продлён дальше 12 часов (с запасом минута на часы). */
export function verifyOwnerCookie(value: string | null | undefined, secret: string, now: number): boolean {
  if (!value) return false;
  const m = COOKIE_RE.exec(value);
  if (!m) return false;
  const exp = Number(m[1]);
  if (!Number.isSafeInteger(exp) || exp <= now || exp - now > OWNER_TTL_MS + 60_000) return false;
  const want = Buffer.from(sign(exp, secret));
  const got = Buffer.from(m[2]);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Введённый пароль равен секрету. Сравниваются хеши одинаковой длины — время не зависит от того, сколько знаков совпало. */
export function passwordMatches(input: unknown, secret: string): boolean {
  if (typeof input !== "string" || input.length === 0 || input.length > OWNER_PASSWORD_MAX) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

/** Заголовок Set-Cookie для входа (HttpOnly, SameSite=Strict, Path=/, 12 часов; Secure в production). */
export function ownerCookieHeader(value: string, env: Record<string, string | undefined> = process.env): string {
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";
  return `${OWNER_COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${OWNER_TTL_MS / 1000}${secure}`;
}

/** Заголовок Set-Cookie для выхода: cookie сразу истекает. */
export function ownerLogoutHeader(env: Record<string, string | undefined> = process.env): string {
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";
  return `${OWNER_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}
