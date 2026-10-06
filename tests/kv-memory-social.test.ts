import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createMemoryKv, createUpstashKv, commandsFor, MEMORY_KV_KEY } = await import("@/server/kv");

// Семантика строгих операций соцчасти в памяти (как в Redis) на подменных часах, конвейер Upstash и одиночка в globalThis.

const clock = () => {
  const c = { t: 1_000_000 };
  return { c, kv: createMemoryKv(() => c.t) };
};

describe("память: строки, SET NX/EX/PX, MGET, DEL, EXPIRE", () => {
  it("SET без срока бессрочный; SET EX истекает; SET NX не перезаписывает живой ключ", async () => {
    const { c, kv } = clock();
    expect(await kv.set("a", "1")).toBe(true);
    expect(await kv.set("b", "2", { ttlSec: 10 })).toBe(true);
    expect(await kv.set("b", "3", { nx: true, ttlSec: 10 })).toBe(false);
    expect(await kv.getStr("b")).toBe("2");
    c.t += 10_000;
    expect(await kv.getStr("b")).toBeNull();
    expect(await kv.set("b", "4", { nx: true, ttlSec: 10 })).toBe(true);
    expect(await kv.getStr("b")).toBe("4");
    c.t += 10 * 86_400_000;
    expect(await kv.getStr("a")).toBe("1");
  });

  it("SET PX — срок в миллисекундах; SET без срока снимает старый срок", async () => {
    const { c, kv } = clock();
    await kv.set("k", "v", { ttlMs: 1500 });
    c.t += 1499;
    expect(await kv.getStr("k")).toBe("v");
    c.t += 1;
    expect(await kv.getStr("k")).toBeNull();
    await kv.set("k", "v", { ttlSec: 1 });
    await kv.set("k", "w");
    c.t += 5000;
    expect(await kv.getStr("k")).toBe("w");
  });

  it("MGET: по порядку, нет ключа или чужой тип — null; DEL считает удалённые; EXPIRE на живом/мёртвом", async () => {
    const { c, kv } = clock();
    await kv.set("x", "1");
    await kv.sadd("s", ["m"]);
    expect(await kv.mget(["x", "нет", "s"])).toEqual(["1", null, null]);
    expect(await kv.mget([])).toEqual([]);
    expect(await kv.expire("x", 5)).toBe(true);
    expect(await kv.expire("нет", 5)).toBe(false);
    c.t += 5000;
    expect(await kv.getStr("x")).toBeNull();
    await kv.set("y", "1");
    expect(await kv.del(["y", "s", "нет"])).toBe(2);
    expect(await kv.del([])).toBe(0);
    expect(await kv.smembers("s")).toEqual([]);
  });

  it("чужой тип — ошибка WRONGTYPE, как в Redis (строгие операции)", async () => {
    const { kv } = clock();
    await kv.set("str", "1");
    await expect(kv.sadd("str", ["a"])).rejects.toThrow(/WRONGTYPE/);
    await expect(kv.zadd("str", 1, "a")).rejects.toThrow(/WRONGTYPE/);
    // Старые методы ИИ-лимитов на чужом типе не падают (как раньше: «нет данных»).
    await kv.sadd("set", ["a"]);
    expect(await kv.get("set")).toBe(0);
    expect(await kv.hgetAll("set")).toEqual({});
  });
});

describe("память: хеши (HSET, HSETNX, HGETALL, HDEL)", () => {
  it("HSETNX пишет поле один раз; HSET возвращает число новых полей; HDEL последнего поля удаляет ключ", async () => {
    const { c, kv } = clock();
    expect(await kv.hsetnx("m", "a:0", "1|900|2")).toBe(true);
    expect(await kv.hsetnx("m", "a:0", "0|100|0")).toBe(false);
    expect(await kv.hget("m", "a:0")).toBe("1|900|2");
    expect(await kv.hset("m", { mode: "blitz", seed: 42 }, 60)).toBe(2);
    expect(await kv.hset("m", { mode: "ten", n: 10 })).toBe(1);
    expect(await kv.hgetAllStr("m")).toEqual({ "a:0": "1|900|2", mode: "ten", seed: "42", n: "10" });
    // HSET без срока не трогает срок, выставленный раньше.
    c.t += 60_000;
    expect(await kv.hgetAllStr("m")).toEqual({});
    await kv.hset("h", { a: "1" });
    expect(await kv.hdel("h", ["a", "b"])).toBe(1);
    expect(await kv.hsetnx("h", "a", "2")).toBe(true);
    expect(await kv.hset("h", {})).toBe(0);
  });

  it("числовые поля читаются и старым hgetAll (счётчики) — один хеш на обе стороны", async () => {
    const { kv } = clock();
    await kv.hincrBy("d", "x", 3, 60);
    await kv.hset("d", { y: "7", z: "не число" });
    expect(await kv.hgetAll("d")).toEqual({ x: 3, y: 7 });
    expect(await kv.hgetAllStr("d")).toEqual({ x: "3", y: "7", z: "не число" });
  });
});

