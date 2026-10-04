import "server-only";

// Общее хранилище счётчиков и списков для серверных маршрутов (потолок расходов ИИ, жалобы, ошибки с телефонов).
// Есть Upstash Redis (Vercel Marketplace: KV_REST_API_URL/KV_REST_API_TOKEN или UPSTASH_REDIS_REST_URL/TOKEN) —
// пишем туда: одно хранилище на все копии сервера. Нет — память процесса: на serverless у каждой копии
// своя память, поэтому это только мягкая защита (решение #48). Upstash недоступен — та же память, сайт не падает.

export interface Kv {
  readonly kind: "upstash" | "memory";
  /** Прибавить n к счётчику (n может быть отрицательным) и вернуть новое значение. Ключ живёт ttlSec после последней записи. */
  incrBy(key: string, n: number, ttlSec: number): Promise<number>;
  /** Текущее значение счётчика (нет ключа — 0). */
  get(key: string): Promise<number>;
  /** Добавить запись в начало списка и оставить не больше max последних записей. */
  pushCapped(key: string, value: string, max: number, ttlSec?: number): Promise<void>;
}

// ---------- память процесса ----------

const MAX_KEYS = 20_000;

export function createMemoryKv(now: () => number = Date.now): Kv {
  const nums = new Map<string, { v: number; exp: number }>();
  const lists = new Map<string, { v: string[]; exp: number }>();
  const sweep = () => {
    if (nums.size + lists.size <= MAX_KEYS) return;
    const t = now();
    for (const [k, e] of nums) if (e.exp <= t) nums.delete(k);
    for (const [k, e] of lists) if (e.exp <= t) lists.delete(k);
    // Всё ещё много живых ключей — убираем самые старые (Map хранит порядок вставки).
    for (const k of nums.keys()) {
      if (nums.size + lists.size <= MAX_KEYS) break;
      nums.delete(k);
    }
  };
  const alive = <T extends { exp: number }>(e: T | undefined): T | undefined => (e && e.exp > now() ? e : undefined);
  return {
    kind: "memory",
    async incrBy(key, n, ttlSec) {
      const cur = alive(nums.get(key))?.v ?? 0;
      const v = cur + n;
      nums.delete(key);
      nums.set(key, { v, exp: now() + ttlSec * 1000 });
      sweep();
      return v;
    },
    async get(key) {
      return alive(nums.get(key))?.v ?? 0;
    },
    async pushCapped(key, value, max, ttlSec = 30 * 86_400) {
      const cur = alive(lists.get(key))?.v ?? [];
      lists.set(key, { v: [value, ...cur].slice(0, max), exp: now() + ttlSec * 1000 });
      sweep();
    },
  };
}

// ---------- Upstash REST ----------

type Cmd = (string | number)[];

export function createUpstashKv(url: string, token: string, fallback: Kv, fetchImpl: typeof fetch = fetch): Kv {
  const base = url.replace(/\/+$/, "");
  let warned = false;
  const pipeline = async (cmds: Cmd[]): Promise<unknown[]> => {
    const res = await fetchImpl(`${base}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) throw new Error(`upstash http ${res.status}`);
    const data = (await res.json()) as { result?: unknown; error?: string }[];
    if (!Array.isArray(data)) throw new Error("upstash bad reply");
    return data.map((r) => {
      if (r?.error) throw new Error(`upstash ${r.error}`);
      return r?.result;
    });
  };
  // Upstash не ответил — работаем на памяти, в лог пишем один раз за жизнь копии сервера.
  const safe = async <T>(run: () => Promise<T>, onFail: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (e) {
      if (!warned) {
        warned = true;
        console.error("[kv] upstash unavailable, using memory", e instanceof Error ? e.message : e);
      }
      return onFail();
    }
  };
  return {
    kind: "upstash",
    incrBy: (key, n, ttlSec) =>
      safe(
        async () => Number((await pipeline([["INCRBY", key, n], ["EXPIRE", key, ttlSec]]))[0]) || 0,
        () => fallback.incrBy(key, n, ttlSec),
      ),
    get: (key) =>
      safe(
        async () => Number((await pipeline([["GET", key]]))[0] ?? 0) || 0,
        () => fallback.get(key),
      ),
    pushCapped: (key, value, max, ttlSec = 30 * 86_400) =>
      safe(
        async () => {
          await pipeline([["LPUSH", key, value], ["LTRIM", key, 0, max - 1], ["EXPIRE", key, ttlSec]]);
        },
        () => fallback.pushCapped(key, value, max, ttlSec),
      ),
  };
}

let shared: Kv | null = null;

/** Хранилище сервера: Upstash, если заданы переменные окружения, иначе память процесса. */
export function getKv(): Kv {
  if (shared) return shared;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const memory = createMemoryKv();
  shared = url && token ? createUpstashKv(url, token, memory) : memory;
  // Без Upstash в production счётчики у каждой копии сервера свои: потолок расходов ИИ становится «на копию». Один раз за жизнь копии.
  if (shared.kind === "memory" && process.env.NODE_ENV === "production") {
    console.warn("[kv] memory store in production: AI limits are per instance");
  }
  return shared;
}

/** Сутки по времени Казахстана (UTC+5): «2026-10-04». Дневные лимиты сбрасываются в полночь по Астане. */
export function kzDay(now: number = Date.now()): string {
  return new Date(now + 5 * 3_600_000).toISOString().slice(0, 10);
}
