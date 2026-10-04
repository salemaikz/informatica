import OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Хранилище лимитов — своя память на каждый тест.
const holder = vi.hoisted(() => ({ kv: null as null | import("@/server/kv").Kv }));
vi.mock("@/server/kv", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/kv")>();
  return { ...real, getKv: () => holder.kv! };
});

// Data Cache Next: простое хранилище по ключу.
const cacheStore = new Map<string, unknown>();
vi.mock("next/cache", () => ({
  unstable_cache:
    (fn: () => Promise<unknown>, keyParts: string[]) =>
    async () => {
      const k = keyParts.join("|");
      if (cacheStore.has(k)) return cacheStore.get(k);
      const v = await fn();
      cacheStore.set(k, v);
      return v;
    },
}));

// OpenAI не вызывается: клиент подменён.
const create = vi.fn();
const state = { client: true };
vi.mock("@/server/openai", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/openai")>();
  return { ...real, getOpenAI: () => (state.client ? { chat: { completions: { create } } } : null) };
});

// Промпт можно сломать: проверка «сбой до вызова модели возвращает обращение».
const promptState = vi.hoisted(() => ({ throws: false }));
vi.mock("@/server/prompts", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/prompts")>();
  return {
    ...real,
    tutorSystemPrompt: (...args: Parameters<typeof real.tutorSystemPrompt>) => {
      if (promptState.throws) throw new Error("prompt bug");
      return real.tutorSystemPrompt(...args);
    },
  };
});

const { createMemoryKv, kzDay } = await import("@/server/kv");
const { POST } = await import("@/app/api/ai/tutor/route");
const { crisisReply } = await import("@/lib/safety");
const { STREAM_CUT_MARK, STREAM_ERROR_MARK, STREAM_OK_MARK, splitStreamTail } = await import("@/lib/ai-stream");
const { MAX_TOKENS } = await import("@/server/openai");
const { maxDuration } = await import("@/app/api/ai/tutor/route");
const { aiDict } = await import("@/i18n/parts/ai");

let ipN = 0;
const freshIp = () => `10.2.${Math.floor(++ipN / 250)}.${ipN % 250}`;

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/ai/tutor", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost", "x-forwarded-for": freshIp(), ...headers },
    body: JSON.stringify(body),
  });
}

const chatBody = (text: string, extra: Record<string, unknown> = {}) => ({
  mode: "chat",
  messages: [{ role: "user", content: text }],
  context: { lang: "ru" },
  ...extra,
});

/** Поток чанков OpenAI: куски текста, затем финальный кусок с finish_reason; fail — исключение посреди потока. */
function fakeStream(parts: string[], finish: string | null = "stop", opts: { fail?: boolean } = {}) {
  async function* gen() {
    for (const p of parts) yield { choices: [{ delta: { content: p }, finish_reason: null }] };
    if (opts.fail) throw new Error("upstream broke");
    yield { choices: [{ delta: {}, finish_reason: finish }] };
    yield { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5 } };
  }
  return Object.assign(gen(), { controller: { abort: vi.fn() } });
}

const site = async () => holder.kv!.get(`ai:site:${kzDay()}`);

/** Ответ маршрута: текст без маркера и признак конца. */
const read = async (res: Response) => splitStreamTail(await res.text());

/** Ошибка OpenAI с HTTP-статусом: запрос отклонён, модель его не обработала. */
const apiError = (status: number) => new OpenAI.APIError(status, { message: "rejected" }, "rejected", new Headers());

/** Запрос с сигналом отмены (клиент может оборвать соединение). */
const postWithSignal = (body: unknown, signal: AbortSignal) =>
  new Request("http://localhost/api/ai/tutor", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost", "x-forwarded-for": freshIp() },
    body: JSON.stringify(body),
    signal,
  });