describe("память: сортированные множества", () => {
  it("ZADD/ZRANGE: по очкам, при равенстве — по имени; REV; отрицательные индексы", async () => {
    const { kv } = clock();
    await kv.zadd("q", 30, "c");
    await kv.zadd("q", 10, "b");
    await kv.zadd("q", 10, "a");
    await kv.zadd("q", 20, "d");
    expect((await kv.zrange("q", 0, -1)).map((e) => e.member)).toEqual(["a", "b", "d", "c"]);
    expect(await kv.zrange("q", 0, 1, { rev: true })).toEqual([
      { member: "c", score: 30 },
      { member: "d", score: 20 },
    ]);
    expect(await kv.zrange("q", -2, -1)).toEqual([
      { member: "d", score: 20 },
      { member: "c", score: 30 },
    ]);
    expect(await kv.zrange("нет", 0, -1)).toEqual([]);
    expect(await kv.zcard("q")).toBe(4);
  });

  it("ZADD NX не меняет очки; без NX обновляет и возвращает 0 для старого члена", async () => {
    const { kv } = clock();
    expect(await kv.zadd("z", 1, "m")).toBe(1);
    expect(await kv.zadd("z", 5, "m", { nx: true })).toBe(0);
    expect(await kv.zscore("z", "m")).toBe(1);
    expect(await kv.zadd("z", 5, "m")).toBe(0);
    expect(await kv.zscore("z", "m")).toBe(5);
  });

  it("ZREM — «захват»: только один из двух получает 1; пустое множество исчезает", async () => {
    const { kv } = clock();
    await kv.zadd("q", 1, "t1");
    const [a, b] = await Promise.all([kv.zrem("q", ["t1"]), kv.zrem("q", ["t1"])]);
    expect(a + b).toBe(1);
    expect(await kv.zcard("q")).toBe(0);
    expect(await kv.zrem("q", [])).toBe(0);
  });

  it("ZINCRBY, ZSCORE, ZMSCORE; срок ключа через ttlSec на подменных часах", async () => {
    const { c, kv } = clock();
    expect(await kv.zincrBy("top", 3, "p1", 15 * 86_400)).toBe(3);
    expect(await kv.zincrBy("top", 2, "p1")).toBe(5);
    await kv.zincrBy("top", 1, "p2");
    expect(await kv.zmscore("top", ["p2", "нет", "p1"])).toEqual([1, null, 5]);
    expect(await kv.zmscore("top", [])).toEqual([]);
    expect(await kv.zscore("top", "нет")).toBeNull();
    c.t += 15 * 86_400_000;
    expect(await kv.zmscore("top", ["p1"])).toEqual([null]);
    // ZADD с ttlSec продлевает очередь, как ZADD + EXPIRE.
    await kv.zadd("q", 1, "x", { ttlSec: 120 });
    c.t += 119_000;
    await kv.zadd("q", 2, "y", { ttlSec: 120 });
    c.t += 119_000;
    expect(await kv.zcard("q")).toBe(2);
  });
});

describe("память: множества", () => {
  it("SADD/SREM/SMEMBERS/SCARD/SISMEMBER, срок и удаление пустого", async () => {
    const { c, kv } = clock();
    expect(await kv.sadd("fr", ["a", "b", "a"], 180 * 86_400)).toBe(2);
    expect(await kv.sadd("fr", ["b", "c"])).toBe(1);
    expect((await kv.smembers("fr")).sort()).toEqual(["a", "b", "c"]);
    expect(await kv.scard("fr")).toBe(3);
    expect(await kv.sismember("fr", "a")).toBe(true);
    expect(await kv.srem("fr", ["a", "zz"])).toBe(1);
    expect(await kv.sismember("fr", "a")).toBe(false);
    expect(await kv.sadd("fr", [])).toBe(0);
    c.t += 180 * 86_400_000;
    expect(await kv.scard("fr")).toBe(0);
    await kv.sadd("e", ["x"]);
    await kv.srem("e", ["x"]);
    expect(await kv.set("e", "теперь строка", { nx: true })).toBe(true);
  });
});

