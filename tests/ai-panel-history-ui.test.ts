// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiPanel } from "@/components/ai/AiPanel";
import type { TutorTurn } from "@/components/ai/useTutor";
import { STREAM_OK_MARK } from "@/lib/ai-stream";
import type { TaskContext } from "@/lib/ai-types";
import { useApp } from "@/lib/store";

// Шторка ИИ с нитью (#119): закрыли и открыли снова — переписка на месте, платной «Ещё подсказки» нет, вопрос при
// открытии не уходит второй раз; ответ, пришедший после закрытия, сохраняется через onTurns.

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
let host: HTMLElement;
let root: Root;

type Props = Parameters<typeof AiPanel>[0];
const render = (p: Partial<Props>) =>
  act(async () => {
    root.render(createElement(AiPanel, { open: true, onClose: () => {}, mode: "hint", task, noteKey: "general", ...p }));
  });
const text = () => document.body.textContent ?? "";
const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(label));
const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

beforeEach(() => {
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
  it("initialTurns показаны, платной кнопки «Ещё подсказка» нет", async () => {
    const turns: TutorTurn[] = [{ role: "assistant", content: "Подсказка от Бита про байт" }];
    await render({ initialTurns: turns });
    expect(text()).toContain("Подсказка от Бита про байт");
    expect(button("Ещё подсказка")).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("без нити — кнопка «Ещё подсказка» на месте", async () => {
    await render({});
    expect(button("Ещё подсказка")).toBeDefined();
  });

  it("autoAsk не уходит второй раз, если нить уже есть", async () => {
    await render({ mode: "ask", autoAsk: "Объясни проще", initialTurns: [{ role: "user", content: "Объясни проще" }, { role: "assistant", content: "Байт — 8 бит" }] });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(text()).toContain("Байт — 8 бит");
  });

  it("autoAsk без нити уходит один раз, ответ сохраняется в onTurns", async () => {
    fetchMock.mockResolvedValue(reply(["Байт — это 8 бит", STREAM_OK_MARK], { "X-AI-Cache": "miss" }));
    const onTurns = vi.fn();
    await render({ mode: "ask", autoAsk: "Объясни проще", onTurns });
    await flush();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onTurns).toHaveBeenLastCalledWith([
      { role: "user", content: "Объясни проще" },
      { role: "assistant", content: "Байт — это 8 бит" },
    ]);
  });

  it("закрыли шторку посреди ответа — ответ дошёл и сохранён через onTurns, обращение списано", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    fetchMock.mockImplementation(async () => {
      await gate;
      return reply(["Полный ответ Бита", STREAM_OK_MARK], { "X-AI-Cache": "skip" });
    });
    const onTurns = vi.fn();
    await render({ mode: "ask", onTurns });
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
    release();
    await flush();
    await flush();
    expect(onTurns).toHaveBeenLastCalledWith([
      { role: "user", content: "Что такое бит?" },
      { role: "assistant", content: "Полный ответ Бита" },
    ]);
    expect(useApp.getState().aiUsage.freeTotal).toBe(1);
  });

  it("нить кончается вопросом без ответа — «Ответ не пришёл» и «Повторить»; повтор не дублирует вопрос", async () => {
    fetchMock.mockResolvedValue(reply(["Теперь ответ есть", STREAM_OK_MARK]));
    const onTurns = vi.fn();
    await render({ mode: "ask", initialTurns: [{ role: "user", content: "Почему 8?" }], onTurns });
    expect(text()).toContain("Ответ не пришёл");
    await act(async () => button("Повторить")!.click());
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { messages: TutorTurn[] };
    expect(body.messages).toEqual([{ role: "user", content: "Почему 8?" }]);
    expect(text()).toContain("Теперь ответ есть");
    expect(text()).not.toContain("Ответ не пришёл");
    expect(onTurns).toHaveBeenLastCalledWith([
      { role: "user", content: "Почему 8?" },
      { role: "assistant", content: "Теперь ответ есть" },
    ]);
  });

  it("кнопка отправки подписана на языке ученика", async () => {
    await render({ mode: "ask" });
    expect(document.querySelector('button[type="submit"]')!.getAttribute("aria-label")).toBe("Отправить");
  });
});
