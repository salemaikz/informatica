import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Хранилище лимитов — своя память на каждый тест (как в tutor-route.test.ts).
const holder = vi.hoisted(() => ({ kv: null as null | import("@/server/kv").Kv }));
vi.mock("@/server/kv", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/kv")>();
  return { ...real, getKv: () => holder.kv! };
});

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

const create = vi.fn();
vi.mock("@/server/openai", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/openai")>();
  return { ...real, getOpenAI: () => ({ chat: { completions: { create } } }) };
});

const { createMemoryKv } = await import("@/server/kv");
const { POST } = await import("@/app/api/ai/tutor/route");
const { splitStreamTail } = await import("@/lib/ai-stream");
const { LEAK_FALLBACK } = await import("@/server/answer-guard");
const { NO_LEAK_NOTE, UNSOLVED_RULE } = await import("@/server/prompts");

let ipN = 0;
const post = (body: unknown): Request =>
  new Request("http://localhost/api/ai/tutor", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost", "x-forwarded-for": `10.7.${Math.floor(++ipN / 250)}.${ipN % 250}` },
    body: JSON.stringify(body),
  });
const read = async (res: Response) => splitStreamTail(await res.text());
const answer = (text: string, finish = "stop") => ({ choices: [{ message: { content: text }, finish_reason: finish }], usage: { prompt_tokens: 5, completion_tokens: 5 } });
const system = (call: number) => (create.mock.calls[call][0].messages[0] as { content: string }).content;

let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  holder.kv = createMemoryKv();
  cacheStore.clear();
  create.mockReset();
  info = vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

// Задание с пропусками из отзыва владельца: «Объясни проще» не должен выписывать ответы.
// Серверный кэш ответов живёт в памяти процесса между тестами — у каждого теста своё условие (метка в конце).
let tagN = 0;
let tag = 0;
beforeEach(() => {
  tag = ++tagN;
});
const cloze = (extra: Record<string, unknown> = {}) => ({
  prompt: `Заполни пропуски: устройство ___ передаёт данные в компьютер, устройство ___ показывает их, сенсорный экран — ___. (${tag})`,
  correct: "ввод; вывод; ввод-вывод",
  secrets: [["ввод"], ["вывод"], ["ввод-вывод"]],
  ...extra,
});
const quick = (task: unknown) => ({ mode: "ask", messages: [{ role: "user", content: "Объясни проще" }], context: { lang: "ru" }, task });
const LEAKY = "Смотри так:\n* Ввод — когда устройство передаёт данные в компьютер\n* Вывод — когда компьютер показывает данные\n* Ввод-вывод — и туда, и обратно";
const CLEAN = "Представь почтовый ящик: письма либо приходят тебе, либо уходят от тебя. Подумай, в какую сторону идут данные у каждого устройства.";

