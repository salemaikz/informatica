// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PerfectDropTile } from "@/components/economy/PerfectDropTile";
import { OutOfHearts } from "@/components/economy/OutOfHearts";
import { Results } from "@/components/lesson/Results";
import { AiPricing, EarnList, HeartRules } from "@/components/economy/ShopInfo";
import { FREE_PLAN } from "@/lib/economy";
import { useApp } from "@/lib/store";

// Пакет P3 этапа 16В: сюрприз за идеальный урок (капсула), «Сердечки закончились» без бесплатной тренировки, правила, цены ИИ.

vi.mock("next/navigation", () => ({ usePathname: () => "/shop", useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown } & Record<string, unknown>) => createElement("a", { href, ...rest }, children as never),
}));

// Конфетти рисует на canvas — в happy-dom его нет.
vi.mock("canvas-confetti", () => ({ default: () => {} }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;

const render = (el: Parameters<Root["render"]>[0]) =>
  act(async () => {
    root.render(el);
  });
const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const text = () => host.textContent ?? "";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  useApp.getState().resetProgress();
  useApp.setState((s) => ({ plan: FREE_PLAN, profile: { ...s.profile, lang: "ru", sound: false, vibration: false, reduceMotion: false } }));
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

describe("PerfectDropTile: капсула показывает то, что выдал стор", () => {
  it("свежий результат: сначала «?», после паузы раскрывается — чипы, сердечко или «пусто»", async () => {
    await render(createElement(PerfectDropTile, { drop: { kind: "chips", amount: 3 }, animate: true, delay: 0.5 }));
    expect(text()).toContain("Сюрприз за идеальный урок");
    expect(text()).toContain("Шанс 40% — только за идеальный урок");
    expect(text()).not.toContain("+3 чипа!");
    await wait(1500);
    expect(text()).toContain("+3 чипа!");
  });

  it("сердечко и «пусто» — свои подписи", async () => {
    await render(createElement(PerfectDropTile, { drop: { kind: "heart", amount: 0.5 }, animate: false }));
    expect(text()).toContain("½ сердечка!");
    await render(createElement(PerfectDropTile, { drop: { kind: "none" }, animate: false }));
    expect(text()).toContain("В этот раз пусто — повезёт в следующий раз");
  });

  it("не свежий результат (итоги из истории) — сразу итог, без ожидания", async () => {
    await render(createElement(PerfectDropTile, { drop: { kind: "chips", amount: 3 }, animate: false, variant: "test" }));
    expect(text()).toContain("+3 чипа!");
    expect(text()).toContain("Сюрприз за идеальный тест");
    expect(text()).toContain("Шанс 40% — только за тест без ошибок");
  });

  it("«Меньше анимаций» — сразу итог", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, reduceMotion: true } }));
    await render(createElement(PerfectDropTile, { drop: { kind: "heart", amount: 0.5 }, animate: true, delay: 0.8 }));
    expect(text()).toContain("½ сердечка!");
  });

  it("на казахском: подписи на месте, чипы без склонения", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, lang: "kk" } }));
    await render(createElement(PerfectDropTile, { drop: { kind: "chips", amount: 3 }, animate: false }));
    expect(text()).toContain("Мінсіз сабақ үшін тосынсый");
    expect(text()).toContain("+3 чип!");
  });
});

describe("«Сердечки закончились»: нет бесплатной тренировки", () => {
  it("при нуле: время до следующего, покупка за чипы, «Безлимит»; ссылок на тренировку нет", async () => {
    useApp.setState({ hearts: { count: 0, updatedAt: Date.now(), day: "" } });
    await render(createElement(OutOfHearts, { layout: "screen", need: 1, onResume: () => {}, onExit: () => {} }));
    expect(text()).toContain("Сердечки закончились");
    expect(text()).toContain("За вход в урок, тренировку, тест или игру платят сердечками");
    expect(text()).toContain("Следующее сердечко через");
    expect(text()).toContain("+1 сердечко");
    expect(text()).toContain("Безлимит: уроки, тренировки, тесты и игры без сердечек");
    expect(text()).not.toMatch(/Тренировка вернёт|Тренировка — бесплатно|Бесплатно: от/);
    expect([...host.querySelectorAll("a")].some((a) => a.getAttribute("href") === "/practice")).toBe(false);
    expect([...host.querySelectorAll("a")].some((a) => a.getAttribute("href")?.startsWith("/plans"))).toBe(true);
  });
});

