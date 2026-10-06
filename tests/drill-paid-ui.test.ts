// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrillScreen } from "@/app/drill/DrillScreen";
import { drillPaidKey } from "@/lib/drill-paid";
import { FREE_PLAN } from "@/lib/economy";
import { useApp } from "@/lib/store";

// Этап 16В, E7: перезагрузка тренировки в течение 20 минут после оплаты не требует сердечка на входе (экран «Сердечки закончились»
// не показывается), а чужая тренировка при нуле сердечек по-прежнему закрыта.

vi.mock("next/navigation", () => ({ usePathname: () => "/drill", useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown } & Record<string, unknown>) => createElement("a", { href, ...rest }, children as never),
}));
vi.mock("canvas-confetti", () => ({ default: () => {} }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
const render = (el: Parameters<Root["render"]>[0]) =>
  act(async () => {
    root.render(el);
  });
const text = () => host.textContent ?? "";

const SKILL = "ns.bin2dec";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
  useApp.getState().resetProgress();
  useApp.setState((s) => ({
    plan: FREE_PLAN,
    profile: { ...s.profile, lang: "ru", sound: false, vibration: false },
    hearts: { count: 0, updatedAt: Date.now(), day: "2027-01-15" },
  }));
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

describe("DrillScreen: сердечки на входе", () => {
  it("сердечек нет и тренировка не оплачена — «Сердечки закончились»", async () => {
    await render(createElement(DrillScreen, { mode: "skill", skill: SKILL }));
    expect(text()).toContain("Сердечки закончились");
  });

  it("сердечек нет, но та же тренировка оплачена минуту назад (перезагрузка) — тренировка открывается", async () => {
    useApp.setState({ entryPaid: { [drillPaidKey("skill", { skill: SKILL })]: Date.now() - 60_000 } });
    await render(createElement(DrillScreen, { mode: "skill", skill: SKILL }));
    expect(text()).not.toContain("Сердечки закончились");
  });

  it("оплата другой тренировки не открывает эту; просроченная оплата (больше 20 минут) — тоже", async () => {
    useApp.setState({ entryPaid: { [drillPaidKey("skill", { skill: "ns.dec2bin" })]: Date.now() - 60_000 } });
    await render(createElement(DrillScreen, { mode: "skill", skill: SKILL }));
    expect(text()).toContain("Сердечки закончились");
    useApp.setState({ entryPaid: { [drillPaidKey("skill", { skill: SKILL })]: Date.now() - 21 * 60_000 } });
    await act(async () => root.unmount());
    root = createRoot(host);
    await render(createElement(DrillScreen, { mode: "skill", skill: SKILL }));
    expect(text()).toContain("Сердечки закончились");
  });
});
