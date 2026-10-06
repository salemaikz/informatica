// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GuideHost } from "@/components/guide/GuideHost";
import { useGuideSpots } from "@/components/guide/GuideSpot";
import { useGuideUi } from "@/components/guide/guide-state";
import { PaywallAgent } from "@/components/plans/PaywallAgent";
import { GUIDE_DELAY_MS, tourBlocking } from "@/lib/guide";
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
/** Шаги без цели пропускаются по одному (каждый ждёт цель DEFAULT_WAIT_MS; act отдаёт перерисовку только в конце). */
const skipSteps = async (n: number) => {
  for (let i = 0; i < n; i++) await wait(2000);
};
/** Пауза перед сценой и первый замер цели. */
const start = async () => {
  await render();
  await wait(GUIDE_DELAY_MS + 50);
};

/** Элемент с data-tour: у happy-dom нет вёрстки, поэтому размеры задаём сами. */
function addTarget(name: string, attrs: Record<string, string> = {}, tag = "a", box = { x: 20, y: 100, w: 200, h: 48 }) {
  const el = document.createElement(tag);
  el.dataset.tour = name;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.appendChild(document.createElement("span"));
  const { x, y, w, h } = box;
  el.getBoundingClientRect = () => ({ left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, x, y, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

/** Карточка следующего урока (`next-lesson`) с кнопкой «Начать» (`continue`) внутри. */
function addLessonCard(href = "/lesson/ns-1") {
  const card = addTarget("next-lesson", {}, "div");
  const cont = addTarget("continue", { href });
  card.appendChild(cont);
  return { card, cont };
}

/** Кнопка Бита: обёртка-цель `bit-dock` и сама кнопка `[data-dock-button]` (справа внизу). */
function addDock() {
  const wrap = addTarget("bit-dock", {}, "div", { x: 284, y: 600, w: 72, h: 56 });
  const btn = document.createElement("button");
  btn.dataset.dockButton = "";
  btn.getBoundingClientRect = () => ({ left: 284, top: 600, width: 56, height: 56, right: 340, bottom: 656, x: 284, y: 600, toJSON: () => ({}) }) as DOMRect;
  wrap.appendChild(btn);
  return wrap;
}

/** Цели знакомства, кроме карточки урока: шапка (огонь, сердечки, чипы), нижние вкладки, кнопка Бита. */
function addIntroTargets() {
  addTarget("hdr-streak", {}, "span", { x: 160, y: 10, w: 40, h: 40 });
  addTarget("hdr-hearts", { href: "/shop" }, "a", { x: 200, y: 10, w: 60, h: 40 });
  addTarget("hdr-chips", { href: "/shop" }, "a", { x: 260, y: 10, w: 60, h: 40 });
  for (const [i, id] of ["nav-practice", "nav-materials", "nav-progress"].entries()) addTarget(id, {}, "a", { x: 90 * (i + 1), y: 580, w: 90, h: 64 });
  addDock();
}

/** Варианты ответа: блок-цель с двумя кнопками и промежутком между ними (`gap`). */
function addOptions() {
  const box = addTarget("lesson-options", {}, "div");
  const gap = box.querySelector("span")!;
  const option = document.createElement("button");
  option.setAttribute("role", "radio");
  option.textContent = "11";
  box.appendChild(option);
  return { box, gap, option };
}

/** Нажатие мышью в точку окна (координаты — для проверки «внутри выреза»; detail 1 — не клавиатура). */
const clickAt = (el: Element, x: number, y: number) => {
  const e = new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: y, detail: 1 });
  el.dispatchEvent(e);
  return e;
};
const finger = () => document.querySelector("[data-guide-finger]");

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

describe("intro: знакомство до первого урока, конец — нажать «Начать»", () => {
  it("после паузы Бит здоровается по имени — модально; дальше урок, шапка, вкладки, кнопка Бита и «Нажми «Начать»»", async () => {
    const { cont } = addLessonCard();
    addIntroTargets();
    await render();
    expect(bubble()).toBeNull();
    await wait(GUIDE_DELAY_MS + 50);
    expect(say()).toContain("Привет, Аня! Я Бит.");
    // Шаг без цели: весь экран затемнён и закрыт для нажатий (один «ловец» на весь экран), пузырь — диалог.
    expect(bubble()?.getAttribute("role")).toBe("dialog");
    expect(bubble()?.getAttribute("aria-modal")).toBe("true");
    expect(dims()).toHaveLength(1);
    expect(useGuideUi.getState().active).toBe(true);

    await click("Дальше");
    await wait(50);
    expect(say()).toContain("следующий урок");
    expect(bubble()?.getAttribute("role")).toBe("dialog");
    expect(dims()).toHaveLength(4);

    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Наверху: огонь — серия дней, сердечки — входы в уроки");
    expect(say()).toContain("чипы — валюта для магазина");

    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Практика — тренировки и пробный ЕНТ");

    await click("Дальше");
    await wait(50);
    expect(say()).toContain("А это я!");
    expect(useGuideUi.getState().dockStep).toBe(true);

    await click("Дальше");
    await wait(50);
    expect(useGuideUi.getState().dockStep).toBe(false);
    expect(say()).toContain("Нажми «Начать»");
    expect(say()).toContain("Нажми, куда показываю");
    // Подсказка — своей строкой над кнопками, а не в одном ряду с «Пропустить» (в узком пузыре ей там тесно).
    const hint = bubble()!.querySelector("[data-guide-tap-hint]")!;
    expect(hint.textContent).toContain("Нажми, куда показываю");
    expect(hint.querySelector("button")).toBeNull();
    expect(hint.nextElementSibling?.contains(button("Пропустить")!)).toBe(true);
    expect(button("Дальше")).toBeUndefined();
    expect(tips().intro).toBeUndefined();

    // Нажатие в саму цель (внутрь неё) — сцена доиграна; переход по ссылке — дело самой ссылки.
    await act(async () => cont.querySelector("span")!.click());
    await wait(10);
    expect(tips().intro).toBeGreaterThan(0);
    // Обучение ещё идёт (до learn-next): сцены страниц и окна тарифов ждут.
    expect(tips()["learn-next"]).toBeUndefined();
    expect(tips().welcome).toBeUndefined();
    expect(bubble()).toBeNull();
    expect(useGuideUi.getState().active).toBe(false);
  });

  it("нажатие на затемнение ничего не делает (шаг тот же), Бит «качает головой»", async () => {
    addLessonCard();
    await start();
    // Шаг без цели: нажатие на затемнение тоже ничего не делает.
    await act(async () => {
      dims()[0].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    });
    expect(say()).toContain("Привет, Аня!");
    await click("Дальше");
    await wait(50);
    const before = say();
    await act(async () => {
      dims()[0].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    });
    await wait(50);
    expect(say()).toBe(before);
    expect(tips().intro).toBeUndefined();
  });

  it("нет кнопки урока (школьный трек без урока) — шаги с ней пропускаются, в конце «Выбери раздел ниже» и «Понятно»", async () => {
    addTarget("hdr-hearts");
    await start();
    await click("Дальше");
    await wait(2000); // карточки так и нет — шаг пропущен
    expect(say()).toContain("Наверху: огонь");
    await click("Дальше");
    await skipSteps(3); // нет вкладок, кнопки Бита и кнопки урока — пропуск, пропуск, запасная реплика
    expect(say()).toContain("Выбери раздел ниже");
    await click("Понятно");
    expect(tips().intro).toBeGreaterThan(0);
  });

  it("«Безлимит»: в шапке — сердечки на «Безлимите» не нужны", async () => {
    useApp.setState({ plan: { tier: "unlimited" as const, until: Date.now() + 86_400_000 } });
    addLessonCard();
    addIntroTargets();
    await start();
    await click("Дальше");
    await wait(50);
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("на «Безлимите» не нужны");
  });

  it("подсказки вернули после пройденных уроков — последний шаг без «Начать» (на кнопке «Продолжить»)", async () => {
    doneLesson();
    addLessonCard();
    addIntroTargets();
    await start();
    for (let i = 0; i < 5; i++) {
      await click("Дальше");
      await wait(50);
    }
    expect(say()).toContain("Следующий урок — здесь. Нажми — и начнём!");
    expect(say()).not.toContain("«Начать»");
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
    expect(tips().intro).toBeGreaterThan(0);
    expect(bubble()).toBeNull();
  });

  it("до онбординга и уже закрытое знакомство — ничего", async () => {
    useApp.setState({ onboarded: false });
    await start();
    expect(bubble()).toBeNull();
    useApp.setState({ onboarded: true, tips: { intro: 1 } });
    await wait(GUIDE_DELAY_MS + 50);
    expect(bubble()).toBeNull();
  });
});

describe("шаг «Дальше» с целью и шаг «нажми»: вырез, палец, фокус, роли", () => {
  it("нажатие на саму цель (ссылку) — это «Дальше»: со страницы не уходим, до цели нажатие не доходит; пальца нет", async () => {
    const { cont } = addLessonCard();
    addTarget("hdr-hearts", { href: "/shop" });
    const reached = vi.fn();
    cont.addEventListener("click", reached);
    cont.addEventListener("pointerdown", reached);
    await start();
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("следующий урок");
    expect(finger()).toBeNull();

    const down = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
    await act(async () => {
      cont.querySelector("span")!.dispatchEvent(down);
    });
    expect(down.defaultPrevented).toBe(true);
    let e!: MouseEvent;
    await act(async () => {
      e = clickAt(cont.querySelector("span")!, 0, 0);
    });
    expect(e.defaultPrevented).toBe(true);
    expect(reached).not.toHaveBeenCalled();
    await wait(50);
    expect(say()).toContain("Наверху: огонь");

    // Нажатие в вырез мимо самой цели (зазор рамки вокруг сердечек) — тоже «Дальше».
    let e2!: MouseEvent;
    await act(async () => {
      e2 = clickAt(document.body, 16, 96);
    });
    expect(e2.defaultPrevented).toBe(true);
    await skipSteps(2); // вкладок и кнопки Бита нет — их шаги пропущены
    expect(say()).toContain("Нажми «Начать»");
    expect(tips().intro).toBeUndefined();
    // Шаг «нажми» — палец есть, нажатие в цель проходит как обычно.
    expect(finger()).not.toBeNull();
    let e3!: MouseEvent;
    await act(async () => {
      e3 = clickAt(cont, 0, 0);
    });
    expect(e3.defaultPrevented).toBe(false);
    expect(reached).toHaveBeenCalledTimes(1);
    await wait(10);
    expect(tips().intro).toBeGreaterThan(0);
  });

  it("нажатие мимо выреза на шаге «Дальше» не перехватывается (страница под затемнением его не получит — его ловит затемнение)", async () => {
    addLessonCard();
    await start();
    await click("Дальше");
    await wait(50);
    let e!: MouseEvent;
    await act(async () => {
      e = clickAt(document.body, 600, 600);
    });
    expect(e.defaultPrevented).toBe(false);
    // Клик с клавиатуры (detail 0) по другому элементу — координатам не верим, не перехватываем.
    const other = document.createElement("button");
    document.body.appendChild(other);
    const kb = new MouseEvent("click", { bubbles: true, cancelable: true, clientX: 30, clientY: 110, detail: 0 });
    await act(async () => {
      other.dispatchEvent(kb);
    });
    other.remove();
    expect(kb.defaultPrevented).toBe(false);
    await wait(50);
    expect(say()).toContain("следующий урок");
  });

  it("фокус: модальный пузырь берёт фокус сам (кольцо на «Дальше» — только после Tab), Enter — «Дальше»; шаг «нажми» — статус, фокус на цели", async () => {
    const { cont } = addLessonCard();
    addTarget("hdr-hearts", { href: "/shop" });
    await start();
    expect(bubble()?.getAttribute("role")).toBe("dialog");
    expect(document.activeElement).toBe(bubble());
    expect(document.activeElement).not.toBe(button("Дальше"));
    await click("Дальше");
    await wait(50);
    expect(bubble()?.getAttribute("role")).toBe("dialog");
    expect(bubble()?.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(bubble());
    // Enter на самом пузыре — «Дальше».
    await act(async () => {
      bubble()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    await wait(50);
    expect(say()).toContain("Наверху: огонь");
    await wait(50);
    await click("Дальше");
    await skipSteps(2);
    expect(say()).toContain("Нажми «Начать»");
    // Затемнение есть, но пузырь не модальный: нажимают саму цель, фокус на ней.
    expect(dims()).toHaveLength(4);
    expect(bubble()?.getAttribute("role")).toBe("status");
    expect(bubble()?.getAttribute("aria-modal")).toBeNull();
    expect(bubble()?.getAttribute("aria-live")).toBe("polite");
    expect(document.activeElement).toBe(cont);
  });

  it("закрытая панель Бита (внутри [inert]) и скрытые окна сцене не мешают; открытое окно — мешает", async () => {
    h.pathname = "/tutor";
    useApp.setState({ tips: { nav: 1 } });
    const made: HTMLElement[] = [];
    const dialog = (setup: (el: HTMLElement, wrap: HTMLElement) => void) => {
      const wrap = document.createElement("div");
      const el = document.createElement("section");
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      wrap.appendChild(el);
      setup(el, wrap);
      document.body.appendChild(wrap);
      made.push(wrap);
      return wrap;
    };
    dialog((_, wrap) => wrap.setAttribute("inert", ""));
    dialog((el) => (el.style.display = "none"));
    dialog((_, wrap) => (wrap.style.display = "none"));
    dialog((el) => (el.style.visibility = "hidden"));
    dialog((el) => el.setAttribute("hidden", ""));
    addTarget("tutor-free", {}, "button");
    await start();
    expect(say()).toContain("Спрашивай меня");
    // Открылось настоящее окно поверх — Бит прячется и ждёт.
    const open = dialog(() => {});
    await wait(300);
    expect(bubble()).toBeNull();
    open.remove();
    await wait(300);
    expect(say()).toContain("Спрашивай меня");
    made.forEach((m) => m.remove());
  });
});

describe("lesson-first: первый урок", () => {
  beforeEach(() => {
    h.pathname = "/lesson/ns-1";
    useApp.setState({ tips: { intro: 1 } });
    useGuideSpots.setState({ lesson: { cost: 1 } });
  });

  it("сердечко → полоска → инструменты → ИИ → ждёт вариант (Бит спрятан) → «нажми вариант» → «нажми Проверить»", async () => {
    addTarget("lesson-hearts");
    addTarget("lesson-progress");
    addTarget("lesson-tools", {}, "button");
    addTarget("lesson-ask", {}, "button");
    await start();
    expect(say()).toContain("Вход в урок списал 1 сердечко");
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Полоска сверху");
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Это инструменты: калькулятор как на ЕНТ");
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Это значок ИИ — тоже я");
    expect(say()).toContain("сколько бесплатных вопросов осталось");
    await click("Дальше");
    // Шаги-рассказы: вариантов нет — Бит молчит и прячется, затемнения нет, страница работает.
    await wait(5000);
    expect(bubble()).toBeNull();
    expect(dims()).toHaveLength(0);

    const { gap, option } = addOptions();
    await wait(200);
    expect(say()).toContain("Выбери ответ");
    // Нажатие в промежуток между вариантами — не выбор: шаг тот же (иначе Бит просил бы «Проверить» без ответа).
    await act(async () => gap.click());
    await wait(200);
    expect(say()).toContain("Выбери ответ");
    await act(async () => option.click());
    await wait(10);
    const check = addTarget("lesson-check", {}, "button");
    await wait(200);
    expect(say()).toContain("Теперь нажми «Проверить»");
    expect(tips()["lesson-first"]).toBeUndefined();
    await act(async () => check.click());
    await wait(10);
    // Сцена кончается на «Проверить»; значки уже объяснены — lesson-icons отмечен вместе с ней.
    expect(tips()["lesson-first"]).toBeGreaterThan(0);
    expect(tips()["lesson-icons"]).toBeGreaterThan(0);
    await wait(GUIDE_DELAY_MS + 500);
    expect(bubble()).toBeNull();
  });

  it("урок закрыт на шаге сердечка — lesson-first отмечен, lesson-icons нет (значки ещё не объяснены)", async () => {
    addTarget("lesson-hearts");
    addTarget("lesson-progress");
    addTarget("lesson-tools", {}, "button");
    addTarget("lesson-ask", {}, "button");
    await start();
    expect(say()).toContain("Вход в урок списал 1 сердечко");
    await act(async () => window.dispatchEvent(new Event("pagehide")));
    expect(tips()["lesson-first"]).toBeGreaterThan(0);
    expect(tips()["lesson-icons"]).toBeUndefined();
  });

  it("урок закрыт после шага ИИ — lesson-icons тоже отмечен", async () => {
    addTarget("lesson-hearts");
    addTarget("lesson-progress");
    addTarget("lesson-tools", {}, "button");
    addTarget("lesson-ask", {}, "button");
    await start();
    await click("Дальше");
    await wait(50);
    await click("Дальше");
    await wait(50);
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Это значок ИИ");
    expect(tips()["lesson-icons"]).toBeUndefined();
    await click("Дальше");
    await wait(50);
    expect(tips()["lesson-icons"]).toBeGreaterThan(0);
    expect(tips()["lesson-first"]).toBeUndefined();
    await act(async () => window.dispatchEvent(new Event("pagehide")));
    expect(tips()["lesson-first"]).toBeGreaterThan(0);
  });

  it("значка ИИ нет — шаг пропускается, «Выбери ответ» всё равно наступает", async () => {
    addTarget("lesson-hearts");
    addTarget("lesson-progress");
    addTarget("lesson-tools", {}, "button");
    addOptions();
    await start();
    await click("Дальше");
    await wait(50);
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Это инструменты");
    await click("Дальше");
    await skipSteps(1);
    expect(say()).toContain("Выбери ответ");
  });

  it("«Безлимит»: на значке ИИ нет числа — реплика без фразы про бесплатные", async () => {
    useApp.setState({ plan: { tier: "unlimited" as const, until: Date.now() + 86_400_000 } });
    addTarget("lesson-hearts");
    addTarget("lesson-progress");
    addTarget("lesson-tools", {}, "button");
    addTarget("lesson-ask", {}, "button");
    await start();
    for (let i = 0; i < 3; i++) {
      await click("Дальше");
      await wait(50);
    }
    expect(say()).toContain("Это значок ИИ — тоже я");
    expect(say()).not.toContain("бесплатных");
  });

  it("школьный трек: инструменты — без ЕНТ", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, track: "school" } }));
    addTarget("lesson-hearts");
    addTarget("lesson-progress");
    addTarget("lesson-tools", {}, "button");
    await start();
    await click("Дальше");
    await wait(50);
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Это инструменты: калькулятор, перевод");
    expect(say()).not.toContain("ЕНТ");
  });

  it("большой урок — «2 сердечка»", async () => {
    useGuideSpots.setState({ lesson: { cost: 2 } });
    addTarget("lesson-hearts");
    await start();
    expect(say()).toContain("списал 2 сердечка");
  });

  it.each([
    ["«Безлимит»", { tier: "unlimited" as const, until: Date.now() + 86_400_000 }],
    ["пробный «Безлимит»", { tier: "unlimited" as const, until: Date.now() + 86_400_000, trial: true, trialUsed: true }],
  ])("%s: сердечки не списывались — Бит так и говорит", async (_, plan) => {
    useApp.setState({ plan });
    addTarget("lesson-hearts");
    await start();
    expect(say()).toContain("На «Безлимите» уроки без сердечек");
    expect(say()).not.toContain("списал");
  });

  it("Escape, пока Бит спрятан (ждёт вопрос с вариантами), проводник не закрывает; Бит на экране — закрывает", async () => {
    addTarget("lesson-hearts");
    addTarget("lesson-progress");
    await start();
    await click("Дальше");
    await wait(50);
    await click("Дальше");
    await skipSteps(2); // нет инструментов и значка ИИ
    await wait(5000);
    expect(bubble()).toBeNull();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(tips()["lesson-first"]).toBeUndefined();
    expect(tips().nav).toBeUndefined();
    addOptions();
    await wait(200);
    expect(say()).toContain("Выбери ответ");
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(tips()["lesson-first"]).toBeGreaterThan(0);
    expect(tips().nav).toBeGreaterThan(0);
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

describe("nav: короткая версия для видевших старое приветствие", () => {
  it("вкладки → (нет кнопки Бита — пропуск) → «нажми» кнопку урока; школьному треку — без ЕНТ", async () => {
    doneLesson();
    useApp.setState((s) => ({ tips: { welcome: 1, "lesson-first": 1, "after-first": 1 }, profile: { ...s.profile, track: "school" } }));
    const { cont } = addLessonCard("/lesson/ns-2");
    addTarget("nav-practice");
    addTarget("nav-materials");
    addTarget("nav-progress");
    await start();
    expect(say()).toContain("Практика — тренировки и игры");
    expect(say()).not.toContain("ЕНТ");
    await click("Дальше");
    await skipSteps(1);
    expect(say()).toContain("Нажми сюда — откроется урок");
    expect(finger()).not.toBeNull();
    expect(tips().nav).toBeUndefined();
    await act(async () => cont.click());
    await wait(10);
    expect(tips().nav).toBeGreaterThan(0);
  });

  it("ЕНТ-трек, урока ещё нет: последний шаг — «Следующий урок — здесь», без названия кнопки", async () => {
    useApp.setState({ tips: { welcome: 1 } });
    addLessonCard();
    addIntroTargets();
    await start();
    expect(say()).toContain("Практика — тренировки и пробный ЕНТ");
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("А это я!");
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Следующий урок — здесь. Нажми — и начнём!");
  });

  it("на шаге про плавающую кнопку Бит её не прячет (active = false)", async () => {
    doneLesson();
    useApp.setState({ tips: { welcome: 1 } });
    addLessonCard("/lesson/ns-2");
    addTarget("nav-practice");
    addDock();
    await start();
    expect(useGuideUi.getState().active).toBe(true);
    expect(useGuideUi.getState().dockStep).toBe(false);
    expect(document.querySelector("[data-guide-bit]")).not.toBeNull();
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("А это я!");
    expect(useGuideUi.getState().active).toBe(false);
    expect(useGuideUi.getState().dockStep).toBe(true);
    // Говорящий Бит прячется: «А это я!» говорит сама кнопка — пузырь над ней, хвостик к её центру (284 + 28).
    expect(document.querySelector("[data-guide-bit]")).toBeNull();
    const tail = bubble()!.querySelector<HTMLElement>("span.rotate-45")!;
    expect(parseFloat(bubble()!.style.left) + parseFloat(tail.style.left) + 8).toBeCloseTo(312);
    // Нажатие на саму кнопку Бита (она в вырезе) — «Дальше», а не чат.
    await act(async () => {
      clickAt(document.querySelector('[data-tour="bit-dock"]')!, 0, 0);
    });
    await wait(50);
    expect(useGuideUi.getState().dockStep).toBe(false);
    // Следующий шаг («нажми» кнопку урока) — Бит снова на месте.
    await wait(1000);
    expect(say()).toContain("Следующий урок — здесь");
    expect(document.querySelector("[data-guide-bit]")).not.toBeNull();
  });

  it("пузырь из кнопки Бита поднят над кнопкой страницы — хвостик вытянут до кнопки Бита (пузырь не «висит»)", async () => {
    doneLesson();
    useApp.setState({ tips: { welcome: 1 } });
    addLessonCard("/lesson/ns-2");
    addTarget("nav-practice");
    // Кнопка страницы там, где верхний край неподнятого пузыря разрезал бы её.
    addTarget("zz-page-button", {}, "button", { x: 300, y: 400, w: 200, h: 70 });
    addDock();
    await start();
    await click("Дальше");
    await wait(2000);
    expect(say()).toContain("А это я!");
    const spike = bubble()!.querySelector<SVGElement>("svg[data-guide-spike]");
    expect(spike).not.toBeNull();
    expect(bubble()!.querySelector("span.rotate-45")).toBeNull();
    // Кончик — над рамкой кнопки Бита (рамка: 600 − 6), как у обычного хвостика: низ пузыря + длина клина (без 2 px рамки).
    const tip = window.innerHeight - parseFloat(bubble()!.style.bottom) + parseFloat(spike!.style.height) - 2;
    expect(tip).toBeLessThanOrEqual(594 - 2);
    expect(tip).toBeGreaterThanOrEqual(594 - 6);
    // Пузырь при этом выше обычного места (низ рамки − 14 px).
    expect(window.innerHeight - parseFloat(bubble()!.style.bottom)).toBeLessThan(594 - 14);
    // Клин — напротив кнопки (284 + 28).
    expect(parseFloat(bubble()!.style.left) + parseFloat(spike!.style.left) + 10).toBeCloseTo(312);
  });
});

describe("learn-next: после первого урока — одна реплика и нажатие", () => {
  it("на «Учиться» Бит показывает кнопку урока; нажатие — обучение закончено, страницы и тарифы больше не ждут", async () => {
    doneLesson();
    useApp.setState({ tips: { intro: 1, "lesson-first": 1, "lesson-icons": 1, "after-first": 1 } });
    const { cont } = addLessonCard("/lesson/ns-2");
    addIntroTargets();
    await start();
    expect(say()).toContain("Следующий урок — здесь. Нажми — и начнём!");
    expect(finger()).not.toBeNull();
    expect(button("Дальше")).toBeUndefined();
    await act(async () => cont.click());
    await wait(10);
    expect(tips()["learn-next"]).toBeGreaterThan(0);
    expect(tourBlocking(tips())).toBe(false);
    // Больше на «Учиться» ничего не играет.
    await wait(GUIDE_DELAY_MS + 500);
    expect(bubble()).toBeNull();
  });

  it("курс пройден (карточки урока нет) — шаг молча пропускается, обучение закончено", async () => {
    doneLesson();
    useApp.setState({ tips: { intro: 1, "lesson-first": 1, "after-first": 1 } });
    await start();
    await skipSteps(1);
    expect(bubble()).toBeNull();
    expect(tips()["learn-next"]).toBeGreaterThan(0);
  });

  it("знакомство показано, первый урок не пройден — страницы молчат", async () => {
    h.pathname = "/practice";
    useApp.setState({ tips: { intro: 1 } });
    addTarget("practice-train");
    await start();
    expect(bubble()).toBeNull();
  });
});

describe("lesson-icons: значки урока для прошедших старый lesson-first", () => {
  it("один раз в следующем уроке: инструменты → ИИ; потом не возвращается", async () => {
    h.pathname = "/lesson/ns-2";
    doneLesson();
    useApp.setState({ tips: { welcome: 1000, "lesson-first": 60_000, "after-first": 200_000, nav: 210_000 } });
    useGuideSpots.setState({ lesson: { cost: 1 } });
    addTarget("lesson-hearts");
    addTarget("lesson-tools", {}, "button");
    addTarget("lesson-ask", {}, "button");
    await start();
    expect(say()).toContain("Это инструменты");
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Это значок ИИ — тоже я");
    await click("Понятно");
    expect(tips()["lesson-icons"]).toBeGreaterThan(0);
    await wait(GUIDE_DELAY_MS + 500);
    expect(bubble()).toBeNull();
  });
});

describe("визуальное ревью: прокрутка к цели, слабые темы, чат", () => {
  it("цель низко на странице — страница прокручивается так, чтобы под ней поместились Бит с пузырём; приколотая цель — нет", async () => {
    const scrollBy = vi.fn();
    const was = window.scrollBy;
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy;
    try {
      const vh = window.innerHeight;
      // Телефон: нижняя панель (64 px) — под карточкой должно хватить места Биту с пузырём над ней.
      addTarget("nav-practice", {}, "a", { x: 90, y: vh - 64, w: 90, h: 64 });
      const card = addTarget("next-lesson", {}, "div", { x: 20, y: vh - 300, w: 300, h: 140 });
      card.appendChild(addTarget("continue", { href: "/lesson/ns-1" }));
      const header = document.createElement("header");
      header.style.position = "sticky";
      const hearts = addTarget("hdr-hearts", { href: "/shop" }, "a", { x: 200, y: 10, w: 60, h: 40 });
      header.appendChild(hearts);
      document.body.appendChild(header);
      await start();
      await click("Дальше");
      await wait(50);
      expect(say()).toContain("следующий урок");
      expect(scrollBy).toHaveBeenCalledTimes(1);
      // Низ карточки (с зазором рамки) — над Битом с пузырём над панелью: сдвиг ≈ 80 px.
      expect(scrollBy.mock.calls[0][0].top).toBeGreaterThan(50);
      await click("Дальше");
      await wait(50);
      expect(say()).toContain("Наверху: огонь");
      // Сердечки в шапке (sticky) — прокрутка их не сдвинет: страницу не трогаем.
      expect(scrollBy).toHaveBeenCalledTimes(1);
      header.remove();
    } finally {
      window.scrollBy = was;
    }
  });

  it("пока плавная прокрутка едет, Бит встаёт под целью — туда, где она окажется (не подпрыгивает над ней на миг)", async () => {
    const scrollBy = vi.fn();
    const was = window.scrollBy;
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy;
    // Страница длинная: прокрутке есть куда ехать. Мок scrollBy страницу не двигает — прокрутка «едет» всё время.
    const page = document.scrollingElement ?? document.documentElement;
    Object.defineProperty(page, "scrollHeight", { configurable: true, value: 5000 });
    Object.defineProperty(page, "clientHeight", { configurable: true, value: window.innerHeight });
    try {
      const vh = window.innerHeight;
      addTarget("nav-practice", {}, "a", { x: 90, y: vh - 64, w: 90, h: 64 });
      // Карточка во всю ширину у самого низа над панелью: где она сейчас, Биту под ней места нет — он поднялся бы над ней.
      const card = addTarget("next-lesson", {}, "div", { x: 12, y: vh - 150, w: window.innerWidth - 24, h: 60 });
      card.appendChild(addTarget("continue", { href: "/lesson/ns-1" }));
      await start();
      await click("Дальше");
      await wait(300);
      expect(say()).toContain("следующий урок");
      expect(scrollBy).toHaveBeenCalledTimes(1);
      const dy = scrollBy.mock.calls[0][0].top as number;
      expect(dy).toBeGreaterThan(50);
      // Пузырь — у низа экрана (Бит над панелью), а не над карточкой (её верх сейчас — в 150 px от низа окна).
      expect(parseFloat(bubble()!.style.bottom)).toBeLessThan(150);
      // Прокрутка так и не доехала (прервали) — дольше SETTLE_MS не ждём: мерим как есть, Бит над целью.
      await wait(1200);
      expect(parseFloat(bubble()!.style.bottom)).toBeGreaterThan(150);
    } finally {
      window.scrollBy = was;
      Reflect.deleteProperty(page, "scrollHeight");
      Reflect.deleteProperty(page, "clientHeight");
    }
  });

  it("слабые места: тем нет (нет первой строки) — «реши пару заданий»; темы есть — «нажми на тему»", async () => {
    h.pathname = "/stats";
    useApp.setState({ tips: { nav: 1 } });
    addTarget("stats-overview", {}, "div");
    const weak = addTarget("stats-weak", {}, "div");
    await start();
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Реши пару заданий");
    expect(say()).not.toContain("Нажми на тему");
    await click("Понятно");
    await wait(600); // Бит ушёл — сцена снята
    weak.remove();
    await act(async () => useApp.getState().resetTips());
    useApp.setState({ tips: { nav: 1 } });
    addTarget("stats-weak", {}, "div");
    addTarget("stats-weak-first", {}, "div");
    await wait(GUIDE_DELAY_MS + 50);
    await click("Дальше");
    await wait(50);
    expect(say()).toContain("Нажми на тему");
  });

  it("чат: рамка на «Свободном» чате; его нет — та же реплика на затемнённом экране", async () => {
    h.pathname = "/tutor";
    useApp.setState({ tips: { nav: 1 } });
    await start();
    expect(bubble()).toBeNull();
    await wait(2000);
    expect(say()).toContain("Спрашивай меня");
    expect(dims()).toHaveLength(1);
    expect(bubble()?.getAttribute("role")).toBe("dialog");
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
    addTarget("tutor-free", {}, "button");
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
    addTarget("tutor-free", {}, "button");
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

  it("тире в реплике не уезжает в начало строки: на экране перед ним неразрывный пробел, читалке — обычный текст", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, reduceMotion: true } }));
    await start();
    const visible = bubble()!.querySelector("p")!.textContent ?? "";
    expect(visible).toContain("где,\u00a0— это быстро");
    expect(bubble()!.querySelector(".sr-only")?.textContent).toContain("где, — это быстро");
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

  it("знакомство показано, но обучение не кончено (нет learn-next) — тарифы ждут", async () => {
    useApp.setState({ tips: { intro: 1, "lesson-first": 1, "after-first": 1 } });
    await act(async () => root.render(createElement(PaywallAgent)));
    await wait(10);
    expect(h.push).not.toHaveBeenCalled();
  });

  it.each([["nav", { nav: 1 }], ["learn-next", { intro: 1, "learn-next": 1 }]])("проводник пройден (%s) — тарифы открываются по расписанию", async (_, t) => {
    useApp.setState({ tips: t });
    await act(async () => root.render(createElement(PaywallAgent)));
    await wait(10);
    expect(h.push).toHaveBeenCalledWith("/plans?from=auto");
  });
});
