import "server-only";
import { getKv } from "@/server/kv";

// Лимит запросов по IP.
// rateLimit — скользящее окно в памяти процесса (синхронно; для маршрутов без денег).
// kvRateLimit — счётчик окна в общем хранилище (Upstash или память, server/kv.ts): им пользуется серверный страж ИИ
// (server/ai-guard.ts), поэтому «всплеск» считается общим для всех копий сервера.
// Ключ по IP всегда строится из clientIp(req): он уже приведён к ipKey (IPv6 — по сети /64), иначе у одного
// человека с IPv6 были бы миллиарды «разных» адресов и лимиты по IP не работали бы.

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

// ---------- Ключ IP ----------

/** Ключ для любого адреса, который не удалось разобрать: все такие запросы делят один счётчик (не «каждому свой»). */
export const IP_INVALID = "invalid";

function parseIpv4(s: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((n) => n <= 255) ? parts : null;
}

/** IPv6 → восемь 16-битных групп (раскрывает «::», принимает хвост-IPv4) или null. */
function parseIpv6(raw: string): number[] | null {
  let s = raw;
  const tail = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  if (tail) {
    const v4 = parseIpv4(tail[2]);
    if (!v4) return null;
    s = `${tail[1]}${(v4[0] * 256 + v4[1]).toString(16)}:${(v4[2] * 256 + v4[3]).toString(16)}`;
  }
  const dbl = s.indexOf("::");
  if (dbl !== s.lastIndexOf("::")) return null; // «::» не больше одного раза (и «:::» тоже мусор)
  let groups: string[];
  if (dbl >= 0) {
    const head = s.slice(0, dbl);
    const rest = s.slice(dbl + 2);
    const a = head ? head.split(":") : [];
    const b = rest ? rest.split(":") : [];
    if (a.length + b.length > 7) return null;
    groups = [...a, ...Array<string>(8 - a.length - b.length).fill("0"), ...b];
  } else {
    groups = s.split(":");
  }
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/**
 * Ключ клиента по его адресу: IPv4 и IPv4-mapped IPv6 («::ffff:1.2.3.4») — сам адрес; остальной IPv6 — сеть /64
 * («2001:db8:1:2::/64»): провайдер выдаёт абоненту целую /64, и без этого ключа менять адрес внутри неё можно бесконечно.
 * Регистр, ведущие нули, «::», скобки, порт и zone id («%eth0») не влияют на результат. Мусор — IP_INVALID.
 */
export function ipKey(ip: string): string {
  let s = ip.trim().toLowerCase();
  const br = /^\[([^\]]*)\](?::\d+)?$/.exec(s);
  if (br) s = br[1];
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);

  const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(s);
  const v4 = parseIpv4(withPort ? withPort[1] : s);
  if (v4) return v4.join(".");

  if (!s.includes(":")) return IP_INVALID;
  const g = parseIpv6(s);
  if (!g) return IP_INVALID;
  // ::ffff:a.b.c.d — IPv4 внутри IPv6 (так его показывают двойные стеки)
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255].join(".");
  return `${g.slice(0, 4).map((x) => x.toString(16)).join(":")}::/64`;
}

/** Ключ клиента запроса (ipKey от первого адреса x-forwarded-for, затем x-real-ip). Нет заголовков (dev) — «local». */
export function clientIp(req: Request): string {
  const raw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim();
  return raw ? ipKey(raw) : "local";
}
