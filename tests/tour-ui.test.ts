// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOUR_DELAY_MS, TourAgent } from "@/components/tour/TourAgent";
import { PageTip } from "@/components/tour/PageTip";
import { AfterFirstLesson } from "@/components/tour/AfterFirstLesson";
import { TIP_IDS } from "@/lib/tips";
import { useApp } from "@/lib/store";

// Проводник первого входа (этап 16Б, P6): приветствие, обзор панели, «Пропустить», карточки страниц, итоги первого урока.

const h = vi.hoisted(() => ({ pathname: "/learn", push: undefined as unknown as (url: string) => void }));

vi.mock("next/navigation", () => ({ usePathname: () => h.pathname, useRouter: () => ({ push: (u: string) => h.push(u), replace: () => {}, back: () => {} }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown } & Record<string, unknown>) => createElement("a", { href, ...rest }, children as never),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
let target: HTMLElement;

const render = (el: Parameters<Root["render"]>[0]) =>
  act(async () => {
    root.render(el);
  });
const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const dialog = () => document.querySelector('[role="dialog"]');
const button = (name: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(name)) as HTMLButtonElement | undefined;
const click = (name: string) =>
  act(async () => {
    button(name)!.click();
  });
const tips = () => useApp.getState().tips;
const doneLesson = () => useApp.setState({ lessons: { l1: { completions: 1 } } as never });

/** Элемент с data-tour: у happy-dom нет вёрстки, поэтому размеры задаём сами. */
function addTarget(name: string, attrs: Record<string, string> = {}) {
  const el = document.createElement("a");
  el.dataset.tour = name;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.getBoundingClientRect = () => ({ left: 20, top: 100, width: 200, height: 48, right: 220, bottom: 148, x: 20, y: 100, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "requestAnimationFrame", "cancelAnimationFrame"] });
  h.pathname = "/learn";
  h.push = vi.fn() as unknown as (url: string) => void;
  useApp.getState().resetProgress();
  useApp.setState((s) => ({ onboarded: true, tips: {}, profile: { ...s.profile, lang: "ru", name: "Аня" } }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  target = addTarget("continue", { href: "/lesson/ns-1" });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.querySelectorAll("[data-tour]").forEach((e) => e.remove());
  useApp.getState().resetProgress();
  vi.useRealTimers();
});

describe("TourAgent: приветствие", () => {
  it("новый ученик на «Учиться»: через паузу — приветствие с именем и кнопкой «Начать урок»", async () => {
    await render(createElement(TourAgent));
    expect(dialog()).toBeNull();
    await wait(TOUR_DELAY_MS + 100);
    expect(dialog()?.textContent).toContain("Привет, Аня!");
    expect(button("Начать урок")).toBeTruthy();
    expect(button("Пропустить")).toBeTruthy();
  });

  it("«Начать урок» отмечает приветствие и ведёт туда, куда ведёт подсвеченная кнопка", async () => {
    await render(createElement(TourAgent));
    await wait(TOUR_DELAY_MS + 100);
    await click("Начать урок");
    expect(h.push).toHaveBeenCalledWith("/lesson/ns-1");
    expect(tips().welcome).toBeGreaterThan(0);
    expect(dialog()).toBeNull();
  });

  it("нет кнопки урока (школьный трек без урока) — пузырь без выреза, кнопка «Понятно»", async () => {
    target.remove();
    await render(createElement(TourAgent));
    await wait(TOUR_DELAY_MS + 100);
    expect(button("Начать урок")).toBeUndefined();
    await click("Понятно");
    expect(tips().welcome).toBeGreaterThan(0);
    expect(h.push).not.toHaveBeenCalled();
  });

  it("«Пропустить» отмечает все подсказки", async () => {
    await render(createElement(TourAgent));
    await wait(TOUR_DELAY_MS + 100);
    await click("Пропустить");
    for (const id of TIP_IDS) expect(tips()[id], id).toBeGreaterThan(0);
    expect(dialog()).toBeNull();
  });

  it("Escape закрывает весь проводник", async () => {
    await render(createElement(TourAgent));
    await wait(TOUR_DELAY_MS + 100);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(tips().nav).toBeGreaterThan(0);
    expect(dialog()).toBeNull();
  });

  it("не на «Учиться» и до онбординга — ничего", async () => {
    h.pathname = "/practice";
    await render(createElement(TourAgent));
    await wait(TOUR_DELAY_MS + 100);
    expect(dialog()).toBeNull();
    h.pathname = "/learn";
    useApp.setState({ onboarded: false });
    await render(createElement(TourAgent, { key: "again" }));
    await wait(TOUR_DELAY_MS + 100);
    expect(dialog()).toBeNull();
  });

  it("приветствие уже закрыто, урока нет — молчит", async () => {
    useApp.setState({ tips: { welcome: 1 } });
    await render(createElement(TourAgent));
    await wait(TOUR_DELAY_MS + 100);
    expect(dialog()).toBeNull();
  });
});

describe("TourAgent: обзор панели после первого урока", () => {
  it("три шага; «Готово» отмечает обзор", async () => {
    doneLesson();
    await render(createElement(TourAgent));
    await wait(TOUR_DELAY_MS + 100);
    expect(dialog()?.textContent).toContain("серия дней");
    expect(dialog()?.textContent).toContain("1 из 3");
    await click("Дальше");
    expect(dialog()?.textContent).toContain("ИИ-чат");
    expect(dialog()?.textContent).toContain("2 из 3");
    await click("Дальше");
    expect(dialog()?.textContent).toContain("3 из 3");
    expect(button("Пропустить")).toBeUndefined();
    expect(tips().nav).toBeUndefined();
    await click("Готово");
    expect(tips().nav).toBeGreaterThan(0);
    expect(dialog()).toBeNull();
  });
});

describe("PageTip", () => {
  it("пока идёт проводник — не показывается", async () => {
    await render(createElement(PageTip, { id: "page-practice" }));
    expect(host.querySelector('[role="note"]')).toBeNull();
  });

  it("после обзора — показывается; крестик закрывает насовсем", async () => {
    useApp.setState({ tips: { nav: 1 } });
    await render(createElement(PageTip, { id: "page-practice" }));
    expect(host.querySelector('[role="note"]')).not.toBeNull();
    await act(async () => (host.querySelector('button[aria-label="Закрыть подсказку"]') as HTMLButtonElement).click());
    expect(host.querySelector('[role="note"]')).toBeNull();
    expect(tips()["page-practice"]).toBeGreaterThan(0);
  });

  it("уход со страницы тоже считается показом", async () => {
    useApp.setState({ tips: { nav: 1 } });
    await render(createElement(PageTip, { id: "page-tutor" }));
    expect(tips()["page-tutor"]).toBeUndefined();
    await act(async () => root.render(createElement("div")));
    await wait(10);
    expect(tips()["page-tutor"]).toBeGreaterThan(0);
  });

  it("уже показанная — не возвращается", async () => {
    useApp.setState({ tips: { nav: 1, "page-materials": 1 } });
    await render(createElement(PageTip, { id: "page-materials" }));
    expect(host.querySelector('[role="note"]')).toBeNull();
  });
});

describe("AfterFirstLesson", () => {
  it("на первом пройденном уроке — четыре строки и кнопка; «Понятно, дальше» убирает карточку", async () => {
    doneLesson();
    await render(createElement(AfterFirstLesson));
    expect(host.querySelectorAll("li")).toHaveLength(4);
    await act(async () => (button("Понятно, дальше") as HTMLButtonElement).click());
    expect(tips()["after-first"]).toBeGreaterThan(0);
    expect(host.querySelector("section")).toBeNull();
  });

  it("не показывается, когда пройдено больше одного урока", async () => {
    useApp.setState({ lessons: { l1: { completions: 1 }, l2: { completions: 1 } } as never });
    await render(createElement(AfterFirstLesson));
    expect(host.querySelector("section")).toBeNull();
  });
});
