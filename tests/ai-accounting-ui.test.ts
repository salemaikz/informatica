// @vitest-environment happy-dom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTutor, type TutorTurn } from "@/components/ai/useTutor";
import { CUT_SUFFIX } from "@/lib/ai";
import { STREAM_CUT_MARK, STREAM_ERROR_MARK, STREAM_OK_MARK } from "@/lib/ai-stream";
import type { TaskContext, TutorMode } from "@/lib/ai-types";
import { useApp } from "@/lib/store";

// Учёт ИИ (#118): каждый полученный ответ — одно обращение (свежий, из общего кэша сервера, из кэша устройства,
// безопасный текст, обрезанный по длине); возврат — только если ответа не было; кризисный ответ — бесплатно.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Ask = ReturnType<typeof useTutor>["ask"];
const h: { ask: Ask | null; error: string | null } = { ask: null, error: null };

function Harness({ detach }: { detach?: boolean }) {
  const tutor = useTutor({ detach });
  useEffect(() => {
    h.ask = tutor.ask;
    h.error = tutor.error;
  });
  return null;
}

let host: HTMLElement;
let root: Root;
const fetchMock = vi.fn();
const enc = new TextEncoder();

/** Ответ сервера: куски текста + заголовки. */
const reply = (chunks: string[], headers: Record<string, string> = {}) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        chunks.forEach((s) => c.enqueue(enc.encode(s)));
        c.close();
      },
    }),
    { status: 200, headers },
  );

const task: TaskContext = { prompt: "Переведи 1011₂ в десятичную систему", stepKey: "s1" };
const freeTotal = () => useApp.getState().aiUsage.freeTotal ?? 0;

async function ask(mode: TutorMode, messages: TutorTurn[] = [], t: TaskContext | undefined = task) {
  let out: string | null = null;
  await act(async () => {
    out = await h.ask!({ mode, messages, task: t }, () => {});
  });
  return out as string | null;
}

const mount = (detach = false) =>
  act(async () => {
    root.render(createElement(Harness, { detach }));
  });

