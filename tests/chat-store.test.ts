import { beforeEach, describe, expect, it } from "vitest";
import {
  capChats,
  capSize,
  chatFromLegacy,
  exportChats,
  historyForAi,
  importChats,
  matchSnippet,
  MAX_CHATS,
  MAX_MESSAGES,
  MAX_TITLE,
  migrateLegacyChat,
  sanitizeChats,
  searchChats,
  sortChats,
  titleFromText,
  useChats,
  type Chat,
} from "@/lib/chat-store";
import { createQuiz } from "@/lib/chat-quiz";
import { useApp } from "@/lib/store";

const reset = () => useChats.setState({ chats: [], activeId: null });
const chat = (over: Partial<Chat> = {}): Chat => ({ id: Math.random().toString(36).slice(2), title: "t", pinned: false, createdAt: 1, updatedAt: 1, messages: [], ...over });

describe("чаты: чистая логика", () => {
  it("заголовок из первого сообщения: одна строка, не длиннее лимита, по границе слова", () => {
    expect(titleFromText("  Как   перевести\n25 в двоичную?  ")).toBe("Как перевести 25 в двоичную?");
    const long = titleFromText("слово ".repeat(40));
    expect(long.length).toBeLessThanOrEqual(MAX_TITLE);
    expect(long.endsWith("…")).toBe(true);
    expect(long).not.toMatch(/\s…$/);
  });

  it("порядок: закреплённые сверху, затем свежие", () => {
    const a = chat({ id: "a", updatedAt: 5 });
    const b = chat({ id: "b", updatedAt: 9 });
    const c = chat({ id: "c", updatedAt: 1, pinned: true });
    expect(sortChats([a, b, c]).map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("поиск по названию и тексту, без регистра и с ё/е; кусок текста вокруг совпадения", () => {
    const a = chat({ id: "a", title: "Логика" });
    const b = chat({ id: "b", title: "Python", messages: [{ id: "m", role: "assistant", content: "Цикл for перебирает ЁЛКИ и списки", at: 1 }] });
    expect(searchChats([a, b], "логик").map((x) => x.id)).toEqual(["a"]);
    expect(searchChats([a, b], "елки").map((x) => x.id)).toEqual(["b"]);
    expect(searchChats([a, b], "  ").length).toBe(2);
    expect(matchSnippet(b, "елки")).toContain("ЁЛКИ");
    expect(matchSnippet(a, "логика")).toBeNull();
  });

  it("лимит чатов: удаляются самые старые незакреплённые, активный сохраняется", () => {
    const list = Array.from({ length: MAX_CHATS + 3 }, (_, i) => chat({ id: `c${i}`, updatedAt: i, pinned: i === 0 }));
    const capped = capChats(list, "c1");
    expect(capped).toHaveLength(MAX_CHATS);
    const ids = capped.map((c) => c.id);
    expect(ids).toContain("c0"); // закреплён
    expect(ids).toContain("c1"); // активный
    expect(ids).not.toContain("c2");
  });

  it("недоверенные данные: мусор отбрасывается, дубли id заменяются, сообщения обрезаются", () => {
    const msgs = Array.from({ length: MAX_MESSAGES + 10 }, (_, i) => ({ id: `m${i}`, role: i % 2 ? "assistant" : "user", content: `x${i}`, at: i }));
    const out = sanitizeChats([
      { id: "a", title: "A", messages: msgs },
      { id: "a", title: "B", messages: [{ role: "hacker", content: "x" }, { role: "user", content: "" }, { role: "user", content: "ok", at: 3 }] },
      null,
      "строка",
      { id: "q", messages: [{ role: "assistant", content: "", quiz: { source: { kind: "topic", topic: "t99" }, level: 1, seed: 1, skills: ["x"], ids: ["y"], answers: [] } }] },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0].messages).toHaveLength(MAX_MESSAGES);
    expect(out[0].messages.at(-1)!.content).toBe(`x${MAX_MESSAGES + 9}`);
    expect(out[1].id).not.toBe("a");
    expect(out[1].messages.map((m) => m.content)).toEqual(["ok"]);
    expect(out[2].messages).toHaveLength(0); // набор с неизвестной темой отброшен
    expect(sanitizeChats("нет")).toEqual([]);
  });

  it("лимит размера: сначала старые незакреплённые чаты, затем старые сообщения активного", () => {
    const msg = (i: number) => ({ id: `m${i}`, role: "user" as const, content: "x".repeat(1000), at: i });
    const old = chat({ id: "old", updatedAt: 1, messages: [msg(1)] });
    const pinned = chat({ id: "pin", pinned: true, updatedAt: 0, messages: [msg(2)] });
    const active = chat({ id: "act", updatedAt: 3, messages: Array.from({ length: 10 }, (_, i) => msg(i + 10)) });
    const all = [old, pinned, active];
    expect(capSize(all, "act", 1e9)).toBe(all);
    const fit = capSize(all, "act", 12_500);
    expect(fit.map((c) => c.id)).toEqual(["pin", "act"]);
    const tight = capSize(all, "act", 5_000);
    expect(tight.map((c) => c.id)).toEqual(["act"]);
    expect(tight[0].messages.length).toBeLessThan(10);
    expect(tight[0].messages.at(-1)?.id).toBe("m19");
    expect(JSON.stringify(tight).length).toBeLessThanOrEqual(5_000);
  });

  it("поиск и отрывок — по тексту без Markdown", () => {
    const c = chat({ title: "x", messages: [{ id: "a", role: "assistant", content: "## Ответ\n- Делим **25** на 2: `11001₂`", at: 1 }] });
    expect(searchChats([c], "25 на 2")).toHaveLength(1);
    expect(matchSnippet(c, "делим")).toBe("Ответ Делим 25 на 2: 11001₂");
  });

  it("одинаковые id сообщений внутри чата заменяются", () => {
    const [c] = sanitizeChats([{ id: "c", messages: [{ id: "a", role: "user", content: "1", at: 1 }, { id: "a", role: "assistant", content: "2", at: 2 }] }]);
    expect(new Set(c.messages.map((m) => m.id)).size).toBe(2);
  });

  it("история для ИИ: набор заданий — короткой сводкой, пустые — отбрасываются, не больше лимита", () => {
    const quiz = createQuiz({ kind: "topic", topic: "t04" }, 1, 1, [])!;
    const h = historyForAi(
      [
        { id: "1", role: "user", content: "привет", at: 1 },
        { id: "2", role: "assistant", content: "", quiz, at: 2 },
        { id: "3", role: "assistant", content: "  ", at: 3 },
      ],
      () => "[сводка]",
    );
    expect(h).toEqual([
      { role: "user", content: "привет" },
      { role: "assistant", content: "[сводка]" },
    ]);
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `${i}`, role: "user" as const, content: `${i}`, at: i }));
    expect(historyForAi(many, () => "", 12)).toHaveLength(12);
  });

  it("старый чат: перенос с заголовком из первого вопроса", () => {
    const c = chatFromLegacy([
      { id: "1", role: "assistant", content: "Привет!", at: 1 },
      { id: "2", role: "user", content: "Что такое бит?", at: 2 },
    ]);
    expect(c!.title).toBe("Что такое бит?");
    expect(c!.messages).toHaveLength(2);
    expect(chatFromLegacy([])).toBeNull();
  });
});

