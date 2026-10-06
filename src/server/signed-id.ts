import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Подписанные id в cookie: `<id22>.<sig22>`, sig = HMAC-SHA256(secret, [context:]id) в base64url, первые 22 знака.
// Общий помощник для cookie устройства ИИ (`inf_ai`, server/ai-guard.ts — без контекста, как раньше) и cookie игрока
// (`inf_pl`, server/social/player.ts — с контекстом «pl» и своим секретом SOCIAL_SECRET).
// Сравнение подписи — за постоянное время.

/** id: 16 случайных байт в base64url = 22 знака. */
export const SIGNED_ID_RE = /^[A-Za-z0-9_-]{22}$/;
const SIG_LEN = 22;

/** Новый случайный id (22 знака base64url). */
export function newSignedId(): string {
  return randomBytes(16).toString("base64url");
}

/** Подпись id; context разводит назначения (одна и та же пара id/секрет не подходит в чужую cookie). */
export function signId(id: string, secret: string, context?: string): string {
  return createHmac("sha256", secret)
    .update(context ? `${context}:${id}` : id)
    .digest("base64url")
    .slice(0, SIG_LEN);
}

/** Значение cookie `<id>.<sig>`. */
export function signedValue(id: string, secret: string, context?: string): string {
  return `${id}.${signId(id, secret, context)}`;
}

/** Значение `<id>.<sig>` → id, если подпись верна (постоянное время сравнения); иначе null. */
export function verifySignedId(value: string, secret: string, context?: string): string | null {
  const dot = value.indexOf(".");
  if (dot !== 22) return null;
  const id = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!SIGNED_ID_RE.test(id) || sig.length !== SIG_LEN) return null;
  const want = Buffer.from(signId(id, secret, context));
  const got = Buffer.from(sig);
  return got.length === want.length && timingSafeEqual(got, want) ? id : null;
}

/** Все значения cookie с этим именем из заголовка запроса (одноимённых может быть несколько — с разными Path). */
export function cookieValues(req: Request, name: string): string[] {
  const header = req.headers.get("cookie");
  if (!header) return [];
  const out: string[] = [];
  for (const part of header.split(";")) {
    const p = part.trim();
    if (p.startsWith(`${name}=`)) out.push(p.slice(name.length + 1));
  }
  return out;
}

/** Первый id из cookie name с верной подписью; null — нет cookie или подпись чужая. */
export function readSignedCookie(req: Request, name: string, secret: string, context?: string): string | null {
  for (const v of cookieValues(req, name)) {
    const id = verifySignedId(v, secret, context);
    if (id) return id;
  }
  return null;
}

export interface CookieOptions {
  path: string;
  maxAgeSec: number;
  /** Secure — по умолчанию в production. */
  secure?: boolean;
}

/** Заголовок Set-Cookie: HttpOnly, SameSite=Lax. maxAgeSec = 0 — удалить cookie. */
export function cookieHeader(name: string, value: string, opts: CookieOptions, env: Record<string, string | undefined> = process.env): string {
  const secure = (opts.secure ?? env.NODE_ENV === "production") ? "; Secure" : "";
  return `${name}=${value}; HttpOnly; SameSite=Lax; Path=${opts.path}; Max-Age=${opts.maxAgeSec}${secure}`;
}
