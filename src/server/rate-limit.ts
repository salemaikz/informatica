import "server-only";
import { getKv } from "@/server/kv";

// Лимит запросов по IP.
// rateLimit — скользящее окно в памяти процесса (синхронно; для маршрутов без денег, например жалоб).
// kvRateLimit — счётчик окна в общем хранилище (Upstash или память, server/kv.ts): им пользуется серверный страж ИИ
// (server/ai-guard.ts), поэтому «всплеск» считается общим для всех копий сервера.

const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return true;
}

/**
 * Лимит в общем хранилище: фиксированное окно windowMs, не больше limit запросов на ключ.
 * Окно привязано к часам, поэтому на стыке окон допустимо до 2×limit — для защиты от всплеска этого достаточно.
 * Каждый вызов считается, в том числе отклонённый.
 */
export async function kvRateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): Promise<boolean> {
  const slot = Math.floor(now / windowMs);
  const n = await getKv().incrBy(`rl:${key}:${slot}`, 1, Math.ceil((windowMs * 2) / 1000));
  return n <= limit;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