beforeEach(() => {
  holder.kv = createMemoryKv();
  cacheStore.clear();
  create.mockReset();
  state.client = true;
  promptState.throws = false;
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("кризисный ответ: без модели, без лимитов", () => {
  it("«хочу умереть»: готовый текст с телефонами, X-AI-Crisis, модель не вызывается, ничего не списано", async () => {
    const res = await POST(post(chatBody("Я хочу умереть")));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-AI-Crisis")).toBe("self_harm");
    expect(res.headers.get("X-AI-Cache")).toBe("hit");
    // кризисный текст заканчивается маркером OK, как любой ответ маршрута
    expect(await read(res)).toEqual({ text: crisisReply("self_harm", "ru"), end: "ok" });
    expect(create).not.toHaveBeenCalled();
    expect(await site()).toBe(0);
  });

  it("казахские буквы — ответ по-казахски; насилие — свой текст", async () => {
    const kk = await POST(post(chatBody("өлгім келеді")));
    expect((await read(kk)).text).toBe(crisisReply("self_harm", "kk"));
    const abuse = await POST(post(chatBody("меня бьет отец")));
    expect(abuse.headers.get("X-AI-Crisis")).toBe("abuse");
    expect((await read(abuse)).text).toBe(crisisReply("abuse", "ru"));
  });

  it("работает без ключа ИИ и при исчерпанном общем запасе сайта", async () => {
    state.client = false;
    const noKey = await POST(post(chatBody("не хочу больше жить")));
    expect(noKey.status).toBe(200);
    expect(noKey.headers.get("X-AI-Crisis")).toBe("self_harm");
    state.client = true;
    vi.stubEnv("AI_SITE_DAILY_UNITS", "1");
    create.mockImplementation(() => fakeStream(["ок"]));
    expect((await POST(post(chatBody("привет")))).status).toBe(200);
    expect((await POST(post(chatBody("привет")))).status).toBe(503);
    const crisis = await POST(post(chatBody("хочу умереть")));
    expect(crisis.status).toBe(200);
    expect(crisis.headers.get("X-AI-Crisis")).toBe("self_harm");
  });

  it("смотрит только на последнее сообщение ученика; учебное («убить процесс») — обычный запрос", async () => {
    create.mockImplementation(() => fakeStream(["ок"]));
    const old = await POST(
      post({ ...chatBody(""), messages: [{ role: "user", content: "хочу умереть" }, { role: "assistant", content: "…" }, { role: "user", content: "как убить процесс в linux" }] }),
    );
    expect(old.headers.get("X-AI-Crisis")).toBeNull();
    expect(await read(old)).toEqual({ text: "ок", end: "ok" });
  });
});

describe("поток: конец ответа", () => {
  it("нормальный ответ: текст и положительный маркер OK в конце, Set-Cookie нового устройства, списано 1", async () => {
    create.mockImplementation(() => fakeStream(["При", "вет"]));
    const res = await POST(post(chatBody("Привет")));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/^inf_ai=/);
    const text = await res.text();
    expect(text).toBe(`Привет${STREAM_OK_MARK}`);
    expect(splitStreamTail(text)).toEqual({ text: "Привет", end: "ok" });
    expect(await site()).toBe(1);
  });

  it("обрезка по длине (finish_reason = length): последним куском маркер CUT", async () => {
    create.mockImplementation(() => fakeStream(["Длинный ", "ответ"], "length"));
    const res = await POST(post(chatBody("Объясни всё")));
    const text = await res.text();
    expect(text).toBe(`Длинный ответ${STREAM_CUT_MARK}`);
    expect(splitStreamTail(text)).toEqual({ text: "Длинный ответ", end: "cut" });
    expect(vi.mocked(console.info).mock.calls.some((c) => String(c[0]).includes("route=tutor:chat cut=1"))).toBe(true);
    // модель вызывалась — обращение с сервера не возвращается
    expect(await site()).toBe(1);
  });

  it("сбой потока посреди ответа: маркер ERR, лог stream_error=1", async () => {
    create.mockImplementation(() => fakeStream(["Начало "], "stop", { fail: true }));
    const text = await (await POST(post(chatBody("Привет")))).text();
    expect(text).toBe(`Начало ${STREAM_ERROR_MARK}`);
    expect(vi.mocked(console.info).mock.calls.some((c) => String(c[0]).includes("route=tutor:chat stream_error=1"))).toBe(true);
  });

  it("поток закончился без finish_reason или с content_filter — тоже ERR", async () => {
    create.mockImplementation(() => fakeStream(["Текст"], null));
    expect(splitStreamTail(await (await POST(post(chatBody("а")))).text()).end).toBe("error");
    create.mockImplementation(() => fakeStream(["Текст"], "content_filter"));
    expect(splitStreamTail(await (await POST(post(chatBody("б")))).text()).end).toBe("error");
  });

  it("служебный символ в тексте модели вырезается: маркер нельзя подделать содержимым ответа", async () => {
    create.mockImplementation(() => fakeStream(["Хитрый \u0000CUT", " ответ\u0000ERR"], "stop"));
    const text = await (await POST(post(chatBody("Привет")))).text();
    expect(text).toBe(`Хитрый CUT ответERR${STREAM_OK_MARK}`);
    expect(splitStreamTail(text)).toEqual({ text: "Хитрый CUT ответERR", end: "ok" });
    // служебный символ в ответе ровно один — настоящий маркер конца
    expect(text.split("\u0000")).toHaveLength(2);
  });

  it("OpenAI ответил HTTP-ошибкой (400/401/429/5xx): 502, обращение возвращено, cookie устройства выдана", async () => {
    for (const status of [400, 401, 429, 500, 503]) {
      create.mockRejectedValue(apiError(status));
      const res = await POST(post(chatBody("Привет")));
      expect(res.status).toBe(502);
      expect((await res.json()).error).toBe("ai_failed");
      expect(res.headers.get("set-cookie")).toMatch(/^inf_ai=/);
      expect(await site()).toBe(0);
    }
  });
});

describe("возврат обращения: только если модель точно не получила запрос", () => {
  it("сетевой сбой и таймаут после начала вызова: 502, обращение НЕ возвращено", async () => {
    for (const err of [new Error("openai down"), new OpenAI.APIConnectionError({ message: "reset" }), new OpenAI.APIConnectionTimeoutError()]) {
      create.mockRejectedValueOnce(err);
      const res = await POST(post(chatBody("Привет")));
      expect(res.status).toBe(502);
    }
    expect(await site()).toBe(3);
  });

  it("обрыв клиентом (req.signal.aborted) во время вызова: обращение не возвращается, даже если ошибка пришла с HTTP-статусом", async () => {
    const ctrl = new AbortController();
    create.mockImplementation(async () => {
      ctrl.abort();
      throw new OpenAI.APIUserAbortError();
    });
    await POST(postWithSignal(chatBody("Привет"), ctrl.signal));
    expect(await site()).toBe(1);
    // гонка: отмена и HTTP-ошибка одновременно — всё равно не возвращаем
    const ctrl2 = new AbortController();
    create.mockImplementation(async () => {
      ctrl2.abort();
      throw apiError(500);
    });
    await POST(postWithSignal(chatBody("Привет"), ctrl2.signal));
    expect(await site()).toBe(2);
  });

  it("сбой до вызова модели (код маршрута упал при сборке запроса): обращение возвращено, модель не вызвана", async () => {
    promptState.throws = true;
    const res = await POST(post(chatBody("Привет")));
    expect(res.status).toBe(502);
    expect(create).not.toHaveBeenCalled();
    expect(await site()).toBe(0);
  });

  it("ученик ушёл посреди потока: ничего не возвращается и маркер не пишется", async () => {
    const ctrl = new AbortController();
    async function* gen() {
      yield { choices: [{ delta: { content: "Начало" }, finish_reason: null }] };
      ctrl.abort();
      throw new OpenAI.APIUserAbortError();
    }
    create.mockImplementation(() => Object.assign(gen(), { controller: { abort: vi.fn() } }));
    const res = await POST(postWithSignal(chatBody("Привет"), ctrl.signal));
    expect(splitStreamTail(await res.text()).end).toBe("open");
    expect(await site()).toBe(1);
  });

  it("кэшируемый запрос: сетевой сбой — не возвращаем, HTTP-ошибка OpenAI — возвращаем, пустой ответ модели — не возвращаем", async () => {
    const body = (n: string) => ({ mode: "explain", messages: [], context: { lang: "ru" }, task: { prompt: `Что такое ${n}?`, options: ["а", "б"], correct: "а", given: "б" } });
    create.mockRejectedValueOnce(new OpenAI.APIConnectionTimeoutError());
    expect((await POST(post(body("x1")))).status).toBe(502);
    expect(await site()).toBe(1);
    create.mockRejectedValueOnce(apiError(429));
    expect((await POST(post(body("x2")))).status).toBe(502);
    expect(await site()).toBe(1);
    create.mockResolvedValueOnce({ choices: [{ message: { content: "   " }, finish_reason: "stop" }], usage: {} });
    expect((await POST(post(body("x3")))).status).toBe(502);
    expect(await site()).toBe(2);
  });
});

describe("вызов OpenAI: таймаут короче maxDuration, без повторов потока", () => {
  it("поток: timeout = maxDuration − 5 с, maxRetries 0, сигнал связан с запросом", async () => {
    create.mockImplementation(() => fakeStream(["ок"]));
    const ctrl = new AbortController();
    await (await POST(postWithSignal(chatBody("Привет"), ctrl.signal))).text();
    const opts = create.mock.calls[0][1] as { timeout: number; maxRetries: number; signal: AbortSignal };
    expect(opts.timeout).toBe((maxDuration - 5) * 1000);
    expect(opts.timeout).toBeLessThan(maxDuration * 1000);
    expect(opts.maxRetries).toBe(0);
    expect(opts.signal.aborted).toBe(false);
    ctrl.abort();
    expect(opts.signal.aborted).toBe(true);
  });

  it("кэшируемый вызов тоже с таймаутом короче maxDuration", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: "текст" }, finish_reason: "stop" }], usage: {} });
    await POST(post({ mode: "explain", messages: [], context: { lang: "ru" }, task: { prompt: "Сколько будет 2+2?", options: ["3", "4"], correct: "4", given: "3" } }));
    expect((create.mock.calls[0][1] as { timeout: number }).timeout).toBeLessThan(maxDuration * 1000);
  });
});

