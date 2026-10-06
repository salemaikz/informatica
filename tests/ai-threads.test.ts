import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanTurns,
  clearThreads,
  dropThread,
  finishThread,
  getThread,
  ideThreadStep,
  saveThread,
  startThread,
  streamThread,
  THREAD_MAX_TURNS,
  THREAD_PENDING_MAX_MS,
  threadKey,
  useAiThreads,
} from "@/components/ai/ai-threads";
import type { TutorTurn } from "@/components/ai/useTutor";

// Нити шторки ИИ (#119): переписка по шагу и режиму живёт, пока идёт урок; итоги / «Начать заново» её чистят.

const q = (content: string): TutorTurn => ({ role: "user", content });
const a = (content: string): TutorTurn => ({ role: "assistant", content });

beforeEach(() => useAiThreads.setState({ threads: {} }));
afterEach(() => vi.useRealTimers());
const turnsOf = (key: string) => getThread(key)?.turns;

describe("ai-threads", () => {
  it("ключ — область, шаг и режим", () => {
    expect(threadKey("ns-1-bits", "s3", "ask")).toBe("ns-1-bits:s3:ask");
    expect(threadKey("drill:smart", "q1:retry", "hint")).toBe("drill:smart:q1:retry:hint");
  });

  it("сохраняет и отдаёт нить; режимы и шаги — отдельно", () => {
    saveThread(threadKey("L", "s1", "ask"), [q("Что такое бит?"), a("Наименьшая единица.")]);
    expect(turnsOf(threadKey("L", "s1", "ask"))).toEqual([q("Что такое бит?"), a("Наименьшая единица.")]);
    expect(getThread(threadKey("L", "s1", "ask"))?.pending).toBe(false);
    expect(getThread(threadKey("L", "s1", "hint"))).toBeUndefined();
    expect(getThread(threadKey("L", "s2", "ask"))).toBeUndefined();
  });

  it("пустая заготовка ответа («Загрузка…») не сохраняется; вопрос без ответа — остаётся", () => {
    saveThread("k", [q("Вопрос"), a("")]);
    expect(turnsOf("k")).toEqual([q("Вопрос")]);
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
    const saved = (saveThread("k", long), turnsOf("k"))!;
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

  it("запрос: сразу вопрос и «ответ в пути», по ходу — часть ответа, в конце — ответ без pending", () => {
    const rev = startThread("k", [q("Вопрос")]);
    expect(getThread("k")).toEqual({ turns: [q("Вопрос")], pending: true, rev });
    streamThread("k", rev, [q("Вопрос"), a("Отв")]);
    expect(getThread("k")).toEqual({ turns: [q("Вопрос"), a("Отв")], pending: true, rev });
    expect(finishThread("k", rev, [q("Вопрос"), a("Ответ")])).toBe(true);
    expect(getThread("k")).toEqual({ turns: [q("Вопрос"), a("Ответ")], pending: false, rev });
  });

  it("«Ещё подсказка» без истории: пустая нить в пути держится, без ответа — удаляется", () => {
    const rev = startThread("k", []);
    expect(getThread("k")?.pending).toBe(true);
    finishThread("k", rev, []);
    expect(getThread("k")).toBeUndefined();
  });

  it("устаревший запуск не затирает более новую переписку", () => {
    const old = startThread("k", [q("Q2")]);
    const cur = startThread("k", [q("Q2"), q("Q3")]);
    streamThread("k", old, [q("Q2"), a("старый поток")]);
    expect(finishThread("k", old, [q("Q2"), a("A2")])).toBe(false);
    expect(getThread("k")).toMatchObject({ turns: [q("Q2"), q("Q3")], pending: true, rev: cur });
  });

  it("нить очищена («Начать заново») посреди ответа — поздний ответ её не воскрешает", () => {
    const rev = startThread(threadKey("L", "s1", "ask"), [q("Q")]);
    clearThreads("L");
    streamThread(threadKey("L", "s1", "ask"), rev, [q("Q"), a("A")]);
    expect(finishThread(threadKey("L", "s1", "ask"), rev, [q("Q"), a("A")])).toBe(false);
    expect(getThread(threadKey("L", "s1", "ask"))).toBeUndefined();
  });

  it("запрос завис дольше THREAD_PENDING_MAX_MS — pending снимается (вопрос без ответа — «Повторить»)", () => {
    vi.useFakeTimers();
    const rev = startThread("k", [q("Q")]);
    vi.advanceTimersByTime(THREAD_PENDING_MAX_MS - 1);
    expect(getThread("k")?.pending).toBe(true);
    vi.advanceTimersByTime(1);
    expect(getThread("k")).toEqual({ turns: [q("Q")], pending: false, rev });
    // поздний ответ того же запуска всё равно сохраняется
    expect(finishThread("k", rev, [q("Q"), a("A")])).toBe(true);
    expect(turnsOf("k")).toEqual([q("Q"), a("A")]);
  });

  it("таймер зависания не трогает нить, если ответ уже пришёл или был новый запрос", () => {
    vi.useFakeTimers();
    const r1 = startThread("k", [q("Q")]);
    finishThread("k", r1, [q("Q"), a("A")]);
    const r2 = startThread("k", [q("Q"), a("A"), q("Q2")]);
    vi.advanceTimersByTime(THREAD_PENDING_MAX_MS - 10);
    // таймер r1 сработал раньше и ничего не сделал: r2 ещё в пути
    expect(getThread("k")).toMatchObject({ pending: true, rev: r2 });
  });

  it("dropThread забывает одну нить", () => {
    saveThread("a", [q("1")]);
    saveThread("b", [q("2")]);
    dropThread("a");
    expect(Object.keys(useAiThreads.getState().threads)).toEqual(["b"]);
  });

  it("практикум: «Объясни ошибку» — своя нить на каждую ошибку, «Спросить Бита» — одна на задачу", () => {
    const e1 = ideThreadStep("py-1", "explain", "NameError: name 'x' is not defined");
    const e2 = ideThreadStep("py-1", "explain", "TypeError: unsupported operand");
    expect(e1).not.toBe(e2);
    expect(ideThreadStep("py-1", "explain", "NameError: name 'x' is not defined")).toBe(e1);
    expect(e1.startsWith("py-1:")).toBe(true);
    expect(ideThreadStep("py-1", "ask", "NameError")).toBe("py-1");
    expect(ideThreadStep("py-1", "ask", null)).toBe("py-1");
    expect(threadKey("ide:py-1", e1, "explain")).not.toBe(threadKey("ide:py-1", e2, "explain"));
  });
});
