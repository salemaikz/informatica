// @vitest-environment happy-dom
import { Fragment, act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BitDock } from "@/components/guide/BitDock";
import { useGuideSpots } from "@/components/guide/GuideSpot";
import { useGuideUi } from "@/components/guide/guide-state";
import { PaywallAgent } from "@/components/plans/PaywallAgent";
import { PUSH_ASK_DELAY_MS, PushAskAgent } from "@/components/reminders/PushAskAgent";
import { CaseAgent } from "@/components/rewards/CaseAgent";
import { TIP_IDS } from "@/lib/tips";
import { useApp } from "@/lib/store";

// Гонка окон: ученик нажал на Бита, панель чата ещё грузится отдельным куском (окном пока не считается), а таймер окна
// «Включить напоминания» (или тарифов, кейса за уровень) срабатывает и кладёт своё окно поверх. Флаг `chatOpen` в `useGuideUi`
// ставится сразу при нажатии на Бита; агенты по нему не открываются, а сам Бит не открывает панель поверх чужого окна.

const h = vi.hoisted(() => ({ pathname: "/learn", push: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => h.pathname, useRouter: () => ({ push: h.push, replace: () => {}, back: () => {} }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown } & Record<string, unknown>) => createElement("a", { href, ...rest }, children as never),
}));
// Панель с чатом грузится лениво — здесь заглушка (как в tests/guide-dock.test.ts): «ещё не загрузилась», окна в DOM нет.
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/components/chat/ChatScreen", () => ({ ChatScreen: () => null }));
vi.mock("@/lib/sound", () => ({ playSound: () => {} }));
vi.mock("@/components/goals/push", () => ({ pushPermission: () => "default", enablePush: async () => "ok" }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ALL = Object.fromEntries(TIP_IDS.map((id) => [id, 1]));
const T0 = Date.UTC(2026, 9, 5, 12);

let host: HTMLElement;
let root: Root;
const extra: HTMLElement[] = [];

const render = (...els: ReturnType<typeof createElement>[]) =>
  act(async () => {
    root.render(createElement(Fragment, null, ...els));
  });
const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const dock = () => document.querySelector<HTMLButtonElement>('[data-tour="bit-dock"]');
const dialogs = () => [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')];
const chatOpen = () => useGuideUi.getState().chatOpen;
const tapBit = () =>
  act(async () => {
    dock()!.click();
  });
/** Окно поверх страницы (как у `Modal` и кейса). */
function modal(): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  document.body.appendChild(el);
  extra.push(el);
  return el;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(T0);
  h.pathname = "/learn";
  h.push.mockClear();
  useApp.getState().resetProgress();
  useApp.setState((s) => ({ onboarded: true, tips: ALL, profile: { ...s.profile, lang: "ru", sound: false, reduceMotion: true, bitHidden: false, createdAt: T0 - 1000 } }));
  useGuideSpots.setState({ lesson: null, results: false });
  useGuideUi.setState({ active: false, dockStep: false, chatOpen: false });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  extra.splice(0).forEach((e) => e.remove());
  useGuideUi.setState({ chatOpen: false });
  useApp.getState().resetProgress();
  vi.useRealTimers();
});

describe("флаг «чат Бита открыт»", () => {
  it("нажали на Бита — флаг поднят сразу, ещё до загрузки панели; ушли со страницы — флаг погас", async () => {
    await render(createElement(BitDock));
    expect(chatOpen()).toBe(false);
    await tapBit();
    expect(chatOpen()).toBe(true);
    // Панель — заглушка, окна в DOM нет: именно в этом промежутке агенты раньше считали экран свободным.
    expect(dialogs()).toHaveLength(0);
    h.pathname = "/stats";
    await render(createElement(BitDock));
    expect(chatOpen()).toBe(false);
  });

  it("поверх чужого окна панель не открывается: нажатие, пришедшее раньше, чем кнопка спряталась, ничего не делает", async () => {
    await render(createElement(BitDock));
    await act(async () => {
      // Окно появилось и в тот же тик ученик успел нажать (наблюдатель за DOM ещё не спрятал кнопку).
      modal();
      dock()!.click();
    });
    expect(chatOpen()).toBe(false);
  });
});

describe("окно «Включить напоминания» и чат Бита", () => {
  it("ученик нажал на Бита, пока ждёт пауза окна, — окно не открывается и показ не засчитывается", async () => {
    await render(createElement(BitDock), createElement(PushAskAgent));
    await wait(PUSH_ASK_DELAY_MS - 300);
    await tapBit();
    await wait(1000);
    expect(dialogs()).toHaveLength(0);
    expect(useApp.getState().pushAsk.count).toBe(0);
  });

  it("чат открыт до паузы окна (панель ещё грузится): окна тоже нет", async () => {
    await render(createElement(BitDock), createElement(PushAskAgent));
    await tapBit();
    await wait(PUSH_ASK_DELAY_MS + 500);
    expect(dialogs()).toHaveLength(0);
    expect(useApp.getState().pushAsk.count).toBe(0);
  });

  it("контроль: без чата то же окно открывается (тест ловит именно флаг)", async () => {
    await render(createElement(BitDock), createElement(PushAskAgent));
    await wait(PUSH_ASK_DELAY_MS + 200);
    expect(dialogs()).toHaveLength(1);
    expect(useApp.getState().pushAsk.count).toBe(1);
  });

  it("чат закрыт (флаг погас) — в следующий заход окно открывается как обычно", async () => {
    await render(createElement(BitDock), createElement(PushAskAgent));
    await tapBit();
    await wait(PUSH_ASK_DELAY_MS + 200);
    expect(dialogs()).toHaveLength(0);
    await act(async () => root.unmount());
    root = createRoot(host);
    useGuideUi.setState({ chatOpen: false });
    await render(createElement(PushAskAgent));
    await wait(PUSH_ASK_DELAY_MS + 200);
    expect(dialogs()).toHaveLength(1);
  });
});

describe("окно тарифов и кейс за уровень при открытом чате", () => {
  it("тарифы не открываются, пока чат открыт; без чата — открываются (контроль)", async () => {
    useGuideUi.setState({ chatOpen: true });
    await render(createElement(PaywallAgent));
    await wait(100);
    expect(h.push).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    root = createRoot(host);
    useGuideUi.setState({ chatOpen: false });
    await render(createElement(PaywallAgent));
    await wait(100);
    expect(h.push).toHaveBeenCalledWith("/plans?from=auto");
  });

  it("кейс за уровень ждёт, пока чат открыт, и выходит, когда панель закрыли", async () => {
    useApp.setState({ pendingCases: [2] });
    useGuideUi.setState({ chatOpen: true });
    await render(createElement(CaseAgent));
    expect(dialogs()).toHaveLength(0);
    await act(async () => useGuideUi.setState({ chatOpen: false }));
    expect(dialogs()).toHaveLength(1);
  });
});
