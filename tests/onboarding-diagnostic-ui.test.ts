// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { setAnalyticsSink, type AnalyticsEvent } from "@/lib/analytics";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import OnboardingPage from "@/app/onboarding/page";
import { DiagnosticScreen, basicsPatch } from "@/components/diagnostic/DiagnosticScreen";
import { safeNext } from "@/components/plans/PlansScreen";

// Короткий онбординг и экран диагностики (#70) в DOM: роутер подменён, e2e эти же потоки проходит в браузере.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => "/",
}));

let host: HTMLElement;
let root: Root;
let events: AnalyticsEvent[];

beforeEach(() => {
  useApp.getState().resetProgress();
  nav.replace.mockClear();
  nav.search = "";
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
});

const render = (node: Parameters<Root["render"]>[0]) =>
  act(async () => {
    root.render(node);
  });
const buttons = () => [...host.querySelectorAll("button")];
const button = (text: string) => buttons().find((b) => b.textContent?.includes(text));
const click = async (text: string) => {
  const b = button(text);
  expect(b, `кнопка «${text}»`).toBeTruthy();
  await act(async () => b!.click());
};
const progressLabel = () => host.querySelector('[role="progressbar"]')?.getAttribute("aria-label");

async function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Язык и имя — первые два экрана. */
async function langAndName() {
  await render(createElement(OnboardingPage));
  await click("Русский");
  await typeInto(host.querySelector("input")!, "Аня");
  await click("Продолжить");
}

describe("онбординг: ЕНТ", () => {
  it("«Пока не знаю» у даты и цели: профиль без даты и цели, дальше — диагностика", async () => {
    await langAndName();
    await click("Готовлюсь к ЕНТ");
    expect(host.textContent).toContain("Когда у тебя ЕНТ?");
    await click("Пока не знаю"); // дата: пропуск сразу ведёт дальше
    expect(host.textContent).toContain("Сколько баллов хочешь набрать?");
    // «Поехали» закрыто, пока не выбрана цель или «Пока не знаю»
    expect(button("Поехали")!.disabled).toBe(true);
    await click("Пока не знаю");
    expect(button("Поехали")!.disabled).toBe(false);
    await click("Поехали");

    const s = useApp.getState();
    expect(s.onboarded).toBe(true);
    expect(s.profile).toMatchObject({ name: "Аня", track: "ent", goal: "ent", grade: "11", examDate: null, targetScoreSet: false });
    expect(s.profile.createdAt).toBeGreaterThan(0);
    expect(nav.replace).toHaveBeenCalledWith("/diagnostic?from=onboarding");
    // окно тарифов — после диагностики, а не сейчас
    expect(s.paywall.views).toBe(0);
    // события: пройденные шаги и конец (без введённых данных)
    expect(events).toEqual([
      { e: "onb_step", step: "lang" },
      { e: "onb_step", step: "name" },
      { e: "onb_step", step: "track" },
      { e: "onb_step", step: "date" },
      { e: "onb_done", track: "ent" },
    ]);
  });

  it("дата и цель выбраны — сохраняются; шагов пять", async () => {
    await langAndName();
    await click("Готовлюсь к ЕНТ");
    expect(progressLabel()).toBe("Шаг 4 из 5");
    const date = todayKey(new Date(Date.now() + 120 * 86_400_000));
    // прошедшая дата не годится
    await typeInto(host.querySelector('input[type="date"]') as HTMLInputElement, "2020-01-01");
    expect(button("Продолжить")!.disabled).toBe(true);
    expect(host.textContent).toContain("Выбери сегодняшнюю дату или позже");
    await typeInto(host.querySelector('input[type="date"]') as HTMLInputElement, date);
    expect(button("Продолжить")!.disabled).toBe(false);
    await click("Продолжить");
    expect(progressLabel()).toBe("Шаг 5 из 5");
    await click("40");
    await click("Поехали");
    expect(useApp.getState().profile).toMatchObject({ examDate: date, targetScore: 40, targetScoreSet: true });
    expect(nav.replace).toHaveBeenCalledWith("/diagnostic?from=onboarding");
  });

  it("убраны шаги «класс», «стиль», «дневная цель», «С чего начнём?»: значения по умолчанию", async () => {
    await langAndName();
    await click("Готовлюсь к ЕНТ");
    await click("Пока не знаю");
    await click("Пока не знаю");
    await click("Поехали");
    const p = useApp.getState().profile;
    expect(p).toMatchObject({ style: "examples", dailyGoalXp: 50, skipBasics: false, grade: "11" });
  });
});

