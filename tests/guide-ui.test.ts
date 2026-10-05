// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GuideHost } from "@/components/guide/GuideHost";
import { useGuideSpots } from "@/components/guide/GuideSpot";
import { useGuideUi } from "@/components/guide/guide-state";
import { PaywallAgent } from "@/components/plans/PaywallAgent";
import { GUIDE_DELAY_MS } from "@/lib/guide";
import { TIP_IDS } from "@/lib/tips";
import { FREE_PLAN } from "@/lib/economy";
import { useApp } from "@/lib/store";

// Всплывающий Бит-проводник (этап 16В, P2a): сцены по шагам, шаг «нажми» ждёт нажатия в цель, затемнение не мешает
// нажать цель, «Пропустить» и Escape закрывают всё, уход со страницы отмечает сцену, звук и «Меньше анимаций».

const h = vi.hoisted(() => ({ pathname: "/learn", push: undefined as unknown as (url: string) => void, sounds: [] as string[] }));

vi.mock("next/navigation", () => ({ usePathname: () => h.pathname, useRouter: () => ({ push: (u: string) => h.push(u), replace: () => {}, back: () => {} }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown } & Record<string, unknown>) => createElement("a", { href, ...rest }, children as never),
}));
vi.mock("@/lib/sound", () => ({ playSound: (name: string) => h.sounds.push(name) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;

const render = () =>
  act(async () => {
    root.render(createElement(GuideHost));
  });
const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
/** Пузырь Бита (диалог на шаге с затемнением, статус — без него). */
const bubble = () => document.querySelector<HTMLElement>('[aria-label="Подсказка Бита"]');
const say = () => bubble()?.textContent ?? "";
const button = (name: string) => [...(bubble()?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.trim() === name) as HTMLButtonElement | undefined;
const click = (name: string) =>
  act(async () => {
    button(name)!.click();
  });
const dims = () => document.querySelectorAll("[data-guide-dim]");
const tips = () => useApp.getState().tips;
const doneLesson = () => useApp.setState({ lessons: { l1: { completions: 1 } } as never });
/** Пауза перед сценой и первый замер цели. */
const start = async () => {
  await render();
  await wait(GUIDE_DELAY_MS + 50);
};

/** Элемент с data-tour: у happy-dom нет вёрстки, поэтому размеры задаём сами. */
function addTarget(name: string, attrs: Record<string, string> = {}, tag = "a") {
  const el = document.createElement(tag);
  el.dataset.tour = name;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.appendChild(document.createElement("span"));
  el.getBoundingClientRect = () => ({ left: 20, top: 100, width: 200, height: 48, right: 220, bottom: 148, x: 20, y: 100, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "requestAnimationFrame", "cancelAnimationFrame"] });
  h.pathname = "/learn";
  h.push = vi.fn() as unknown as (url: string) => void;
  h.sounds = [];
  useApp.getState().resetProgress();
  useApp.setState((s) => ({ onboarded: true, tips: {}, profile: { ...s.profile, lang: "ru", name: "Аня", sound: false, reduceMotion: false } }));
  useGuideSpots.setState({ lesson: null, results: false });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.querySelectorAll("[data-tour]").forEach((e) => e.remove());
  useApp.getState().resetProgress();
  useApp.setState({ plan: FREE_PLAN });
  vi.useRealTimers();
});

describe("welcome: приветствие и путь к первому уроку", () => {
  it("после паузы Бит здоровается по имени — без затемнения; дальше показывает урок и сердечки и просит нажать «Начать»", async () => {
    const cont = addTarget("continue", { href: "/lesson/ns-1" });
    addTarget("hdr-hearts");
    await render();
    expect(bubble()).toBeNull();
    await wait(GUIDE_DELAY_MS + 50);
    expect(say()).toContain("Привет, Аня! Я Бит.");
    expect(bubble()?.getAttribute("role")).toBe("status");
    expect(dims()).toHaveLength(0);
    expect(useGuideUi.getState().active).toBe(true);

    await click("Дальше");
    await wait(50);
    expect(say()).toContain("следующий урок");
    expect(bubble()?.getAttribute("role")).toBe("dialog");
    expect(dims()).toHaveLength(4);

    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Сердечки — входы в уроки");

    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Нажми «Начать»");
    expect(say()).toContain("Нажми, куда показываю");
    expect(button("Дальше")).toBeUndefined();
    expect(tips().welcome).toBeUndefined();

    // Нажатие в саму цель (внутрь неё) — сцена доиграна; переход по ссылке — дело самой ссылки.
    await act(async () => cont.querySelector("span")!.click());
    await wait(10);
    expect(tips().welcome).toBeGreaterThan(0);
    expect(bubble()).toBeNull();
    expect(useGuideUi.getState().active).toBe(false);
  });

  it("нажатие на затемнение ничего не делает (шаг тот же), Бит «качает головой»", async () => {
    addTarget("continue", { href: "/lesson/ns-1" });
    await start();
    await click("Дальше");
    await wait(50);
    const before = say();
    await act(async () => {
      dims()[0].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    });
    await wait(50);
    expect(say()).toBe(before);
    expect(tips().welcome).toBeUndefined();
  });

  it("нет кнопки урока (школьный трек без урока) — шаги с ней пропускаются, в конце «Выбери раздел ниже» и «Понятно»", async () => {
    addTarget("hdr-hearts");
    await start();
    await click("Дальше");
    await wait(2000); // «continue» так и не появилась — шаг пропущен
    expect(say()).toContain("Сердечки");
    await click("Дальше");
    await wait(2000);
    expect(say()).toContain("Выбери раздел ниже");
    await click("Понятно");
    expect(tips().welcome).toBeGreaterThan(0);
  });

  it("без имени — «Привет! Я Бит.»", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, name: "" } }));
    await start();
    expect(say()).toContain("Привет! Я Бит.");
  });

  it("«Пропустить» закрывает весь проводник", async () => {
    await start();
    await act(async () => (bubble()!.querySelector('button[aria-label="Пропустить подсказки"]') as HTMLButtonElement).click());
    for (const id of TIP_IDS) expect(tips()[id], id).toBeGreaterThan(0);
    expect(bubble()).toBeNull();
  });

  it("Escape закрывает весь проводник", async () => {
    await start();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(tips().nav).toBeGreaterThan(0);
    expect(bubble()).toBeNull();
  });

  it("ушли со страницы посреди сцены — сцена считается показанной", async () => {
    await start();
    expect(bubble()).not.toBeNull();
    h.pathname = "/practice";
    await render();
    await wait(10);
    expect(tips().welcome).toBeGreaterThan(0);
    expect(bubble()).toBeNull();
  });

  it("до онбординга и уже закрытое приветствие — ничего", async () => {
    useApp.setState({ onboarded: false });
    await start();
    expect(bubble()).toBeNull();
    useApp.setState({ onboarded: true, tips: { welcome: 1 } });
    await wait(GUIDE_DELAY_MS + 50);
    expect(bubble()).toBeNull();
  });
});

