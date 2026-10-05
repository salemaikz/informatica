import "server-only";

// Общее хранилище счётчиков и списков для серверных маршрутов (потолок расходов ИИ, жалобы, ошибки с телефонов).
// Есть Upstash Redis (Vercel Marketplace: KV_REST_API_URL/KV_REST_API_TOKEN или UPSTASH_REDIS_REST_URL/TOKEN) —
// пишем туда: одно хранилище на все копии сервера. Нет — память процесса: на serverless у каждой копии
// своя память, поэтому это только мягкая защита (решение #48). Upstash недоступен — запись и счётчики учеников идут в ту же память,
// сайт не падает. Чтения для страницы владельца (hgetAll, hgetAllMany, hmgetMany, lrange) в память НЕ откатываются: пустая память
// выглядела бы как «данных нет». Ошибка доходит до вызывающего (loadOwnerData показывает «хранилище не ответило»).

export interface Kv {
  readonly kind: "upstash" | "memory";
  /** Прибавить n к счётчику (n может быть отрицательным) и вернуть новое значение. Ключ живёт ttlSec после последней записи. */
  incrBy(key: string, n: number, ttlSec: number): Promise<number>;
  /** Текущее значение счётчика (нет ключа — 0). */
  get(key: string): Promise<number>;
  /** Добавить запись в начало списка и оставить не больше max последних записей. */
  pushCapped(key: string, value: string, max: number, ttlSec?: number): Promise<void>;
  /**
   * Прибавить n к полю хеша и вернуть новое значение (хеш — счётчики по полям, например суточная статистика).
   * Ключ живёт ttlSec после последней записи. В памяти у хеша не больше HASH_MAX_FIELDS полей: новое поле сверх
   * потолка не пишется (вернётся 0), уже записанные продолжают расти.
   */
  hincrBy(key: string, field: string, n: number, ttlSec: number): Promise<number>;
  /**
   * То же для нескольких полей одним конвейером (одно обращение к хранилищу на пачку). Увеличивать можно только положительными n.
   * Возвращает, сколько полей создано впервые (по ним маршрут следит за раздуванием суточного хеша).
   */
  hincrMany(key: string, fields: Record<string, number>, ttlSec: number): Promise<number>;
  /** Все поля хеша как числа (нет ключа — пустой объект). */
  hgetAll(key: string): Promise<Record<string, number>>;
  /** Несколько хешей одним конвейером; порядок результата — как порядок ключей. */
  hgetAllMany(keys: string[]): Promise<Record<string, number>[]>;
  /**
   * Только перечисленные поля нескольких хешей одним конвейером (HMGET): порядок результата — как порядок ключей;
   * в объект попадают лишь существующие поля. Для удержания: act:0/1/7/30 за все сутки без чтения целых хешей.
   */
  hmgetMany(keys: string[], fields: string[]): Promise<Record<string, number>[]>;
  /** Срез списка как в Redis LRANGE (индексы включительно, -1 — последний); новые записи — в начале. Нет ключа — пустой список. */
  lrange(key: string, start: number, stop: number): Promise<string[]>;
}

// ---------- память процесса ----------

const MAX_KEYS = 20_000;
/** Потолок полей одного хеша в памяти: суточная статистика не должна раздуваться (лишние поля не пишутся). */
export const HASH_MAX_FIELDS = 5000;

export function createMemoryKv(now: () => number = Date.now): Kv {
  const nums = new Map<string, { v: number; exp: number }>();
  const lists = new Map<string, { v: string[]; exp: number }>();
  const hashes = new Map<string, { v: Map<string, number>; exp: number }>();
  const size = () => nums.size + lists.size + hashes.size;
  const sweep = () => {
    if (size() <= MAX_KEYS) return;
    const t = now();
    for (const [k, e] of nums) if (e.exp <= t) nums.delete(k);
    for (const [k, e] of lists) if (e.exp <= t) lists.delete(k);
    for (const [k, e] of hashes) if (e.exp <= t) hashes.delete(k);
    // Всё ещё много живых ключей — убираем самые старые (Map хранит порядок вставки).
    for (const k of nums.keys()) {
      if (size() <= MAX_KEYS) break;
      nums.delete(k);
    }
  };
  /** Прибавить к полю; false — новое поле не влезло в потолок. */
  const bump = (h: Map<string, number>, field: string, n: number): number => {
    const cur = h.get(field);
    if (cur === undefined && h.size >= HASH_MAX_FIELDS) return 0;
    const v = (cur ?? 0) + n;
    h.set(field, v);
    return v;
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
    async hincrBy(key, field, n, ttlSec) {
      const h = alive(hashes.get(key))?.v ?? new Map<string, number>();
      const v = bump(h, field, n);
      hashes.delete(key);
      hashes.set(key, { v: h, exp: now() + ttlSec * 1000 });
      sweep();
      return v;
    },
    async hincrMany(key, fields, ttlSec) {
      const h = alive(hashes.get(key))?.v ?? new Map<string, number>();
      let created = 0;
      for (const [f, n] of Object.entries(fields)) {
        const had = h.has(f);
        bump(h, f, n);
        if (!had && h.has(f)) created++;
      }
      hashes.delete(key);
      hashes.set(key, { v: h, exp: now() + ttlSec * 1000 });
      sweep();
      return created;
    },
    async hgetAll(key) {
      return Object.fromEntries(alive(hashes.get(key))?.v ?? []);
    },
    async hgetAllMany(keys) {
      return keys.map((k) => Object.fromEntries(alive(hashes.get(k))?.v ?? []));
    },
    async hmgetMany(keys, fields) {
      return keys.map((k) => {
        const h = alive(hashes.get(k))?.v;
        const out: Record<string, number> = {};
        if (h) for (const f of fields) if (h.has(f)) out[f] = h.get(f)!;
        return out;
      });
    },
    async lrange(key, start, stop) {
      const cur = alive(lists.get(key))?.v ?? [];
      // Как LRANGE: отрицательный индекс — с конца, stop включительно.
      const from = start < 0 ? Math.max(cur.length + start, 0) : start;
      const to = stop < 0 ? cur.length + stop : stop;
      return cur.slice(from, to + 1);
    },
  };
}

