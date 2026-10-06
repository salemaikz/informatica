// @vitest-environment happy-dom
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLesson } from "@/content/course";
import { TheoryReader } from "@/components/theory/TheoryReader";
import { TheoryCost } from "@/components/theory/TheoryCost";
import { useTheoryAccess } from "@/components/theory/useTheoryAccess";
import { DAY, FREE_PLAN, HOUR, heartsView } from "@/lib/economy";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";

// Теория 2.0, плата (решение #113, ТЗ §10.1): ½ сердечка списывается при открытии темы; повтор за сутки и «Безлимит» — бесплатно;
// нет сердечек — «Сердечки закончились» и ни одной карточки; на странице чтения нет пояснений про плату, цена — значок в списке.

const h = vi.hoisted(() => ({ pushed: [] as string[] }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/theory/ns-1-bits",
  useRouter: () => ({ push: (href: string) => h.pushed.push(href), replace: () => {}, back: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown } & Record<string, unknown>) => createElement("a", { href, ...rest }, children as never),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const A = "ns-1-bits";
const B = "ns-2-read";
const st = () => useApp.getState();
const hearts = () => heartsView(st().hearts, "free", Date.now(), todayKey()).count;

let host: HTMLElement;
let root: Root;

const render = (el: Parameters<Root["render"]>[0]) =>
  act(async () => {
    root.render(el);
  });
/** Прошёл следующий кадр: колбэк открытия страницы (requestAnimationFrame) списал плату. */
const frame = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(40);
  });
const unmount = () =>
  act(async () => {
    root.unmount();
    root = createRoot(host);
  });
const body = () => document.body.textContent ?? "";

function Probe({ id }: { id: string }) {
  const { access, resume } = useTheoryAccess(id);
  return createElement("div", null, createElement("span", { id: "access" }, access), createElement("button", { id: "resume", onClick: resume }, "resume"));
}
const access = () => host.querySelector("#access")?.textContent;
const click = (sel: string) =>
  act(async () => {
    (host.querySelector(sel) as HTMLElement).click();
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "Date"] });
  vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
  h.pushed.length = 0;
  st().resetProgress();
  useApp.setState((s) => ({ plan: FREE_PLAN, profile: { ...s.profile, lang: "ru", sound: false, vibration: false, reduceMotion: true } }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  st().resetProgress();
  vi.useRealTimers();
});

describe("P1: открыл тему — сразу списано ½ сердечка, один раз", () => {
  it("списание не из тела рендера и эффекта, а из колбэка кадра: до кадра сердечки целы, текста нет", async () => {
    expect(hearts()).toBe(5);
    await render(createElement(Probe, { id: A }));
    expect(access()).toBe("wait");
    expect(hearts()).toBe(5);
    await frame();
    expect(access()).toBe("open");
    expect(hearts()).toBe(4.5);
    expect(st().theoryPaid[A]).toBeLessThanOrEqual(Date.now());
    expect(st().theoryPaid[A]).toBeGreaterThan(Date.now() - 1000);
  });

  it("StrictMode (эффект дважды) и перерисовки — одно списание", async () => {
    await render(createElement(StrictMode, null, createElement(Probe, { id: A })));
    await frame();
    await frame();
    await vi.advanceTimersByTimeAsync(20_000); // часы интерфейса тикают — пересчёт, а не новая оплата
    expect(access()).toBe("open");
    expect(hearts()).toBe(4.5);
  });

  it("лента уроков: A → B → A — A и B по ½, возврат к A в течение суток не списывает и открывается сразу", async () => {
    await render(createElement(Probe, { id: A }));
    await frame();
    await render(createElement(Probe, { id: B }));
    await frame();
    expect(hearts()).toBe(4);
    await unmount();
    await render(createElement(Probe, { id: A }));
    expect(access()).toBe("open"); // без ожидания кадра
    await frame();
    expect(hearts()).toBe(4);
  });

  it("пройденный урок тоже платный", async () => {
    useApp.setState((s) => ({ lessons: { ...s.lessons, [A]: { completions: 1, bestAccuracy: 1, lastAt: Date.now(), totalXp: 20 } } }));
    await render(createElement(Probe, { id: A }));
    await frame();
    expect(hearts()).toBe(4.5);
  });
});

describe("P2: повтор за сутки и «Безлимит» — бесплатно", () => {
  it("оплачено недавно — открыто сразу, ничего не списано", async () => {
    useApp.setState({ theoryPaid: { [A]: Date.now() - 5 * HOUR } });
    await render(createElement(Probe, { id: A }));
    expect(access()).toBe("open");
    await frame();
    expect(hearts()).toBe(5);
  });

  it("оплата старше суток — снова ½", async () => {
    useApp.setState({ theoryPaid: { [A]: Date.now() - DAY - 1000 } });
    await render(createElement(Probe, { id: A }));
    expect(access()).toBe("wait");
    await frame();
    expect(access()).toBe("open");
    expect(hearts()).toBe(4.5);
  });

  it("пробный «Безлимит» — открыто сразу, ничего не списано и не записано", async () => {
    expect(st().startTrial()).toBe(true);
    await render(createElement(Probe, { id: A }));
    expect(access()).toBe("open");
    await frame();
    expect(hearts()).toBe(5);
    expect(st().theoryPaid).toEqual({});
  });
});

