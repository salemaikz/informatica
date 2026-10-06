import "server-only";

// Общее хранилище счётчиков и списков для серверных маршрутов (потолок расходов ИИ, жалобы, ошибки с телефонов,
// соцчасть: профили игроков, друзья, дуэли). Есть Upstash Redis (Vercel Marketplace: KV_REST_API_URL/KV_REST_API_TOKEN
// или UPSTASH_REDIS_REST_URL/TOKEN) — пишем туда: одно хранилище на все копии сервера. Нет — память процесса: на serverless
// у каждой копии своя память, поэтому это только мягкая защита (решение #48).
//
// Два режима отказа Upstash:
// - «старые» методы ИИ-лимитов (incrBy, get, pushCapped, hincrBy, hincrMany) у getKv() молча уходят в память копии —
//   сайт не падает. Чтения для страницы владельца (hgetAll, hgetAllMany, hmgetMany, lrange) в память НЕ откатываются:
//   пустая память выглядела бы как «данных нет»;
// - строгие операции соцчасти (getStr, set, z*, s*, hsetnx, pipeline …) не откатываются никогда: ошибка доходит до
//   маршрута, он отвечает 503 social_unavailable (docs/specs/duels.md §2). Разные копии с разной памятью дали бы разные
//   очереди и матчи. getStrictKv() — клиент без отката вообще (и для старых методов).
//
// Память процесса — одиночка в globalThis[Symbol.for("informatica.kv")]: маршруты Next собираются отдельными точками входа,
// и переменная модуля не гарантирует одну память на процесс (dev и e2e: два игрока в одной очереди).

/** Одна операция хранилища: из них собирается конвейер (одно обращение по сети на пачку). */
export type KvOp =
  | { op: "getStr"; key: string }
  /** SET с EX (ttlSec) или PX (ttlMs); nx — только если ключа нет. Без срока — ключ бессрочный (как SET в Redis). */
  | { op: "set"; key: string; value: string; ttlSec?: number; ttlMs?: number; nx?: boolean }
  | { op: "mget"; keys: readonly string[] }
  | { op: "del"; keys: readonly string[] }
  | { op: "expire"; key: string; ttlSec: number }
  | { op: "incrBy"; key: string; n: number; ttlSec?: number }
  | { op: "hset"; key: string; fields: Record<string, string | number>; ttlSec?: number }
  | { op: "hsetnx"; key: string; field: string; value: string | number }
  | { op: "hget"; key: string; field: string }
  | { op: "hgetAllStr"; key: string }
  | { op: "hdel"; key: string; fields: readonly string[] }
  /** LPUSH + (LTRIM до max) + (EXPIRE). */
  | { op: "lpush"; key: string; value: string; max?: number; ttlSec?: number }
  | { op: "lrange"; key: string; start: number; stop: number }
  | { op: "zadd"; key: string; score: number; member: string; nx?: boolean; ttlSec?: number }
  | { op: "zrem"; key: string; members: readonly string[] }
  /** ZRANGE … [REV] WITHSCORES: по возрастанию очков (rev — по убыванию), индексы включительно, -1 — последний. */
  | { op: "zrange"; key: string; start: number; stop: number; rev?: boolean }
  | { op: "zincrBy"; key: string; n: number; member: string; ttlSec?: number }
  | { op: "zscore"; key: string; member: string }
  | { op: "zmscore"; key: string; members: readonly string[] }
  | { op: "zcard"; key: string }
  | { op: "sadd"; key: string; members: readonly string[]; ttlSec?: number }
  | { op: "srem"; key: string; members: readonly string[] }
  | { op: "smembers"; key: string }
  | { op: "sismember"; key: string; member: string }
  | { op: "scard"; key: string };

export interface ZEntry {
  member: string;
  score: number;
}