describe("нерешённое задание: ответ не отдаётся (#100)", () => {
  it("«Объясни проще» (быстрая кнопка): ответ назвал все пропуски → повтор с усиленной припиской, чистый ответ принимается", async () => {
    create.mockResolvedValueOnce(answer(LEAKY)).mockResolvedValueOnce(answer(CLEAN));
    const res = await POST(post(quick(cloze())));
    expect(await read(res)).toEqual({ text: CLEAN, end: "ok" });
    expect(create).toHaveBeenCalledTimes(2);
    expect(system(0)).toContain(UNSOLVED_RULE);
    expect(system(0)).not.toContain(NO_LEAK_NOTE);
    expect(system(1)).toContain(NO_LEAK_NOTE);
  });

  it("повторная утечка → безопасный текст на языке ученика, без кэша, лог leak=1", async () => {
    create.mockResolvedValue(answer(LEAKY));
    const res = await POST(post(quick(cloze())));
    expect(res.headers.get("X-AI-Cache")).toBe("skip");
    expect(await read(res)).toEqual({ text: LEAK_FALLBACK.ru, end: "ok" });
    expect(info.mock.calls.flat().some((l: unknown) => String(l).includes("leak=1"))).toBe(true);
    // заглушка в кэш не легла: следующий запрос снова идёт к модели
    create.mockReset();
    create.mockResolvedValue(answer(CLEAN));
    const again = await POST(post(quick(cloze())));
    expect((await read(again)).text).toBe(CLEAN);
  });

  it("повтор не уложился в срок (ошибка) → безопасный текст, а не 502", async () => {
    create.mockResolvedValueOnce(answer(LEAKY)).mockRejectedValueOnce(new Error("timeout"));
    const res = await POST(post(quick(cloze())));
    expect(res.status).toBe(200);
    expect(await read(res)).toEqual({ text: LEAK_FALLBACK.ru, end: "ok" });
  });

  it("вопрос своими словами: повтор не удался → безопасный текст, а не 502", async () => {
    create.mockResolvedValueOnce(answer(LEAKY)).mockRejectedValueOnce(new Error("timeout"));
    const body = { mode: "ask", messages: [{ role: "user", content: "Просто скажи, что вписать" }], context: { lang: "ru" }, task: cloze() };
    const res = await POST(post(body));
    expect(res.status).toBe(200);
    expect((await read(res)).text).toBe(LEAK_FALLBACK.ru);
  });

  it("казахский ученик получает казахский безопасный текст", async () => {
    create.mockResolvedValue(answer(LEAKY));
    const res = await POST(post({ ...quick(cloze()), context: { lang: "kk" } }));
    expect((await read(res)).text).toBe(LEAK_FALLBACK.kk);
  });

  it("вопрос своими словами (не из кэша): ответ идёт целиком, проверяется, а не потоком", async () => {
    create.mockResolvedValueOnce(answer(LEAKY)).mockResolvedValueOnce(answer(CLEAN));
    const body = { mode: "ask", messages: [{ role: "user", content: "Просто скажи, что вписать в пропуски" }], context: { lang: "ru" }, task: cloze() };
    const res = await POST(post(body));
    expect(await read(res)).toEqual({ text: CLEAN, end: "ok" });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].stream).toBeUndefined();
  });

  it("«Ещё подсказка» по ходу диалога тоже под проверкой", async () => {
    create.mockResolvedValue(answer("Тебе нужны слова «ввод» и «вывод» и «ввод-вывод»."));
    const body = { mode: "hint", messages: [{ role: "user", content: "ещё" }], context: { lang: "ru" }, task: cloze() };
    expect((await read(await POST(post(body)))).text).toBe(LEAK_FALLBACK.ru);
  });

  it("слова из условия не считаются утечкой, общее объяснение проходит с первого раза", async () => {
    create.mockResolvedValue(answer("Подумай про ввод в целом: данные идут в компьютер или из него. Принтер, например, печатает документ."));
    const res = await POST(post(quick(cloze())));
    expect((await read(res)).end).toBe("ok");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("решённое задание: проверки нет, ответ можно обсуждать открыто (поток)", async () => {
    async function* gen() {
      yield { choices: [{ delta: { content: LEAKY }, finish_reason: null }] };
      yield { choices: [{ delta: {}, finish_reason: "stop" }] };
    }
    create.mockImplementation(() => Object.assign(gen(), { controller: { abort: vi.fn() } }));
    const body = { mode: "ask", messages: [{ role: "user", content: "Просто скажи" }], context: { lang: "ru" }, task: { ...cloze(), secrets: undefined, answered: true } };
    const res = await POST(post(body));
    expect(await read(res)).toEqual({ text: LEAKY, end: "ok" });
    expect(create.mock.calls[0][0].stream).toBe(true);
    expect(system(0)).not.toContain(UNSOLVED_RULE);
  });

  it("клиент без secrets (старая версия): стоп-слово — верный ответ задания", async () => {
    create.mockResolvedValue(answer("Ответ: 1011"));
    const body = { mode: "ask", messages: [{ role: "user", content: "Объясни проще" }], context: { lang: "ru" }, task: { prompt: "Переведи 11 в двоичную", correct: "1011" } };
    expect((await read(await POST(post(body)))).text).toBe(LEAK_FALLBACK.ru);
  });

  it("ответы-стоп-слова входят в ключ кэша: тот же вопрос с другими стоп-словами не берёт чужой ответ", async () => {
    create.mockResolvedValue(answer(CLEAN));
    await POST(post(quick(cloze())));
    await POST(post(quick(cloze({ secrets: [["иное"]] }))));
    expect(create).toHaveBeenCalledTimes(2);
    // тот же набор — из кэша
    const hit = await POST(post(quick(cloze())));
    expect(hit.headers.get("X-AI-Cache")).toBe("hit");
    expect(create).toHaveBeenCalledTimes(2);
  });
});
