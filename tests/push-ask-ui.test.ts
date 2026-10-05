// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUSH_ASK_DELAY_MS, PushAskAgent } from "@/components/reminders/PushAskAgent";
import type { PushPermission } from "@/lib/push-ask";
import { useApp } from "@/lib/store";

// Окно «Включить напоминания» (этап 15, F3): когда показывается, что в нём и что происходит по кнопкам.
// Разрешение и системный запрос подменены: настоящий Notification в тесте не нужен.

const h = vi.hoisted(() => ({
  pathname: "/learn",
  permission: "default" as string,
  enable: undefined as unknown as (() => Promise<string>) & { mockResolvedValue: (v: string) => void; mock: { calls: unknown[] } },
}));

vi.mock("next/navigation", () => ({ usePathname: () => h.pathname, useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown } & Record<string, unknown>) => createElement("a", { href, ...rest }, children as never),
}));
vi.mock("@/components/goals/push", () => ({
  pushPermission: () => h.permission as PushPermission,
  enablePush: () => h.enable(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 5, 12);

let host: HTMLElement;
let root: Root;

const mount = () =>
  act(async () => {
    root.render(createElement(PushAskAgent));
  });
/** Прокрутить время (таймер показа окна, анимации) — внутри act, чтобы React успел перерисоваться. */
const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const dialog = () => host.ownerDocument.querySelector('[role="dialog"]');
const text = () => dialog()?.textContent ?? "";
const button = (name: string) => [...(dialog()?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.includes(name)) as HTMLButtonElement | undefined;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(T0);
  h.pathname = "/learn";
  h.permission = "default";
  h.enable = vi.fn() as unknown as typeof h.enable;
  h.enable.mockResolvedValue("ok");
  useApp.getState().resetProgress();
  // Проводник первого входа (#104) пройден: до этого окно напоминаний ждёт (отдельный тест ниже).
  useApp.setState((s) => ({ onboarded: true, tips: { nav: T0 }, profile: { ...s.profile, lang: "ru", createdAt: T0 - 1000 } }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useApp.getState().resetProgress();
  vi.useRealTimers();
});

describe("PushAskAgent: когда показывается", () => {
  it("на главном экране первый раз — через короткую паузу, с текстом и двумя кнопками; показ засчитывается", async () => {
    await mount();
    await wait(PUSH_ASK_DELAY_MS - 100);
    expect(dialog()).toBeNull();
    await wait(200);
    expect(text()).toContain("Включить напоминания");
    expect(text()).toContain("Напомним позаниматься и не потерять серию");
    expect(button("Включить")).toBeTruthy();
    expect(button("Не сейчас")).toBeTruthy();
    const { lastAt, count } = useApp.getState().pushAsk;
    expect(count).toBe(1);
    expect(lastAt).toBeGreaterThanOrEqual(T0 + PUSH_ASK_DELAY_MS); // записано время показа
  });

  it("не показывается в уроке, тесте и игре", async () => {
    for (const p of ["/lesson/ns-1-bits", "/exam/run", "/game/sort", "/drill", "/onboarding"]) {
      h.pathname = p;
      await mount();
      await wait(PUSH_ASK_DELAY_MS + 500);
      expect(dialog(), p).toBeNull();
    }
    expect(useApp.getState().pushAsk.count).toBe(0);
  });

  it("ушли с главного экрана до паузы — окно не открывается", async () => {
    await mount();
    await wait(500);
    h.pathname = "/lesson/ns-1-bits";
    await mount();
    await wait(PUSH_ASK_DELAY_MS);
    expect(dialog()).toBeNull();
    expect(useApp.getState().pushAsk.count).toBe(0);
  });

  it("до онбординга не показывается", async () => {
    useApp.setState({ onboarded: false });
    await mount();
    await wait(PUSH_ASK_DELAY_MS + 500);
    expect(dialog()).toBeNull();
  });

  it("пока идёт проводник первого входа — ждёт; после обзора панели появляется (#104)", async () => {
    useApp.setState({ tips: {} });
    await mount();
    await wait(PUSH_ASK_DELAY_MS + 500);
    expect(dialog()).toBeNull();
    expect(useApp.getState().pushAsk.count).toBe(0);
    await act(async () => useApp.getState().noteTip("nav"));
    await wait(PUSH_ASK_DELAY_MS + 500);
    expect(dialog()).not.toBeNull();
    expect(useApp.getState().pushAsk.count).toBe(1);
  });

  it("разрешено в браузере, включено в профиле или браузер не умеет — не показывается", async () => {
    for (const permission of ["granted", "unsupported"]) {
      h.permission = permission;
      await mount();
      await wait(PUSH_ASK_DELAY_MS + 500);
      expect(dialog(), permission).toBeNull();
    }
    expect(useApp.getState().pushAsk.count).toBe(0);
  });

  it("ученик выключил напоминания в профиле — не уговариваем", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, reminder: { ...s.profile.reminder, enabled: false } } }));
    await mount();
    await wait(PUSH_ASK_DELAY_MS + 500);
    expect(dialog()).toBeNull();
  });

  it("недавно показывали (меньше 3 дней назад) — не показывается; через 3 дня — снова", async () => {
    useApp.setState({ pushAsk: { lastAt: T0 - 2 * DAY, count: 1 } });
    await mount();
    await wait(PUSH_ASK_DELAY_MS + 500);
    expect(dialog()).toBeNull();
    await act(async () => root.unmount());
    root = createRoot(host);
    useApp.setState({ pushAsk: { lastAt: T0 - 3 * DAY, count: 1 } });
    await mount();
    await wait(PUSH_ASK_DELAY_MS + 500);
    expect(text()).toContain("Включить напоминания");
    expect(useApp.getState().pushAsk.count).toBe(2);
    expect(useApp.getState().pushAsk.lastAt).toBeGreaterThan(T0 - DAY);
  });
});

