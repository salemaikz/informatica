import { describe, expect, it } from "vitest";
import { lessonStep, stepLevel, stepReviewDays, stepTone } from "@/lib/mastery-steps";
import { DAY_MS, type LessonStat } from "@/lib/review";
import { masteryDict } from "@/i18n/parts/mastery";

const NOW = 1_000_000_000_000;
const stat = (o: Partial<LessonStat> = {}): LessonStat => ({ completions: 1, bestAccuracy: 0.9, lastAt: NOW, totalXp: 10, stage: 0, via: "learn", ...o });

describe("lessonStep", () => {
  it("new: нет статистики или не пройден", () => {
    expect(lessonStep(undefined, NOW)).toBe("new");
    expect(lessonStep(stat({ completions: 0 }), NOW)).toBe("new");
  });
  it("started: игра, экстерн, проверка себя, низкая точность", () => {
    expect(lessonStep(stat({ via: "game" }), NOW)).toBe("started");
    expect(lessonStep(stat({ via: "extern" }), NOW)).toBe("started");
    expect(lessonStep(stat({ via: "check" }), NOW)).toBe("started");
    expect(lessonStep(stat({ bestAccuracy: 0.59 }), NOW)).toBe("started");
    expect(lessonStep(stat({ bestAccuracy: 0.5, stage: 4 }), NOW)).toBe("started");
  });
  it("familiar: пройден, ступень 0–1", () => {
    expect(lessonStep(stat({ stage: 0 }), NOW)).toBe("familiar");
    expect(lessonStep(stat({ stage: 1, bestAccuracy: 0.6 }), NOW)).toBe("familiar");
    expect(lessonStep(stat({ via: "game", completions: 2, stage: 1 }), NOW)).toBe("familiar");
    expect(lessonStep({ completions: 1, bestAccuracy: 1, lastAt: NOW, totalXp: 0 }, NOW)).toBe("familiar");
  });
  it("skilled: ступень 2–3 и точность ≥ 80%", () => {
    expect(lessonStep(stat({ stage: 2 }), NOW)).toBe("skilled");
    expect(lessonStep(stat({ stage: 3, bestAccuracy: 0.8 }), NOW)).toBe("skilled");
    expect(lessonStep(stat({ stage: 3, bestAccuracy: 0.75 }), NOW)).toBe("familiar");
  });
  it("mastered: ступень ≥ 4", () => {
    expect(lessonStep(stat({ stage: 4 }), NOW)).toBe("mastered");
    expect(lessonStep(stat({ stage: 5 }), NOW)).toBe("mastered");
  });
});

describe("вспомогательные", () => {
  it("уровень и цвет", () => {
    expect(["new", "started", "familiar", "skilled", "mastered"].map((s) => stepLevel(s as never))).toEqual([0, 1, 2, 3, 4]);
    expect(stepTone("new")).toBeNull();
    expect(stepTone("started")).toBe("warning");
    expect(stepTone("familiar")).toBe("warning");
    expect(stepTone("skilled")).toBe("success");
    expect(stepTone("mastered")).toBe("success");
  });
  it("дни до повторения", () => {
    expect(stepReviewDays(undefined, NOW)).toBeNull();
    expect(stepReviewDays(stat({ dueAt: NOW + 3 * DAY_MS }), NOW)).toBe(3);
    expect(stepReviewDays(stat({ dueAt: NOW - DAY_MS }), NOW)).toBe(0);
    expect(stepReviewDays(stat({ dueAt: undefined, lastAt: NOW - 5 * DAY_MS }), NOW)).toBe(0);
  });
  it("испорченные данные из localStorage не ломают ступень и дни", () => {
    const bad = (o: Record<string, unknown>) => ({ ...stat(), ...o }) as unknown as LessonStat;
    expect(lessonStep(bad({ completions: undefined }), NOW)).toBe("new");
    expect(lessonStep(bad({ completions: "3" }), NOW)).toBe("new");
    expect(lessonStep(bad({ bestAccuracy: NaN }), NOW)).toBe("started");
    expect(lessonStep(bad({ stage: "4" }), NOW)).toBe("familiar");
    expect(stepReviewDays(bad({ dueAt: undefined, lastAt: NaN }), NOW)).toBe(0);
    expect(stepReviewDays(bad({ dueAt: "x", lastAt: NOW }), NOW)).toBe(1);
  });
  it("строки двуязычны", () => {
    for (const [k, v] of Object.entries(masteryDict)) {
      expect(v.ru.length, k).toBeGreaterThan(0);
      expect(v.kk.length, k).toBeGreaterThan(0);
    }
  });
});