// ---------- Upstash REST ----------

type Cmd = (string | number)[];
/** Таймаут чтения хешей и списков (страница владельца), мс. */
const READ_TIMEOUT_MS = 8000;

export function createUpstashKv(url: string, token: string, fallback: Kv, fetchImpl: typeof fetch = fetch): Kv {
  const base = url.replace(/\/+$/, "");
  let warned = false;
  // Запись и счётчики учеников — быстрый таймаут (не держим запрос); чтение страницы владельца (хеши за 60 суток) — дольше.
  const pipeline = async (cmds: Cmd[], timeoutMs = 1500): Promise<unknown[]> => {
    const res = await fetchImpl(`${base}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
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
  // Чтение для страницы владельца: длинный таймаут, ошибка логируется и пробрасывается (в память не откатываемся).
  const read = async (cmds: Cmd[]): Promise<unknown[]> => {
    try {
      return await pipeline(cmds, READ_TIMEOUT_MS);
    } catch (e) {
      console.error("[kv] upstash read failed", e instanceof Error ? e.message : e);
      throw e;
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
    hincrBy: (key, field, n, ttlSec) =>
      safe(
        async () => Number((await pipeline([["HINCRBY", key, field, n], ["EXPIRE", key, ttlSec]]))[0]) || 0,
        () => fallback.hincrBy(key, field, n, ttlSec),
      ),
    hincrMany: (key, fields, ttlSec) =>
      safe(
        async () => {
          const entries = Object.entries(fields);
          if (entries.length === 0) return 0;
          // Одна команда HINCRBY на поле и EXPIRE — всё одним конвейером (одно обращение по сети на пачку).
          const res = await pipeline([...entries.map(([f, n]): Cmd => ["HINCRBY", key, f, n]), ["EXPIRE", key, ttlSec]]);
          // Поле создано впервые, если после прибавления в нём ровно n (у старого было бы больше: прибавляем только положительное).
          return entries.reduce((c, [, n], i) => c + (Number(res[i]) === n ? 1 : 0), 0);
        },
        () => fallback.hincrMany(key, fields, ttlSec),
      ),
    // Чтения — только для страницы владельца: без отката в память (пустая память = «данных нет», это ложь). Ошибку — наверх.
    hgetAll: async (key) => hashOf((await read([["HGETALL", key]]))[0]),
    hgetAllMany: async (keys) => (keys.length === 0 ? [] : (await read(keys.map((k): Cmd => ["HGETALL", k]))).map(hashOf)),
    hmgetMany: async (keys, fields) => {
      if (keys.length === 0 || fields.length === 0) return keys.map(() => ({}));
      const res = await read(keys.map((k): Cmd => ["HMGET", k, ...fields]));
      return res.map((r) => {
        const out: Record<string, number> = {};
        if (Array.isArray(r)) {
          fields.forEach((f, i) => {
            const v = r[i];
            if (v === null || v === undefined) return;
            const n = Number(v);
            if (Number.isFinite(n)) out[f] = n;
          });
        }
        return out;
      });
    },
    lrange: async (key, start, stop) => {
      const r = (await read([["LRANGE", key, start, stop]]))[0];
      return Array.isArray(r) ? r.filter((x): x is string => typeof x === "string") : [];
    },
  };
}

/** Ответ HGETALL в REST-формате: плоский список [поле, значение, поле, значение…] (иногда уже объект) → поля-числа. */
function hashOf(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (Array.isArray(raw)) {
    for (let i = 0; i + 1 < raw.length; i += 2) {
      const n = Number(raw[i + 1]);
      if (Number.isFinite(n)) out[String(raw[i])] = n;
    }
  } else if (raw && typeof raw === "object") {
    for (const [f, v] of Object.entries(raw)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[f] = n;
    }
  }
  return out;
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
