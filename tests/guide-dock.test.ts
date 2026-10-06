// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BitDock } from "@/components/guide/BitDock";
import { BitChatPanel } from "@/components/guide/BitChatPanel";
import { useGuideSpots } from "@/components/guide/GuideSpot";
import { useGuideUi } from "@/components/guide/guide-state";
import { foreignModal } from "@/components/guide/targets";
import { useTutor } from "@/components/ai/useTutor";
import { TIP_IDS } from "@/lib/tips";
import { useApp } from "@/lib/store";

// Этап 16В, ревью P2a + P2b: плавающая кнопка Бита рядом с проводником (не выезжает перед сценой, видна на шаге про
// себя, не путает пузырь проводника и закрытую панель с окнами), фокус с клавиатуры, закрытая чат-панель — не окно,
// уход с экрана посреди ответа ИИ возвращает обращение или сохраняет показанную часть.

const h = vi.hoisted(() => ({
  pathname: "/learn",
  stream: null as null | ((req: unknown, onText: (t: string) => void, signal: AbortSignal) => Promise<string>),
}));

vi.mock("next/navigation", () => ({ usePathname: () => h.pathname, useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown } & Record<string, unknown>) => createElement("a", { href, ...rest }, children as never),
}));
// Панель с чатом грузится лениво; здесь — заглушка (сама панель проверяется отдельно).
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/components/chat/ChatScreen", () => ({ ChatScreen: () => null }));
vi.mock("@/lib/sound", () => ({ playSound: () => {} }));
vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  streamTutor: (req: unknown, onText: (t: string) => void, signal: AbortSignal) => h.stream!(req, onText, signal),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ALL = Object.fromEntries(TIP_IDS.map((id) => [id, 1]));

let host: HTMLElement;
let root: Root;
const extra: HTMLElement[] = [];

const render = (el: ReturnType<typeof createElement>) =>
  act(async () => {
    root.render(el);
  });
const dock = () => document.querySelector<HTMLButtonElement>('[data-tour="bit-dock"]');
const tab = () => document.querySelector<HTMLButtonElement>("[data-dock-tab]");
/** Окно поверх страницы; wrap — обёртка (для inert / data-guide). */
function modal(wrapAttrs: Record<string, string> = {}) {
  const wrap = document.createElement("div");
  for (const [k, v] of Object.entries(wrapAttrs)) wrap.setAttribute(k, v);
  const el = document.createElement("div");
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  wrap.appendChild(el);
  document.body.appendChild(wrap);
  extra.push(wrap);
  return wrap;
}
const key = (el: Element, k: string) =>
  act(async () => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  });

beforeEach(() => {
  h.pathname = "/learn";
  useApp.getState().resetProgress();
  useApp.setState((s) => ({ onboarded: true, tips: ALL, profile: { ...s.profile, lang: "ru", sound: false, reduceMotion: true, bitHidden: false } }));
  useGuideSpots.setState({ lesson: null, results: false });
  useGuideUi.setState({ active: false, dockStep: false });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  extra.splice(0).forEach((e) => e.remove());
  useApp.getState().resetProgress();
});

describe("кнопка Бита и проводник", () => {
  it("сцен нет — кнопка видна", async () => {
    await render(createElement(BitDock));
    expect(dock()).not.toBeNull();
  });

  it("проводник хочет сыграть сцену (ещё пауза перед выходом Бита) — кнопка не показывается вовсе", async () => {
    h.pathname = "/practice";
    useApp.setState({ tips: { nav: 1 } });
    await render(createElement(BitDock));
    expect(dock()).toBeNull();
    // Сцену доиграли — кнопка выезжает.
    await act(async () => useApp.getState().noteTip("page-practice"));
    expect(dock()).not.toBeNull();
  });

  it("свежий профиль на «Учиться» (приветствие) — кнопки нет с первого кадра", async () => {
    useApp.setState({ tips: {} });
    await render(createElement(BitDock));
    expect(dock()).toBeNull();
  });

  it("шаг «А это я!»: кнопка видна, хотя сцена идёт и модальный пузырь проводника открыт", async () => {
    useApp.setState({ tips: { welcome: 1, "lesson-first": 1, "after-first": 1 }, lessons: { l1: { completions: 1 } } as never });
    modal({ "data-guide": "" });
    await render(createElement(BitDock));
    expect(dock()).toBeNull();
    await act(async () => useGuideUi.setState({ active: false, dockStep: true }));
    expect(dock()).not.toBeNull();
    // Пузырь проводника перерисовался (новый шаг) — кнопка не мигает.
    modal({ "data-guide": "" });
    await act(async () => {});
    expect(dock()).not.toBeNull();
  });

  it("чужое окно поверх — кнопка прячется; закрытое (inert) и скрытое окна — не мешают", async () => {
    modal({ inert: "" });
    modal({ hidden: "" });
    modal({ style: "display:none" });
    await render(createElement(BitDock));
    expect(dock()).not.toBeNull();
    const open = modal();
    await act(async () => {});
    expect(dock()).toBeNull();
    open.remove();
    await act(async () => {});
    expect(dock()).not.toBeNull();
  });
});

