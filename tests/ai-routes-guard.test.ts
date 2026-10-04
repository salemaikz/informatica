import OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const holder = vi.hoisted(() => ({ kv: null as null | import("@/server/kv").Kv }));
vi.mock("@/server/kv", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/kv")>();
  return { ...real, getKv: () => holder.kv! };
});

const create = vi.fn();
const state = { client: true };
vi.mock("@/server/openai", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/openai")>();
  return { ...real, getOpenAI: () => (state.client ? { chat: { completions: { create } } } : null) };
});

const { createMemoryKv, kzDay } = await import("@/server/kv");
const check = await import("@/app/api/ai/check-solution/route");
const feedback = await import("@/app/api/ai/lesson-feedback/route");
const { MAX_TOKENS } = await import("@/server/openai");

let ipN = 0;
const freshIp = () => `10.3.${Math.floor(++ipN / 250)}.${ipN % 250}`;
const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost", "x-forwarded-for": freshIp(), ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const site = () => holder.kv!.get(`ai:site:${kzDay()}`);
const code = async (r: Response) => (await r.json()).error as string;

/** Ошибка OpenAI с HTTP-статусом: запрос отклонён, модель его не обработала. */
const apiError = (status: number) => new OpenAI.APIError(status, { message: "rejected" }, "rejected", new Headers());

/** Запрос, который клиент может оборвать. */
const postWithSignal = (url: string, body: unknown, signal: AbortSignal) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost", "x-forwarded-for": freshIp() },
    body: JSON.stringify(body),
    signal,
  });

const reply = (content: string) => ({ choices: [{ message: { content } }], usage: { prompt_tokens: 5, completion_tokens: 5 } });

