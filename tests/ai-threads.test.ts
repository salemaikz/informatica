import { beforeEach, describe, expect, it } from "vitest";
import { cleanTurns, clearThreads, getThread, saveThread, THREAD_MAX_TURNS, threadKey, useAiThreads } from "@/components/ai/ai-threads";
import type { TutorTurn } from "@/components/ai/useTutor";

// Нити шторки ИИ (#119): переписка по шагу и режиму живёт, пока идёт урок; итоги / «Начать заново» её чистят.

const q = (content: string): TutorTurn => ({ role: "user", content });
const a = (content: string): TutorTurn => ({ role: "assistant", content });

beforeEach(() => useAiThreads.setState({ threads: {} }));

describe("ai-threads", () => {
  it("ключ — область, шаг и режим", () => {
    expect(threadKey("ns-1-bits", "s3", "ask")).toBe("ns-1-bits:s3:ask");
    expect(threadKey("drill:smart", "q1:retry", "hint")).toBe("drill:smart:q1:retry:hint");
  });

  it("сохраняет и отдаёт нить; режимы и шаги — отдельно", () => {
    saveThread(threadKey("L", "s1", "ask"), [q("Что такое бит?"), a("Наименьшая единица.")]);
    expect(getThread(threadKey("L", "s1", "ask"))).toEqual([q("Что такое бит?"), a("Наименьшая единица.")]);
    expect(getThread(threadKey("L", "s1", "hint"))).toBeUndefined();
    expect(getThread(threadKey("L", "s2", "ask"))).toBeUndefined();
  });

  it("пустая заготовка ответа («Загрузка…») не сохраняется; вопрос без ответа — остаётся", () => {
    saveThread("k", [q("Вопрос"), a("")]);
    expect(getThread("k")).toEqual([q("Вопрос")]);
    expect(cleanTurns([a("   "), q("x")])).toEqual([q("x")]);
  });

  it("пустая нить удаляет ключ", () => {
    saveThread("k", [q("Вопрос"), a("Ответ")]);
    saveThread("k", [a("")]);
    expect(getThread("k")).toBeUndefined();
    expect(Object.keys(useAiThreads.getState().threads)).toEqual([]);
  });

  it("не длиннее THREAD_MAX_TURNS — держим хвост", () => {
    const long = Array.from({ length: THREAD_MAX_TURNS + 6 }, (_, i) => (i % 2 ? a(`a${i}`) : q(`q${i}`)));
    const saved = (saveThread("k", long), getThread("k"))!;
    expect(saved).toHaveLength(THREAD_MAX_TURNS);
    expect(saved[saved.length - 1]).toEqual(long[long.length - 1]);
  });

  it("clearThreads чистит только свою область (префикс с двоеточием: ns-1 не задевает ns-1-bits)", () => {
    saveThread(threadKey("ns-1", "s1", "ask"), [q("1")]);
    saveThread(threadKey("ns-1", "s2", "hint"), [q("2")]);
    saveThread(threadKey("ns-1-bits", "s1", "ask"), [q("3")]);
    saveThread(threadKey("drill:smart", "s1", "ask"), [q("4")]);
    clearThreads("ns-1");
    expect(Object.keys(useAiThreads.getState().threads).sort()).toEqual(["drill:smart:s1:ask", "ns-1-bits:s1:ask"]);
    const before = useAiThreads.getState().threads;
    clearThreads("nothing");
    expect(useAiThreads.getState().threads).toBe(before);
  });
});