describe("кнопка Бита с клавиатуры", () => {
  it("стрелка вправо прячет — фокус на язычке; стрелка влево возвращает — фокус на кнопке", async () => {
    await render(createElement(BitDock));
    dock()!.focus();
    await key(dock()!, "ArrowRight");
    expect(useApp.getState().profile.bitHidden).toBe(true);
    expect(document.activeElement).toBe(tab());
    await key(tab()!, "ArrowLeft");
    expect(useApp.getState().profile.bitHidden).toBe(false);
    expect(document.activeElement).toBe(dock());
  });

  it("Enter на язычке (на нём фокус) — кнопка вернулась, фокус на ней", async () => {
    useApp.getState().updateProfile({ bitHidden: true });
    await render(createElement(BitDock));
    tab()!.focus();
    await act(async () => tab()!.click());
    expect(useApp.getState().profile.bitHidden).toBe(false);
    expect(document.activeElement).toBe(dock());
  });

  it("касание язычка без фокуса на нём — кнопка вернулась, фокус не трогаем", async () => {
    useApp.getState().updateProfile({ bitHidden: true });
    await render(createElement(BitDock));
    const before = document.activeElement;
    await act(async () => tab()!.click());
    expect(useApp.getState().profile.bitHidden).toBe(false);
    expect(document.activeElement).toBe(before);
  });
});

describe("чат-панель Бита: закрытая — не окно", () => {
  const panel = (open: boolean) => createElement(BitChatPanel, { open, chatId: "c1", onClose: () => {}, onNewChat: () => {} });
  const section = () => document.querySelector("[data-bit-panel]")!;

  it("закрыта: без role=dialog и aria-modal, внутри inert — проводник её не ждёт; открыта на телефоне — модальное окно", async () => {
    // Телефон: шторка (на компьютере панель сбоку не модальная).
    const happy = (window as unknown as { happyDOM: { setViewport: (v: { width: number; height: number }) => void } }).happyDOM;
    happy.setViewport({ width: 400, height: 800 });
    await render(panel(false));
    expect(section().getAttribute("role")).toBeNull();
    expect(section().getAttribute("aria-modal")).toBeNull();
    expect(section().closest("[inert]")).not.toBeNull();
    expect(foreignModal()).toBe(false);
    await render(panel(true));
    expect(section().getAttribute("role")).toBe("dialog");
    expect(section().getAttribute("aria-modal")).toBe("true");
    expect(foreignModal()).toBe(true);
    await render(panel(false));
    expect(section().getAttribute("role")).toBeNull();
    expect(foreignModal()).toBe(false);
    happy.setViewport({ width: 1024, height: 768 });
  });

  it("компьютер: открытая панель — диалог, но не модальный (страница рядом работает)", async () => {
    await render(panel(true));
    expect(section().getAttribute("role")).toBe("dialog");
    expect(section().getAttribute("aria-modal")).toBeNull();
  });
});

describe("useTutor: ушли с экрана посреди ответа", () => {
  let ask: ReturnType<typeof useTutor>["ask"];
  function Probe() {
    ask = useTutor().ask;
    return null;
  }
  /** Ответ, который «печатается» и обрывается только отменой; partial — что уже показано. */
  const hanging = (partial: string) => (_req: unknown, onText: (t: string) => void, signal: AbortSignal) =>
    new Promise<string>((_, reject) => {
      if (partial) onText(partial);
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });
  const used = () => useApp.getState().aiUsage?.count ?? 0;

  it("ответа ещё не видно — обращение возвращается", async () => {
    h.stream = hanging("");
    await render(createElement(Probe));
    let result!: Promise<string | null>;
    await act(async () => {
      result = ask({ mode: "chat", messages: [{ role: "user", content: "Что такое бит?" }] }, () => {});
    });
    expect(used()).toBeGreaterThan(0);
    await act(async () => root.unmount());
    root = createRoot(host);
    expect(await result).toBeNull();
    expect(used()).toBe(0);
  });

  it("часть ответа уже показана — она возвращается как ответ (чат её сохранит), обращение не возвращается", async () => {
    h.stream = hanging("Бит — это наименьшая единица");
    await render(createElement(Probe));
    let result!: Promise<string | null>;
    await act(async () => {
      result = ask({ mode: "chat", messages: [{ role: "user", content: "Что такое бит?" }] }, () => {});
    });
    await act(async () => root.unmount());
    root = createRoot(host);
    expect(await result).toBe("Бит — это наименьшая единица");
    expect(used()).toBeGreaterThan(0);
  });

  it("«Стоп» ученика (экран на месте) — как раньше: null, обращение не возвращается", async () => {
    h.stream = hanging("");
    let stop!: () => void;
    function StopProbe() {
      const t = useTutor();
      ask = t.ask;
      stop = t.stop;
      return null;
    }
    await render(createElement(StopProbe));
    let result!: Promise<string | null>;
    await act(async () => {
      result = ask({ mode: "chat", messages: [{ role: "user", content: "Что такое бит?" }] }, () => {});
    });
    await act(async () => stop());
    expect(await result).toBeNull();
    expect(used()).toBeGreaterThan(0);
  });
});
