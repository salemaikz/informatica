import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SKILLS, skillById } from "@/content/skills";
import { liveMastery, liveSkills } from "@/games/live-mastery";
import { forecastScore } from "@/lib/forecast";
import { DECAY_BASE, decaySkills, decayedMastery, masteryLevel, type SkillStat } from "@/lib/mastery";
import { buildParentReport, type ReportInput } from "@/lib/parent-report";
import { buildStudentContext } from "@/lib/student-context";
import { tx } from "@/lib/text";
import { useApp } from "@/lib/store";

// Затухание освоения подключено к тем, кто его показывает или по нему выбирает (этап 14, P1; #45, #80).

const NOW = new Date(2027, 0, 15, 12, 0, 0).getTime();
const DAY = 86_400_000;
const skill = SKILLS[0];

/** Освоенный навык: оценка 1,0, много самостоятельных верных ответов в разные дни; последний ответ — daysAgo дней назад. */
const solid = (daysAgo: number): SkillStat => ({ attempts: 12, correct: 12, mastery: 1, lastSeen: NOW - daysAgo * DAY, clean: 8, okDays: 4, okDay: "2026-12-01" });
const allSkills = (daysAgo: number) => Object.fromEntries(SKILLS.map((s) => [s.id, solid(daysAgo)]));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("ИИ-наставник: освоение с затуханием", () => {
  it("свежий освоенный навык — «сильный», не в слабых", () => {
    const ctx = buildStudentContext({ ...useApp.getState(), skills: { [skill.id]: solid(0) }, skillDays: {} });
    const title = tx(skillById(skill.id)!.title, useApp.getState().profile.lang);
    expect(ctx.strong.some((s) => s.startsWith(title))).toBe(true);
    expect(ctx.weak.some((s) => s.startsWith(title))).toBe(false);
  });

  it("давно не тренированный освоенный навык не «сильный», а слабое место «давно не было практики»", () => {
    const ctx = buildStudentContext({ ...useApp.getState(), skills: { [skill.id]: solid(60) }, skillDays: {} });
    const title = tx(skillById(skill.id)!.title, useApp.getState().profile.lang);
    expect(ctx.strong.some((s) => s.startsWith(title))).toBe(false);
    const line = ctx.weak.find((s) => s.startsWith(title));
    expect(line).toBeDefined();
    // 60 дней: 0,5 + 0,5 · 2^(−2) = 0,625 → 63%.
    expect(line).toContain("63%");
  });
});

describe("прогноз балла по освоению с затуханием", () => {
  it("через 60 дней без практики прогноз ниже, чем сразу", () => {
    const skills = allSkills(0);
    const fresh = forecastScore({ skills: decaySkills(skills, NOW), exams: [], now: NOW });
    const later = forecastScore({ skills: decaySkills(skills, NOW + 60 * DAY), exams: [], now: NOW + 60 * DAY });
    expect(fresh.basis).not.toBe("none");
    expect(later.score).toBeLessThan(fresh.score);
    // Затухание умеренное: прогноз не обваливается вдвое (#80).
    expect(later.score).toBeGreaterThan(fresh.score / 2);
  });

  it("отчёт родителю: затухшие навыки на момент создания отчёта", () => {
    const base = useApp.getState();
    const input: ReportInput = { ...base, profile: { ...base.profile, track: "ent" }, skills: allSkills(0), exams: [], days: {}, lessons: {} };
    const fresh = buildParentReport(input, NOW);
    const later = buildParentReport(input, NOW + 60 * DAY);
    expect(fresh.ent?.forecast).not.toBeNull();
    expect(later.ent!.forecast!.score).toBeLessThan(fresh.ent!.forecast!.score);
    expect(Math.max(...later.ent!.topics)).toBeLessThan(Math.max(...fresh.ent!.topics));
  });
});

describe("затухание: общие свойства читателей", () => {
  it("сервер и первый кадр (now = 0) — без затухания, тот же объект", () => {
    const skills = allSkills(90);
    expect(decaySkills(skills, 0)).toBe(skills);
  });

  it("освоенный навык через 30 и 60 дней: «в процессе»; ниже базы не тает", () => {
    const m30 = decayedMastery(solid(0), NOW + 30 * DAY);
    const m60 = decayedMastery(solid(0), NOW + 60 * DAY);
    expect(m30).toBeCloseTo(0.75, 3);
    expect(m60).toBeCloseTo(0.625, 3);
    expect(masteryLevel(decaySkills({ a: solid(30) }, NOW).a)).toBe("progress");
    expect(decayedMastery({ mastery: 0.3, lastSeen: NOW - 200 * DAY }, NOW)).toBe(0.3);
    expect(DECAY_BASE).toBe(0.5);
  });
});

describe("игры: освоение для выбора заданий — с затуханием", () => {
  beforeEach(() => {
    useApp.setState({ skills: { [skill.id]: solid(60) } });
  });
  afterEach(() => {
    useApp.setState({ skills: {} });
  });

  it("liveMastery: затухшее значение; нет навыка — undefined (игра подставит своё)", () => {
    expect(liveMastery(skill.id)).toBeCloseTo(0.625, 3);
    expect(liveMastery("нет-такого-навыка")).toBeUndefined();
  });

  it("liveSkills: вся карта навыков затухшая, стор остаётся «как записано»", () => {
    expect(liveSkills()[skill.id].mastery).toBeCloseTo(0.625, 3);
    expect(useApp.getState().skills[skill.id].mastery).toBe(1);
  });
});
