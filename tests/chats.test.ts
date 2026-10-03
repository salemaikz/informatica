import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deleteMessages, loadMessages, saveMessages } from "@/lib/chat-store";
import {
  autoTitle,
  CHAT_MODES,
  MAX_MESSAGES,
  previewOf,
  quizGrade,
  sanitizeChats,
  searchChats,
  sortChats,
  type ChatMeta,
  type ChatMsg,
  type QuizSummary,
} from "@/lib/chats";
import { translate } from "@/i18n/useT";
import { chat2Dict } from "@/i18n/parts/chat2";
import {
  appendMessage,
  clip,
  describeQuiz,
  displayTitle,
  firstUserText,
  formatChatTime,
  HISTORY_LIMIT,
  lastPreview,
  legacyToMsgs,
  MAX_MISTAKES_TO_AI,
  MODE_DESC_KEY,
  MODE_NAME_KEY,
  needsTopicStep,
  reviewRequest,
  toHistory,
  topicTitle,
  type Tr,
} from "@/components/chat/helpers";

const meta = (p: Partial<ChatMeta> & { id: string }): ChatMeta => ({
  title: "",
  mode: "free",
  createdAt: 1,
  updatedAt: 1,
  preview: "",
  count: 0,
  ...p,
});

const msg = (p: Partial<ChatMsg> & { id: string }): ChatMsg => ({ role: "user", content: "x", at: 1, ...p });

const quiz = (p: Partial<QuizSummary> = {}): QuizSummary => ({
  topic: "t04",
  correct: 7,
  total: 10,
  grade: 4,
  mistakes: [
    { prompt: "1011₂ в десятичную?", given: "10", expected: "11" },
    { prompt: "2³ = ?", given: "6", expected: "8" },
  ],
  ...p,
});

const trRu: Tr = (k, p) => translate("ru", k, p);
const trKk: Tr = (k, p) => translate("kk", k, p);

describe("lib/chats: список", () => {
  it("закреплённые сверху, дальше — по времени", () => {
    const list = [meta({ id: "a", updatedAt: 5 }), meta({ id: "b", updatedAt: 9 }), meta({ id: "c", updatedAt: 1, pinned: true })];
    expect(sortChats(list).map((c) => c.id)).toEqual(["c", "b", "a"]);
  });

  it("поиск по названию и превью без учёта регистра и «ё»", () => {
    const list = [meta({ id: "a", title: "Системы счисления" }), meta({ id: "b", preview: "Ёмкость диска" }), meta({ id: "c", title: "Логика" })];
    expect(searchChats(list, "СЧИСЛ").map((c) => c.id)).toEqual(["a"]);
    expect(searchChats(list, "емкость").map((c) => c.id)).toEqual(["b"]);
    expect(searchChats(list, "  ")).toHaveLength(3);
    expect(searchChats(list, "нет такого")).toEqual([]);
  });

  it("название и превью: без разметки и с обрезкой", () => {
    expect(autoTitle("**Объясни** `код`")).toBe("Объясни код");
    const long = "слово ".repeat(40);
    expect(autoTitle(long).length).toBeLessThanOrEqual(61);
    expect(autoTitle(long).endsWith("…")).toBe(true);
    expect(previewOf(long).length).toBeLessThanOrEqual(90);
  });

  it("оценка за задачи: 90/70/50", () => {
    expect([10, 9, 8, 7, 6, 5, 4, 0].map((c) => quizGrade(c, 10))).toEqual([5, 5, 4, 4, 3, 3, 2, 2]);
    expect(quizGrade(0, 0)).toBe(2);
  });

  it("sanitizeChats выкидывает мусор", () => {
    const ok = meta({ id: "a", mode: "tasks", topic: "t01" });
    const out = sanitizeChats([ok, { id: 5 }, null, { id: "z", mode: "wat" }]);
    expect(out.map((c) => c.id)).toEqual(["a"]);
    expect(sanitizeChats("x")).toEqual([]);
  });
});

