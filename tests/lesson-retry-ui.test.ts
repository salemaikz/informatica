// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LessonScreen } from "@/app/lesson/[id]/LessonScreen";
import { Results } from "@/components/lesson/Results";
import { LESSONS } from "@/content/course";
import { FREE_PLAN, heartsView } from "@/lib/economy";
import { checkEntryKey, lessonEntryKey } from "@/lib/entry-paid";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import type { QuestionStep } from "@/lib/types";

// «Пройти урок заново» на итогах незасчитанного урока (#122): новый платный вход в том же режиме, плеер монтируется
// заново; сердечек нет — окно «Сердечки закончились» поверх итогов, урок не перезапускается.
// Плеер заменён заглушкой: здесь проверяется проводка экрана урока (оплата, ключ плеера, режим).

const h = vi.hoisted(() => ({ mounts: 0, props: [] as { via?: string; prepaid?: number; paidAt?: number | null; resume?: unknown }[] }));
vi.mock("next/navigation", () => ({ usePathname: () => "/lesson", useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }) }));
vi.mock("next/link", async () => {
  const { createElement: ce } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: unknown } & Record<string, unknown>) => ce("a", { href, ...rest }, children as never) };
});
vi.mock("canvas-confetti", () => ({ default: () => {} }));
vi.mock("@/components/lesson/LessonPlayer", () => ({
  LessonPlayer: (p: { via?: string; prepaid?: number; paidAt?: number | null; resume?: unknown; onRetry?: () => void }) => {
    const [mount] = useState(() => ++h.mounts);
    h.props.push({ via: p.via, prepaid: p.prepaid, paidAt: p.paidAt, resume: p.resume });
    return createElement("button", { "data-retry": "", "data-mount": mount, onClick: p.onRetry }, "retry");
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
const render = (el: Parameters<Root["render"]>[0]) =>
  act(async () => {
    root.render(el);
  });
const hearts = () => heartsView(useApp.getState().hearts, "free", Date.now(), todayKey()).count;
const setHearts = (count: number) => useApp.setState({ hearts: { count, updatedAt: Date.now(), day: todayKey() } });
const retry = () => host.querySelector<HTMLButtonElement>("[data-retry]")!;
const mountId = () => Number(retry().dataset.mount);

const lesson = LESSONS["ns-1-bits"];
const check = lesson.steps.filter((s) => s.type !== "theory" && s.type !== "video" && s.type !== "story" && s.type !== "worked" && s.type !== "explore").slice(0, 3) as QuestionStep[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
  useApp.getState().resetProgress();
  useApp.setState((s) => ({ plan: FREE_PLAN, profile: { ...s.profile, lang: "ru", sound: false, vibration: false } }));
  setHearts(5);
  h.mounts = 0;
  h.props.length = 0;
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

describe("«Пройти урок заново» с итогов", () => {
  it("«Учиться»: новый платный вход (даже в течение 20 минут), плеер монтируется заново с первого шага", async () => {
    await render(createElement(LessonScreen, { lesson, mode: "learn", check: [] }));
    expect(hearts()).toBe(4);
    const first = mountId();
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => retry().click());
    expect(hearts()).toBe(3);
    expect(useApp.getState().entryPaid[lessonEntryKey(lesson.id)]).toBe(Date.now());
    expect(mountId()).not.toBe(first);
    const last = h.props[h.props.length - 1];
    expect(last).toMatchObject({ prepaid: 1, paidAt: Date.now() });
    expect(last.via).toBeUndefined();
    expect(last.resume).toBeUndefined();
  });

  it("«Проверить себя»: режим сохраняется, платит ключ режима", async () => {
    await render(createElement(LessonScreen, { lesson, mode: "check", check }));
    expect(hearts()).toBe(4);
    const first = mountId();
    await act(async () => retry().click());
    expect(hearts()).toBe(3);
    expect(useApp.getState().entryPaid[checkEntryKey(lesson.id)]).toBe(Date.now());
    expect(mountId()).not.toBe(first);
    expect(h.props[h.props.length - 1].via).toBe("check");
  });

  it("сердечек нет — окно «Сердечки закончились», плеер не перезапускается", async () => {
    await render(createElement(LessonScreen, { lesson, mode: "learn", check: [] }));
    const first = mountId();
    setHearts(0);
    await act(async () => retry().click());
    expect(document.body.textContent).toContain("Сердечки закончились");
    expect(mountId()).toBe(first);
    expect(hearts()).toBe(0);
  });
});

describe("итоги: кнопка «Пройти урок заново»", () => {
  const result = {
    kind: "lesson" as const,
    lessonId: lesson.id,
    title: "Урок",
    answers: [],
    xp: 0,
    maxCombo: 0,
    durationSec: 30,
    accuracy: 0,
  };
  const props = { kind: "lesson" as const, lessonId: lesson.id, title: "Урок", result, bonusXp: 0, achievements: [], feedback: { status: "failed" as const } };

  it("урок не засчитан — кнопка (не ссылка на тот же адрес) вызывает повтор экрана урока", async () => {
    const onRetry = vi.fn();
    await render(createElement(Results, { ...props, counted: false, onRetry }));
    const btn = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Пройти урок заново"));
    expect(btn).toBeDefined();
    expect([...host.querySelectorAll("a")].some((a) => a.textContent?.includes("Пройти урок заново"))).toBe(false);
    await act(async () => btn!.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("урок засчитан — кнопки повтора нет", async () => {
    await render(createElement(Results, { ...props, counted: true, onRetry: () => {} }));
    expect(host.textContent).not.toContain("Пройти урок заново");
  });
});