describe("PushAskAgent: что в окне и что делают кнопки", () => {
  it("«Включить» → разрешение получено: уведомления включены в профиле, окно закрыто", async () => {
    await mount();
    await wait(PUSH_ASK_DELAY_MS + 100);
    await act(async () => {
      button("Включить")!.click();
    });
    await wait(600);
    expect(h.enable.mock.calls.length).toBe(1);
    const r = useApp.getState().profile.reminder;
    expect(r.push).toBe(true);
    expect(r.enabled).toBe(true);
    expect(dialog()).toBeNull();
  });

  it("«Включить» → системный запрос закрыли, не выбрав: окно закрывается без инструкции, в профиле не включено", async () => {
    h.enable.mockResolvedValue("denied");
    await mount();
    await wait(PUSH_ASK_DELAY_MS + 100);
    await act(async () => {
      button("Включить")!.click();
    });
    await wait(600);
    expect(useApp.getState().profile.reminder.push).toBe(false);
    expect(dialog()).toBeNull();
  });

  it("«Включить» → браузер запретил: то же окно показывает инструкцию вместо кнопки запроса", async () => {
    h.enable.mockResolvedValue("denied");
    await mount();
    await wait(PUSH_ASK_DELAY_MS + 100);
    h.permission = "denied"; // после ответа на системный запрос браузер помнит запрет
    await act(async () => {
      button("Включить")!.click();
    });
    await wait(100);
    expect(text()).toContain("Уведомления выключены в браузере");
    expect(button("Включить")).toBeUndefined();
    expect(button("Понятно")).toBeTruthy();
    expect(useApp.getState().profile.reminder.push).toBe(false);
  });

  it("«Не сейчас» закрывает окно, ничего не включая", async () => {
    await mount();
    await wait(PUSH_ASK_DELAY_MS + 100);
    await act(async () => {
      button("Не сейчас")!.click();
    });
    await wait(600);
    expect(dialog()).toBeNull();
    expect(h.enable.mock.calls.length).toBe(0);
    expect(useApp.getState().profile.reminder.push).toBe(false);
  });

  it("не получилось включить — сообщение об ошибке, окно остаётся для повтора", async () => {
    h.enable.mockResolvedValue("failed");
    await mount();
    await wait(PUSH_ASK_DELAY_MS + 100);
    await act(async () => {
      button("Включить")!.click();
    });
    await wait(100);
    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toContain("Не получилось включить уведомления");
    expect(button("Включить")).toBeTruthy();
  });

  it("браузер запретил уведомления заранее: инструкция «разреши в настройках», без кнопки запроса", async () => {
    h.permission = "denied";
    await mount();
    await wait(PUSH_ASK_DELAY_MS + 100);
    expect(text()).toContain("Уведомления выключены в браузере");
    expect(text()).toContain("Разреши уведомления для этого сайта в настройках браузера");
    expect(button("Включить")).toBeUndefined();
    expect(h.enable.mock.calls.length).toBe(0);
  });

  it("iPhone без экрана «Домой»: подсказка с шагами установки, без запроса", async () => {
    h.permission = "needs-install";
    await mount();
    await wait(PUSH_ASK_DELAY_MS + 100);
    expect(text()).toContain("Напоминания на iPhone");
    expect(text()).toContain("На экран Домой");
    expect(button("Включить")).toBeUndefined();
    expect(useApp.getState().pushAsk.count).toBe(1);
  });

  it("на казахском окно говорит по-казахски", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, lang: "kk" } }));
    await mount();
    await wait(PUSH_ASK_DELAY_MS + 100);
    expect(text()).toContain("Еске салғыштарды қосу");
    expect(button("Қосу")).toBeTruthy();
    expect(button("Қазір емес")).toBeTruthy();
  });
});