describe("онбординг: школа", () => {
  it("четыре экрана, класс обязателен, диагностики нет — сразу окно тарифов", async () => {
    await langAndName();
    await click("Изучаю школьную программу");
    expect(progressLabel()).toBe("Шаг 4 из 4");
    expect(button("Поехали")!.disabled).toBe(true);
    await act(async () => (host.querySelector('[aria-label="8 класс"]') as HTMLButtonElement).click());
    expect(button("Поехали")!.disabled).toBe(false);
    await click("Поехали");

    const s = useApp.getState();
    expect(s.onboarded).toBe(true);
    expect(s.profile).toMatchObject({ track: "school", goal: "school", grade: "8", examDate: null, targetScoreSet: false });
    expect(nav.replace).toHaveBeenCalledWith("/plans?from=onboarding");
    expect(nav.replace).not.toHaveBeenCalledWith(expect.stringContaining("/diagnostic"));
    expect(s.paywall.views).toBe(1);
    expect(events.at(-1)).toEqual({ e: "onb_done", track: "school" });
  });

  it("передумал: вернулся и выбрал ЕНТ — шагов снова пять, класс 11", async () => {
    await langAndName();
    await click("Изучаю школьную программу");
    expect(progressLabel()).toBe("Шаг 4 из 4");
    await act(async () => (host.querySelector('[aria-label="Назад"]') as HTMLButtonElement).click());
    await click("Готовлюсь к ЕНТ");
    expect(progressLabel()).toBe("Шаг 4 из 5");
    expect(useApp.getState().profile).toMatchObject({ track: "ent", grade: "11" });
  });
});

/** Ждём, пока выполнится условие (динамический импорт банка и курса). */
async function waitFor(cond: () => boolean, ms = 30_000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("не дождались");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
  }
}

/** Проходит 10 заданий: чётные — «Не знаю», нечётные — первый вариант и «Дальше»/«Показать итог». */
async function answerAll() {
  await waitFor(() => !!button("Начать") && !button("Начать")!.disabled);
  await click("Начать");
  for (let n = 1; n <= 10; n++) {
    expect(host.textContent).toContain(`${n} из 10`);
    if (n % 2 === 0) await click("Не знаю");
    else {
      await act(async () => (host.querySelector("article button[aria-pressed]") as HTMLButtonElement).click());
      await click(n === 10 ? "Показать итог" : "Дальше");
    }
  }
}

describe("окно тарифов: адрес «дальше» (C35)", () => {
  it("safeNext: только путь внутри приложения", () => {
    expect(safeNext("/lesson/ns-1-binary")).toBe("/lesson/ns-1-binary");
    expect(safeNext("/drill?mode=topic&topic=t04")).toBe("/drill?mode=topic&topic=t04");
    expect(safeNext(null)).toBeNull();
    expect(safeNext("")).toBeNull();
    expect(safeNext("lesson/x")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("/" + "a".repeat(400))).toBeNull();
  });
});