describe("components/chat/helpers", () => {
  it("тема: нужна ли и как называется", () => {
    expect(needsTopicStep("explain")).toBe(true);
    expect(needsTopicStep("tasks")).toBe(true);
    expect(needsTopicStep("free")).toBe(false);
    expect(needsTopicStep("check")).toBe(false);
    expect(topicTitle("t04", "ru")).toBe("Системы счисления");
    expect(topicTitle("t04", "kk", true)).toBe("Санау жүйелері");
    expect(topicTitle(undefined, "ru")).toBe("");
  });

  it("название для показа: своё или режим и тема", () => {
    expect(displayTitle({ title: " Мой ", mode: "free" }, "ru", trRu)).toBe("Мой");
    expect(displayTitle({ title: "", mode: "free" }, "ru", trRu)).toBe("Свободный");
    expect(displayTitle({ title: "", mode: "tasks", topic: "t04" }, "kk", trKk)).toBe("Есеп бер: Санау жүйелері");
  });

  it("история для ИИ: последние 12, карточка итога — текстом", () => {
    const many = Array.from({ length: 20 }, (_, i) => msg({ id: `m${i}`, role: i % 2 ? "assistant" : "user", content: `t${i}` }));
    const h = toHistory(many, "ru", trRu);
    expect(h).toHaveLength(HISTORY_LIMIT);
    expect(h[h.length - 1].content).toBe("t19");

    const withQuiz = toHistory([msg({ id: "q", role: "assistant", content: "Итог", quiz: quiz() })], "ru", trRu);
    expect(withQuiz[0].role).toBe("user");
    expect(withQuiz[0].content).toContain("7 из 10");
    expect(withQuiz[0].content).toContain("«Системы счисления»");
    expect(withQuiz[0].content).toContain("1011₂ в десятичную?");
    expect(withQuiz[0].content).toContain("Верный ответ: 11");
  });

  it("описание итога: ограничено числом и длиной ошибок", () => {
    const mistakes = Array.from({ length: 9 }, (_, i) => ({ prompt: "п".repeat(500), given: String(i), expected: "в" }));
    const text = describeQuiz(quiz({ mistakes, topic: undefined }), "ru", trRu);
    expect(text.split("\n")).toHaveLength(1 + MAX_MISTAKES_TO_AI);
    expect(text.split("\n")[1].length).toBeLessThan(300);
    expect(text.startsWith("Результат моих заданий: 7 из 10")).toBe(true);
    expect(clip("абв", 10)).toBe("абв");
  });

  it("«Разобрать ошибки»: просьба и список на казахском без пропусков", () => {
    const text = reviewRequest(quiz(), trKk);
    expect(text.split("\n")[0]).toBe(trKk("chat2.quiz.reviewAsk"));
    expect(text).toContain("1. 1011₂ в десятичную?");
    expect(text).toContain("Дұрыс жауап: 11.");
  });

  it("лента: добавление с обрезкой, первый вопрос, превью", () => {
    const full = Array.from({ length: MAX_MESSAGES }, (_, i) => msg({ id: `m${i}` }));
    const next = appendMessage(full, msg({ id: "new" }));
    expect(next).toHaveLength(MAX_MESSAGES);
    expect(next[next.length - 1].id).toBe("new");
    expect(next[0].id).toBe("m1");

    const feed = [msg({ id: "1", role: "assistant", content: "карточка", quiz: quiz() }), msg({ id: "2", content: "Что такое бит?" })];
    expect(firstUserText(feed)).toBe("Что такое бит?");
    expect(lastPreview(feed, trRu)).toBe("Что такое бит?");
    expect(lastPreview([feed[0]], trRu)).toBe("Итог: 7 из 10, оценка 4");
    expect(lastPreview([], trRu)).toBe("");
  });

  it("перенос старого чата: пустое отбрасывается, поля сохраняются", () => {
    const out = legacyToMsgs([
      { id: "a", role: "user", content: "привет", hadImage: true, at: 5 },
      { id: "b", role: "assistant", content: "  ", at: 6 },
      { id: "c", role: "assistant", content: "ответ", at: 7 },
    ]);
    expect(out).toEqual([
      { id: "a", role: "user", content: "привет", hadImage: true, at: 5 },
      { id: "c", role: "assistant", content: "ответ", hadImage: undefined, at: 7 },
    ]);
  });

  it("время в списке: сегодня — часы, раньше — дата, нет часов — пусто", () => {
    const now = new Date(2026, 9, 3, 15, 0).getTime();
    expect(formatChatTime(new Date(2026, 9, 3, 9, 5).getTime(), now, "ru")).toBe("09:05");
    expect(formatChatTime(new Date(2026, 9, 2, 9, 5).getTime(), now, "ru")).toBe("2 окт.");
    expect(formatChatTime(new Date(2026, 9, 2, 9, 5).getTime(), now, "kk")).toBe("2 қаз.");
    expect(formatChatTime(now, 0, "ru")).toBe("");
    expect(formatChatTime(0, now, "ru")).toBe("");
  });
});

describe("chat-store: сообщения", () => {
  it("сохраняет, читает, обрезает и удаляет (без IndexedDB — в памяти)", async () => {
    const id = "test-chat";
    expect(await loadMessages(id)).toEqual([]);
    const many = Array.from({ length: MAX_MESSAGES + 5 }, (_, i) => msg({ id: `m${i}` }));
    await saveMessages(id, many);
    const loaded = await loadMessages(id);
    expect(loaded).toHaveLength(MAX_MESSAGES);
    expect(loaded[loaded.length - 1].id).toBe(`m${MAX_MESSAGES + 4}`);
    await deleteMessages(id);
    expect(await loadMessages(id)).toEqual([]);
  });
});

describe("словарь chat2.*", () => {
  const entries = Object.entries(chat2Dict) as [string, { ru: string; kk: string }][];

  it("у каждого режима есть название и описание", () => {
    for (const m of CHAT_MODES) {
      expect(chat2Dict).toHaveProperty([MODE_NAME_KEY[m]]);
      expect(chat2Dict).toHaveProperty([MODE_DESC_KEY[m]]);
    }
  });

  it("ключи только с префиксом chat2., ru и kk заполнены, плейсхолдеры совпадают", () => {
    for (const [key, v] of entries) {
      expect(key.startsWith("chat2."), key).toBe(true);
      expect(v.ru.trim(), key).toBeTruthy();
      expect(v.kk.trim(), key).toBeTruthy();
      const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(ph(v.kk), key).toEqual(ph(v.ru));
    }
  });

  it("в казахском нет окончаний сразу после {плейсхолдера}", () => {
    for (const [key, v] of entries) expect(/\}[\p{L}]/u.test(v.kk), key).toBe(false);
  });

  it("все используемые в коде ключи chat2.* есть в словаре", () => {
    const root = join(__dirname, "..");
    const files = [
      join(root, "src/components/chat/helpers.ts"),
      ...readdirSync(join(root, "src/components/chat"))
        .filter((f) => /\.tsx?$/.test(f))
        .map((f) => join(root, "src/components/chat", f)),
      join(root, "src/app/(main)/tutor/page.tsx"),
    ];
    const missing = new Set<string>();
    for (const f of files) {
      for (const m of readFileSync(f, "utf8").matchAll(/"(chat2\.[a-zA-Z0-9_.]+)"/g)) {
        if (!(m[1] in chat2Dict)) missing.add(`${m[1]} (${f})`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
