import { describe, expect, it } from "vitest";
import { accuracyOf, completionOf, daysAccuracy, isPerfect, sessionAccuracy, tallyOf } from "@/lib/accuracy";
import type { AnswerRecord } from "@/lib/types";
import type { DayStat } from "@/lib/store";

const rec = (o: Partial<AnswerRecord> = {}): AnswerRecord => ({ stepId: "q", correct: true, score: 1, given: "", expected: "", prompt: "", retry: false, timeMs: 1, ...o });

describe("точность #66", () => {
  it("пропуск снижает точность и полноту (раньше давал 100%)", () => {
    const t = tallyOf([rec(), rec(), rec({ skipped: true, correct: false, score: 0 })]);
    expect(t).toMatchObject({ asked: 3, score: 2, skipped: 1 });
    expect(accuracyOf(t)).toBeCloseTo(2 / 3);
    expect(completionOf(t)).toBeCloseTo(2 / 3);
    expect(isPerfect(t)).toBe(false);
  });
  it("повтор ошибки в точность не входит", () => {
    const t = tallyOf([rec({ correct: false, score: 0 }), rec({ retry: true })]);
    expect(accuracyOf(t)).toBe(0);
    expect(t.asked).toBe(1);
  });
  it("частичный балл — как есть; «сам» и «с подсказкой» раздельно", () => {
    const t = tallyOf([rec({ score: 0.5, correct: false }), rec({ hinted: true }), rec()]);
    expect(accuracyOf(t)).toBeCloseTo(2.5 / 3);
    expect(t).toMatchObject({ hinted: 1, selfAsked: 2, selfScore: 1.5 });
  });
  it("заданий нет — null; для итогов сессии — 1", () => {
    expect(accuracyOf(tallyOf([]))).toBeNull();
    expect(completionOf(tallyOf([]))).toBeNull();
    expect(sessionAccuracy([])).toBe(1);
  });
  it("без ошибок: все первые попытки верны и нет пропусков; подсказка не мешает", () => {
    expect(isPerfect(tallyOf([rec(), rec({ hinted: true })]))).toBe(true);
    expect(isPerfect(tallyOf([rec(), rec({ score: 0.5 })]))).toBe(false);
  });
});

describe("daysAccuracy", () => {
  const day = (o: Partial<DayStat>): DayStat => ({ xp: 0, answers: 0, correct: 0, seconds: 0, ...o });
  it("по новым полям; старые дни игнорируются, если есть новые", () => {
    const r = daysAccuracy({ a: day({ asked: 4, score: 3 }), b: day({ answers: 10, correct: 1 }), c: day({ asked: 6, score: 6 }) });
    expect(r).toEqual({ value: 0.9, asked: 10, approx: false, partial: true, since: "a" });
  });
  it("только старые дни — приблизительно", () => {
    expect(daysAccuracy({ a: day({ answers: 4, correct: 3 }) })).toEqual({ value: 0.75, asked: 4, approx: true, partial: false, since: null });
    // только новые дни — не partial, since — самый ранний
    expect(daysAccuracy({ "2027-01-16": day({ asked: 1, score: 1 }), "2027-01-15": day({ asked: 1, score: 0 }) })).toMatchObject({ partial: false, since: "2027-01-15" });
  });
  it("нет данных — null; выбор дней по ключам", () => {
    expect(daysAccuracy({}).value).toBeNull();
    expect(daysAccuracy({ a: day({ asked: 2, score: 2 }), b: day({ asked: 2, score: 0 }) }, ["b"]).value).toBe(0);
  });
});
