// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutOfHearts } from "@/components/economy/OutOfHearts";
import { NoChipsNotice } from "@/components/economy/NoChipsNotice";
import { ChipItemRow } from "@/components/economy/ShopParts";
import { TryOnSheet } from "@/components/cosmetics/TryOnSheet";
import { COSMETICS } from "@/lib/cosmetics";
import { FREE_PLAN, shopItem } from "@/lib/economy";
import { setAnalyticsSink, type AnalyticsEvent } from "@/lib/analytics";
import { useApp } from "@/lib/store";

// Этап 16Г, пакет C: единое окно «Не хватает» во всех местах, где упираются в сердечки или чипы.

vi.mock("next/navigation", () => ({ usePathname: () => "/shop", useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown } & Record<string, unknown>) => createElement("a", { href, ...rest }, children as never),
}));
vi.mock("canvas-confetti", () => ({ default: () => {} }));
vi.mock("@/lib/feedback", () => ({ feedback: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
let events: AnalyticsEvent[];

const render = (el: Parameters<Root["render"]>[0]) =>
  act(async () => {
    root.render(el);
  });
const text = () => document.body.textContent ?? "";
const buttons = () => [...document.body.querySelectorAll("button")];
const byText = (s: string) => buttons().find((b) => b.textContent?.includes(s));
const links = () => [...document.body.querySelectorAll("a")].map((a) => a.getAttribute("href"));
const click = (el: Element | undefined) =>
  act(async () => {
    (el as HTMLElement).click();
  });
const dialogs = () => [...document.body.querySelectorAll('[role="dialog"]')].map((d) => d.getAttribute("aria-label"));

beforeEach(() => {
  useApp.getState().resetProgress();
  useApp.setState((s) => ({ plan: FREE_PLAN, hearts: { count: 0, updatedAt: Date.now(), day: "" }, profile: { ...s.profile, lang: "ru", sound: false, vibration: false, reduceMotion: true } }));
  events = [];
  setAnalyticsSink((ev) => events.push(ev));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  setAnalyticsSink(null);
  useApp.getState().resetProgress();
});

describe("«Сердечки закончились» (0 сердечек, 20 чипов)", () => {
  it("шторка: подпись окна прежняя; чипы, ₸-пополнение, «Безлимит» со ссылкой и пробным, заработок; пропусков на время нет", async () => {
    await render(createElement(OutOfHearts, { need: 1, onResume: () => {}, onExit: () => {} }));
    expect(dialogs()).toContain("Сердечки закончились");
    expect(text()).toContain("+1 сердечко");
    expect(text()).toContain("Купить чипы");
    expect(text()).toContain("100 чипов");
    expect(text()).toMatch(/249\s₸/);
    expect(text()).toContain("Пополнить все сердечки");
    expect(text()).toMatch(/490\s₸/);
    expect(text()).toContain("7 дней бесплатно");
    expect(text()).toContain("Заработать бесплатно");
    expect(text()).not.toMatch(/на 24|на 7 дней|149 ₸|590 ₸/);
    expect(links()).toContain("/plans?from=hearts");
    expect(links()).toContain("/shop#shop-chips");
    expect(links()).toContain("/shop#shop-earn");
  });

  it("набор чипов открывает «Оплата скоро» поверх, не закрывая шторку", async () => {
    await render(createElement(OutOfHearts, { need: 1, onResume: () => {}, onExit: () => {} }));
    await click(byText("100 чипов"));
    expect(dialogs()).toEqual(["Сердечки закончились", "Оплата скоро появится"]);
    expect(events).toContainEqual({ e: "shop_click", item: "chips-100" });
    expect(events).toContainEqual({ e: "short_pick", need: "hearts", pick: "pack" });
    expect(events).toContainEqual({ e: "chips_out", where: "hearts" });
  });

  it("пополнение за ₸ — тоже «Оплата скоро»", async () => {
    await render(createElement(OutOfHearts, { need: 1, onResume: () => {}, onExit: () => {} }));
    await click(byText("Пополнить все сердечки"));
    expect(dialogs()).toContain("Оплата скоро появится");
    expect(events).toContainEqual({ e: "shop_click", item: "hearts-refill" });
  });

  it("пробный «Безлимит»: тариф включается, вход продолжается один раз", async () => {
    const onResume = vi.fn();
    await render(createElement(OutOfHearts, { need: 1, onResume, onExit: () => {} }));
    await click(byText("7 дней бесплатно"));
    expect(useApp.getState().plan?.trial).toBe(true);
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(events).toContainEqual({ e: "trial_start", from: "hearts" });
  });

  it("хватает чипов на сердечко — покупка продолжает вход, набора чипов нет", async () => {
    useApp.setState((s) => ({ wallet: { ...s.wallet, chips: 100 } }));
    const onResume = vi.fn();
    await render(createElement(OutOfHearts, { need: 1, onResume, onExit: () => {} }));
    expect(text()).not.toContain("Купить чипы");
    await click(byText("+1 сердечко"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("«Выйти» вызывает onExit", async () => {
    const onExit = vi.fn();
    await render(createElement(OutOfHearts, { need: 1, onResume: () => {}, onExit }));
    await click(byText("Выйти"));
    expect(onExit).toHaveBeenCalled();
  });

  it("при «Безлимите» предложений нет: окно сразу даёт продолжить", async () => {
    useApp.getState().startTrial();
    await render(createElement(OutOfHearts, { layout: "screen", need: 1, onResume: () => {}, onExit: () => {} }));
    expect(text()).toContain("Продолжить");
    expect(text()).not.toContain("Пополнить все сердечки");
  });
});

const setChips = (n: number) => useApp.setState((st) => ({ wallet: { ...st.wallet, chips: n } }));

describe("«Не хватает чипов» в ИИ (NoChipsNotice)", () => {
  it("встроенная карточка: нужно/есть, набор чипов, «Безлимит» (/plans?from=ai) и пробный; в магазин не уводит", async () => {
    setChips(2);
    await render(createElement(NoChipsNotice, { kind: "chat" }));
    expect(document.body.querySelector('[role="alert"]')).not.toBeNull();
    expect(text()).toContain("Нужно 7 чипов, у тебя 2");
    expect(text()).toContain("100 чипов");
    expect(text()).toMatch(/249\s₸/);
    expect(text()).toContain("7 дней бесплатно");
    expect(links()).toContain("/plans?from=ai");
    expect(links()).not.toContain("/shop");
    expect(events).toContainEqual({ e: "chips_out", where: "ai" });
  });

  it("₸ открывает «Оплата скоро» на месте (карточка остаётся)", async () => {
    setChips(2);
    await render(createElement(NoChipsNotice, { kind: "chat" }));
    await click(byText("100 чипов"));
    expect(dialogs()).toEqual(["Оплата скоро появится"]);
    expect(document.body.querySelector('[role="alert"]')).not.toBeNull();
    expect(events).toContainEqual({ e: "short_pick", need: "chips", pick: "pack" });
  });

  it("пробный период снимает нехватку и сообщает onEnough", async () => {
    setChips(2);
    await render(createElement(NoChipsNotice, { kind: "hint" }));
    await click(byText("7 дней бесплатно"));
    expect(useApp.getState().plan?.trial).toBe(true);
    expect(events).toContainEqual({ e: "trial_start", from: "ai" });
  });
});

describe("магазин: строка без чипов", () => {
  it("«Купить» за недостающее открывает окно «Не хватает чипов» (Безлимит про чипы вдвое больше)", async () => {
    setChips(20);
    await render(createElement(ChipItemRow, { item: shopItem("hearts-3")!, tone: "heart", icon: null, nameKey: "shop.item.hearts-3", descKey: "shop.item.hearts-3.desc" }));
    useApp.setState({ hearts: { count: 1, updatedAt: Date.now(), day: "" } });
    await click(buttons().find((b) => b.getAttribute("aria-label")?.startsWith("Купить")));
    expect(dialogs()).toContain("Не хватает чипов");
    expect(text()).toContain("Нужно 150 чипов, у тебя 20");
    expect(text()).toContain("Чипов вдвое больше за каждое дело");
    expect(links()).toContain("/plans?from=chips");
    expect(events).toContainEqual({ e: "chips_out", where: "shop" });
  });
});

describe("примерка украшения без чипов", () => {
  it("кнопка «Купить» активна; нажатие открывает окно поверх примерки; покупки не происходит", async () => {
    setChips(10);
    const def = COSMETICS.find((c) => c.price !== null)!;
    await render(createElement(TryOnSheet, { open: true, id: def.id, onClose: () => {} }));
    const buy = buttons().find((b) => b.textContent?.includes(`Купить за`));
    expect(buy?.hasAttribute("disabled")).toBe(false);
    await click(buy);
    expect(dialogs()).toEqual(["Примерка", "Не хватает чипов"]);
    expect(events).toContainEqual({ e: "chips_out", where: "cosmetic" });
    expect(useApp.getState().wallet.chips).toBe(10);
  });
});