interface KvOpResultMap {
  getStr: string | null;
  set: boolean;
  mget: (string | null)[];
  del: number;
  expire: boolean;
  incrBy: number;
  hset: number;
  hsetnx: boolean;
  hget: string | null;
  hgetAllStr: Record<string, string>;
  hdel: number;
  lpush: number;
  lrange: string[];
  zadd: number;
  zrem: number;
  zrange: ZEntry[];
  zincrBy: number;
  zscore: number | null;
  zmscore: (number | null)[];
  zcard: number;
  sadd: number;
  srem: number;
  smembers: string[];
  sismember: boolean;
  scard: number;
}

export type KvOpResult<O extends KvOp> = KvOpResultMap[O["op"]];
export type KvOpResults<T extends readonly KvOp[]> = { -readonly [K in keyof T]: T[K] extends KvOp ? KvOpResult<T[K]> : never };

/** Строгие операции соцчасти: ошибка Upstash всегда доходит до вызывающего (без отката в память). */
export interface KvStrictOps {
  getStr(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { ttlSec?: number; ttlMs?: number; nx?: boolean }): Promise<boolean>;
  mget(keys: string[]): Promise<(string | null)[]>;
  del(keys: string[]): Promise<number>;
  expire(key: string, ttlSec: number): Promise<boolean>;
  hset(key: string, fields: Record<string, string | number>, ttlSec?: number): Promise<number>;
  hsetnx(key: string, field: string, value: string | number): Promise<boolean>;
  hget(key: string, field: string): Promise<string | null>;
  hgetAllStr(key: string): Promise<Record<string, string>>;
  hdel(key: string, fields: string[]): Promise<number>;
  zadd(key: string, score: number, member: string, opts?: { nx?: boolean; ttlSec?: number }): Promise<number>;
  zrem(key: string, members: string[]): Promise<number>;
  zrange(key: string, start: number, stop: number, opts?: { rev?: boolean }): Promise<ZEntry[]>;
  zincrBy(key: string, n: number, member: string, ttlSec?: number): Promise<number>;
  zscore(key: string, member: string): Promise<number | null>;
  zmscore(key: string, members: string[]): Promise<(number | null)[]>;
  zcard(key: string): Promise<number>;
  sadd(key: string, members: string[], ttlSec?: number): Promise<number>;
  srem(key: string, members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  sismember(key: string, member: string): Promise<boolean>;
  scard(key: string): Promise<number>;
  /** Несколько операций одним обращением (Upstash /pipeline; в памяти — по очереди). Не атомарно, как конвейер Redis. */
  pipeline<const T extends readonly KvOp[]>(ops: T): Promise<KvOpResults<T>>;
}

export interface Kv extends KvStrictOps {
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

/** Одиночные строгие методы поверх общего исполнителя операций (одна реализация на память и Upstash). */
export function bindOps(run: (ops: readonly KvOp[]) => Promise<unknown[]>): KvStrictOps {
  const one = async <O extends KvOp>(op: O): Promise<KvOpResult<O>> => (await run([op]))[0] as KvOpResult<O>;
  return {
    getStr: (key) => one({ op: "getStr", key }),
    set: (key, value, opts = {}) => one({ op: "set", key, value, ...opts }),
    mget: (keys) => one({ op: "mget", keys }),
    del: (keys) => one({ op: "del", keys }),
    expire: (key, ttlSec) => one({ op: "expire", key, ttlSec }),
    hset: (key, fields, ttlSec) => one({ op: "hset", key, fields, ttlSec }),
    hsetnx: (key, field, value) => one({ op: "hsetnx", key, field, value }),
    hget: (key, field) => one({ op: "hget", key, field }),
    hgetAllStr: (key) => one({ op: "hgetAllStr", key }),
    hdel: (key, fields) => one({ op: "hdel", key, fields }),
    zadd: (key, score, member, opts = {}) => one({ op: "zadd", key, score, member, ...opts }),
    zrem: (key, members) => one({ op: "zrem", key, members }),
    zrange: (key, start, stop, opts = {}) => one({ op: "zrange", key, start, stop, ...opts }),
    zincrBy: (key, n, member, ttlSec) => one({ op: "zincrBy", key, n, member, ttlSec }),
    zscore: (key, member) => one({ op: "zscore", key, member }),
    zmscore: (key, members) => one({ op: "zmscore", key, members }),
    zcard: (key) => one({ op: "zcard", key }),
    sadd: (key, members, ttlSec) => one({ op: "sadd", key, members, ttlSec }),
    srem: (key, members) => one({ op: "srem", key, members }),
    smembers: (key) => one({ op: "smembers", key }),
    sismember: (key, member) => one({ op: "sismember", key, member }),
    scard: (key) => one({ op: "scard", key }),
    pipeline: async <const T extends readonly KvOp[]>(ops: T) => (await run(ops)) as KvOpResults<T>,
  };
}

// ---------- память процесса ----------

const MAX_KEYS = 20_000;
/** Потолок полей одного хеша в памяти: суточная статистика не должна раздуваться (лишние поля не пишутся). */
export const HASH_MAX_FIELDS = 5000;

type MemEntry =
  // ctr — ключ создан счётчиком (incrBy): при переполнении вытесняются только такие ключи (счётчики лимитов, как раньше).
  | { t: "str"; v: string; exp: number; ctr?: boolean }
  | { t: "hash"; v: Map<string, string>; exp: number }
  | { t: "list"; v: string[]; exp: number }
  | { t: "zset"; v: Map<string, number>; exp: number }
  | { t: "set"; v: Set<string>; exp: number };
type MemType = MemEntry["t"];
type EntryOf<T extends MemType> = Extract<MemEntry, { t: T }>;

const wrongType = (key: string) => new Error(`WRONGTYPE ${key}: operation against a key holding the wrong kind of value`);
const notInt = (key: string) => new Error(`ERR ${key}: value is not an integer`);

/** Индексы как в Redis LRANGE/ZRANGE: отрицательный — с конца, stop включительно. */
function sliceRange<T>(arr: T[], start: number, stop: number): T[] {
  const from = start < 0 ? Math.max(arr.length + start, 0) : start;
  const to = stop < 0 ? arr.length + stop : stop;
  return arr.slice(from, to + 1);
}

export function createMemoryKv(now: () => number = Date.now): Kv {
  const store = new Map<string, MemEntry>();
  const sweep = () => {
    if (store.size <= MAX_KEYS) return;
    const t = now();
    for (const [k, e] of store) if (e.exp <= t) store.delete(k);
    // Всё ещё много живых ключей — убираем самые старые счётчики (Map хранит порядок вставки). Данные соцчасти не трогаем.
    for (const [k, e] of store) {
      if (store.size <= MAX_KEYS) break;
      if (e.t === "str" && e.ctr) store.delete(k);
    }
  };
  /** Живая запись ключа (истёкшая удаляется), с проверкой типа — чужой тип даёт WRONGTYPE, как в Redis. */
  const read = <T extends MemType>(key: string, t: T): EntryOf<T> | undefined => {
    const e = store.get(key);
    if (!e) return undefined;
    if (e.exp <= now()) {
      store.delete(key);
      return undefined;
    }
    if (e.t !== t) throw wrongType(key);
    return e as EntryOf<T>;
  };
  /** Как read, но чужой тип — «нет ключа» (старые методы ИИ-лимитов и страницы владельца никогда не падали на типе). */
  const peek = <T extends MemType>(key: string, t: T): EntryOf<T> | undefined => {
    const e = store.get(key);
    return e && e.t === t ? read(key, t) : undefined;
  };
  const exists = (key: string): boolean => {
    const e = store.get(key);
    if (!e) return false;
    if (e.exp <= now()) {
      store.delete(key);
      return false;
    }
    return true;
  };
  /** Запись ключа нужного типа: существующая или новая бессрочная. */
  const ensure = <T extends MemType>(key: string, t: T, make: () => EntryOf<T>["v"]): EntryOf<T> => {
    const cur = read(key, t);
    if (cur) return cur;
    const e = { t, v: make(), exp: Infinity } as unknown as EntryOf<T>;
    store.set(key, e);
    sweep();
    return e;
  };
  const ttl = (sec: number) => now() + sec * 1000;
  /** Перезаписать ключ в конец порядка вставки (свежие счётчики вытесняются последними). */
  const touch = (key: string, e: MemEntry) => {
    store.delete(key);
    store.set(key, e);
  };
  /** Пустые хеш, множество и список удаляются, как в Redis. */
  const dropIfEmpty = (key: string, e: MemEntry) => {
    const size = e.v instanceof Map || e.v instanceof Set ? e.v.size : Array.isArray(e.v) ? e.v.length : 1;
    if (size === 0) store.delete(key);
  };
  const intOf = (key: string, s: string): number => {
    if (!/^-?\d+$/.test(s)) throw notInt(key);
    return Number(s);
  };
  /** INCRBY: без ttlSec срок ключа не меняется (как в Redis), с ttlSec — продлевается. */
  const incr = (key: string, n: number, ttlSec?: number): number => {
    const cur = read(key, "str");
    const v = (cur ? intOf(key, cur.v) : 0) + n;
    const exp = ttlSec !== undefined ? ttl(ttlSec) : (cur?.exp ?? Infinity);
    touch(key, { t: "str", v: String(v), exp, ctr: cur ? cur.ctr : true });
    sweep();
    return v;
  };
  const sortedZ = (z: Map<string, number>): ZEntry[] =>
    [...z]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => a.score - b.score || (a.member < b.member ? -1 : a.member > b.member ? 1 : 0));