describe("память: списки и конвейер", () => {
  it("LPUSH с потолком и сроком, LRANGE", async () => {
    const { c, kv } = clock();
    for (let i = 1; i <= 4; i++) await kv.pipeline([{ op: "lpush", key: "inbox", value: `m${i}`, max: 3, ttlSec: 60 }]);
    expect(await kv.lrange("inbox", 0, -1)).toEqual(["m4", "m3", "m2"]);
    c.t += 60_000;
    expect(await kv.lrange("inbox", 0, -1)).toEqual([]);
  });

  it("pipeline возвращает результаты по порядку операций; INCRBY без срока сохраняет старый срок", async () => {
    const { c, kv } = clock();
    const res = await kv.pipeline([
      { op: "set", key: "s", value: "v", nx: true, ttlSec: 30 },
      { op: "incrBy", key: "n", n: 2, ttlSec: 30 },
      { op: "incrBy", key: "n", n: 5 },
      { op: "zadd", key: "z", score: 1, member: "a" },
      { op: "smembers", key: "нет" },
      { op: "getStr", key: "s" },
    ]);
    expect(res).toEqual([true, 2, 7, 1, [], "v"]);
    c.t += 30_000;
    expect(await kv.get("n")).toBe(0);
  });
});

describe("конвейер: одинаковое поведение ошибок в памяти и Upstash", () => {
  it("память: ошибка одной операции не останавливает остальные, бросается первая ошибка после всей пачки", async () => {
    const { kv } = clock();
    await kv.set("str", "x");
    await expect(
      kv.pipeline([
        { op: "set", key: "before", value: "1" },
        { op: "sadd", key: "str", members: ["a"] },
        { op: "zadd", key: "str", score: 1, member: "b" },
        { op: "set", key: "after", value: "2" },
      ]),
    ).rejects.toThrow(/WRONGTYPE/);
    // как Upstash /pipeline: команды после ошибочной тоже применены
    expect(await kv.mget(["before", "after"])).toEqual(["1", "2"]);
  });

  it("lpush max < 1 — ошибка до запуска (ни одна операция пачки не применена), в памяти и в Upstash", async () => {
    const { kv } = clock();
    await expect(
      kv.pipeline([
        { op: "set", key: "k", value: "v" },
        { op: "lpush", key: "l", value: "m", max: 0 },
      ]),
    ).rejects.toThrow(/max must be/);
    expect(await kv.getStr("k")).toBeNull();
    await expect(kv.pipeline([{ op: "lpush", key: "l", value: "m", max: 1.5 }])).rejects.toThrow(/max must be/);

    let calls = 0;
    const fetchMock = (async () => {
      calls++;
      return new Response("[]", { status: 200 });
    }) as unknown as typeof fetch;
    const up = createUpstashKv("https://x.upstash.io", "tok", null, fetchMock);
    await expect(up.pipeline([{ op: "set", key: "k", value: "v" }, { op: "lpush", key: "l", value: "m", max: 0 }])).rejects.toThrow(
      /max must be/,
    );
    expect(calls).toBe(0);
  });

  it("Upstash: ошибка одной команды в ответе — бросается (остальные команды Redis уже выполнил)", async () => {
    const fetchMock = (async () =>
      new Response(JSON.stringify([{ result: "OK" }, { error: "WRONGTYPE Operation against a key" }, { result: "OK" }]), {
        status: 200,
      })) as unknown as typeof fetch;
    const up = createUpstashKv("https://x.upstash.io", "tok", null, fetchMock);
    await expect(
      up.pipeline([
        { op: "set", key: "a", value: "1" },
        { op: "sadd", key: "a", members: ["x"] },
        { op: "set", key: "b", value: "2" },
      ]),
    ).rejects.toThrow(/WRONGTYPE/);
  });
});

