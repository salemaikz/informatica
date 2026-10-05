import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Хранилище лимитов — своя память на каждый тест; OpenAI не вызывается (клиент подменён).
const holder = vi.hoisted(() => ({ kv: null as null | import("@/server/kv").Kv }));
vi.mock("@/server/kv", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/kv")>();
  return { ...real, getKv: () => holder.kv! };
});
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));
const create = vi.fn();
vi.mock("@/server/openai", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/openai")>();
  return { ...real, getOpenAI: () => ({ chat: { completions: { create } } }) };
});

const { createMemoryKv } = await import("@/server/kv");
const { POST } = await import("@/app/api/ai/tutor/route");
const { clipConspect, fitInput, LESSON_CONSPECT_MAX_CHARS, loadLessonChat, sanitizeLessonId } = await import("@/server/context");
const { lessonChatRule, tutorSystemPrompt } = await import("@/server/prompts");
const { INPUT_BUDGET } = await import("@/server/openai");
const { findLessonChat, sanitizeChats } = await import("@/lib/chats");
const { PROMPT_VERSION } = await import("@/lib/ai-cache");
const { readableLessonIds } = await import("@/lib/theory");
const { UNITS } = await import("@/content/course-map");
const { CONSPECTS } = await import("@/content/conspects.generated");
const { useApp } = await import("@/lib/store");

import type { ChatMeta } from "@/lib/chats";
import type { StudentContext } from "@/lib/ai-types";

// Чат по теме урока (этап 16В, P6): кнопка «Спросить Бита об этой теме». Клиент шлёт только id урока —
// название, тему ЕНТ и конспект сервер берёт сам (клиент содержимое курса не грузит).

const ctx: StudentContext = {
  name: "Т",
  lang: "ru",
  grade: "9",
  goal: "ent",
  style: "short",
  level: 1,
  xp: 0,
  streak: 0,
  weak: [],
  strong: [],
  mistakes: [],
  notes: "",
  lessons: [],
};

const meta = (p: Partial<ChatMeta> & { id: string }): ChatMeta => ({ title: "", mode: "free", createdAt: 1, updatedAt: 1, preview: "", count: 0, ...p });

describe("чаты по теме урока: список", () => {
  it("findLessonChat: один на урок — самый свежий; чужие и обычные чаты не мешают", () => {
    const list = [
      meta({ id: "a" }),
      meta({ id: "b", lessonId: "ns-1-bits", updatedAt: 5 }),
      meta({ id: "c", lessonId: "ns-1-bits", updatedAt: 9 }),
      meta({ id: "d", lessonId: "ns-2-read", updatedAt: 99 }),
    ];
    expect(findLessonChat(list, "ns-1-bits")?.id).toBe("c");
    expect(findLessonChat(list, "ns-2-read")?.id).toBe("d");
    expect(findLessonChat(list, "ns-3-write")).toBeUndefined();
    expect(findLessonChat([], "ns-1-bits")).toBeUndefined();
  });

  it("sanitizeChats: lessonId — строка до 80 символов, остальное отбрасывается", () => {
    const row = (lessonId: unknown) => ({ id: "x", mode: "free", title: "t", createdAt: 1, updatedAt: 1, preview: "", count: 0, lessonId });
    const out = sanitizeChats([row("ns-1-bits"), row(5), row(""), row("x".repeat(81)), row(undefined)]);
    expect(out.map((c) => c.lessonId)).toEqual(["ns-1-bits", undefined, undefined, undefined, undefined]);
  });

  it("стор: createChat запоминает урок, чат по теме урока не создаётся дважды вручную через findLessonChat", () => {
    useApp.getState().resetProgress();
    const first = useApp.getState().createChat("free", "Бит и разряды", "t04", "ns-1-bits");
    const chat = useApp.getState().chats.find((c) => c.id === first)!;
    expect(chat).toMatchObject({ mode: "free", title: "Бит и разряды", topic: "t04", lessonId: "ns-1-bits", count: 0 });
    // обычный чат без урока — поле не появляется
    const plain = useApp.getState().createChat("free");
    expect(useApp.getState().chats.find((c) => c.id === plain)!.lessonId).toBeUndefined();
    expect(findLessonChat(useApp.getState().chats, "ns-1-bits")?.id).toBe(first);
  });
});

