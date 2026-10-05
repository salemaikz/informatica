// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { UNITS } from "@/content/course";
import { GoalSummaryCard } from "@/components/goals/GoalSummaryCard";
import { PlanCard } from "@/components/plan/PlanCard";
import { buildPlan, taskHref, todayPlan, type Plan } from "@/lib/plan";
import { useApp } from "@/lib/store";

// Этап 15, F1: главная без повторов — карточка цели без кольца недели, «Сегодня» и приглашение поставить цель — в карточке плана.

// Плана без загрузки банка ЕНТ (usePlan ждёт его) — подменяем хук; план строим настоящим buildPlan по настоящему курсу.
const held = vi.hoisted(() => ({ plan: null as Plan | null, now: 0 }));
vi.mock("@/components/plan/usePlan", () => ({
  usePlan: () => held.plan,
  useToday: (p: Plan | null) => (p ? todayPlan(p, held.now) : null),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TODAY = "2026-10-05"; // понедельник
const at = (day: string, hour = 10) => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`).getTime();
function makePlan(over: { today?: string; examDate?: string | null; weeklyLessons?: number; lessons?: Parameters<typeof buildPlan>[0]["lessons"] } = {}): Plan {
  return buildPlan({
    units: UNITS,
    today: over.today ?? TODAY,
    start: TODAY,
    examDate: over.examDate ?? null,
    skipBasics: false,
    weeklyLessons: over.weeklyLessons ?? 3,
    lessons: over.lessons ?? {},
    exams: [],
    days: {},
  });
}

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
  held.now = at(TODAY);
  held.plan = makePlan();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useApp.getState().resetProgress();
});

describe("GoalSummaryCard: только цель", () => {
  it("цели нет (ни даты, ни балла) — карточки нет", async () => {
    await setProfile({ examDate: null, targetScoreSet: false });
    await render(createElement(GoalSummaryCard));
    expect(host.innerHTML).toBe("");
  });

  it("с датой — «До ЕНТ», прогноз и цель, без кольца «уроков за неделю»", async () => {
    await setProfile({ examDate: "2999-01-01", targetScore: 40, targetScoreSet: true });
    await render(createElement(GoalSummaryCard));
    expect(text()).toContain("До ЕНТ");
    expect(text()).toContain("цель 40");
    expect(text()).not.toContain("уроков за неделю");
    expect(text()).not.toMatch(/\d+\/\d+/); // «0/4» из кольца недели нет
  });

  it("только балл без даты — «Укажи дату ЕНТ»", async () => {
    await setProfile({ examDate: null, targetScore: 35, targetScoreSet: true });
    await render(createElement(GoalSummaryCard));
    expect(text()).toContain("Укажи дату ЕНТ");
    expect(text()).toContain("цель 35");
    expect(host.querySelector("a")?.getAttribute("href")).toBe("/profile#goals");
  });
});

describe("PlanCard: «Сегодня» и приглашение", () => {
  const invite = () => [...host.querySelectorAll("a")].find((a) => a.getAttribute("href") === "/profile#goals");

  it("есть уроки на сегодня: «Сегодня: 1 урок» и кнопка на первый урок", async () => {
    await setProfile({ examDate: null, targetScoreSet: true });
    await render(createElement(PlanCard));
    expect(text()).toContain("Сегодня: 1 урок"); // 3 урока в неделю, 7 дней — по ceil(3/7) = 1
    const first = held.plan!.weeks[0].tasks.find((t) => t.type === "lesson")!;
    const links = [...host.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links).toContain(taskHref(first));
    expect(links).toContain("/plan");
    expect(invite()).toBeUndefined(); // цель есть — приглашения нет
  });

  it("цели нет — внутри карточки плана одна строка-приглашение в профиль", async () => {
    await setProfile({ examDate: null, targetScoreSet: false });
    await render(createElement(PlanCard));
    expect(invite()?.textContent).toContain("Укажи дату ЕНТ и цель");
    expect(host.querySelectorAll('a[href="/profile#goals"]')).toHaveLength(1);
  });

  it("ссылки не вложены друг в друга (кнопка — не внутри карточки-ссылки)", async () => {
    await setProfile({ examDate: null, targetScoreSet: false });
    await render(createElement(PlanCard));
    expect(host.querySelectorAll("a a")).toHaveLength(0);
    expect(host.querySelectorAll("a button")).toHaveLength(0);
  });

  it("уроки недели пройдены сегодня — «Уроки этой недели пройдены», счётчик и кнопка «Ещё урок»", async () => {
    const weekIds = held.plan!.weeks[0].tasks.flatMap((t) => (t.type === "lesson" ? [t.id] : []));
    const day = "2026-10-07"; // среда
    held.now = at(day);
    held.plan = makePlan({ today: day, lessons: Object.fromEntries(weekIds.map((id) => [id, { completions: 1, firstAt: at(day, 9) }])) });
    await setProfile({ examDate: null, targetScoreSet: true });
    await render(createElement(PlanCard));
    expect(text()).toContain("Уроки этой недели пройдены");
    expect(text()).toContain(`Сегодня пройдено: ${weekIds.length}`);
    expect(text()).toContain("Ещё урок:");
  });

  it("дата ЕНТ прошла — плана нет: одна ссылка на /plan, без кнопки урока", async () => {
    held.plan = makePlan({ examDate: "2026-10-01" });
    await setProfile({ examDate: "2026-10-01", targetScoreSet: true });
    await render(createElement(PlanCard));
    expect(text()).toContain("Дата ЕНТ прошла");
    expect(host.querySelectorAll("a")).toHaveLength(1);
  });
});