  const runOne = (op: KvOp): unknown => {
    switch (op.op) {
      case "getStr":
        return read(op.key, "str")?.v ?? null;
      case "set": {
        if (op.nx && exists(op.key)) return false;
        const exp = op.ttlMs !== undefined ? now() + op.ttlMs : op.ttlSec !== undefined ? ttl(op.ttlSec) : Infinity;
        touch(op.key, { t: "str", v: op.value, exp });
        sweep();
        return true;
      }
      case "mget":
        return op.keys.map((k) => {
          if (!exists(k)) return null;
          const e = store.get(k)!;
          return e.t === "str" ? e.v : null; // MGET не падает на чужом типе — отдаёт nil
        });
      case "del":
        return op.keys.reduce((c, k) => c + (exists(k) && store.delete(k) ? 1 : 0), 0);
      case "expire": {
        if (!exists(op.key)) return false;
        if (op.ttlSec <= 0) store.delete(op.key);
        else store.get(op.key)!.exp = ttl(op.ttlSec);
        return true;
      }
      case "incrBy":
        return incr(op.key, op.n, op.ttlSec);
      case "hset": {
        const entries = Object.entries(op.fields);
        if (entries.length === 0) return 0;
        const h = ensure(op.key, "hash", () => new Map());
        let created = 0;
        for (const [f, v] of entries) {
          if (!h.v.has(f)) created++;
          h.v.set(f, String(v));
        }
        if (op.ttlSec !== undefined) h.exp = ttl(op.ttlSec);
        return created;
      }
      case "hsetnx": {
        const h = ensure(op.key, "hash", () => new Map());
        if (h.v.has(op.field)) return false;
        h.v.set(op.field, String(op.value));
        return true;
      }
      case "hget":
        return read(op.key, "hash")?.v.get(op.field) ?? null;
      case "hgetAllStr":
        return Object.fromEntries(read(op.key, "hash")?.v ?? []);
      case "hdel": {
        const h = read(op.key, "hash");
        if (!h) return 0;
        const n = op.fields.reduce((c, f) => c + (h.v.delete(f) ? 1 : 0), 0);
        dropIfEmpty(op.key, h);
        return n;
      }
      case "lpush": {
        const l = ensure(op.key, "list", () => []);
        l.v.unshift(op.value);
        const len = l.v.length;
        if (op.max !== undefined) l.v.splice(Math.max(op.max, 0));
        if (op.ttlSec !== undefined) l.exp = ttl(op.ttlSec);
        dropIfEmpty(op.key, l);
        return len;
      }
      case "lrange":
        return sliceRange(read(op.key, "list")?.v ?? [], op.start, op.stop);
      case "zadd": {
        const z = ensure(op.key, "zset", () => new Map());
        const had = z.v.has(op.member);
        if (!(op.nx && had)) z.v.set(op.member, op.score);
        if (op.ttlSec !== undefined) z.exp = ttl(op.ttlSec);
        return had ? 0 : 1;
      }
      case "zrem": {
        const z = read(op.key, "zset");
        if (!z) return 0;
        const n = op.members.reduce((c, m) => c + (z.v.delete(m) ? 1 : 0), 0);
        dropIfEmpty(op.key, z);
        return n;
      }
      case "zrange": {
        const z = read(op.key, "zset");
        if (!z) return [];
        const all = sortedZ(z.v);
        return sliceRange(op.rev ? all.reverse() : all, op.start, op.stop);
      }
      case "zincrBy": {
        const z = ensure(op.key, "zset", () => new Map());
        const v = (z.v.get(op.member) ?? 0) + op.n;
        z.v.set(op.member, v);
        if (op.ttlSec !== undefined) z.exp = ttl(op.ttlSec);
        return v;
      }
      case "zscore":
        return read(op.key, "zset")?.v.get(op.member) ?? null;
      case "zmscore": {
        const z = read(op.key, "zset");
        return op.members.map((m) => z?.v.get(m) ?? null);
      }
      case "zcard":
        return read(op.key, "zset")?.v.size ?? 0;
      case "sadd": {
        if (op.members.length === 0) return 0;
        const s = ensure(op.key, "set", () => new Set());
        let n = 0;
        for (const m of op.members) {
          if (s.v.has(m)) continue;
          s.v.add(m);
          n++;
        }
        if (op.ttlSec !== undefined) s.exp = ttl(op.ttlSec);
        return n;
      }
      case "srem": {
        const s = read(op.key, "set");
        if (!s) return 0;
        const n = op.members.reduce((c, m) => c + (s.v.delete(m) ? 1 : 0), 0);
        dropIfEmpty(op.key, s);
        return n;
      }
      case "smembers":
        return [...(read(op.key, "set")?.v ?? [])];
      case "sismember":
        return read(op.key, "set")?.v.has(op.member) ?? false;
      case "scard":
        return read(op.key, "set")?.v.size ?? 0;
    }
  };
  // Конвейер в памяти — по очереди; первая ошибка обрывает его (для вызывающего — как отказ всего ответа Upstash).
  const run = async (ops: readonly KvOp[]): Promise<unknown[]> => ops.map(runOne);