describe("контекст урока для чата (server/context.ts)", () => {
  it("sanitizeLessonId: только id вида «ns-1-bits»", () => {
    expect(sanitizeLessonId("ns-1-bits")).toBe("ns-1-bits");
    expect(sanitizeLessonId("py-1-vars")).toBe("py-1-vars");
    for (const bad of [undefined, null, 5, {}, [], "", "NS-1", "ns 1", "../x", "-a", "a".repeat(61), "constructor ", "ns-1-bits\n"]) {
      expect(sanitizeLessonId(bad), String(bad)).toBeUndefined();
    }
  });

  it("clipConspect: короткий — как есть; длинный — по абзацу, не длиннее предела", () => {
    expect(clipConspect("  Коротко.  ")).toBe("Коротко.");
    const para = "а".repeat(900);
    const long = [para, para, para].join("\n\n");
    const out = clipConspect(long, 2000);
    expect(out).toBe(`${para}\n\n${para}…`);
    expect(clipConspect("я".repeat(5000), 100)).toHaveLength(101);
  });

  it("все готовые уроки, оба языка: название, тема, конспект в пределах бюджета", async () => {
    const ids = readableLessonIds(UNITS);
    expect(ids.length).toBeGreaterThan(50);
    for (const id of ids) {
      for (const lang of ["ru", "kk"] as const) {
        const lesson = await loadLessonChat(id, lang);
        expect(lesson, `${id} ${lang}`).toBeDefined();
        expect(lesson!.title.trim().length, id).toBeGreaterThan(0);
        expect(lesson!.conspect.trim().length, id).toBeGreaterThan(50);
        expect(lesson!.conspect.length, id).toBeLessThanOrEqual(LESSON_CONSPECT_MAX_CHARS + 1);
      }
    }
    // конспект — тот же, что видит ученик
    expect((await loadLessonChat("ns-1-bits", "ru"))!.conspect).toBe(CONSPECTS["ns-1-bits"].ru.trim());
  });

  it("тема ЕНТ берётся из урока на языке ученика", async () => {
    const ru = await loadLessonChat("ns-1-bits", "ru");
    const kk = await loadLessonChat("ns-1-bits", "kk");
    expect(ru!.topic).toBeTruthy();
    expect(kk!.topic).toBeTruthy();
    expect(ru!.topic).not.toBe(kk!.topic);
  });

  it("не урок — undefined (чат идёт как обычный)", async () => {
    for (const bad of ["nope", "constructor", "toString", "", 5, null, undefined, "../ns-1-bits"]) {
      expect(await loadLessonChat(bad, "ru"), String(bad)).toBeUndefined();
    }
  });
});

describe("промпт чата по теме урока", () => {
  const lesson = { title: "Язык лампочек", topic: "Системы счисления", conspect: "# Бит\n\n**Бит** — одна лампочка." };

  it("правило: название, тема ЕНТ, держаться темы, конспект ниже, не выдавать ответы заданий", () => {
    const rule = lessonChatRule(lesson);
    expect(rule).toContain("«Язык лампочек»");
    expect(rule).toContain("тема ЕНТ: «Системы счисления»");
    expect(rule).toContain("КОНСПЕКТ УРОКА:\n# Бит");
    expect(rule).toContain("Держись темы урока");
    expect(rule).toContain("не выдумывай факты");
    expect(rule).toContain("готовых ответов к ним не давай");
    // без темы ЕНТ — без скобок
    expect(lessonChatRule({ ...lesson, topic: undefined })).not.toContain("тема ЕНТ");
  });

  it("свободный чат с уроком: правило и конспект в системном промпте, после режима и перед данными ученика", () => {
    const p = tutorSystemPrompt(ctx, "chat", undefined, { chatMode: "free", lesson });
    expect(p).toContain("ЧАТ ПО ТЕМЕ УРОКА «Язык лампочек»");
    expect(p.indexOf("Режим: свободный диалог")).toBeLessThan(p.indexOf("ЧАТ ПО ТЕМЕ УРОКА"));
    expect(p.indexOf("ЧАТ ПО ТЕМЕ УРОКА")).toBeLessThan(p.indexOf("ДАННЫЕ УЧЕНИКА"));
    // без chatMode — тоже свободный
    expect(tutorSystemPrompt(ctx, "chat", undefined, { lesson })).toContain("КОНСПЕКТ УРОКА");
  });

  it("другие режимы, чаты «Объясни тему» и «Проверь решение» и подсказки к заданиям урока не получают", () => {
    expect(tutorSystemPrompt(ctx, "chat")).not.toContain("ЧАТ ПО ТЕМЕ УРОКА");
    expect(tutorSystemPrompt(ctx, "chat", undefined, { chatMode: "free" })).not.toContain("ЧАТ ПО ТЕМЕ УРОКА");
    expect(tutorSystemPrompt(ctx, "chat", undefined, { chatMode: "explain", topic: "T", lesson })).not.toContain("ЧАТ ПО ТЕМЕ УРОКА");
    expect(tutorSystemPrompt(ctx, "chat", undefined, { chatMode: "check", lesson })).not.toContain("ЧАТ ПО ТЕМЕ УРОКА");
    expect(tutorSystemPrompt(ctx, "hint", { prompt: "Задание" }, { lesson })).not.toContain("ЧАТ ПО ТЕМЕ УРОКА");
    expect(tutorSystemPrompt(ctx, "ask", { prompt: "Шаг", theory: "Текст" }, { lesson })).not.toContain("ЧАТ ПО ТЕМЕ УРОКА");
  });

  it("версия кэша ответов поднята до 5 (этап 16В)", () => {
    expect(PROMPT_VERSION).toBeGreaterThanOrEqual(5);
  });

  it("запрос с самым длинным конспектом, заметками и историей умещается в бюджет входа", async () => {
    const heavy: StudentContext = {
      ...ctx,
      notes: "з".repeat(800),
      lessons: Array.from({ length: 20 }, (_, i) => `Урок номер ${i}`),
      weak: Array.from({ length: 8 }, (_, i) => `Слабая тема ${i}`),
      strong: Array.from({ length: 8 }, (_, i) => `Сильная тема ${i}`),
      mistakes: Array.from({ length: 6 }, () => ({ q: "в".repeat(220), given: "о".repeat(80), expected: "п".repeat(80) })),
    };
    const history = Array.from({ length: 12 }, (_, i) => ({ role: (i % 2 ? "assistant" : "user") as "user" | "assistant", content: "с".repeat(700) }));
    let longest = { id: "", len: 0 };
    for (const id of readableLessonIds(UNITS)) {
      const l = await loadLessonChat(id, "kk");
      if (l && l.conspect.length > longest.len) longest = { id, len: l.conspect.length };
    }
    const lesson2 = (await loadLessonChat(longest.id, "kk"))!;
    const fit = fitInput({
      budget: INPUT_BUDGET.tutor,
      ctx: heavy,
      history,
      base: (c) => tutorSystemPrompt(c, "chat", undefined, { chatMode: "free", lesson: lesson2 }).length,
    });
    expect(fit.chars).toBeLessThanOrEqual(INPUT_BUDGET.tutor);
    // правила и конспект урока целы: ужимаются история и данные ученика
    expect(tutorSystemPrompt(fit.ctx, "chat", undefined, { chatMode: "free", lesson: lesson2 })).toContain(lesson2.conspect);
    expect(fit.history[fit.history.length - 1]).toEqual(history[history.length - 1]);
  });
});

