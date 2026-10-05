import { describe, expect, it } from "vitest";
import { DECAY_BASE, decayedMastery, decaySkills, decayStat, masteryLevel, updateSkill, type SkillStat } from "@/lib/mastery";

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 9, 1, 12);
const mastered = (m = 1): SkillStat => ({ attempts: 12, correct: 11, mastery: m, lastSeen: T0, clean: 8, okDays: 4, okDay: "2026-10-01" });

describe("затухание освоения (#45)", () => {
  it("часть выше базы тает вдвое за 30 дней", () => {
    expect(decayedMastery(mastered(1), T0 + 30 * DAY)).toBeCloseTo(0.75, 3);
    expect(decayedMastery(mastered(0.9), T0 + 30 * DAY)).toBeCloseTo(0.7, 3);
    expect(decayedMastery(mastered(1), T0 + 60 * DAY)).toBeCloseTo(0.625, 3);
  });

  it("ниже базы, без lastSeen и в прошлом — без изменений", () => {
    expect(decayedMastery({ mastery: 0.4, lastSeen: T0 }, T0 + 90 * DAY)).toBe(0.4);
    expect(decayedMastery({ mastery: 0.9, lastSeen: 0 }, T0)).toBe(0.9);
    expect(decayedMastery(mastered(0.9), T0 - DAY)).toBe(0.9);
    expect(decayedMastery(undefined, T0)).toBe(0);
  });

  it("никогда не опускается ниже базы", () => {
    expect(decayedMastery(mastered(1), T0 + 3650 * DAY)).toBeGreaterThanOrEqual(DECAY_BASE);
  });

  it("«освоено» гаснет без практики примерно через 3 недели и возвращается одним верным ответом", () => {
    const st = mastered(1);
    expect(masteryLevel(decayStat(st, T0 + 7 * DAY))).toBe("mastered");
    expect(masteryLevel(decayStat(st, T0 + 30 * DAY))).toBe("progress");
    const back = updateSkill(st, 1, T0 + 30 * DAY, { clean: true, day: "2026-10-31" });
    expect(back.mastery).toBeGreaterThanOrEqual(0.8);
    expect(masteryLevel(back)).toBe("mastered");
  });

  it("новый ответ сдвигает затухшую оценку, а не сохранённую", () => {
    const st = mastered(1);
    const wrong = updateSkill(st, 0, T0 + 30 * DAY, { day: "2026-10-31" });
    // 0,75 − 0,3 · 0,75
    expect(wrong.mastery).toBeCloseTo(0.525, 3);
  });

  it("decaySkills: тот же объект, если ничего не затухло; now = 0 — без затухания", () => {
    const stats = { a: { attempts: 3, correct: 1, mastery: 0.4, lastSeen: T0 } as SkillStat };
    expect(decaySkills(stats, T0 + 40 * DAY)).toBe(stats);
    const strong = { a: mastered(1) };
    expect(decaySkills(strong, 0)).toBe(strong);
    const d = decaySkills(strong, T0 + 30 * DAY);
    expect(d).not.toBe(strong);
    expect(d.a.mastery).toBeCloseTo(0.75, 3);
    expect(strong.a.mastery).toBe(1);
  });
});