  /** Хеш-счётчик: прибавить к полю; новое поле сверх потолка не пишется (вернётся 0). */
  const bump = (h: Map<string, string>, key: string, field: string, n: number): number => {
    const cur = h.get(field);
    if (cur === undefined && h.size >= HASH_MAX_FIELDS) return 0;
    const v = (cur === undefined ? 0 : intOf(key, cur)) + n;
    h.set(field, String(v));
    return v;
  };
  /** Хеш счётчиков с продлённым сроком (каждая запись продлевает ttl, как HINCRBY + EXPIRE). */
  const counterHash = (key: string, ttlSec: number): Map<string, string> => {
    const cur = read(key, "hash");
    const e: EntryOf<"hash"> = { t: "hash", v: cur?.v ?? new Map(), exp: ttl(ttlSec) };
    touch(key, e);
    sweep();
    return e.v;
  };
  const numbers = (h: Map<string, string> | undefined): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [f, v] of h ?? []) {
      const n = Number(v);
      if (Number.isFinite(n)) out[f] = n;
    }
    return out;
  };

  return {
    kind: "memory",
    ...bindOps(run),
    async incrBy(key, n, ttlSec) {
      return incr(key, n, ttlSec);
    },
    async get(key) {
      const v = peek(key, "str")?.v;
      return v === undefined ? 0 : Number(v) || 0;
    },
    async pushCapped(key, value, max, ttlSec = 30 * 86_400) {
      const cur = peek(key, "list")?.v ?? [];
      touch(key, { t: "list", v: [value, ...cur].slice(0, max), exp: ttl(ttlSec) });
      sweep();
    },
    async hincrBy(key, field, n, ttlSec) {
      return bump(counterHash(key, ttlSec), key, field, n);
    },
    async hincrMany(key, fields, ttlSec) {
      const h = counterHash(key, ttlSec);
      let created = 0;
      for (const [f, n] of Object.entries(fields)) {
        const had = h.has(f);
        bump(h, key, f, n);
        if (!had && h.has(f)) created++;
      }
      return created;
    },
    async hgetAll(key) {
      return numbers(peek(key, "hash")?.v);
    },
    async hgetAllMany(keys) {
      return keys.map((k) => numbers(peek(k, "hash")?.v));
    },
    async hmgetMany(keys, fields) {
      return keys.map((k) => {
        const h = peek(k, "hash")?.v;
        const out: Record<string, number> = {};
        if (h)
          for (const f of fields) {
            const n = h.has(f) ? Number(h.get(f)) : NaN;
            if (Number.isFinite(n)) out[f] = n;
          }
        return out;
      });
    },
    async lrange(key, start, stop) {
      return sliceRange(peek(key, "list")?.v ?? [], start, stop);
    },
  };
}