describe("экран диагностики", () => {
  it("10 заданий → итог с прогнозом диапазоном и слабыми темами → тарифы; не пробник", async () => {
    nav.search = "from=onboarding";
    await render(createElement(DiagnosticScreen));
    expect(host.textContent).toContain("Короткая проверка");
    await answerAll();

    expect(host.textContent).toContain("Предварительный прогноз");
    expect(host.textContent).toMatch(/примерно \d+–\d+ из 50/);
    // минимум пять «Не знаю» — минимум три разные темы; после онбординга «Начать с неё» идёт через окно тарифов (C35)
    expect(host.querySelectorAll('a[href^="/lesson/"], a[href^="/drill"]')).toHaveLength(0);
    const links = [...host.querySelectorAll('a[href^="/plans?from=onboarding&next="]')];
    expect(links).toHaveLength(3);
    for (const a of links) {
      const next = new URLSearchParams(a.getAttribute("href")!.split("?")[1]).get("next")!;
      expect(next).toMatch(/^\/(lesson|drill)/);
      expect(safeNext(next)).toBe(next);
    }

    const s = useApp.getState();
    expect(s.profile.diagnostic).toMatchObject({ max: 10 });
    expect(s.exams).toHaveLength(0);
    expect(s.xp).toBe(0);
    expect(s.streak.current).toBe(0);
    expect(Object.keys(s.skills).length).toBeGreaterThan(0);
    expect(Object.values(s.skills).every((k) => k.mastery <= 0.45)).toBe(true);
    expect(events.at(-1)).toMatchObject({ e: "diag", done: 1 });

    await click("Дальше");
    expect(nav.replace).toHaveBeenCalledWith("/plans?from=onboarding");
    expect(useApp.getState().paywall.views).toBe(1);
  }, 60_000);

  it("«Начать с неё» после онбординга: показ тарифов отмечается один раз (даже при двойном нажатии), ссылка хранит выбранную тему (C35)", async () => {
    nav.search = "from=onboarding";
    await render(createElement(DiagnosticScreen));
    await answerAll();
    const link = host.querySelector('a[href^="/plans?from=onboarding&next="]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(useApp.getState().paywall.views).toBe(0);
    // Переход по ссылке в тесте не нужен — отменяем его, обработчик показа тарифов всё равно срабатывает.
    for (let i = 0; i < 2; i++) {
      await act(async () => {
        link.addEventListener("click", (e) => e.preventDefault(), { once: true });
        link.click();
      });
    }
    expect(useApp.getState().paywall.views).toBe(1);
    expect(useApp.getState().paywall.lastShownAt).toBeGreaterThan(0);
  }, 60_000);

  it("без from (повтор из «Цели») «Начать с неё» ведёт сразу на урок или тренировку", async () => {
    await render(createElement(DiagnosticScreen));
    await answerAll();
    expect(host.querySelectorAll('a[href^="/plans"]')).toHaveLength(0);
    expect(host.querySelectorAll('a[href^="/lesson/"], a[href^="/drill"]')).toHaveLength(3);
  }, 60_000);

  it("двойное нажатие «Дальше»: тарифы отмечаются и открываются один раз (C33)", async () => {
    nav.search = "from=onboarding";
    await render(createElement(DiagnosticScreen));
    await answerAll();
    const next = button("Дальше")!;
    await act(async () => {
      next.click();
      next.click();
    });
    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(nav.replace).toHaveBeenCalledWith("/plans?from=onboarding");
    expect(useApp.getState().paywall.views).toBe(1);
  }, 60_000);

  it("basicsPatch: диагностика только включает пропуск «Старта», никогда не выключает (C32)", () => {
    expect(basicsPatch({ basicsItems: 3, skipBasics: true })).toEqual({ skipBasics: true });
    // Основы слабые — профиль не трогаем (раньше уходило { skipBasics: false } и перебивало выбор ученика).
    expect(basicsPatch({ basicsItems: 3, skipBasics: false })).toBeUndefined();
    // Заданий по основам мало — вывода нет.
    expect(basicsPatch({ basicsItems: 2, skipBasics: true })).toBeUndefined();
    expect(basicsPatch({ basicsItems: 2, skipBasics: false })).toBeUndefined();
  });

  it("повторная диагностика не выключает «Начинать с раздела «Старт»» (C32)", async () => {
    // Ученик пропускает «Старт» в профиле; все ответы «Не знаю» → по основам нулевой результат.
    useApp.getState().updateProfile({ skipBasics: true });
    await render(createElement(DiagnosticScreen));
    await waitFor(() => !!button("Начать") && !button("Начать")!.disabled);
    await click("Начать");
    for (let n = 1; n <= 10; n++) await click("Не знаю");
    expect(host.textContent).toContain("Предварительный прогноз");
    expect(useApp.getState().profile.diagnostic).toMatchObject({ max: 10 });
    expect(useApp.getState().profile.skipBasics).toBe(true);
    expect(host.textContent).not.toContain("можно пропустить");
  }, 60_000);

  it("без from (повтор из «Цели») итог ведёт на главную, окно тарифов не отмечается", async () => {
    await render(createElement(DiagnosticScreen));
    await answerAll();
    await click("Дальше");
    expect(nav.replace).toHaveBeenCalledWith("/learn");
    expect(useApp.getState().paywall.views).toBe(0);
  }, 60_000);

  it("«Пропустить» на вступлении: в профиль ничего, событие done 0, дальше — тарифы", async () => {
    nav.search = "from=onboarding";
    await render(createElement(DiagnosticScreen));
    await click("Пропустить");
    expect(useApp.getState().profile.diagnostic).toBeNull();
    expect(events).toEqual([{ e: "diag", done: 0, pct: 0 }]);
    expect(nav.replace).toHaveBeenCalledWith("/plans?from=onboarding");
    expect(useApp.getState().paywall.views).toBe(1);
  });

  it("«Пропустить диагностику» посреди заданий — видна всегда, ничего не записывается", async () => {
    nav.search = "from=onboarding";
    await render(createElement(DiagnosticScreen));
    await waitFor(() => !!button("Начать") && !button("Начать")!.disabled);
    await click("Начать");
    expect(host.textContent).toContain("1 из 10");
    await act(async () => (host.querySelector("article button[aria-pressed]") as HTMLButtonElement).click());
    await click("Пропустить диагностику");
    expect(useApp.getState().profile.diagnostic).toBeNull();
    expect(Object.keys(useApp.getState().skills)).toHaveLength(0);
    expect(nav.replace).toHaveBeenCalledWith("/plans?from=onboarding");
  }, 60_000);

  it("«Дальше» закрыто, пока нет ответа; «Не знаю» идёт дальше без ответа", async () => {
    await render(createElement(DiagnosticScreen));
    await waitFor(() => !!button("Начать") && !button("Начать")!.disabled);
    await click("Начать");
    expect(button("Дальше")!.disabled).toBe(true);
    await click("Не знаю");
    expect(host.textContent).toContain("2 из 10");
  }, 60_000);
});
