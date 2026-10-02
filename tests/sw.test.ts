import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

// Загружаем public/sw.js как есть, с заглушкой self.
const code = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const listeners: Record<string, unknown> = {};
const sandbox: Record<string, unknown> = {
  self: { addEventListener: (n: string, f: unknown) => (listeners[n] = f), registration: {}, clients: {}, location: { search: "", origin: "https://x.test" } },
  URL,
};
runInNewContext(code, sandbox);
const sw = sandbox as {
  routeFor: (req: unknown, origin: string) => string;
  cacheable: (res: unknown) => boolean;
  fetchAndCache: (event: unknown, key: unknown) => Promise<unknown>;
  trimRuntime: (cache: unknown) => Promise<void>;
  CACHE_PREFIX: string;
  CORE_CACHE: string;
  RUNTIME_CACHE: string;
  RUNTIME_MAX: number;
};

const ORIGIN = "https://x.test";
const req = (path: string, extra: Record<string, unknown> = {}) => ({ method: "GET", url: ORIGIN + path, mode: "no-cors", headers: new Headers(), ...extra });

describe("sw: стратегия для запроса", () => {
  it("/_next/static — cache-first", () => {
    expect(sw.routeFor(req("/_next/static/chunks/a.js"), ORIGIN)).toBe("static");
  });
  it("переходы по страницам — network-first", () => {
    expect(sw.routeFor(req("/learn", { mode: "navigate" }), ORIGIN)).toBe("page");
    expect(sw.routeFor(req("/", { mode: "navigate" }), ORIGIN)).toBe("page");
  });
  it("шрифты и картинки — stale-while-revalidate", () => {
    expect(sw.routeFor(req("/icons/icon-192.png"), ORIGIN)).toBe("swr");
    expect(sw.routeFor(req("/media/x.mp3"), ORIGIN)).toBe("swr");
  });
  it("/api/* не трогаем никогда (даже переходом)", () => {
    expect(sw.routeFor(req("/api/tutor"), ORIGIN)).toBe("ignore");
    expect(sw.routeFor(req("/api/tutor", { mode: "navigate" }), ORIGIN)).toBe("ignore");
    expect(sw.routeFor(req("/api"), ORIGIN)).toBe("ignore");
  });
  it("не GET и чужой домен — мимо", () => {
    expect(sw.routeFor(req("/learn", { method: "POST" }), ORIGIN)).toBe("ignore");
    expect(sw.routeFor({ method: "GET", url: "https://cdn.jsdelivr.net/pyodide/pyodide.js", mode: "no-cors" }, ORIGIN)).toBe("ignore");
  });
  it("RSC-запросы Next и сам sw.js — мимо", () => {
    expect(sw.routeFor(req("/learn?_rsc=abc"), ORIGIN)).toBe("ignore");
    expect(sw.routeFor(req("/learn", { headers: new Headers({ RSC: "1" }) }), ORIGIN)).toBe("ignore");
    expect(sw.routeFor(req("/sw.js"), ORIGIN)).toBe("ignore");
  });
  it("запросы с Range (аудио) — мимо", () => {
    expect(sw.routeFor(req("/media/x.mp3", { headers: new Headers({ Range: "bytes=0-" }) }), ORIGIN)).toBe("ignore");
  });
  it("битый URL — мимо, без исключения", () => {
    expect(sw.routeFor({ method: "GET", url: "http://[", mode: "no-cors" }, ORIGIN)).toBe("ignore");
  });
});

describe("sw: кэш", () => {
  it("кэшируем только успешные ответы своего домена без редиректа", () => {
    expect(sw.cacheable({ status: 200, type: "basic", redirected: false })).toBe(true);
    expect(sw.cacheable({ status: 404, type: "basic", redirected: false })).toBe(false);
    expect(sw.cacheable({ status: 200, type: "opaque", redirected: false })).toBe(false);
    expect(sw.cacheable({ status: 200, type: "basic", redirected: true })).toBe(false);
    expect(sw.cacheable(null)).toBe(false);
  });
  it("имена кэшей версионные, с общим префиксом для чистки старых", () => {
    for (const n of [sw.CORE_CACHE, sw.RUNTIME_CACHE]) {
      expect(n.startsWith(sw.CACHE_PREFIX)).toBe(true);
      expect(n).not.toBe(sw.CACHE_PREFIX);
    }
    expect(sw.CORE_CACHE).not.toBe(sw.RUNTIME_CACHE);
  });
  it("запись в кэш регистрируется в waitUntil сразу (иначе после ответа из кэша браузер её отвергнет)", () => {
    const waits: unknown[] = [];
    sandbox.fetch = () => new Promise(() => {});
    void sw.fetchAndCache({ request: {}, waitUntil: (p: unknown) => waits.push(p) }, "k");
    expect(waits).toHaveLength(1);
  });
  it("рабочий кэш обрезается до лимита, удаляются самые старые", async () => {
    const keys = Array.from({ length: sw.RUNTIME_MAX + 3 }, (_, i) => `k${i}`);
    const deleted: string[] = [];
    await sw.trimRuntime({ keys: async () => keys, delete: async (k: string) => void deleted.push(k) });
    expect(deleted).toEqual(["k0", "k1", "k2"]);
    deleted.length = 0;
    await sw.trimRuntime({ keys: async () => keys.slice(0, 5), delete: async (k: string) => void deleted.push(k) });
    expect(deleted).toEqual([]);
  });
  it("обработчики install/activate/fetch зарегистрированы, напоминания сохранены", () => {
    for (const n of ["install", "activate", "fetch", "periodicsync", "notificationclick"]) expect(typeof listeners[n]).toBe("function");
  });
});
