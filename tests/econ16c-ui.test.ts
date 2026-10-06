// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AchievementsSection } from "@/components/profile/AchievementsSection";
import { ContextHub } from "@/components/ide/ContextHub";
import { ExamResult } from "@/components/exam/ExamResult";
import { dropRandom } from "@/lib/perfect";
import { feedback } from "@/lib/feedback";
import { translate } from "@/i18n/useT";
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

// Звуки: проверяем, какие отклики играет капсула сюрприза (E9).
vi.mock("@/lib/feedback", () => ({ feedback: vi.fn() }));

// Итоги теста читают попытку из IndexedDB; в тесте нужна только запись о попытке в сторе («только итог»).
vi.mock("@/lib/exam-store", async (orig) => ({ ...(await orig<typeof import("@/lib/exam-store")>()), loadAttempt: vi.fn(async () => null) }));

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

describe("PerfectDropTile: звуки и отметка «показана» (E5, E9)", () => {
  const played = () => vi.mocked(feedback).mock.calls.map((c) => c[0]);
  beforeEach(() => vi.mocked(feedback).mockClear());

  it("чипы: звук chips (один, вместе с полётом), без pop; отметка «показана» один раз после раскрытия", async () => {
    const onSeen = vi.fn();
    await render(createElement(PerfectDropTile, { drop: { kind: "chips", amount: 3 }, animate: true, delay: 0.5, onSeen }));
    expect(onSeen).not.toHaveBeenCalled(); // пока «?» — не показано
    await wait(1500);
    expect(text()).toContain("+3 чипа!");
    await wait(1500);
    expect(played()).toEqual(["chips"]);
    expect(onSeen).toHaveBeenCalledTimes(1);
  });

  it("пол-сердечка: звук pop", async () => {
    const onSeen = vi.fn();
    await render(createElement(PerfectDropTile, { drop: { kind: "heart", amount: 0.5 }, animate: true, delay: 0.2, onSeen }));
    await wait(2000);
    expect(played()).toEqual(["pop"]);
    expect(onSeen).toHaveBeenCalledTimes(1);
  });

  it("«пусто»: без звука, но отметка «показана» ставится", async () => {
    const onSeen = vi.fn();
    await render(createElement(PerfectDropTile, { drop: { kind: "none" }, animate: true, delay: 0.2, onSeen }));
    await wait(2000);
    expect(text()).toContain("В этот раз пусто");
    expect(played()).toEqual([]);
    expect(onSeen).toHaveBeenCalledTimes(1);
  });

  it("уже показанная капсула (animate=false): сразу итог, без звука и без повторной отметки", async () => {
    const onSeen = vi.fn();
    await render(createElement(PerfectDropTile, { drop: { kind: "chips", amount: 3 }, animate: false, variant: "test", onSeen }));
    await wait(3000);
    expect(text()).toContain("+3 чипа!");
    expect(played()).toEqual([]);
    expect(onSeen).not.toHaveBeenCalled();
  });

  it("«Меньше анимаций»: сразу итог, звук и отметка всё равно один раз", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, reduceMotion: true } }));
    const onSeen = vi.fn();
    await render(createElement(PerfectDropTile, { drop: { kind: "heart", amount: 0.5 }, animate: true, onSeen }));
    expect(text()).toContain("½ сердечка!");
    await wait(500);
    expect(played()).toEqual(["pop"]);
    expect(onSeen).toHaveBeenCalledTimes(1);
  });
});

