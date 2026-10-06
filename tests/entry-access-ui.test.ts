// @vitest-environment happy-dom
import { StrictMode, act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrillScreen } from "@/app/drill/DrillScreen";
import { LessonScreen } from "@/app/lesson/[id]/LessonScreen";
import { LESSONS } from "@/content/course";
import { drillPaidKey } from "@/lib/drill-paid";
import { FREE_PLAN, heartsView } from "@/lib/economy";
import { lessonEntryKey } from "@/lib/entry-paid";
import { buildRun, freshQueue } from "@/components/lesson/run-snapshot";
import { RUN_GRACE_MS } from "@/lib/lesson-run";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";

// Этап 16Г, #120: сердечко списывается при открытии урока и тренировки (useEntryAccess), один раз за вход:
// двойной вызов эффекта (StrictMode) и повторный вход в течение 20 минут не списывают второй раз.

const h = vi.hoisted(() => ({ events: [] as { e: string; where?: string }[] }));
vi.mock("next/navigation", () => ({ usePathname: () => "/lesson", useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }) }));
vi.mock("next/link", async () => {
  const { createElement: ce } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: unknown } & Record<string, unknown>) => ce("a", { href, ...rest }, children as never) };
});
vi.mock("canvas-confetti", () => ({ default: () => {} }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  track: (ev: { e: string; where?: string }) => h.events.push(ev),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
const render = (el: Parameters<Root["render"]>[0]) =>
  act(async () => {
    root.render(el);
  });
const remount = async (el: Parameters<Root["render"]>[0]) => {
  await act(async () => root.unmount());
  root = createRoot(host);
  await render(el);
};
const text = () => host.textContent ?? "";
const hearts = () => heartsView(useApp.getState().hearts, "free", Date.now(), todayKey()).count;
const setHearts = (count: number) => useApp.setState({ hearts: { count, updatedAt: Date.now(), day: todayKey() } });

const SKILL = "ns.bin2dec";
const lesson = LESSONS["ns-1-bits"];
const lessonEl = () => createElement(LessonScreen, { lesson, mode: "learn", check: [] });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
  useApp.getState().resetProgress();
  useApp.setState((s) => ({ plan: FREE_PLAN, profile: { ...s.profile, lang: "ru", sound: false, vibration: false } }));
  setHearts(5);
  h.events.length = 0;
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

describe("тренировка: сердечко при открытии", () => {
  it("открыли — сразу −1 и отметка входа; повторный вход в течение 20 минут бесплатный", async () => {
    await render(createElement(DrillScreen, { mode: "skill", skill: SKILL }));
    expect(hearts()).toBe(4);
    expect(useApp.getState().entryPaid[drillPaidKey("skill", { skill: SKILL })]).toBe(Date.now());
    expect(text()).not.toContain("Сердечки закончились");
    vi.setSystemTime(Date.now() + 10 * 60_000);
    await remount(createElement(DrillScreen, { mode: "skill", skill: SKILL }));
    expect(hearts()).toBe(4);
  });

  it("StrictMode (двойной эффект) — списано одно сердечко", async () => {
    await render(createElement(StrictMode, null, createElement(DrillScreen, { mode: "skill", skill: SKILL })));
    expect(hearts()).toBe(4);
  });

  it("сердечек нет — «Сердечки закончились» и одно событие hearts_out", async () => {
    setHearts(0);
    await render(createElement(DrillScreen, { mode: "skill", skill: SKILL }));
    expect(text()).toContain("Сердечки закончились");
    expect(h.events.filter((e) => e.e === "hearts_out")).toEqual([{ e: "hearts_out", where: "drill" }]);
  });
});

describe("урок: сердечко при открытии", () => {
  it("свежий вход — сразу −1, плеер на экране; повторный вход в течение 20 минут бесплатный", async () => {
    await render(lessonEl());
    expect(hearts()).toBe(4);
    expect(useApp.getState().entryPaid[lessonEntryKey(lesson.id)]).toBe(Date.now());
    expect(host.querySelector('[data-tour="lesson-hearts"]')).not.toBeNull();
    vi.setSystemTime(Date.now() + 5 * 60_000);
    await remount(lessonEl());
    expect(hearts()).toBe(4);
  });

  it("StrictMode — одно сердечко", async () => {
    await render(createElement(StrictMode, null, lessonEl()));
    expect(hearts()).toBe(4);
  });

  it("сердечек нет — «Сердечки закончились» вместо урока, hearts_out «lesson» один раз", async () => {
    setHearts(0);
    await render(lessonEl());
    expect(text()).toContain("Сердечки закончились");
    expect(host.querySelector('[data-tour="lesson-hearts"]')).toBeNull();
    expect(h.events.filter((e) => e.e === "hearts_out")).toEqual([{ e: "hearts_out", where: "lesson" }]);
  });

  it("оплаченное, но нетронутое прохождение (шаг 0) — продолжаем молча, без экрана выбора и без платы", async () => {
    const now = Date.now();
    const run = buildRun({
      lessonId: lesson.id,
      steps: lesson.steps,
      queue: freshQueue(lesson.steps),
      pos: 0,
      done: 0,
      records: [],
      xp: 0,
      combo: 0,
      maxCombo: 0,
      skipped: 0,
      activeMs: 0,
      xpFactor: 1,
      chipsEarned: 0,
      cost: 1,
      startedAt: now - 60_000,
      paidAt: now - 60_000,
      now: now - 60_000,
    });
    useApp.getState().saveLessonRun(run);
    await render(lessonEl());
    expect(text()).not.toContain("Урок не закончен");
    expect(host.querySelector('[data-tour="lesson-hearts"]')).not.toBeNull();
    expect(hearts()).toBe(5);
  });
});

describe("урок: экран «Урок не закончен»", () => {
  const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(label))!;
  // Сохранение с пройденным шагом; ago — сколько минут назад было последнее действие (оно же оплата).
  const saveRun = (ago: number) => {
    const at = Date.now() - ago * 60_000;
    const run = buildRun({
      lessonId: lesson.id,
      steps: lesson.steps,
      queue: freshQueue(lesson.steps),
      pos: 1,
      done: 1,
      records: [],
      xp: 0,
      combo: 0,
      maxCombo: 0,
      skipped: 0,
      activeMs: 0,
      xpFactor: 1,
      chipsEarned: 0,
      cost: 1,
      startedAt: at,
      paidAt: at,
      now: at,
    });
    useApp.getState().saveLessonRun(run);
  };

  it("«Продолжить» в течение 20 минут — бесплатно", async () => {
    saveRun(5);
    await render(lessonEl());
    expect(text()).toContain("Урок не закончен");
    expect(hearts()).toBe(5);
    await act(async () => button("Продолжить").click());
    expect(host.querySelector('[data-tour="lesson-hearts"]')).not.toBeNull();
    expect(hearts()).toBe(5);
  });

  it("«Продолжить» после 20 минут — сердечко списывается по нажатию, не при открытии экрана", async () => {
    saveRun(RUN_GRACE_MS / 60_000 + 10);
    await render(lessonEl());
    expect(text()).toContain("Урок не закончен");
    expect(hearts()).toBe(5);
    await act(async () => button("Продолжить").click());
    expect(hearts()).toBe(4);
    expect(host.querySelector('[data-tour="lesson-hearts"]')).not.toBeNull();
  });

  it("«Начать заново» — новый платный вход, даже если прошлый оплачен минуту назад", async () => {
    saveRun(1);
    useApp.getState().payEntryOnce(lessonEntryKey(lesson.id), 1);
    expect(hearts()).toBe(4);
    await render(lessonEl());
    await act(async () => button("Начать заново").click());
    expect(hearts()).toBe(3);
    expect(useApp.getState().entryPaid[lessonEntryKey(lesson.id)]).toBe(Date.now());
    expect(host.querySelector('[data-tour="lesson-hearts"]')).not.toBeNull();
  });

  it("сердечек нет: «Начать заново» — окно «Сердечки закончились», урок не начинается", async () => {
    saveRun(1);
    setHearts(0);
    await render(lessonEl());
    await act(async () => button("Начать заново").click());
    expect(document.body.textContent).toContain("Сердечки закончились");
    expect(host.querySelector('[data-tour="lesson-hearts"]')).toBeNull();
    expect(useApp.getState().lessonRuns[lesson.id]).toBeDefined();
  });
});

describe("урок: выход — «вернуться в течение 20 минут бесплатно» отсчитывается от выхода", () => {
  const quit = async () => {
    await act(async () => host.querySelector<HTMLButtonElement>('header button[aria-label="Выйти"]')!.click());
    const exit = [...document.body.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((b) => b.textContent?.trim() === "Выйти")!;
    expect(document.body.textContent).toContain("Вернуться в течение");
    await act(async () => exit.click());
  };

  it("на первом шаге 25 минут, потом выход — сохранение с шага 0 и временем выхода; возврат через 10 минут бесплатный", async () => {
    await render(lessonEl());
    expect(hearts()).toBe(4);
    expect(useApp.getState().lessonRuns[lesson.id]).toBeUndefined();
    vi.setSystemTime(Date.now() + 25 * 60_000);
    await quit();
    const run = useApp.getState().lessonRuns[lesson.id];
    expect(run).toMatchObject({ pos: 0, updatedAt: Date.now() });
    expect(run.paidAt).not.toBeNull();
    vi.setSystemTime(Date.now() + 10 * 60_000);
    await remount(lessonEl());
    expect(text()).not.toContain("Урок не закончен");
    expect(host.querySelector('[data-tour="lesson-hearts"]')).not.toBeNull();
    expect(hearts()).toBe(4);
  });

  it("есть сохранение — выход обновляет его время, шаг тот же; «Продолжить» через 10 минут бесплатно", async () => {
    const at = Date.now();
    useApp.getState().saveLessonRun(
      buildRun({
        lessonId: lesson.id,
        steps: lesson.steps,
        queue: freshQueue(lesson.steps),
        pos: 1,
        done: 1,
        records: [],
        xp: 0,
        combo: 0,
        maxCombo: 0,
        skipped: 0,
        activeMs: 0,
        xpFactor: 1,
        chipsEarned: 0,
        cost: 1,
        startedAt: at,
        paidAt: at,
        now: at,
      }),
    );
    await render(lessonEl());
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith("Продолжить"))!.click());
    expect(hearts()).toBe(5);
    vi.setSystemTime(Date.now() + 25 * 60_000);
    await quit();
    expect(useApp.getState().lessonRuns[lesson.id]).toMatchObject({ pos: 1, updatedAt: Date.now(), paidAt: at });
    vi.setSystemTime(Date.now() + 10 * 60_000);
    await remount(lessonEl());
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith("Продолжить"))!.click());
    expect(hearts()).toBe(5);
  });
});

describe("«Дай задачи» в чате: сердечко при выборе числа заданий", () => {
  const quizButton = (n: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(n));

  it("до выбора — бесплатно; выбор числа — −1; двойное нажатие — одно сердечко", async () => {
    const { ChatQuiz } = await import("@/components/chat/quiz/ChatQuiz");
    await render(createElement(ChatQuiz, { onDone: () => {} }));
    expect(hearts()).toBe(5);
    const five = quizButton("5")!;
    await act(async () => {
      five.click();
      five.click();
    });
    expect(hearts()).toBe(4);
    expect(text()).toContain("Проверить");
  });

  it("сердечек нет — шторка «Сердечки закончились», задания не начинаются, hearts_out «drill»", async () => {
    setHearts(0);
    const { ChatQuiz } = await import("@/components/chat/quiz/ChatQuiz");
    await render(createElement(ChatQuiz, { onDone: () => {} }));
    await act(async () => quizButton("5")!.click());
    expect(document.body.textContent).toContain("Сердечки закончились");
    expect(text()).not.toContain("Проверить");
    expect(h.events.filter((e) => e.e === "hearts_out")).toEqual([{ e: "hearts_out", where: "drill" }]);
  });
});
