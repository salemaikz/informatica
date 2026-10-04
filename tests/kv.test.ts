import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createMemoryKv, createUpstashKv, kzDay } = await import("@/server/kv");

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
