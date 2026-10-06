// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiPanel } from "@/components/ai/AiPanel";
import type { TutorTurn } from "@/components/ai/useTutor";
import { getThread, saveThread, useAiThreads } from "@/components/ai/ai-threads";
import { STREAM_OK_MARK } from "@/lib/ai-stream";
import type { TaskContext } from "@/lib/ai-types";
import { useApp } from "@/lib/store";

// Шторка ИИ с нитью (#119): закрыли и открыли снова — переписка на месте, платной «Ещё подсказки» нет, вопрос при
// открытии не уходит второй раз; ответ, пришедший после закрытия, сохраняется в нить (ai-threads.ts); открыли снова,
// пока ответ идёт, — вопрос второй раз не уходит (не списывается), ответ появляется в открытой шторке.

vi.mock("next/navigation", () => ({ usePathname: () => "/lesson/x", useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown } & Record<string, unknown>) => createElement("a", { href, ...rest }, children as never),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const enc = new TextEncoder();
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

const task: TaskContext = { prompt: "Сколько бит в байте?", stepKey: "s1", hint: "Вспомни про степени двойки" };
const fetchMock = vi.fn();
const KEY = "L:s1:hint";
const turnsOf = (key = KEY) => getThread(key)?.turns;
let host: HTMLElement;
let root: Root;

type Props = Parameters<typeof AiPanel>[0];
const render = (p: Partial<Props>) =>
  act(async () => {
    root.render(createElement(AiPanel, { open: true, onClose: () => {}, mode: "hint", task, noteKey: "general", thread: KEY, ...p }));
  });
const text = () => document.body.textContent ?? "";
const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(label));
const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

