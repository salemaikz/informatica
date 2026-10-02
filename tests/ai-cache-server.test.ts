import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Data Cache Next в тестах: простое хранилище по ключу или «недоступно» (бросает до вызова генератора).
const store = new Map<string, unknown>();
const state = { broken: false, failOnSave: false };
vi.mock("next/cache", () => ({
  unstable_cache:
    (fn: () => Promise<unknown>, keyParts: string[]) =>
    async () => {
      if (state.broken) throw new Error("no incremental cache");
      const k = keyParts.join("|");
      if (store.has(k)) return store.get(k);
      const v = await fn();
      if (state.failOnSave) throw new Error("cache write failed");
      store.set(k, v);
      return v;
    },
}));

const { cachedAnswer, SkipCache, sha256 } = await import("@/server/ai-cache");

let n = 0;
const uniq = () => `k${++n}-${Math.random()}`;

describe("серверный кэш ответов ИИ", () => {
  beforeEach(() => {
    state.broken = false;
    state.failOnSave = false;
  });

  it("первый раз — генерация (miss), второй — из кэша без вызова модели (hit)", async () => {
    const key = uniq();
    const produce = vi.fn(async () => "подсказка");
    expect(await cachedAnswer(key, produce)).toEqual({ text: "подсказка", hit: false, cacheable: true });
    expect(await cachedAnswer(key, produce)).toEqual({ text: "подсказка", hit: true, cacheable: true });
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it("одновременные одинаковые запросы делят одну генерацию", async () => {
    const key = uniq();
    let release!: (v: string) => void;
    const produce = vi.fn(() => new Promise<string>((r) => (release = r)));
    const a = cachedAnswer(key, produce);
    const b = cachedAnswer(key, produce);
    await Promise.resolve();
    await Promise.resolve();
    release("ответ");
    expect((await a).text).toBe("ответ");
    expect((await b).text).toBe("ответ");
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it("пустой ответ и ошибка не кэшируются", async () => {
    const key = uniq();
    await expect(cachedAnswer(key, async () => "  ")).rejects.toThrow("empty_answer");
    await expect(cachedAnswer(key, async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(await cachedAnswer(key, async () => "ok")).toMatchObject({ text: "ok", hit: false });
  });

  it("SkipCache — заглушка отдаётся, но не запоминается", async () => {
    const key = uniq();
    expect(await cachedAnswer(key, async () => Promise.reject(new SkipCache("заглушка")))).toEqual({
      text: "заглушка",
      hit: false,
      cacheable: false,
    });
    expect(await cachedAnswer(key, async () => "настоящая")).toMatchObject({ text: "настоящая", hit: false, cacheable: true });
  });

  it("хранилище Next недоступно — работаем через память", async () => {
    state.broken = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const key = uniq();
    const produce = vi.fn(async () => "из памяти");
    expect(await cachedAnswer(key, produce)).toMatchObject({ text: "из памяти", hit: false, cacheable: true });
    expect(await cachedAnswer(key, produce)).toMatchObject({ text: "из памяти", hit: true });
    expect(produce).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("Data Cache не сохранил ответ — ответ всё равно отдаётся и живёт в памяти", async () => {
    state.failOnSave = true;
    const key = uniq();
    const produce = vi.fn(async () => "готово");
    expect(await cachedAnswer(key, produce)).toMatchObject({ text: "готово", hit: false, cacheable: true });
    expect(await cachedAnswer(key, produce)).toMatchObject({ text: "готово", hit: true });
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it("sha256 — 64 hex-символа и стабилен", () => {
    expect(sha256("a")).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256("a")).toBe(sha256("a"));
    expect(sha256("a")).not.toBe(sha256("b"));
  });
});