beforeEach(() => {
  holder.kv = createMemoryKv();
  create.mockReset();
  state.client = true;
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/ai/check-solution — страж лимитов", () => {
  const body = { lang: "ru", context: {}, task: { prompt: "Переведи 5 в двоичную", reference: "101", answer: "101" }, typedAnswer: "101" };
  const good = JSON.stringify({ verdict: "correct", score: 1, feedback: "Верно", steps: [{ text: "5 = 101", ok: true }], tip: "Так держать" });

  it("успех: 2 обращения, cookie устройства, потолок токенов из MAX_TOKENS", async () => {
    create.mockResolvedValue(reply(good));
    const res = await check.POST(post("/api/ai/check-solution", body));
    expect(res.status).toBe(200);
    expect((await res.json()).verdict).toBe("correct");
    expect(res.headers.get("set-cookie")).toMatch(/^inf_ai=/);
    expect(await site()).toBe(2);
    expect(create.mock.calls[0][0].max_completion_tokens).toBe(MAX_TOKENS.check);
    expect(MAX_TOKENS.check).toBeLessThan(2500);
    // таймаут вызова короче maxDuration маршрута
    expect((create.mock.calls[0][1] as { timeout: number }).timeout).toBe((check.maxDuration - 5) * 1000);
  });

  it("ошибка до вызова модели возвращает обращения: битый JSON, нет условия, ИИ не настроен", async () => {
    expect((await check.POST(post("/api/ai/check-solution", "{"))).status).toBe(400);
    expect((await check.POST(post("/api/ai/check-solution", { ...body, task: { prompt: "" } }))).status).toBe(400);
    state.client = false;
    expect((await check.POST(post("/api/ai/check-solution", body))).status).toBe(503);
    expect(await site()).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });

  it("HTTP-ошибка OpenAI (модель запрос не обработала) возвращает обращения", async () => {
    for (const status of [400, 401, 429, 500, 503]) {
      create.mockRejectedValueOnce(apiError(status));
      const res = await check.POST(post("/api/ai/check-solution", body));
      expect(res.status).toBe(502);
      expect(await code(res)).toBe("ai_failed");
      expect(await site()).toBe(0);
    }
  });

  it("сетевой сбой и таймаут после начала вызова обращения НЕ возвращают", async () => {
    for (const err of [new Error("down"), new OpenAI.APIConnectionError({ message: "reset" }), new OpenAI.APIConnectionTimeoutError()]) {
      create.mockRejectedValueOnce(err);
      const res = await check.POST(post("/api/ai/check-solution", body));
      expect(res.status).toBe(502);
      expect(res.headers.get("set-cookie")).toMatch(/^inf_ai=/);
    }
    expect(await site()).toBe(6);
  });

  it("обрыв клиентом во время вызова: обращения не возвращаются, даже при ошибке с HTTP-статусом", async () => {
    const ctrl = new AbortController();
    create.mockImplementationOnce(async () => {
      ctrl.abort();
      throw new OpenAI.APIUserAbortError();
    });
    await check.POST(postWithSignal("/api/ai/check-solution", body, ctrl.signal));
    expect(await site()).toBe(2);
    const ctrl2 = new AbortController();
    create.mockImplementationOnce(async () => {
      ctrl2.abort();
      throw apiError(500);
    });
    await check.POST(postWithSignal("/api/ai/check-solution", body, ctrl2.signal));
    expect(await site()).toBe(4);
  });

  it("модель ответила, но ответ не разобрать (токены потрачены): 502, обращения не возвращаются", async () => {
    create.mockResolvedValue(reply("{оборвано"));
    const res = await check.POST(post("/api/ai/check-solution", body));
    expect(res.status).toBe(502);
    expect(await site()).toBe(2);
  });

  it("лимит устройства: фото весит 2 — на потолке 3 второй запрос не помещается", async () => {
    vi.stubEnv("AI_DEVICE_DAILY_UNITS", "3");
    create.mockResolvedValue(reply(good));
    const ip = freshIp();
    const first = await check.POST(post("/api/ai/check-solution", body, { "x-forwarded-for": ip }));
    const cookie = (first.headers.get("set-cookie") ?? "").split(";")[0];
    const second = await check.POST(post("/api/ai/check-solution", body, { "x-forwarded-for": ip, cookie }));
    expect(second.status).toBe(429);
    expect(await code(second)).toBe("daily_limit");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("в production без Origin — 403", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await check.POST(post("/api/ai/check-solution", body));
    expect(res.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("POST /api/ai/lesson-feedback — бесплатно для устройства, 1 для сайта", () => {
  const body = { context: {}, lesson: "Системы счисления", accuracy: 0.8, durationSec: 300, mistakes: [], skills: [] };
  const good = JSON.stringify({ feedback: "Хорошо", memory: "- любит примеры", focus: ["двоичная"] });

  it("успех: сайт +1, у устройства свой потолок (AI_FREE_DEVICE_DAILY), обращения устройства не тратятся", async () => {
    vi.stubEnv("AI_FREE_DEVICE_DAILY", "2");
    vi.stubEnv("AI_DEVICE_DAILY_UNITS", "1");
    create.mockResolvedValue(reply(good));
    const ip = freshIp();
    const first = await feedback.POST(post("/api/ai/lesson-feedback", body, { "x-forwarded-for": ip }));
    expect(first.status).toBe(200);
    expect((await first.json()).focus).toEqual(["двоичная"]);
    const cookie = (first.headers.get("set-cookie") ?? "").split(";")[0];
    expect((await feedback.POST(post("/api/ai/lesson-feedback", body, { "x-forwarded-for": ip, cookie }))).status).toBe(200);
    expect(await site()).toBe(2);
    const third = await feedback.POST(post("/api/ai/lesson-feedback", body, { "x-forwarded-for": ip, cookie }));
    expect(third.status).toBe(429);
    expect(await code(third)).toBe("daily_limit");
    expect(create.mock.calls[0][0].max_completion_tokens).toBe(MAX_TOKENS.feedback);
  });

  it("ошибка до вызова модели и HTTP-ошибка OpenAI возвращают счёт", async () => {
    expect((await feedback.POST(post("/api/ai/lesson-feedback", "{"))).status).toBe(400);
    state.client = false;
    expect((await feedback.POST(post("/api/ai/lesson-feedback", body))).status).toBe(503);
    state.client = true;
    create.mockRejectedValue(apiError(500));
    expect((await feedback.POST(post("/api/ai/lesson-feedback", body))).status).toBe(502);
    expect(await site()).toBe(0);
  });

  it("сетевой сбой и обрыв клиентом счёт не возвращают; таймаут вызова короче maxDuration", async () => {
    create.mockRejectedValueOnce(new Error("down"));
    expect((await feedback.POST(post("/api/ai/lesson-feedback", body))).status).toBe(502);
    expect(await site()).toBe(1);
    const ctrl = new AbortController();
    create.mockImplementationOnce(async () => {
      ctrl.abort();
      throw new OpenAI.APIUserAbortError();
    });
    await feedback.POST(postWithSignal("/api/ai/lesson-feedback", body, ctrl.signal));
    expect(await site()).toBe(2);
    create.mockResolvedValueOnce(reply(good));
    await feedback.POST(post("/api/ai/lesson-feedback", body));
    expect((create.mock.calls[2][1] as { timeout: number }).timeout).toBe((feedback.maxDuration - 5) * 1000);
    expect((feedback.maxDuration - 5) * 1000).toBeLessThan(feedback.maxDuration * 1000);
  });
});