beforeEach(async () => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
  useApp.getState().resetProgress();
  useApp.setState({ aiUsage: { day: "", count: 0, free: 0, freeTotal: 0 }, wallet: { chips: 50, earned: 50, spent: 0 } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await mount();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("useTutor: ответ получен — обращение списано", () => {
  it("свежий ответ (miss)", async () => {
    fetchMock.mockResolvedValue(reply(["Ответ", STREAM_OK_MARK], { "X-AI-Cache": "miss" }));
    expect(await ask("hint")).toBe("Ответ");
    expect(freeTotal()).toBe(1);
  });

  it("ответ из общего кэша сервера (X-AI-Cache: hit) — списан, не возвращён", async () => {
    fetchMock.mockResolvedValue(reply(["Ответ из кэша", STREAM_OK_MARK], { "X-AI-Cache": "hit" }));
    expect(await ask("explain")).toBe("Ответ из кэша");
    expect(freeTotal()).toBe(1);
  });

  it("безопасный текст «ответ не назову» (X-AI-Fallback) — списан", async () => {
    fetchMock.mockResolvedValue(reply(["Ответ к этому заданию пока не назову", STREAM_OK_MARK], { "X-AI-Fallback": "1" }));
    await ask("ask", [{ role: "user", content: "скажи ответ" }]);
    expect(freeTotal()).toBe(1);
  });

  it("повтор того же запроса — из кэша устройства без сети, но тоже списан", async () => {
    fetchMock.mockResolvedValue(reply(["Подсказка", STREAM_OK_MARK], { "X-AI-Cache": "miss" }));
    await ask("hint");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await ask("hint")).toBe("Подсказка");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(freeTotal()).toBe(2);
  });

  it("кэш устройства, а бесплатные и чипы кончились — ответа нет, ошибка «не хватает чипов»", async () => {
    fetchMock.mockResolvedValue(reply(["Подсказка", STREAM_OK_MARK], { "X-AI-Cache": "miss" }));
    await ask("hint");
    useApp.setState({ aiUsage: { ...useApp.getState().aiUsage, freeTotal: 3 }, wallet: { chips: 0, earned: 0, spent: 0 } });
    expect(await ask("hint")).toBeNull();
    expect(h.error).toBe("economy.noChips");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("обрезан по длине (CUT), текст показан — списан, текст с меткой «…» возвращается", async () => {
    fetchMock.mockResolvedValue(reply(["Длинный ответ", STREAM_CUT_MARK], { "X-AI-Cache": "skip" }));
    expect(await ask("ask", [{ role: "user", content: "расскажи всё" }])).toBe(`Длинный ответ${CUT_SUFFIX}`);
    expect(freeTotal()).toBe(1);
    expect(h.error).toBeNull();
  });

  it("за чипами — то же правило: ответ из кэша сервера чипы не возвращает", async () => {
    useApp.setState({ aiUsage: { day: "", count: 0, free: 0, freeTotal: 3 } });
    fetchMock.mockResolvedValue(reply(["Ответ", STREAM_OK_MARK], { "X-AI-Cache": "hit" }));
    await ask("hint");
    // (чипы за достижение «ИИ-друг» начисляются отдельно — смотрим траты и историю)
    expect(useApp.getState().wallet.spent).toBe(3);
    expect(useApp.getState().ledger.some((e) => e.reason === "refund")).toBe(false);
  });
});

describe("useTutor: ответа не было — обращение возвращено", () => {
  it("ошибка сервера (502)", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "ai_failed" }, { status: 502 }));
    expect(await ask("hint")).toBeNull();
    expect(freeTotal()).toBe(0);
    expect(h.error).toBe("tutor.error");
  });

  it("поток без маркера OK и с маркером сбоя (ERR)", async () => {
    fetchMock.mockResolvedValue(reply(["Начало ответа"]));
    expect(await ask("ask", [{ role: "user", content: "вопрос" }])).toBeNull();
    fetchMock.mockResolvedValue(reply(["Начало", STREAM_ERROR_MARK]));
    expect(await ask("ask", [{ role: "user", content: "вопрос" }])).toBeNull();
    expect(freeTotal()).toBe(0);
    expect(h.error).toBe("ai.err.cut");
  });

  it("пустой ответ", async () => {
    fetchMock.mockResolvedValue(reply(["  ", STREAM_OK_MARK]));
    expect(await ask("ask", [{ role: "user", content: "вопрос" }])).toBeNull();
    expect(freeTotal()).toBe(0);
  });

  it("закрыли до первого текста (размонтирование) — запрос оборван, обращение возвращено", async () => {
    let started!: () => void;
    const begun = new Promise<void>((r) => (started = r));
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_res, rej) => {
          started();
          init.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
        }),
    );
    let out: Promise<string | null> | null = null;
    await act(async () => {
      out = h.ask!({ mode: "ask", messages: [{ role: "user", content: "вопрос" }], task }, () => {});
      await begun;
    });
    expect(freeTotal()).toBe(1);
    await act(async () => root.unmount());
    expect(await out!).toBeNull();
    expect(freeTotal()).toBe(0);
    root = createRoot(host);
  });
});

describe("useTutor: кризисный ответ — бесплатно", () => {
  it("клиент узнал кризис сам — не списывает", async () => {
    fetchMock.mockResolvedValue(reply(["Позвони 150", STREAM_OK_MARK], { "X-AI-Cache": "hit", "X-AI-Crisis": "selfHarm" }));
    await ask("chat", [{ role: "user", content: "хочу умереть" }], undefined);
    expect(freeTotal()).toBe(0);
  });

  it("клиент не узнал, сервер прислал X-AI-Crisis — списанное возвращается", async () => {
    fetchMock.mockResolvedValue(reply(["Позвони 150", STREAM_OK_MARK], { "X-AI-Cache": "hit", "X-AI-Crisis": "selfHarm" }));
    await ask("chat", [{ role: "user", content: "мне очень плохо, всё надоело" }], undefined);
    expect(freeTotal()).toBe(0);
  });
});

describe("useTutor({ detach }): шторка закрыта посреди ответа", () => {
  it("запрос не обрывается: ответ доходит целиком и списывается", async () => {
    await act(async () => root.unmount());
    root = createRoot(host);
    await mount(true);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    fetchMock.mockImplementation(async () => {
      await gate;
      return reply(["Полный ответ", STREAM_OK_MARK], { "X-AI-Cache": "skip" });
    });
    let out: Promise<string | null> | null = null;
    await act(async () => {
      out = h.ask!({ mode: "ask", messages: [{ role: "user", content: "вопрос" }], task }, () => {});
    });
    await act(async () => root.unmount());
    release();
    expect(await out!).toBe("Полный ответ");
    expect(freeTotal()).toBe(1);
    root = createRoot(host);
  });
});