beforeEach(() => {
  useAiThreads.setState({ threads: {} });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
  useApp.getState().resetProgress();
  useApp.setState((s) => ({ profile: { ...s.profile, lang: "ru" }, aiUsage: { day: "", count: 0, free: 0, freeTotal: 0 } }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("AiPanel: нить из памяти", () => {
  it("нить показана, платной кнопки «Ещё подсказка» нет", async () => {
    saveThread(KEY, [{ role: "assistant", content: "Подсказка от Бита про байт" }]);
    await render({});
    expect(text()).toContain("Подсказка от Бита про байт");
    expect(button("Ещё подсказка")).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("без нити — кнопка «Ещё подсказка» на месте", async () => {
    await render({});
    expect(button("Ещё подсказка")).toBeDefined();
  });

  it("autoAsk не уходит второй раз, если нить уже есть", async () => {
    saveThread("L:s1:ask", [{ role: "user", content: "Объясни проще" }, { role: "assistant", content: "Байт — 8 бит" }]);
    await render({ mode: "ask", autoAsk: "Объясни проще", thread: "L:s1:ask" });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(text()).toContain("Байт — 8 бит");
  });

  it("autoAsk без нити уходит один раз, ответ сохраняется в нить", async () => {
    fetchMock.mockResolvedValue(reply(["Байт — это 8 бит", STREAM_OK_MARK], { "X-AI-Cache": "miss" }));
    await render({ mode: "ask", autoAsk: "Объясни проще" });
    await flush();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getThread(KEY)?.pending).toBe(false);
    expect(turnsOf()).toEqual([
      { role: "user", content: "Объясни проще" },
      { role: "assistant", content: "Байт — это 8 бит" },
    ]);
  });

  it("закрыли шторку посреди ответа — ответ дошёл и сохранён в нить, обращение списано", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    fetchMock.mockImplementation(async () => {
      await gate;
      return reply(["Полный ответ Бита", STREAM_OK_MARK], { "X-AI-Cache": "skip" });
    });
    await render({ mode: "ask" });
    const input = document.querySelector("input")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "Что такое бит?");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Закрыли (размонтировали) до ответа.
    await act(async () => root.unmount());
    root = createRoot(host);
    expect(getThread(KEY)).toMatchObject({ turns: [{ role: "user", content: "Что такое бит?" }], pending: true });
    release();
    await flush();
    await flush();
    expect(turnsOf()).toEqual([
      { role: "user", content: "Что такое бит?" },
      { role: "assistant", content: "Полный ответ Бита" },
    ]);
    expect(useApp.getState().aiUsage.freeTotal).toBe(1);
  });

  it("нить кончается вопросом без ответа — «Ответ не пришёл» и «Повторить»; повтор не дублирует вопрос", async () => {
    fetchMock.mockResolvedValue(reply(["Теперь ответ есть", STREAM_OK_MARK]));
    saveThread(KEY, [{ role: "user", content: "Почему 8?" }]);
    await render({ mode: "ask" });
    expect(text()).toContain("Ответ не пришёл");
    await act(async () => button("Повторить")!.click());
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { messages: TutorTurn[] };
    expect(body.messages).toEqual([{ role: "user", content: "Почему 8?" }]);
    expect(text()).toContain("Теперь ответ есть");
    expect(text()).not.toContain("Ответ не пришёл");
    expect(turnsOf()).toEqual([
      { role: "user", content: "Почему 8?" },
      { role: "assistant", content: "Теперь ответ есть" },
    ]);
  });

  // Поток: первая часть сразу, остальное — после release().
  const gatedReply = () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const res = new Response(
      new ReadableStream<Uint8Array>({
        async start(c) {
          c.enqueue(enc.encode("Часть ответа"));
          await gate;
          c.enqueue(enc.encode(" и конец"));
          c.enqueue(enc.encode(STREAM_OK_MARK));
          c.close();
        },
      }),
      { status: 200, headers: { "X-AI-Cache": "skip" } },
    );
    return { res, release };
  };
  const typeAndSend = async (q: string) => {
    const input = document.querySelector("input")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, q);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  };
  const reopen = async (p: Partial<Props>) => {
    await act(async () => root.unmount());
    root = createRoot(host);
    await render(p);
  };

  it("закрыли и открыли снова, пока ответ идёт: второй раз не спрашивает и не списывает, ответ появляется в открытой шторке", async () => {
    saveThread(KEY, [{ role: "user", content: "Q1" }, { role: "assistant", content: "A1" }]);
    const g = gatedReply();
    fetchMock.mockResolvedValueOnce(g.res);
    await render({ mode: "ask" });
    await typeAndSend("Q2");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useApp.getState().aiUsage.freeTotal).toBe(1);
    // Закрыли до конца ответа и открыли снова на том же шаге.
    await reopen({ mode: "ask" });
    expect(text()).toContain("Q2");
    expect(text()).toContain("Часть ответа");
    // Пока ответ в пути — отправить нельзя.
    const input = document.querySelector("input")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "Q3");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect((document.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Ответ первого запроса дошёл — виден в открытой шторке и сохранён; обращение одно.
    g.release();
    await flush();
    await flush();
    expect(text()).toContain("Часть ответа и конец");
    expect(text()).not.toContain("Ответ не пришёл");
    expect(turnsOf()).toEqual([
      { role: "user", content: "Q1" },
      { role: "assistant", content: "A1" },
      { role: "user", content: "Q2" },
      { role: "assistant", content: "Часть ответа и конец" },
    ]);
    expect(getThread(KEY)?.pending).toBe(false);
    expect(useApp.getState().aiUsage.freeTotal).toBe(1);
    expect((document.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it("вопрос при открытии (autoAsk): закрыли до ответа и открыли снова — второй запрос не уходит", async () => {
    const g = gatedReply();
    fetchMock.mockResolvedValueOnce(g.res);
    await render({ mode: "ask", autoAsk: "Объясни проще" });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await reopen({ mode: "ask", autoAsk: "Объясни проще" });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    g.release();
    await flush();
    await flush();
    expect(text()).toContain("Часть ответа и конец");
    expect(turnsOf()).toEqual([
      { role: "user", content: "Объясни проще" },
      { role: "assistant", content: "Часть ответа и конец" },
    ]);
  });

  it("«Ещё подсказка»: закрыли до ответа и открыли снова — платной кнопки нет, ждём тот же ответ", async () => {
    const g = gatedReply();
    fetchMock.mockResolvedValueOnce(g.res);
    await render({});
    await act(async () => button("Ещё подсказка")!.click());
    await flush();
    await reopen({});
    expect(button("Ещё подсказка")).toBeUndefined();
    g.release();
    await flush();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(text()).toContain("Часть ответа и конец");
    expect(turnsOf()).toEqual([{ role: "assistant", content: "Часть ответа и конец" }]);
  });

  it("шторка без ключа нити: при закрытии нить забывается", async () => {
    saveThread(KEY, [{ role: "assistant", content: "чужая нить" }]);
    fetchMock.mockResolvedValue(reply(["Подсказка", STREAM_OK_MARK]));
    await render({ thread: undefined });
    await act(async () => button("Ещё подсказка")!.click());
    await flush();
    expect(text()).toContain("Подсказка");
    expect(Object.keys(useAiThreads.getState().threads).some((k) => k.startsWith("local:"))).toBe(true);
    await act(async () => root.unmount());
    root = createRoot(host);
    expect(Object.keys(useAiThreads.getState().threads)).toEqual([KEY]);
  });

  it("кнопка отправки подписана на языке ученика", async () => {
    await render({ mode: "ask" });
    expect(document.querySelector('button[type="submit"]')!.getAttribute("aria-label")).toBe("Отправить");
  });
});