describe("Upstash: строгие операции одним конвейером, без отката в память", () => {
  const make = (replies: unknown[][], status = 200) => {
    const calls: unknown[] = [];
    const fetchMock = (async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)));
      if (status !== 200) return new Response("no", { status });
      return new Response(JSON.stringify((replies.shift() ?? []).map((result) => ({ result }))), { status: 200 });
    }) as unknown as typeof fetch;
    return { kv: createUpstashKv("https://x.upstash.io", "tok", createMemoryKv(), fetchMock), calls };
  };

  it("команды и разбор ответов", async () => {
    const { kv, calls } = make([["OK", null, 3, 1, ["m", "2", "n", "1.5"], ["5", null], 1, ["a", "1"], 0, 1]]);
    const res = await kv.pipeline([
      { op: "set", key: "pl:code:K", value: "pid", nx: true, ttlSec: 60 },
      { op: "getStr", key: "nope" },
      { op: "zincrBy", key: "top", n: 3, member: "p", ttlSec: 100 },
      { op: "zrange", key: "q", start: 0, stop: 9, rev: true },
      { op: "zmscore", key: "top", members: ["p", "q"] },
      { op: "hsetnx", key: "m", field: "a:0", value: "1" },
      { op: "hgetAllStr", key: "h" },
      { op: "zmscore", key: "top", members: [] },
      { op: "sismember", key: "s", member: "x" },
    ]);
    expect(calls[0]).toEqual([
      ["SET", "pl:code:K", "pid", "EX", 60, "NX"],
      ["GET", "nope"],
      ["ZINCRBY", "top", 3, "p"],
      ["EXPIRE", "top", 100],
      ["ZRANGE", "q", 0, 9, "REV", "WITHSCORES"],
      ["ZMSCORE", "top", "p", "q"],
      ["HSETNX", "m", "a:0", "1"],
      ["HGETALL", "h"],
      ["SISMEMBER", "s", "x"],
    ]);
    expect(res).toEqual([true, null, 3, [{ member: "m", score: 2 }, { member: "n", score: 1.5 }], [5, null], true, { a: "1" }, [], false]);
  });

  it("SET NX занят (null) → false; ZADD NX + EXPIRE; число команд для лога", async () => {
    const { kv, calls } = make([[null], [1, 1]]);
    expect(await kv.set("k", "v", { nx: true, ttlMs: 2000 })).toBe(false);
    expect(await kv.zadd("q", 5, "t", { nx: true, ttlSec: 120 })).toBe(1);
    expect(calls).toEqual([[["SET", "k", "v", "PX", 2000, "NX"]], [["ZADD", "q", "NX", 5, "t"], ["EXPIRE", "q", 120]]]);
    expect(commandsFor({ op: "lpush", key: "l", value: "v", max: 20, ttlSec: 60 })).toBe(3);
    expect(commandsFor({ op: "del", keys: [] })).toBe(0);
  });

  it("Upstash не ответил — строгая операция бросает (а не уходит в память)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { kv } = make([], 500);
    await expect(kv.sadd("s", ["a"])).rejects.toThrow(/upstash http 500/);
    await expect(kv.pipeline([{ op: "getStr", key: "k" }])).rejects.toThrow();
    // Старые методы ИИ-лимитов по-прежнему уходят в память.
    expect(await kv.incrBy("c", 1, 60)).toBe(1);
  });

  it("строгий клиент (fallback = null) бросает и на старых методах", async () => {
    const fetchMock = (async () => new Response("no", { status: 503 })) as unknown as typeof fetch;
    const kv = createUpstashKv("https://x.upstash.io", "tok", null, fetchMock);
    await expect(kv.incrBy("c", 1, 60)).rejects.toThrow(/503/);
  });
});

describe("одиночка памяти в globalThis", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("два отдельно загруженных экземпляра модуля делят одну память процесса", async () => {
    for (const k of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) vi.stubEnv(k, "");
    vi.resetModules();
    const a = await import("@/server/kv");
    vi.resetModules();
    const b = await import("@/server/kv");
    expect(a.getKv).not.toBe(b.getKv);
    await a.getKv().set("shared", "1");
    expect(await b.getKv().getStr("shared")).toBe("1");
    expect(await b.getStrictKv().getStr("shared")).toBe("1");
    expect((globalThis as Record<symbol, unknown>)[MEMORY_KV_KEY]).toBe(a.memoryKv());
    await a.getKv().del(["shared"]);
  });

  it("сроки ключей одиночки идут по serverNow(): тестовый сдвиг часов истекает ключи (DUEL_TEST_HOOKS=1)", async () => {
    for (const k of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) vi.stubEnv(k, "");
    vi.stubEnv("DUEL_TEST_HOOKS", "1");
    vi.stubEnv("VERCEL", "");
    const g = globalThis as Record<symbol, unknown>;
    const saved = g[MEMORY_KV_KEY];
    delete g[MEMORY_KV_KEY];
    const clockMod = await import("@/server/clock");
    try {
      vi.resetModules();
      const m = await import("@/server/kv");
      const kv = m.memoryKv();
      await kv.set("du:tk:x", "1", { ttlSec: 60 });
      expect(clockMod.advanceClock(59_000)).toBe(59_000);
      expect(await kv.getStr("du:tk:x")).toBe("1");
      clockMod.advanceClock(1_000);
      expect(await kv.getStr("du:tk:x")).toBeNull();
    } finally {
      clockMod.resetClock();
      g[MEMORY_KV_KEY] = saved;
    }
  });
});