describe("P3: нет сердечек", () => {
  it("locked: ничего не списано; после восстановления сердечек resume списывает и открывает", async () => {
    useApp.setState({ hearts: { count: 0, updatedAt: Date.now(), day: todayKey() } });
    await render(createElement(Probe, { id: A }));
    await frame();
    expect(access()).toBe("locked");
    expect(hearts()).toBe(0);
    expect(st().theoryPaid).toEqual({});
    // сердечко куплено (стор обновился) — нажали «Продолжить»
    useApp.setState({ hearts: { count: 1, updatedAt: Date.now(), day: todayKey() } });
    await click("#resume");
    expect(access()).toBe("open");
    expect(hearts()).toBe(0.5);
    expect(st().theoryPaid[A]).toBeGreaterThan(0);
  });

  it("ровно ½ сердечка хватает: остаётся 0", async () => {
    useApp.setState({ hearts: { count: 0.5, updatedAt: Date.now(), day: todayKey() } });
    await render(createElement(Probe, { id: A }));
    await frame();
    expect(access()).toBe("open");
    expect(hearts()).toBe(0);
  });
});

describe("страница чтения (TheoryReader)", () => {
  const lesson = getLesson(A)!;
  const reader = () => createElement(TheoryReader, { lesson, key: A });
  /** Всё, что говорило бы о плате на странице: ворота, статус оплаты, плашки. */
  const PAY_TEXT = /первая карточка|Читать дальше|Оплачено|читать бесплатно|Чтение: 0|Безлимит — |Конспект оплачен|Дальше — за/i;

  it("P1/P4: после открытия — карточка темы и списанное ½; ни одного пояснения про плату", async () => {
    await render(createElement(StrictMode, null, reader()));
    expect(body()).not.toContain("Карточка 1 из"); // до кадра текста темы нет
    await frame();
    expect(hearts()).toBe(4.5);
    expect(body()).toContain("Карточка 1 из");
    expect(body()).not.toMatch(PAY_TEXT);
    expect(host.querySelector("[data-tour=theory-next]")).not.toBeNull(); // «Дальше» — обычная кнопка, не ворота
    expect(hearts()).toBe(4.5);
  });

  it("P4: ни плашки, ни ворот и у «Безлимита», и у оплаченной ранее темы", async () => {
    useApp.setState({ theoryPaid: { [A]: Date.now() - HOUR } });
    await render(reader());
    expect(body()).toContain("Карточка 1 из");
    expect(body()).not.toMatch(PAY_TEXT);
    await unmount();
    useApp.setState({ theoryPaid: {} });
    expect(st().startTrial()).toBe(true);
    await render(reader());
    expect(body()).toContain("Карточка 1 из");
    expect(body()).not.toMatch(PAY_TEXT);
    expect(hearts()).toBe(5);
  });

  it("P3: сердечек нет — окно «Сердечки закончились», текста темы нет, выход — к списку теории", async () => {
    useApp.setState({ hearts: { count: 0, updatedAt: Date.now(), day: todayKey() } });
    await render(reader());
    await frame();
    expect(body()).toContain("Сердечки закончились");
    expect(body()).not.toContain("Карточка 1 из");
    expect(host.querySelector("[data-tour=theory-next]")).toBeNull();
    expect(host.querySelector("[data-tour=theory-ask]")).toBeNull();
    expect(body()).not.toMatch(PAY_TEXT);
    expect(hearts()).toBe(0);
    expect(useApp.getState().theoryLast).toBeNull(); // непрочитанное не попадает в «Продолжить чтение»
    const exit = [...document.body.querySelectorAll("button")].find((b) => b.textContent === "Выйти")!;
    await act(async () => exit.click());
    expect(h.pushed).toEqual(["/theory"]);
  });
});

describe("P4: цена — значок на карточке темы в списке", () => {
  const badge = () => host.querySelector('[role="img"]')?.getAttribute("aria-label") ?? null;

  it("тема не оплачена — значок ½; оплачена за сутки — значка нет", async () => {
    await render(createElement(TheoryCost, { id: A }));
    expect(badge()).toContain("0,5");
    expect(host.textContent).toContain("0,5");
    useApp.setState({ theoryPaid: { [A]: Date.now() - HOUR } });
    await frame();
    expect(badge()).toBeNull();
  });

  it("«Безлимит» — значка нет, как у уроков", async () => {
    expect(st().startTrial()).toBe(true);
    await render(createElement(TheoryCost, { id: A }));
    expect(badge()).toBeNull();
  });
});
