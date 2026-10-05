import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createMemoryKv, createUpstashKv, kzDay, HASH_MAX_FIELDS } = await import("@/server/kv");

describe("хранилище сервера: память", () => {
  it("счётчик растёт, уменьшается и сбрасывается по времени жизни", async () => {
    let t = 1_000;
    const kv = createMemoryKv(() => t);
    expect(await kv.incrBy("a", 2, 10)).toBe(2);
    expect(await kv.incrBy("a", 3, 10)).toBe(5);
    expect(await kv.incrBy("a", -1, 10)).toBe(4);
    expect(await kv.get("a")).toBe(4);
    t += 11_000;
    expect(await kv.get("a")).toBe(0);
    expect(await kv.incrBy("a", 1, 10)).toBe(1);
  });

  it("список хранит последние записи", async () => {
    const kv = createMemoryKv();
    for (let i = 0; i < 5; i++) await kv.pushCapped("l", String(i), 3);
    // Внутреннее содержимое списка не читается через интерфейс — проверяем, что вызовы не падают.
    expect(await kv.get("l")).toBe(0);
  });
});

describe("хранилище сервера: Upstash", () => {
  it("шлёт команды одним пакетом и читает ответ", async () => {
    const calls: { url: string; body: unknown; auth: string | null }[] = [];
    const fetchMock = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") });
      return new Response(JSON.stringify([{ result: 7 }, { result: 1 }]), { status: 200 });
    }) as unknown as typeof fetch;
    const kv = createUpstashKv("https://x.upstash.io/", "tok", createMemoryKv(), fetchMock);
    expect(await kv.incrBy("k", 7, 60)).toBe(7);
    expect(calls[0].url).toBe("https://x.upstash.io/pipeline");
    expect(calls[0].auth).toBe("Bearer tok");
    expect(calls[0].body).toEqual([["INCRBY", "k", 7], ["EXPIRE", "k", 60]]);
  });

  it("Upstash недоступен — работает на памяти и не бросает", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    const kv = createUpstashKv("https://x.upstash.io", "tok", createMemoryKv(), fetchMock);
    expect(await kv.incrBy("k", 2, 60)).toBe(2);
    expect(await kv.incrBy("k", 2, 60)).toBe(4);
    await expect(kv.pushCapped("l", "v", 10)).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });
});

