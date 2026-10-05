import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { clientIp } from "@/server/rate-limit";

// IP в ключах хранилища — только хеш: в Redis нет сырых адресов (решение #69).
// Подход как в страже ИИ (server/ai-guard.ts → ipHash): HMAC от ключа клиента (clientIp уже приведён к ipKey: IPv6 по сети /64).

let processSecret: string | null = null;

/**
 * Секрет хеширования: производный от AI_DEVICE_SECRET; нет — от OPENAI_API_KEY (sha256 с солью, сами значения нигде не
 * хранятся и не логируются); нет и их — постоянная строка вне production, а в production — случайная на процесс
 * (ключи лимитов тогда «на копию сервера»).
 */
function ipSecret(env: Record<string, string | undefined> = process.env): string {
  const own = env.AI_DEVICE_SECRET?.trim() || env.OPENAI_API_KEY?.trim();
  if (own) return createHash("sha256").update(`informatica-ip-hash-v1:${own}`).digest("hex");
  if (env.NODE_ENV !== "production") return "informatica-dev-ip-hash-secret";
  processSecret ??= randomBytes(32).toString("hex");
  return processSecret;
}

/** Хеш IP запроса (20 hex-символов) для ключей лимитов. По хешу адрес не восстановить без секрета. */
export function ipHash(req: Request, secret: string = ipSecret()): string {
  return createHmac("sha256", secret).update(`ip:${clientIp(req)}`).digest("hex").slice(0, 20);
}