describe("токены и вес запроса", () => {
  it("потолок токенов: чат 800, «Объясни тему» и «ЕНТ» 1000, подсказка по ходу диалога 250", async () => {
    create.mockImplementation(() => fakeStream(["ок"]));
    await (await POST(post(chatBody("а")))).text();
    await (await POST(post(chatBody("б", { chatMode: "explain" })))).text();
    await (await POST(post(chatBody("в", { chatMode: "ent" })))).text();
    await (await POST(post({ ...chatBody("г"), mode: "hint" }))).text();
    const caps = create.mock.calls.map((c) => c[0].max_completion_tokens);
    expect(caps).toEqual([MAX_TOKENS.chat, MAX_TOKENS.chatLong, MAX_TOKENS.chatLong, MAX_TOKENS.hint]);
    expect(MAX_TOKENS).toMatchObject({ hint: 250, chat: 800, chatPhoto: 1200, cached: 600 });
  });

  it("чат с фото: потолок 1200 (размышление low съедает часть), режим «ЕНТ» с фото — тоже 1200", async () => {
    create.mockImplementation(() => fakeStream(["ок"]));
    const image = `data:image/png;base64,${"A".repeat(40)}`;
    await (await POST(post(chatBody("Проверь", { image })))).text();
    await (await POST(post(chatBody("Проверь", { image, chatMode: "ent" })))).text();
    expect(create.mock.calls.map((c) => c[0].max_completion_tokens)).toEqual([1200, 1200]);
  });

  it("чат с фото стоит 2 обращения и идёт на модель с изображением", async () => {
    create.mockImplementation(() => fakeStream(["ок"]));
    const image = `data:image/png;base64,${"A".repeat(40)}`;
    await (await POST(post(chatBody("Проверь", { image })))).text();
    expect(await site()).toBe(2);
    const msgs = create.mock.calls[0][0].messages;
    expect(JSON.stringify(msgs[msgs.length - 1].content)).toContain("image_url");
  });

  it("история в модель: не больше 8000 символов, каждое сообщение до 2000", async () => {
    create.mockImplementation(() => fakeStream(["ок"]));
    const long = "я".repeat(5000);
    const messages = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: long }));
    messages.push({ role: "user", content: "последний вопрос" });
    await (await POST(post({ mode: "chat", messages, context: { lang: "ru" } }))).text();
    const sent = (create.mock.calls[0][0].messages as { role: string; content: string }[]).filter((m) => m.role !== "system");
    expect(sent.reduce((a, m) => a + m.content.length, 0)).toBeLessThanOrEqual(8000);
    expect(Math.max(...sent.map((m) => m.content.length))).toBeLessThanOrEqual(2000);
    expect(sent[sent.length - 1].content).toBe("последний вопрос");
  });
});