describe("lesson-first: первый урок", () => {
  beforeEach(() => {
    h.pathname = "/lesson/ns-1";
    useApp.setState({ tips: { welcome: 1 } });
    useGuideSpots.setState({ lesson: { cost: 1 } });
  });

  it("сердечко → полоска → ждёт вариант (Бит спрятан) → «нажми вариант» → «нажми Проверить» → где подсказка", async () => {
    addTarget("lesson-hearts");
    addTarget("lesson-progress");
    await start();
    expect(say()).toContain("Вход в урок списал 1 сердечко");
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Полоска сверху");
    await click("Дальше");
    // Шаги-рассказы: вариантов нет — Бит молчит и прячется, затемнения нет, страница работает.
    await wait(5000);
    expect(bubble()).toBeNull();
    expect(dims()).toHaveLength(0);

    const options = addTarget("lesson-options", {}, "div");
    await wait(200);
    expect(say()).toContain("Выбери ответ");
    await act(async () => options.querySelector("span")!.click());
    await wait(10);
    const check = addTarget("lesson-check", {}, "button");
    await wait(200);
    expect(say()).toContain("Теперь нажми «Проверить»");
    await act(async () => check.click());
    await wait(10);
    addTarget("lesson-ask", {}, "button");
    await wait(200);
    expect(say()).toContain("нажми на меня здесь");
    await click("Понятно");
    expect(tips()["lesson-first"]).toBeGreaterThan(0);
  });

  it("большой урок — «2 сердечка»", async () => {
    useGuideSpots.setState({ lesson: { cost: 2 } });
    addTarget("lesson-hearts");
    await start();
    expect(say()).toContain("списал 2 сердечка");
  });

  it("урок кончился без вариантов — сцена закрывается, на итогах начинается after-first", async () => {
    addTarget("lesson-hearts");
    await start();
    await click("Дальше");
    await wait(2000);
    doneLesson();
    useGuideSpots.setState({ results: true });
    addTarget("res-xp");
    await wait(10);
    expect(tips()["lesson-first"]).toBeGreaterThan(0);
    await wait(GUIDE_DELAY_MS + 50);
    expect(say()).toContain("Опыт (XP)");
  });
});

describe("after-first: итоги первого урока", () => {
  it("плитки по одной; нет плитки — шаг пропускается; «Продолжить» нажимается в саму кнопку", async () => {
    h.pathname = "/lesson/ns-1";
    doneLesson();
    useGuideSpots.setState({ lesson: { cost: 1 }, results: true });
    addTarget("res-xp");
    addTarget("res-streak");
    const cont = addTarget("res-continue", {}, "button");
    await start();
    expect(say()).toContain("Опыт (XP)");
    await click("Дальше");
    await wait(2000); // чипов не дали — плитки нет
    expect(say()).toContain("Огонь — серия дней");
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Нажми «Продолжить»");
    await act(async () => cont.click());
    await wait(10);
    expect(tips()["after-first"]).toBeGreaterThan(0);
  });
});