describe("чаты: хранилище", () => {
  beforeEach(reset);

  it("первое сообщение создаёт чат и даёт заголовок; переименование, закрепление, удаление", () => {
    const { chatId } = useChats.getState().addMessage({ role: "user", content: "Как работает XOR?" });
    let s = useChats.getState();
    expect(s.activeId).toBe(chatId);
    expect(s.chats[0].title).toBe("Как работает XOR?");
    s.addMessage({ role: "assistant", content: "Ответ" }, { chatId });
    s.addMessage({ role: "user", content: "Другой вопрос" }, { chatId });
    expect(useChats.getState().chats[0].title).toBe("Как работает XOR?");
    s.rename(chatId, "  Логика  ");
    s.togglePin(chatId);
    s = useChats.getState();
    expect(s.chats[0]).toMatchObject({ title: "Логика", pinned: true });
    s.remove(chatId);
    expect(useChats.getState()).toMatchObject({ chats: [], activeId: null });
  });

  it("«Новый чат» не плодит пустые чаты", () => {
    const a = useChats.getState().newChat();
    expect(useChats.getState().newChat()).toBe(a);
    useChats.getState().addMessage({ role: "user", content: "вопрос" });
    const b = useChats.getState().newChat();
    expect(b).not.toBe(a);
    expect(useChats.getState().chats).toHaveLength(2);
    useChats.getState().setActive(a);
    expect(useChats.getState().activeId).toBe(a);
  });

  it("набор заданий первым сообщением — заголовок из подсказки; ответ сохраняется", () => {
    const quiz = createQuiz({ kind: "topic", topic: "t04" }, 1, 1, [])!;
    const { chatId, msgId } = useChats.getState().addMessage({ role: "assistant", content: "", quiz }, { titleHint: "Задания: Счисление" });
    expect(useChats.getState().chats[0].title).toBe("Задания: Счисление");
    useChats.getState().answerQuiz(chatId, msgId, { ...quiz, answers: [{ type: "choice", index: 0 }, null, null, null, null] });
    expect(useChats.getState().chats[0].messages[0].quiz!.answers[0]).toEqual({ type: "choice", index: 0 });
  });

  it("не больше MAX_MESSAGES сообщений в чате", () => {
    const { chatId } = useChats.getState().addMessage({ role: "user", content: "0" });
    for (let i = 1; i < MAX_MESSAGES + 5; i++) useChats.getState().addMessage({ role: "user", content: `${i}` }, { chatId });
    const msgs = useChats.getState().chats[0].messages;
    expect(msgs).toHaveLength(MAX_MESSAGES);
    expect(msgs.at(-1)!.content).toBe(`${MAX_MESSAGES + 4}`);
  });

  it("перенос старого чата из useApp: один раз, старый очищается", () => {
    useApp.getState().resetProgress();
    useApp.getState().addChat({ role: "user", content: "Старый вопрос" });
    useApp.getState().addChat({ role: "assistant", content: "Старый ответ" });
    expect(migrateLegacyChat(useApp.getState().chat, () => useApp.getState().clearChat())).toBe(true);
    expect(useApp.getState().chat).toEqual([]);
    expect(useChats.getState().chats[0].title).toBe("Старый вопрос");
    expect(useChats.getState().activeId).toBe(useChats.getState().chats[0].id);
    // Повторно — нечего переносить.
    expect(migrateLegacyChat(useApp.getState().chat, () => useApp.getState().clearChat())).toBe(false);
  });

  it("перенос не трогает существующие чаты", () => {
    useChats.getState().addMessage({ role: "user", content: "новый" });
    useApp.getState().resetProgress();
    useApp.getState().addChat({ role: "user", content: "старый" });
    expect(migrateLegacyChat(useApp.getState().chat, () => useApp.getState().clearChat())).toBe(false);
    expect(useChats.getState().chats).toHaveLength(1);
  });

  it("экспорт и импорт: туда-обратно, мусор отвергается", () => {
    useChats.getState().addMessage({ role: "user", content: "вопрос" });
    const dump = JSON.parse(JSON.stringify(exportChats()));
    reset();
    expect(importChats(dump)).toBe(true);
    expect(useChats.getState().chats[0].title).toBe("вопрос");
    expect(useChats.getState().activeId).toBe(useChats.getState().chats[0].id);
    expect(importChats(null)).toBe(false);
    expect(importChats({ chats: "x" })).toBe(false);
  });
});