describe("защиты на входе", () => {
  it("в production запрос без Origin — 403, модель не вызывается, ничего не списано", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(post(chatBody("Привет")));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("forbidden_origin");
    expect(create).not.toHaveBeenCalled();
    expect(await site()).toBe(0);
  });

  it("заведомо огромное тело (Content-Length > 5 МБ) — 413 без чтения", async () => {
    const res = await POST(post(chatBody("а"), { "content-length": "9000000" }));
    expect(res.status).toBe(413);
    expect(create).not.toHaveBeenCalled();
  });

  it("ИИ не настроен — 503 без списания; битый JSON и пустой чат — 400", async () => {
    state.client = false;
    expect((await POST(post(chatBody("Привет")))).status).toBe(503);
    expect(await site()).toBe(0);
    state.client = true;
    const bad = await POST(new Request("http://localhost/api/ai/tutor", { method: "POST", body: "{", headers: { host: "localhost" } }));
    expect(bad.status).toBe(400);
    expect((await POST(post({ mode: "chat", messages: [], context: {} }))).status).toBe(400);
  });

  it("дешёвый счётчик по IP до разбора тела: 120 запросов за 10 минут проходят (даже мусор — 400), 121-й — 429 rate_limited", async () => {
    const ip = freshIp();
    const bad = () => new Request("http://localhost/api/ai/tutor", { method: "POST", body: "{", headers: { host: "localhost", "x-forwarded-for": ip } });
    for (let i = 0; i < 120; i++) expect((await POST(bad())).status).toBe(400);
    const over = await POST(bad());
    expect(over.status).toBe(429);
    expect((await over.json()).error).toBe("rate_limited");
    // кризисный путь тоже под счётчиком
    const crisis = await POST(post(chatBody("хочу умереть"), { "x-forwarded-for": ip }));
    expect(crisis.status).toBe(429);
    // другой IP не задет
    expect((await POST(post(chatBody("хочу умереть")))).status).toBe(200);
    expect(create).not.toHaveBeenCalled();
  });

  it("лимит устройства: сверх потолка — 429 daily_limit, модель второй раз не вызывается (всплеск и сайт — в ai-guard.test.ts)", async () => {
    create.mockImplementation(() => fakeStream(["ок"]));
    vi.stubEnv("AI_DEVICE_DAILY_UNITS", "1");
    const ip = freshIp();
    const first = await POST(post(chatBody("а"), { "x-forwarded-for": ip }));
    expect(first.status).toBe(200);
    const cookie = (first.headers.get("set-cookie") ?? "").split(";")[0];
    const over = await POST(post(chatBody("б"), { "x-forwarded-for": ip, cookie }));
    expect(over.status).toBe(429);
    expect((await over.json()).error).toBe("daily_limit");
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("кэшируемые ответы (подсказка, разбор)", () => {
  const task = (n: string) => ({ prompt: `Сколько будет 2 + ${n}?`, options: ["3", "4", "5", "6"], correct: "4" });
  const hintBody = (n: string) => ({ mode: "explain", messages: [], context: { lang: "ru" }, task: { ...task(n), given: "3" } });
  const answer = (text: string, finish = "stop") => ({ choices: [{ message: { content: text }, finish_reason: finish }], usage: { prompt_tokens: 5, completion_tokens: 5 } });

  it("первый запрос — miss, обращение списано; повторный — hit из кэша, обращение возвращено", async () => {
    create.mockResolvedValue(answer("Складываем двойки."));
    const miss = await POST(post(hintBody("2")));
    expect(miss.headers.get("X-AI-Cache")).toBe("miss");
    expect(await read(miss)).toEqual({ text: "Складываем двойки.", end: "ok" });
    expect(await site()).toBe(1);
    const hit = await POST(post(hintBody("2")));
    expect(hit.headers.get("X-AI-Cache")).toBe("hit");
    // ответ из кэша тоже заканчивается маркером OK
    expect(await read(hit)).toEqual({ text: "Складываем двойки.", end: "ok" });
    expect(create).toHaveBeenCalledTimes(1);
    // кэш-hit не списывает: счётчик сайта остался от первого запроса
    expect(await site()).toBe(1);
  });

  it("потолок токенов кэшируемого ответа: разбор 600, подсказка 250", async () => {
    create.mockResolvedValue(answer("текст"));
    await POST(post(hintBody("7")));
    expect(create.mock.calls[0][0].max_completion_tokens).toBe(600);
    await POST(post({ mode: "hint", messages: [], context: { lang: "ru" }, task: { prompt: "Сколько будет 8 + 1?", options: ["9", "8"], correct: "9" } }));
    expect(create.mock.calls[1][0].max_completion_tokens).toBe(250);
  });

  it("ответ обрезан по длине: отдаётся с маркером CUT, в кэш не попадает, обращение не возвращается", async () => {
    create.mockResolvedValueOnce(answer("Половина разбора", "length"));
    const cut = await POST(post(hintBody("9")));
    expect(cut.headers.get("X-AI-Cache")).toBe("skip");
    const text = await cut.text();
    expect(splitStreamTail(text)).toEqual({ text: "Половина разбора", end: "cut" });
    expect(await site()).toBe(1);
    // повтор — снова генерация (оборванный текст не лёг в кэш), теперь целый ответ
    create.mockResolvedValueOnce(answer("Целый разбор."));
    const again = await POST(post(hintBody("9")));
    expect(again.headers.get("X-AI-Cache")).toBe("miss");
    expect(await read(again)).toEqual({ text: "Целый разбор.", end: "ok" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("подсказка выдала ответ дважды: заглушка из словаря с маркером OK, в кэш не попадает", async () => {
    create.mockResolvedValue(answer("Ответ: 1011"));
    const res = await POST(
      post({ mode: "hint", messages: [], context: { lang: "ru" }, task: { prompt: "Переведи число 11 в двоичную систему", options: ["1011", "1101", "1110"], correct: "1011" } }),
    );
    expect(res.headers.get("X-AI-Cache")).toBe("skip");
    expect(await read(res)).toEqual({ text: aiDict["ai.hintFallback"].ru, end: "ok" });
  });

  it("HTTP-ошибка OpenAI в кэшируемом запросе: 502 и обращение возвращено", async () => {
    create.mockRejectedValue(apiError(500));
    const res = await POST(post(hintBody("11")));
    expect(res.status).toBe(502);
    expect(await site()).toBe(0);
  });
});