describe("маршрут /api/ai/tutor: чат по теме урока", () => {
  let ip = 0;
  const post = (body: unknown) =>
    new Request("http://localhost/api/ai/tutor", {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost", "x-forwarded-for": `10.9.0.${++ip}` },
      body: JSON.stringify(body),
    });
  const stream = () => {
    async function* gen() {
      yield { choices: [{ delta: { content: "Ответ" }, finish_reason: null }] };
      yield { choices: [{ delta: {}, finish_reason: "stop" }] };
    }
    return Object.assign(gen(), { controller: { abort: vi.fn() } });
  };
  const systemOf = () => (create.mock.calls[0][0].messages as { role: string; content: string }[])[0].content;
  const body = (extra: Record<string, unknown>) => ({ mode: "chat", messages: [{ role: "user", content: "Объясни проще" }], context: { lang: "ru" }, ...extra });

  beforeEach(() => {
    holder.kv = createMemoryKv();
    create.mockReset();
    create.mockImplementation(() => stream());
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("lessonId: в системный промпт попадают название и конспект урока; ИИ вызывается один раз", async () => {
    await (await POST(post(body({ chatMode: "free", lessonId: "ns-1-bits" })))).text();
    expect(create).toHaveBeenCalledTimes(1);
    const sys = systemOf();
    const lesson = (await loadLessonChat("ns-1-bits", "ru"))!;
    expect(sys).toContain(`ЧАТ ПО ТЕМЕ УРОКА «${lesson.title}»`);
    expect(sys).toContain(lesson.conspect);
  });

  it("язык ученика — конспект на казахском", async () => {
    await (await POST(post(body({ lessonId: "ns-1-bits", context: { lang: "kk" } })))).text();
    expect(systemOf()).toContain((await loadLessonChat("ns-1-bits", "kk"))!.conspect);
  });

  it("неизвестный и подозрительный lessonId — обычный чат, без падения", async () => {
    for (const lessonId of ["nope", "constructor", "../x", 5, { a: 1 }]) {
      create.mockClear();
      const res = await POST(post(body({ lessonId })));
      expect(res.status).toBe(200);
      await res.text();
      expect(systemOf()).not.toContain("ЧАТ ПО ТЕМЕ УРОКА");
    }
  });

  it("lessonId в других режимах чата («Объясни тему», «Проверь решение») и в подсказке игнорируется", async () => {
    await (await POST(post(body({ chatMode: "explain", topic: "t04", lessonId: "ns-1-bits" })))).text();
    expect(systemOf()).not.toContain("ЧАТ ПО ТЕМЕ УРОКА");
    create.mockClear();
    await (await POST(post({ mode: "hint", messages: [], context: { lang: "ru" }, task: { prompt: "Сколько?" }, lessonId: "ns-1-bits" }))).text();
    expect(systemOf()).not.toContain("ЧАТ ПО ТЕМЕ УРОКА");
  });

  it("без lessonId — прежний свободный чат", async () => {
    await (await POST(post(body({ chatMode: "free" })))).text();
    expect(systemOf()).not.toContain("КОНСПЕКТ УРОКА");
  });
});