describe("итоги теста: сюрприз из истории не разыгрывается заново (E5)", () => {
  beforeEach(() => {
    vi.mocked(feedback).mockClear();
    vi.spyOn(dropRandom, "next").mockReturnValue(0.3);
    useApp.setState((s) => ({ profile: { ...s.profile, dailyGoalXp: 0 } }));
    useApp.getState().recordExam(
      { id: "t1", kind: "topic", seed: 1, at: Date.now(), points: 10, maxPoints: 10, durationSec: 60, byTopic: {} },
      { "ns.bin2dec": [1, 1] },
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("первый показ: «?», затем капсула раскрывается со звуком, стор помечает её показанной", async () => {
    expect(useApp.getState().exams[0].dropSeen).toBeUndefined();
    await render(createElement(ExamResult, { id: "t1" }));
    expect(text()).toContain("Сюрприз за идеальный тест");
    expect(text()).not.toContain("+3 чипа!");
    await wait(3000);
    expect(text()).toContain("+3 чипа!");
    expect(vi.mocked(feedback).mock.calls.map((c) => c[0])).toContain("chips");
    expect(useApp.getState().exams[0].dropSeen).toBe(true);
  });

  it("повторное открытие итогов (хоть через минуту, хоть через день): сразу итог, без звука и анимации", async () => {
    useApp.getState().markDropSeen("t1");
    await render(createElement(ExamResult, { id: "t1" }));
    expect(text()).toContain("+3 чипа!"); // сразу, без ожидания
    await wait(3000);
    expect(vi.mocked(feedback).mock.calls.map((c) => c[0])).toEqual([]);
  });

  it("давность значения не имеет: отметка, а не время, решает, играть ли капсулу", async () => {
    useApp.setState((s) => ({ exams: s.exams.map((e) => ({ ...e, at: Date.now() - 10 * 86_400_000 })) }));
    await render(createElement(ExamResult, { id: "t1" }));
    expect(text()).not.toContain("+3 чипа!"); // ещё не показывали — снова «?»
    await wait(3000);
    expect(text()).toContain("+3 чипа!");
    expect(useApp.getState().exams[0].dropSeen).toBe(true);
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
    // бесплатные: задачи практикума в редакторе кода, шпаргалка, чат — без тренировки/повторения/ошибок
    // (контекстные задания и «Чтение кода» — тренировки на заданиях ЕНТ, они платные)
    const free = host.querySelector('section[aria-labelledby="heart-rules-free"]')!;
    expect(free.textContent).toContain("Задачи практикума в редакторе кода");
    expect(free.textContent).not.toContain("Практикум кода");
    expect(free.textContent).not.toContain("Повторение");
    expect(free.textContent).not.toContain("Тренировка");
  });

  it("«Как заработать»: идеальный урок — шанс, а не +5", async () => {
    await render(createElement(EarnList));
    expect(text()).toContain("Идеальный урок или тест без ошибок");
    expect(text()).toContain("шанс 40%");
    expect(text()).toContain("½ сердечка — 20%, чипы — 20%, ничего — 60%");
    expect(text()).toContain("тесты — не больше 3 раз в день");
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

describe("итоги урока: новое достижение показывает редкость, а не число чипов (E4)", () => {
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
  const props = { kind: "lesson" as const, lessonId: "ns-1-bits", title: "Урок", result, bonusXp: 20, firstPass: true, chips: 5, lessonChips: 3, feedback: { status: "failed" as const } };

  it("карточка достижения: название и цветная подпись редкости, без «+N чипов»", async () => {
    await render(createElement(Results, { ...props, achievements: ["lessons_10", "lessons_100"] }));
    await wait(2500);
    const cards = [...host.querySelectorAll("p")].filter((p) => p.textContent === "Новое достижение!");
    expect(cards).toHaveLength(2);
    expect(text()).toContain("Десять уроков");
    const rarity = [...host.querySelectorAll("p")].filter((p) => p.textContent === "Обычная" || p.textContent === "Легендарная");
    expect(rarity.map((p) => p.textContent)).toEqual(["Обычная", "Легендарная"]);
    expect(rarity[0].className).toContain("text-rarity-common");
    expect(rarity[1].className).toContain("text-rarity-legendary");
    // число чипов у карточки достижения не показываем: оно зависит от множителя и могло не совпасть с выданным
    for (const card of cards) expect(card.parentElement?.parentElement?.textContent).not.toMatch(/\+\d+ чип/);
  });
});

describe("«Контекстные задания»: вход — тренировка за сердечко (E3)", () => {
  it("внизу списка — пояснение и значок цены 1 сердечко (как у «Чтения кода»)", async () => {
    await render(createElement(ContextHub));
    expect(text()).toContain("Каждое задание открывается как тренировка:");
    const cost = host.querySelector('[role="img"][aria-label="Цена входа в сердечках: 1"]');
    expect(cost).not.toBeNull();
  });

  it("у «Безлимита» вход бесплатный — значка цены нет", async () => {
    useApp.getState().startTrial();
    await render(createElement(ContextHub));
    expect(host.querySelector('[role="img"][aria-label^="Цена входа"]')).toBeNull();
  });
});

describe("профиль: достижения (E10–E12)", () => {
  it("сводка: у каждой из четырёх мини-полосок подпись — точка, название редкости и «N из M»", async () => {
    useApp.setState({ achievements: { first_lesson: 1, level_20: 2 } });
    await render(createElement(AchievementsSection));
    const summary = host.querySelector("div.grid")!;
    const cells = [...summary.children];
    expect(cells).toHaveLength(4);
    expect(cells.map((c) => c.querySelector("span.truncate")?.textContent)).toEqual(["Легендарные", "Эпические", "Редкие", "Обычные"]);
    for (const cell of cells) {
      expect(cell.querySelector('[role="progressbar"]')).not.toBeNull();
      expect(cell.textContent).toMatch(/\d+ из \d+/);
      expect(cell.querySelector("span[aria-hidden].rounded-full")).not.toBeNull();
    }
    // полоски — в цвете своей редкости (токены), а не одним цветом
    const colors = cells.map((c) => (c.querySelector('[role="progressbar"] > div') as HTMLElement).style.background);
    expect(new Set(colors).size).toBe(4);
    // легендарное «level_20» получено: 1 из N в первой ячейке
    expect(cells[0].textContent).toMatch(/1 из \d+/);
  });

  it("на казахском подписи сводки на месте", async () => {
    useApp.setState((s) => ({ profile: { ...s.profile, lang: "kk" } }));
    await render(createElement(AchievementsSection));
    const summary = host.querySelector("div.grid")!;
    expect([...summary.children].map((c) => c.querySelector("span.truncate")?.textContent)).toEqual(["Аңыздық", "Эпикалық", "Сирек", "Қарапайым"]);
    expect(summary.textContent).toMatch(/\d+ \/ \d+/);
  });

  it("подзаголовок магазина упоминает украшения профиля (ru и kk)", () => {
    expect(translate("ru", "shop.subtitle")).toBe("Чипы зарабатываются в уроках — трать их на сердечки, множитель, ИИ и украшения профиля.");
    expect(translate("kk", "shop.subtitle")).toContain("профиль әшекейлеріне");
  });

  it("раздел «Достижения» стоит сразу после «Мои украшения», до тарифа, программы и настроек", () => {
    const src = readFileSync("src/app/(main)/profile/page.tsx", "utf-8");
    const at = (needle: string) => src.indexOf(needle);
    expect(at("<MyCosmetics />")).toBeGreaterThan(0);
    expect(at("<AchievementsSection />")).toBeGreaterThan(at("<MyCosmetics />"));
    for (const later of ["<PlanStatusCard />", "<TrackSettings />", 'id="goals"', "<ReminderSettings />", 'data-tour="profile-settings"']) {
      expect(at(later), later).toBeGreaterThan(at("<AchievementsSection />"));
    }
    expect(src.match(/<AchievementsSection \/>/g)).toHaveLength(1);
  });
});