describe("магазин: правила сердечек, «Как заработать», цены ИИ", () => {
  it("«Как работают сердечки»: тренировка — в платных (1), не в бесплатных; путь при нуле", async () => {
    await render(createElement(HeartRules));
    expect(text()).toContain("Тренировка");
    expect(text()).toContain("Бесплатной тренировки нет");
    expect(text()).not.toMatch(/возвращает сердечко|вернёт сердечко/);
    // бесплатные: практикум, шпаргалка, чат — без тренировки/повторения/ошибок
    const free = host.querySelector('section[aria-labelledby="heart-rules-free"]')!;
    expect(free.textContent).toContain("Практикум кода");
    expect(free.textContent).not.toContain("Повторение");
    expect(free.textContent).not.toContain("Тренировка");
  });

  it("«Как заработать»: идеальный урок — шанс, а не +5", async () => {
    await render(createElement(EarnList));
    expect(text()).toContain("Идеальный урок или тест без ошибок");
    expect(text()).toContain("шанс 40%");
    expect(text()).toContain("½ сердечка — 20%, чипы — 20%, ничего — 60%");
    // у строки про идеальный урок нет гарантированного «+N» — только шанс
    const row = [...host.querySelectorAll("li")].find((li) => li.textContent?.includes("Идеальный урок"))!;
    expect(row.textContent).not.toContain("+");
  });

  it("цены ИИ: под каждой строкой — «что это»; 15 — разбор пробного ЕНТ", async () => {
    await render(createElement(AiPricing));
    const t = text();
    for (const line of [
      "Намёк к заданию, на котором застрял. Ответ не называет.",
      "Пошаговое объяснение задания после ответа.",
      "Любой вопрос прямо в уроке или тренировке — про текущее задание.",
      "Одно сообщение в чате с Битом — на любую тему.",
      "Бит проверит решение с фото тетради.",
      "Разбор всего пробного ЕНТ: ошибки, темы, что повторить.",
      "Короткий отзыв после урока. Бесплатно.",
    ]) {
      expect(t, line).toContain(line);
    }
    // голос — прежняя подпись про расшифровку
    expect(t).toContain("к сообщению за расшифровку");
    // у каждой из 8 строк списка есть строка-описание
    expect(host.querySelectorAll("ul > li span.block").length).toBe(8);
  });
});

describe("итоги урока: сюрприз вместо «+5 за идеальный»", () => {
  const result = {
    kind: "lesson" as const,
    lessonId: "ns-1-bits",
    title: "Урок",
    answers: [{ stepId: "a", skill: "ns.bin2dec", correct: true, score: 1, given: "1", expected: "1", prompt: "?", retry: false, timeMs: 1000 }],
    xp: 10,
    maxCombo: 1,
    durationSec: 30,
    accuracy: 1,
  };
  const props = { kind: "lesson" as const, lessonId: "ns-1-bits", title: "Урок", result, bonusXp: 20, firstPass: true, achievements: [], feedback: { status: "failed" as const } };

  it("выпали чипы: сумма сессии — без них, плитка сюрприза — отдельно; плитки «+5 за идеальный» и «Сердечко: +1» нет", async () => {
    await render(createElement(Results, { ...props, chips: 6, lessonChips: 3, perfectDrop: { kind: "chips", amount: 3 } }));
    await wait(2500);
    const t = text();
    expect(t).toContain("Сюрприз за идеальный урок");
    expect(t).toContain("+3 чипа!");
    expect(t).toContain("Урок +3"); // разбивка основной плитки: только урок (3), сюрприз в неё не входит
    expect(t).not.toContain("идеально +");
    expect(t).not.toContain("Сердечко: +1");
  });

  it("сердечко выпало — «½ сердечка!»; броска не было (повтор урока) — плитки нет", async () => {
    await render(createElement(Results, { ...props, chips: 3, lessonChips: 3, perfectDrop: { kind: "heart", amount: 0.5 } }));
    await wait(2500);
    expect(text()).toContain("½ сердечка!");
    await render(createElement(Results, { ...props, firstPass: false, chips: 1, lessonChips: 1, perfectDrop: null }));
    expect(text()).not.toContain("Сюрприз");
  });
});