// ---------- Upstash REST ----------

type Cmd = (string | number)[];
/** Таймаут чтения хешей и списков (страница владельца), мс. */
const READ_TIMEOUT_MS = 8000;
/** Таймаут строгих операций соцчасти, мс: дольше записи лимитов, но в пределах maxDuration маршрута. */
const STRICT_TIMEOUT_MS = 3000;

/** Команды Redis для одной операции (пустые наборы — ни одной команды). */
function toCmds(op: KvOp): Cmd[] {
  const exp = (key: string, ttlSec: number | undefined): Cmd[] => (ttlSec !== undefined ? [["EXPIRE", key, ttlSec]] : []);
  switch (op.op) {
    case "getStr":
      return [["GET", op.key]];
    case "set": {
      const cmd: Cmd = ["SET", op.key, op.value];
      if (op.ttlMs !== undefined) cmd.push("PX", op.ttlMs);
      else if (op.ttlSec !== undefined) cmd.push("EX", op.ttlSec);
      if (op.nx) cmd.push("NX");
      return [cmd];
    }
    case "mget":
      return op.keys.length ? [["MGET", ...op.keys]] : [];
    case "del":
      return op.keys.length ? [["DEL", ...op.keys]] : [];
    case "expire":
      return [["EXPIRE", op.key, op.ttlSec]];
    case "incrBy":
      return [["INCRBY", op.key, op.n], ...exp(op.key, op.ttlSec)];
    case "hset": {
      const flat = Object.entries(op.fields).flatMap(([f, v]) => [f, String(v)]);
      return flat.length ? [["HSET", op.key, ...flat], ...exp(op.key, op.ttlSec)] : [];
    }
    case "hsetnx":
      return [["HSETNX", op.key, op.field, String(op.value)]];
    case "hget":
      return [["HGET", op.key, op.field]];
    case "hgetAllStr":
      return [["HGETALL", op.key]];
    case "hdel":
      return op.fields.length ? [["HDEL", op.key, ...op.fields]] : [];
    case "lpush":
      return [["LPUSH", op.key, op.value], ...(op.max !== undefined ? [["LTRIM", op.key, 0, op.max - 1]] : []), ...exp(op.key, op.ttlSec)];
    case "lrange":
      return [["LRANGE", op.key, op.start, op.stop]];
    case "zadd":
      return [["ZADD", op.key, ...(op.nx ? ["NX"] : []), op.score, op.member], ...exp(op.key, op.ttlSec)];
    case "zrem":
      return op.members.length ? [["ZREM", op.key, ...op.members]] : [];
    case "zrange":
      return [["ZRANGE", op.key, op.start, op.stop, ...(op.rev ? ["REV"] : []), "WITHSCORES"]];
    case "zincrBy":
      return [["ZINCRBY", op.key, op.n, op.member], ...exp(op.key, op.ttlSec)];
    case "zscore":
      return [["ZSCORE", op.key, op.member]];
    case "zmscore":
      return op.members.length ? [["ZMSCORE", op.key, ...op.members]] : [];
    case "zcard":
      return [["ZCARD", op.key]];
    case "sadd":
      return op.members.length ? [["SADD", op.key, ...op.members], ...exp(op.key, op.ttlSec)] : [];
    case "srem":
      return op.members.length ? [["SREM", op.key, ...op.members]] : [];
    case "smembers":
      return [["SMEMBERS", op.key]];
    case "sismember":
      return [["SISMEMBER", op.key, op.member]];
    case "scard":
      return [["SCARD", op.key]];
  }
}

