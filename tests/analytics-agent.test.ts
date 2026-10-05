// @vitest-environment happy-dom
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAnalyticsSink, type AnalyticsEvent } from "@/lib/analytics";
import { ACTIVE_MARK_KEY } from "@/lib/analytics-client";
import { useApp } from "@/lib/store";
import { AnalyticsAgent } from "@/components/app/AnalyticsAgent";

// C7: событие active (удержание D1/D7/D30) уходит не только при загрузке страницы, но и когда вкладку или PWA снова показали:
// телефон возобновляет приложение из фона, а не перезагружает его.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0).getTime();
const DAY0 = at(2026, 9, 1);

let host: HTMLElement;
let root: Root;
let events: AnalyticsEvent[];
let visibility = "visible";

const mount = async () => {
  await act(async () => {
    root.render(createElement(AnalyticsAgent));
  });
  // Свой приёмник вместо того, что поставил агент: проверяем, что уходит в track().
  setAnalyticsSink((ev) => events.push(ev));
};
const show = async (kind: "visibilitychange" | "pageshow") => {
  await act(async () => {
    if (kind === "visibilitychange") document.dispatchEvent(new Event("visibilitychange"));
    else window.dispatchEvent(new Event("pageshow"));
  });
};
const days = (n: number, h = 9) => vi.setSystemTime(at(2026, 9, 1 + n, h));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(DAY0);
  vi.stubEnv("NEXT_PUBLIC_ANALYTICS", "1");
  vi.spyOn(console, "info").mockImplementation(() => {});
  try {
    window.localStorage.removeItem(ACTIVE_MARK_KEY);
  } catch {
    // нет хранилища
  }
  useApp.getState().resetProgress();
  useApp.setState((s) => ({ profile: { ...s.profile, createdAt: DAY0, analytics: true } }));
  events = [];
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  setAnalyticsSink(null);
  delete (document as { visibilityState?: unknown }).visibilityState;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("AnalyticsAgent: удержание без перезагрузки страницы", () => {
  it("вкладка жила до следующего дня: при возврате на экран уходит active d=1; повтор в тот же день — нет", async () => {
    await mount();
    days(1);
    await show("visibilitychange");
    expect(events).toEqual([{ e: "active", d: 1 }]);
    await show("visibilitychange");
    await show("pageshow");
    expect(events).toHaveLength(1);
  });

  it("pageshow (возврат из кэша переходов) тоже проверяет день; день 7 и день 30 — каждый раз один раз", async () => {
    await mount();
    days(7);
    await show("pageshow");
    days(7, 20);
    await show("pageshow");
    days(30);
    await show("visibilitychange");
    expect(events).toEqual([
      { e: "active", d: 7 },
      { e: "active", d: 30 },
    ]);
  });

  it("вкладка скрыта (visibilityState = hidden) или день не из списка — ничего", async () => {
    await mount();
    days(1);
    visibility = "hidden";
    await show("visibilitychange");
    expect(events).toEqual([]);
    visibility = "visible";
    days(3);
    await show("visibilitychange");
    expect(events).toEqual([]);
  });

  it("выключили статистику в профиле или убрали агента — события при возврате не уходят", async () => {
    await mount();
    await act(async () => useApp.setState((s) => ({ profile: { ...s.profile, analytics: false } })));
    setAnalyticsSink((ev) => events.push(ev));
    days(1);
    await show("visibilitychange");
    expect(events).toEqual([]);

    await act(async () => useApp.setState((s) => ({ profile: { ...s.profile, analytics: true } })));
    setAnalyticsSink((ev) => events.push(ev));
    await act(async () => root.render(null));
    days(7);
    await show("pageshow");
    expect(events).toEqual([]);
  });
});
