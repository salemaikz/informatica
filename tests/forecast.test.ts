import { describe, expect, it } from "vitest";
import { ENT_TOPICS } from "@/content/ent-topics";
import { SKILLS } from "@/content/skills";
import { forecastMargin, forecastScore, topicMastery, type ForecastExam } from "@/lib/forecast";
import type { SkillStat } from "@/lib/mastery";
import type { EntTopicId } from "@/lib/types";

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;
const stat = (mastery: number, attempts = 10): SkillStat => ({ attempts, correct: 5, mastery, lastSeen: NOW });
const allSkills = (mastery: number, attempts = 10) => Object.fromEntries(SKILLS.map((s) => [s.id, stat(mastery, attempts)]));
const byTopic = (ratio: number): Record<EntTopicId, { points: number; max: number }> =>
  Object.fromEntries(ENT_TOPICS.map((t) => [t.id, { points: ratio * 10, max: 10 }])) as never;
const exam = (points: number, daysAgo = 1, extra: Partial<ForecastExam> = {}): ForecastExam => ({
  at: NOW - daysAgo * DAY, points, maxPoints: 50, byTopic: byTopic(points / 50), ...extra,
});

describe("forecastScore", () => {
  it("нет данных — basis none, балл 0", () => {
    const f = forecastScore({ skills: {}, exams: [], now: NOW });
    expect(f).toMatchObject({ score: 0, low: 0, high: 0, basis: "none", answers: 0 });
    expect(Object.values(f.byTopic).every((v) => v === 0)).toBe(true);
  });

  it("навыки без попыток — тоже «нет данных»", () => {
    const f = forecastScore({ skills: { "ns.base": stat(0.9, 0) }, exams: [], now: NOW });
    expect(f.basis).toBe("none");
  });

  it("только навыки: полное освоение — 50, нулевое — 0, половина — 25", () => {
    expect(forecastScore({ skills: allSkills(1), exams: [], now: NOW }).score).toBe(50);
    expect(forecastScore({ skills: allSkills(0.5), exams: [], now: NOW }).score).toBe(25);
    const f = forecastScore({ skills: allSkills(0), exams: [], now: NOW });
    expect(f.basis).toBe("mastery");
    expect(f.score).toBe(0);
  });

  it("освоение темы — среднее по навыкам, неосвоенные считаются нулём", () => {
    const t04 = SKILLS.filter((s) => s.ent === "t04");
    const skills = { [t04[0].id]: stat(1) };
    const m = topicMastery(skills);
    expect(m.t04).toBeCloseTo(1 / t04.length, 5);
    expect(m.t01).toBe(0);
  });

  it("вес темы: освоена только t01 — доля её веса", () => {
    const skills = Object.fromEntries(SKILLS.filter((s) => s.ent === "t01").map((s) => [s.id, stat(1)]));
    const f = forecastScore({ skills, exams: [], now: NOW });
    expect(f.byTopic.t01).toBe(1);
    expect(f.score).toBe(Math.round((5 / 35) * 45)); // 6
  });

  it("только пробники: свежее весомее", () => {
    const f = forecastScore({ skills: {}, exams: [exam(10, 20), exam(40, 1)], now: NOW });
    expect(f.basis).toBe("exams");
    expect(f.score).toBeGreaterThan(25);
    expect(f.score).toBeLessThan(40);
    expect(f.byTopic.t01).toBeGreaterThan(0.5);
  });

  it("учитываются только последние 3 пробника", () => {
    const old = exam(0, 100);
    const f = forecastScore({ skills: {}, exams: [old, exam(30, 3), exam(30, 2), exam(30, 1)], now: NOW });
    expect(f.score).toBe(30);
  });

  it("тест по теме (kind: topic) не влияет на прогноз", () => {
    const f = forecastScore({ skills: {}, exams: [exam(50, 1, { kind: "topic" })], now: NOW });
    expect(f.basis).toBe("none");
    const g = forecastScore({ skills: {}, exams: [exam(30, 1, { kind: "mini" })], now: NOW });
    expect(g.score).toBe(30);
  });

  it("пробник с maxPoints = 0 пропускается", () => {
    const f = forecastScore({ skills: {}, exams: [{ at: NOW, points: 0, maxPoints: 0, byTopic: byTopic(0) }], now: NOW });
    expect(f.basis).toBe("none");
  });

  it("мини-пробник (19 баллов) переводится в 50-балльную шкалу", () => {
    const f = forecastScore({ skills: {}, exams: [{ at: NOW, points: 19, maxPoints: 19, byTopic: byTopic(1) }], now: NOW });
    expect(f.score).toBe(50);
  });

  it("оба источника: 60% пробники + 40% освоение", () => {
    const f = forecastScore({ skills: allSkills(0), exams: [exam(50, 0)], now: NOW });
    // освоение у навыков с попытками = 0 → 0.6 * 50 = 30
    expect(f.basis).toBe("both");
    expect(f.score).toBe(30);
    const g = forecastScore({ skills: allSkills(1), exams: [exam(0, 0)], now: NOW });
    expect(g.score).toBe(20);
  });

  it("интервал зависит от числа ответов и обрезается 0..50", () => {
    expect(forecastMargin(0)).toBe(8);
    expect(forecastMargin(29)).toBe(8);
    expect(forecastMargin(30)).toBe(5);
    expect(forecastMargin(99)).toBe(5);
    expect(forecastMargin(100)).toBe(3);
    const few = forecastScore({ skills: allSkills(0.5, 1), exams: [], now: NOW });
    expect(few.answers).toBe(SKILLS.length);
    // навыков ≥ 30 → ±5, а ответов 1 на навык — зависит от числа навыков
    expect(few.high - few.low).toBeLessThanOrEqual(2 * forecastMargin(few.answers));
    const top = forecastScore({ skills: allSkills(1, 10), exams: [], now: NOW });
    expect(top.high).toBe(50);
    expect(top.low).toBe(47);
    const zero = forecastScore({ skills: allSkills(0, 1), exams: [], now: NOW });
    expect(zero.low).toBe(0);
    expect(zero.score).toBe(0);
  });

  it("малое число ответов — шире интервал", () => {
    const one = { [SKILLS[0].id]: stat(0.5, 5) };
    const f = forecastScore({ skills: one, exams: [], now: NOW });
    expect(f.answers).toBe(5);
    expect(f.high - f.low).toBe(f.score < 8 ? f.score + 8 : 16);
  });

  it("неизвестные навыки (нет в SKILLS) не считаются ответами", () => {
    const f = forecastScore({ skills: { "zzz.unknown": stat(1, 50) }, exams: [], now: NOW });
    expect(f.basis).toBe("none");
  });
});