/** Сколько команд Redis стоит операция (для лога `cmds=N` и бюджета Upstash). */
export function commandsFor(op: KvOp): number {
  return toCmds(op).length;
}

const str = (x: unknown): string | null => (typeof x === "string" ? x : typeof x === "number" ? String(x) : null);
const int = (x: unknown): number => Number(x) || 0;
const num = (x: unknown): number | null => {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};
const strings = (x: unknown): string[] => (Array.isArray(x) ? x.map(str).filter((s): s is string => s !== null) : []);

/** Ответ HGETALL в REST-формате: плоский список [поле, значение, …] (иногда уже объект) → поля-строки. */
function hashStrOf(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(raw)) {
    for (let i = 0; i + 1 < raw.length; i += 2) {
      const v = str(raw[i + 1]);
      if (v !== null) out[String(raw[i])] = v;
    }
  } else if (raw && typeof raw === "object") {
    for (const [f, v] of Object.entries(raw)) {
      const s = str(v);
      if (s !== null) out[f] = s;
    }
  }
  return out;
}

/** Результат операции из ответов её команд (r[0] — ответ первой команды; пустой r — операция без команд). */
function fromReplies(op: KvOp, r: unknown[]): unknown {
  switch (op.op) {
    case "getStr":
    case "hget":
      return str(r[0]);
    case "set":
      return r[0] === "OK";
    case "mget": {
      const arr = Array.isArray(r[0]) ? (r[0] as unknown[]) : [];
      return op.keys.map((_, i) => str(arr[i]));
    }
    case "del":
    case "hset":
    case "hdel":
    case "lpush":
    case "zadd":
    case "zrem":
    case "zcard":
    case "sadd":
    case "srem":
    case "scard":
    case "incrBy":
      return int(r[0]);
    case "expire":
    case "hsetnx":
    case "sismember":
      return int(r[0]) === 1;
    case "hgetAllStr":
      return hashStrOf(r[0]);
    case "lrange":
    case "smembers":
      return strings(r[0]);
    case "zrange": {
      const flat = Array.isArray(r[0]) ? (r[0] as unknown[]) : [];
      const out: ZEntry[] = [];
      for (let i = 0; i + 1 < flat.length; i += 2) {
        const member = str(flat[i]);
        const score = num(flat[i + 1]);
        if (member !== null && score !== null) out.push({ member, score });
      }
      return out;
    }
    case "zincrBy":
      return num(r[0]) ?? 0;
    case "zscore":
      return num(r[0]);
    case "zmscore": {
      const arr = Array.isArray(r[0]) ? (r[0] as unknown[]) : [];
      return op.members.map((_, i) => num(arr[i]));
    }
  }
}