describe("nav: после первого урока", () => {
  it("следующий урок → панель → (нет кнопки Бита — пропуск) → «нажми на чипы»; школьному треку — без ЕНТ", async () => {
    doneLesson();
    useApp.setState((s) => ({ tips: { welcome: 1, "lesson-first": 1, "after-first": 1 }, profile: { ...s.profile, track: "school" } }));
    addTarget("continue", { href: "/lesson/ns-2" });
    addTarget("nav-practice");
    addTarget("nav-materials");
    addTarget("nav-progress");
    const chips = addTarget("hdr-chips", { href: "/shop" });
    await start();
    expect(say()).toContain("Сюда я кладу следующий урок");
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Практика — тренировки и игры");
    expect(say()).not.toContain("ЕНТ");
    await click("Дальше");
    await wait(2000);
    expect(say()).toContain("нажми на чипы");
    expect(tips().nav).toBeUndefined();
    await act(async () => chips.click());
    await wait(10);
    expect(tips().nav).toBeGreaterThan(0);
  });

  it("на шаге про плавающую кнопку Бит её не прячет (active = false)", async () => {
    doneLesson();
    useApp.setState({ tips: { welcome: 1 } });
    addTarget("continue", { href: "/lesson/ns-2" });
    addTarget("bit-dock", {}, "button");
    await start();
    expect(useGuideUi.getState().active).toBe(true);
    await click("Дальше");
    await wait(2000);
    expect(say()).toContain("А это я!");
    expect(useGuideUi.getState().active).toBe(false);
  });
});

describe("страницы и «Показать подсказки снова»", () => {
  it("первый заход на страницу после nav — две реплики с целями; уже показанная — не возвращается", async () => {
    h.pathname = "/materials";
    useApp.setState({ tips: { nav: 1 } });
    addTarget("materials-notes");
    addTarget("materials-theory");
    await start();
    expect(say()).toContain("Конспекты — твои записи");
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Теория — короткие справки");
    await click("Понятно");
    expect(tips()["page-materials"]).toBeGreaterThan(0);
    await wait(GUIDE_DELAY_MS + 50);
    expect(bubble()).toBeNull();
  });

  it("до nav страницы молчат", async () => {
    h.pathname = "/practice";
    addTarget("practice-train");
    await start();
    expect(bubble()).toBeNull();
  });

  it("сброс подсказок — сцена играет снова с первого шага", async () => {
    h.pathname = "/tutor";
    useApp.setState({ tips: { nav: 1 } });
    await start();
    expect(say()).toContain("Спрашивай меня");
    await click("Понятно");
    expect(bubble()).toBeNull();
    await act(async () => useApp.getState().resetTips());
    useApp.setState({ tips: { nav: 1 } });
    await wait(GUIDE_DELAY_MS + 50);
    expect(say()).toContain("Спрашивай меня");
  });

  it("чужое окно поверх (шторка) — Бит ждёт, пока его закроют", async () => {
    h.pathname = "/tutor";
    useApp.setState({ tips: { nav: 1 } });
    const modal = document.createElement("div");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);
    await start();
    await wait(3000);
    expect(bubble()).toBeNull();
    expect(tips()["page-tutor"]).toBeUndefined();
    modal.remove();
    await wait(300);
    expect(say()).toContain("Спрашивай меня");
  });
});

describe("звук и «Меньше анимаций»", () => {
  it("звук включён: «буп» при появлении и слоги «голоска» при печати", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, sound: true } }));
    await start();
    await wait(3000);
    expect(h.sounds[0]).toBe("bitPop");
    expect(h.sounds.filter((s) => s === "bitTalk").length).toBeGreaterThan(3);
  });

  it("звук выключен — тишина", async () => {
    await start();
    await wait(3000);
    expect(h.sounds).toEqual([]);
  });

  it("«Меньше анимаций»: текст сразу целиком, звук — один «буп»", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, sound: true, reduceMotion: true } }));
    await start();
    const visible = bubble()!.querySelector("p")!;
    expect(visible.querySelector(".text-transparent")?.textContent).toBe("");
    await wait(3000);
    expect(h.sounds).toEqual(["bitPop"]);
  });
});

describe("PaywallAgent и проводник", () => {
  it("тарифы не открываются, пока проводник не закончен", async () => {
    useApp.setState({ tips: {} });
    await act(async () => root.render(createElement(PaywallAgent)));
    await wait(10);
    expect(h.push).not.toHaveBeenCalled();
  });

  it("проводник пройден — тарифы открываются по расписанию", async () => {
    useApp.setState({ tips: { nav: 1 } });
    await act(async () => root.render(createElement(PaywallAgent)));
    await wait(10);
    expect(h.push).toHaveBeenCalledWith("/plans?from=auto");
  });
});
