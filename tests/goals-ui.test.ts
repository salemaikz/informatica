// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ENT_TOPICS, topicWeight } from "@/content/ent-topics";
import ProfilePage from "@/app/(main)/profile/page";
import { GoalsPanel } from "@/components/goals/GoalsPanel";
import { useApp, type DiagnosticSummary, type ExamSummary } from "@/lib/store";
import type { EntTopicId } from "@/lib/types";

// Панель «Цели» и блок цели в профиле (этап 12, исправления по ревью): план недели по диагностике (C29, C37),
// график пробников без выбранной цели (C30), «Цель пока не выбрана» в профиле (C39).

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {} }),
  usePathname: () => "/profile",
  useSearchParams: () => new URLSearchParams(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;

const render = (node: ReactNode) =>
  act(async () => {
    root.render(node);
  });
const text = () => host.textContent ?? "";
const setProfile = (p: Partial<ReturnType<typeof useApp.getState>["profile"]>) => act(() => useApp.getState().updateProfile(p));

beforeEach(() => {
  useApp.getState().resetProgress();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useApp.getState().resetProgress();
});

/** Диагностика, где по каждой из перечисленных тем был один вопрос; верно — первые `right` из них. */
function diag(topics: EntTopicId[], right = topics.length): DiagnosticSummary {
  return {
    at: Date.now(),
    points: Math.min(right, topics.length),
    max: topics.length,
    byTopic: Object.fromEntries(topics.map((t, i) => [t, { points: i < right ? 1 : 0, max: 1 }])),
  };
}

const exam = (at: number, points: number, byTopic: ExamSummary["byTopic"] = {}): ExamSummary => ({
  id: `e${at}`,
  kind: "mini",
  seed: 1,
  at,
  points,
  maxPoints: 15,
  durationSec: 600,
  byTopic,
});

describe("план недели при предварительном прогнозе (C29, C37)", () => {
  const ALL = ENT_TOPICS.map((t) => t.id);

  it("10/10 по диагностике: план не пуст, «Все темы освоены» нет, у тем — «по диагностике 100%»", async () => {
    await setProfile({ diagnostic: diag(ALL) });
    await render(createElement(GoalsPanel));
    expect(text()).toContain("предварительно, по диагностике");
    expect(text()).not.toContain("Все темы освоены");
    expect(text()).toContain("по диагностике 100%");
    expect(text()).not.toContain("не проверялось");
  });

  it("тема без вопросов в диагностике — «по диагностике не проверялось», без процента и полосы", async () => {
    const lightest = [...ALL].sort((a, b) => topicWeight(a) - topicWeight(b))[0];
    await setProfile({ diagnostic: diag([lightest]) });
    await render(createElement(GoalsPanel));
    expect(text()).not.toContain("Все темы освоены");
    // В план попадают три самые весомые темы — самой лёгкой среди них нет, значит, ни одну из трёх диагностика не проверяла.
    expect(text().match(/по диагностике не проверялось/g)).toHaveLength(3);
    expect(text()).not.toMatch(/по диагностике \d+%/);
  });

  it("по реальному освоению (пробники) — «Все темы освоены» по-прежнему возможно", async () => {
    const all = Object.fromEntries(ALL.map((t) => [t, { points: 1, max: 1 }]));
    await act(async () => useApp.setState({ exams: [exam(Date.now() - 1000, 15, all)] }));
    await render(createElement(GoalsPanel));
    expect(text()).not.toContain("предварительно, по диагностике");
    expect(text()).toContain("Все темы освоены");
  });
});

describe("график пробников и цель (C30)", () => {
  const withExams = () => act(async () => useApp.setState({ exams: [exam(Date.now() - 2000, 12), exam(Date.now() - 1000, 3)] }));
  const chart = () => host.querySelector('[role="img"][aria-label^="Баллы пробных"]')!;

  it("цель не выбрана: линии цели нет, столбики одного цвета", async () => {
    await setProfile({ targetScore: 35, targetScoreSet: false });
    await withExams();
    await render(createElement(GoalsPanel));
    expect(chart()).toBeTruthy();
    expect(chart().querySelector(".border-dashed")).toBeNull();
    expect(chart().querySelector(".bg-success")).toBeNull();
    expect(chart().querySelectorAll(".bg-primary").length).toBe(2);
  });

  it("цель выбрана: пунктирная линия и зелёный столбик не ниже цели", async () => {
    await setProfile({ targetScore: 35, targetScoreSet: true });
    await withExams();
    await render(createElement(GoalsPanel));
    expect(chart().querySelector(".border-dashed")).toBeTruthy();
    // 12 из 15 → 40 из 50: выше цели 35 (зелёный); 3 из 15 → 10 из 50: ниже (primary)
    expect(chart().querySelectorAll(".bg-success")).toHaveLength(1);
    expect(chart().querySelectorAll(".bg-primary")).toHaveLength(1);
  });
});

describe("профиль: цель по баллам (C39)", () => {
  const slider = () => host.querySelector("#prof-target") as HTMLInputElement;

  it("цель не выбрана: вместо числа — «Цель пока не выбрана»; касание ползунка подтверждает цель", async () => {
    await setProfile({ track: "ent", targetScore: 35, targetScoreSet: false });
    await render(createElement(ProfilePage));
    expect(text()).toContain("Цель пока не выбрана");
    expect(text()).not.toContain("35 из 50");
    expect(slider().className).toContain("opacity-60");

    await act(async () => {
      slider().dispatchEvent(new Event("pointerup", { bubbles: true }));
    });
    expect(useApp.getState().profile.targetScoreSet).toBe(true);
    expect(useApp.getState().profile.targetScore).toBe(35);
    expect(text()).toContain("35 из 50");
    expect(text()).not.toContain("Цель пока не выбрана");
  });

  it("клавиши-стрелки подтверждают цель, а Tab на ползунок — нет", async () => {
    await setProfile({ track: "ent", targetScore: 35, targetScoreSet: false });
    await render(createElement(ProfilePage));
    await act(async () => {
      slider().dispatchEvent(new KeyboardEvent("keyup", { key: "Tab", bubbles: true }));
    });
    expect(useApp.getState().profile.targetScoreSet).toBe(false);
    await act(async () => {
      slider().dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true }));
    });
    expect(useApp.getState().profile.targetScoreSet).toBe(true);
  });

  it("цель выбрана: число показано, ползунок обычный", async () => {
    await setProfile({ track: "ent", targetScore: 40, targetScoreSet: true });
    await render(createElement(ProfilePage));
    expect(text()).toContain("40 из 50");
    expect(slider().className).not.toContain("opacity-60");
  });
});