/**
 * Клиент Upstash REST. fallback — память для «старых» методов ИИ-лимитов (запись без отказа); null — строгий клиент:
 * любая ошибка доходит до вызывающего. Строгие операции (KvStrictOps) не откатываются в любом случае.
 */
export function createUpstashKv(url: string, token: string, fallback: Kv | null, fetchImpl: typeof fetch = fetch): Kv {
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
  // Upstash не ответил — работаем на памяти, в лог пишем один раз за жизнь копии сервера. Без памяти-запаса — ошибка наверх.
  const safe = async <T>(run: () => Promise<T>, onFail: (fb: Kv) => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (e) {
      if (!fallback) throw e;
      if (!warned) {
        warned = true;
        console.error("[kv] upstash unavailable, using memory", e instanceof Error ? e.message : e);
      }
      return onFail(fallback);
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
  // Строгие операции: все команды пачки — одним запросом; ответы раскладываются обратно по операциям.
  const runOps = async (ops: readonly KvOp[]): Promise<unknown[]> => {
    const parts = ops.map(toCmds);
    const cmds = parts.flat();
    const replies = cmds.length ? await pipeline(cmds, STRICT_TIMEOUT_MS) : [];
    let at = 0;
    return ops.map((op, i) => {
      const r = replies.slice(at, at + parts[i].length);
      at += parts[i].length;
      return fromReplies(op, r);
    });
  };
  return {
    kind: "upstash",
    ...bindOps(runOps),
    incrBy: (key, n, ttlSec) =>
      safe(
        async () => Number((await pipeline([["INCRBY", key, n], ["EXPIRE", key, ttlSec]]))[0]) || 0,
        (fb) => fb.incrBy(key, n, ttlSec),
      ),
    get: (key) =>
      safe(
        async () => Number((await pipeline([["GET", key]]))[0] ?? 0) || 0,
        (fb) => fb.get(key),
      ),
    pushCapped: (key, value, max, ttlSec = 30 * 86_400) =>
      safe(
        async () => {
          await pipeline([["LPUSH", key, value], ["LTRIM", key, 0, max - 1], ["EXPIRE", key, ttlSec]]);
        },
        (fb) => fb.pushCapped(key, value, max, ttlSec),
      ),
    hincrBy: (key, field, n, ttlSec) =>
      safe(
        async () => Number((await pipeline([["HINCRBY", key, field, n], ["EXPIRE", key, ttlSec]]))[0]) || 0,
        (fb) => fb.hincrBy(key, field, n, ttlSec),
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
        (fb) => fb.hincrMany(key, fields, ttlSec),
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
  for (const [f, v] of Object.entries(hashStrOf(raw))) {
    const n = Number(v);
    if (Number.isFinite(n)) out[f] = n;
  }
  return out;
}

// ---------- одиночки ----------

/** Ключ одиночки памяти в globalThis: одна память на процесс, даже если модуль загружен несколькими точками входа. */
export const MEMORY_KV_KEY = Symbol.for("informatica.kv");
type KvGlobal = { [MEMORY_KV_KEY]?: Kv };

/** Память процесса (одиночка в globalThis). */
export function memoryKv(): Kv {
  const g = globalThis as KvGlobal;
  return (g[MEMORY_KV_KEY] ??= createMemoryKv());
}

function upstashEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

let shared: Kv | null = null;
let strict: Kv | null = null;

/** Хранилище сервера: Upstash, если заданы переменные окружения, иначе память процесса. */
export function getKv(): Kv {
  if (shared) return shared;
  const env = upstashEnv();
  shared = env ? createUpstashKv(env.url, env.token, memoryKv()) : memoryKv();
  // Без Upstash в production счётчики у каждой копии сервера свои: потолок расходов ИИ становится «на копию». Один раз за жизнь копии.
  if (shared.kind === "memory" && process.env.NODE_ENV === "production") {
    console.warn("[kv] memory store in production: AI limits are per instance");
  }
  return shared;
}

/** Хранилище без отката в память (соцчасть, дуэли): Upstash, а без него — та же память процесса, что у getKv(). */
export function getStrictKv(): Kv {
  if (strict) return strict;
  const env = upstashEnv();
  strict = env ? createUpstashKv(env.url, env.token, null) : memoryKv();
  return strict;
}

/** Сутки по времени Казахстана (UTC+5): «2026-10-04». Дневные лимиты сбрасываются в полночь по Астане. */
export function kzDay(now: number = Date.now()): string {
  return new Date(now + 5 * 3_600_000).toISOString().slice(0, 10);
}