describe("хранилище сервера: хеши и срезы списка (память)", () => {
  it("hincrBy: поле растёт, возвращает новое значение; hgetAll отдаёт все поля", async () => {
    const kv = createMemoryKv();
    expect(await kv.hincrBy("h", "a", 2, 60)).toBe(2);
    expect(await kv.hincrBy("h", "a", 3, 60)).toBe(5);
    expect(await kv.hincrBy("h", "b", 1, 60)).toBe(1);
    expect(await kv.hgetAll("h")).toEqual({ a: 5, b: 1 });
    expect(await kv.hgetAll("нет")).toEqual({});
  });

  it("hincrMany: несколько полей разом (в том числе отрицательные), hgetAllMany — по порядку ключей", async () => {
    const kv = createMemoryKv();
    await kv.hincrMany("d1", { x: 3, y: 1 }, 60);
    await kv.hincrMany("d1", { x: 2, z: 7, y: -1 }, 60);
    await kv.hincrMany("d2", { q: 1 }, 60);
    expect(await kv.hgetAllMany(["d1", "нет", "d2"])).toEqual([{ x: 5, y: 0, z: 7 }, {}, { q: 1 }]);
    await expect(kv.hincrMany("d3", {}, 60)).resolves.toBe(0);
    expect(await kv.hgetAllMany([])).toEqual([]);
  });

  it("hincrMany возвращает, сколько полей создано впервые", async () => {
    const kv = createMemoryKv();
    expect(await kv.hincrMany("h", { a: 1, b: 2, c: 3 }, 60)).toBe(3);
    expect(await kv.hincrMany("h", { a: 1, d: 1 }, 60)).toBe(1);
    expect(await kv.hincrMany("h", { a: 5 }, 60)).toBe(0);
  });

  it("hmgetMany: только нужные поля, по порядку ключей; нет ключа или поля — пусто", async () => {
    const kv = createMemoryKv();
    await kv.hincrMany("ev:a", { "act:0": 4, "act:7": 2, "ls:x:learn": 9 }, 60);
    await kv.hincrMany("ev:b", { "act:1": 1 }, 60);
    expect(await kv.hmgetMany(["ev:a", "ev:b", "ev:none"], ["act:0", "act:1", "act:7", "act:30"])).toEqual([{ "act:0": 4, "act:7": 2 }, { "act:1": 1 }, {}]);
  });

  it("время жизни хеша: после ttl поля исчезают, ttl продлевается каждой записью", async () => {
    let t = 1_000;
    const kv = createMemoryKv(() => t);
    await kv.hincrMany("h", { a: 1 }, 10);
    t += 8_000;
    await kv.hincrBy("h", "a", 1, 10);
    t += 8_000;
    expect(await kv.hgetAll("h")).toEqual({ a: 2 });
    t += 3_000;
    expect(await kv.hgetAll("h")).toEqual({});
    expect(await kv.hincrBy("h", "a", 1, 10)).toBe(1);
  });

  it("у хеша не больше 5000 полей: новое поле сверх потолка не пишется, старые растут", async () => {
    const kv = createMemoryKv();
    const fields: Record<string, number> = {};
    for (let i = 0; i < HASH_MAX_FIELDS + 50; i++) fields[`f${i}`] = 1;
    await kv.hincrMany("big", fields, 60);
    const all = await kv.hgetAll("big");
    expect(Object.keys(all)).toHaveLength(HASH_MAX_FIELDS);
    expect(all.f0).toBe(1);
    expect(all[`f${HASH_MAX_FIELDS}`]).toBeUndefined();
    expect(await kv.hincrBy("big", "f0", 4, 60)).toBe(5);
    expect(await kv.hincrBy("big", "новое", 1, 60)).toBe(0);
    expect(Object.keys(await kv.hgetAll("big"))).toHaveLength(HASH_MAX_FIELDS);
  });

  it("lrange: новые записи в начале, индексы включительно, отрицательные — с конца", async () => {
    const kv = createMemoryKv();
    for (let i = 1; i <= 5; i++) await kv.pushCapped("l", `v${i}`, 4);
    expect(await kv.lrange("l", 0, -1)).toEqual(["v5", "v4", "v3", "v2"]);
    expect(await kv.lrange("l", 0, 1)).toEqual(["v5", "v4"]);
    expect(await kv.lrange("l", 1, 2)).toEqual(["v4", "v3"]);
    expect(await kv.lrange("l", -2, -1)).toEqual(["v3", "v2"]);
    expect(await kv.lrange("l", 10, 20)).toEqual([]);
    expect(await kv.lrange("нет", 0, -1)).toEqual([]);
  });
});

describe("хранилище сервера: Upstash — хеши и срезы", () => {
  const make = (replies: unknown[][]) => {
    const calls: unknown[] = [];
    const fetchMock = (async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify((replies.shift() ?? []).map((result) => ({ result }))), { status: 200 });
    }) as unknown as typeof fetch;
    return { kv: createUpstashKv("https://x.upstash.io", "tok", createMemoryKv(), fetchMock), calls };
  };

  it("hincrMany: одна команда HINCRBY на поле и EXPIRE — одним запросом", async () => {
    const { kv, calls } = make([[2, 1, 1]]);
    await kv.hincrMany("ev:2026-10-05", { "lesson_start": 2, "ls:a:learn": 1 }, 400 * 86_400);
    expect(calls).toEqual([[["HINCRBY", "ev:2026-10-05", "lesson_start", 2], ["HINCRBY", "ev:2026-10-05", "ls:a:learn", 1], ["EXPIRE", "ev:2026-10-05", 34_560_000]]]);
  });

  it("hincrMany с пустым набором полей ничего не шлёт", async () => {
    const { kv, calls } = make([]);
    expect(await kv.hincrMany("k", {}, 60)).toBe(0);
    expect(calls).toEqual([]);
  });

  it("hincrMany: новое поле — когда после прибавления в нём ровно n (у старого было бы больше)", async () => {
    // a: 2 → стало 2 (новое), b: 1 → стало 5 (было), c: 3 → стало 3 (новое)
    const { kv } = make([[2, 5, 3, 1]]);
    expect(await kv.hincrMany("k", { a: 2, b: 1, c: 3 }, 60)).toBe(2);
  });

  it("hincrBy: HINCRBY + EXPIRE, возвращает новое значение", async () => {
    const { kv, calls } = make([[7, 1]]);
    expect(await kv.hincrBy("k", "f", 7, 60)).toBe(7);
    expect(calls[0]).toEqual([["HINCRBY", "k", "f", 7], ["EXPIRE", "k", 60]]);
  });

  it("hgetAll / hgetAllMany: плоский список [поле, значение, …] превращается в объект с числами", async () => {
    const { kv, calls } = make([[["a", "3", "b", "10"]], [["a", "1"], [], ["x", "2", "мусор", "не число"]]]);
    expect(await kv.hgetAll("k")).toEqual({ a: 3, b: 10 });
    expect(await kv.hgetAllMany(["k1", "k2", "k3"])).toEqual([{ a: 1 }, {}, { x: 2 }]);
    expect(calls[0]).toEqual([["HGETALL", "k"]]);
    expect(calls[1]).toEqual([["HGETALL", "k1"], ["HGETALL", "k2"], ["HGETALL", "k3"]]);
  });

  it("lrange: передаёт границы и возвращает только строки", async () => {
    const { kv, calls } = make([[["a", "b", 5, null]]]);
    expect(await kv.lrange("issues", 0, 99)).toEqual(["a", "b"]);
    expect(calls[0]).toEqual([["LRANGE", "issues", 0, 99]]);
  });

  it("hmgetMany: HMGET нужных полей по каждому ключу одним запросом; нет поля (null) — его нет в объекте", async () => {
    const { kv, calls } = make([[["4", null, "2", null], [null, null, null, null], ["1", "мусор", null, "7"]]]);
    expect(await kv.hmgetMany(["ev:a", "ev:b", "ev:c"], ["act:0", "act:1", "act:7", "act:30"])).toEqual([{ "act:0": 4, "act:7": 2 }, {}, { "act:0": 1, "act:30": 7 }]);
    expect(calls).toEqual([
      [
        ["HMGET", "ev:a", "act:0", "act:1", "act:7", "act:30"],
        ["HMGET", "ev:b", "act:0", "act:1", "act:7", "act:30"],
        ["HMGET", "ev:c", "act:0", "act:1", "act:7", "act:30"],
      ],
    ]);
  });

  it("hmgetMany без ключей или без полей ничего не шлёт", async () => {
    const { kv, calls } = make([]);
    expect(await kv.hmgetMany([], ["a"])).toEqual([]);
    expect(await kv.hmgetMany(["k1", "k2"], [])).toEqual([{}, {}]);
    expect(calls).toEqual([]);
  });

  it("Upstash недоступен — запись идёт в память и не бросает, а ЧТЕНИЯ для страницы владельца бросают (не подменяются пустой памятью)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    const memory = createMemoryKv();
    const kv = createUpstashKv("https://x.upstash.io", "tok", memory, fetchMock);
    expect(await kv.hincrMany("h", { a: 2 }, 60)).toBe(1);
    expect(await kv.hincrBy("h", "a", 1, 60)).toBe(3);
    await kv.pushCapped("l", "v", 10);
    // Запись ушла в память-запас, но читать её «вместо Upstash» нельзя: нулевые таблицы выглядели бы как «данных нет».
    await expect(kv.hgetAll("h")).rejects.toThrow(/upstash http 500/);
    await expect(kv.hgetAllMany(["h"])).rejects.toThrow();
    await expect(kv.hmgetMany(["h"], ["a"])).rejects.toThrow();
    await expect(kv.lrange("l", 0, -1)).rejects.toThrow();
    expect(await memory.hgetAll("h")).toEqual({ a: 3 });
    // Ошибка чтения попала в журнал.
    expect(err.mock.calls.some((c) => String(c[0]).includes("upstash read failed"))).toBe(true);
    err.mockRestore();
  });
});

describe("сутки по Казахстану", () => {
  it("полночь по Астане (UTC+5)", () => {
    expect(kzDay(Date.UTC(2026, 9, 4, 18, 59))).toBe("2026-10-04");
    expect(kzDay(Date.UTC(2026, 9, 4, 19, 0))).toBe("2026-10-05");
  });
});

describe("getKv: предупреждение про память в production", () => {
  const load = async () => {
    vi.resetModules();
    return await import("@/server/kv");
  };
  const noRedis = () => {
    for (const k of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) vi.stubEnv(k, "");
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("production без Upstash: один раз за жизнь копии — «memory store in production: AI limits are per instance»", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    noRedis();
    vi.stubEnv("NODE_ENV", "production");
    const { getKv } = await load();
    expect(getKv().kind).toBe("memory");
    getKv();
    getKv();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[kv] memory store in production: AI limits are per instance");
  });

  it("не production — без предупреждения", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    noRedis();
    vi.stubEnv("NODE_ENV", "development");
    const { getKv } = await load();
    expect(getKv().kind).toBe("memory");
    expect(warn).not.toHaveBeenCalled();
  });

  it("production с Upstash — без предупреждения", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    noRedis();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://x.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    vi.stubEnv("NODE_ENV", "production");
    const { getKv } = await load();
    expect(getKv().kind).toBe("upstash");
    expect(warn).not.toHaveBeenCalled();
  });
});
