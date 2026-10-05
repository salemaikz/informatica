import { describe, expect, it } from "vitest";
import { isPerfectSession, nextPerfectRun, PERFECT_RUN_GOAL } from "@/lib/perfect";
import { EMPTY_PERFECT_RUN } from "@/lib/rewards-state";
import { dict } from "@/i18n/dict";
import type { AnswerRecord } from "@/lib/types";

const rec = (over: Partial<AnswerRecord> = {}): AnswerRecord => ({
  stepId: "q1",
  skill: "ns.bin2dec",
  correct: true,
  score: 1,
  given: "5",
  expected: "5",
  prompt: "?",
  retry: false,
  timeMs: 1000,
  ...over,
});

describe("isPerfectSession", () => {
  it("все первые попытки верны, пропусков нет — идеально", () => {
    expect(isPerfectSession({ answers: [rec(), rec({ stepId: "q2" })] })).toBe(true);
  });
  it("ошибка с первой попытки — не идеально, даже если потом исправлена", () => {
    expect(isPerfectSession({ answers: [rec({ correct: false, score: 0 }), rec({ retry: true })] })).toBe(false);
  });
  it("повторные попытки не считаются, пока первые верны", () => {
    expect(isPerfectSession({ answers: [rec(), rec({ stepId: "q2", retry: true, correct: false })] })).toBe(true);
  });
  it("пропуск — не идеально; сессия без заданий — не идеально", () => {
    expect(isPerfectSession({ answers: [rec()], skipped: 1 })).toBe(false);
    expect(isPerfectSession({ answers: [] })).toBe(false);
  });
});

describe("nextPerfectRun", () => {
  it("идеальное первое прохождение растёт, best тянется за current", () => {
    let run = nextPerfectRun(EMPTY_PERFECT_RUN, { perfect: true, first: true });
    expect(run).toEqual({ current: 1, best: 1 });
    run = nextPerfectRun(run, { perfect: true, first: true });
    expect(run).toEqual({ current: 2, best: 2 });
  });
  it("первое прохождение с ошибкой сбрасывает серию, best остаётся", () => {
    expect(nextPerfectRun({ current: 4, best: 6 }, { perfect: false, first: true })).toEqual({ current: 0, best: 6 });
  });
  it("повтор урока серию не меняет — ни рост, ни сброс", () => {
    const run = { current: 3, best: 3 };
    expect(nextPerfectRun(run, { perfect: true, first: false })).toBe(run);
    expect(nextPerfectRun(run, { perfect: false, first: false })).toBe(run);
  });
  it("цель достижения — 5", () => {
    expect(PERFECT_RUN_GOAL).toBe(5);
  });
});

describe("строки R1/R2", () => {
  const keys = Object.keys(dict).filter((k) => k.startsWith("perfect.") || k.startsWith("economy.earn.") || k.startsWith("economy.ledger."));
  it("есть и ru, и kk", () => {
    expect(keys.length).toBeGreaterThan(15);
    for (const k of keys) {
      const v = dict[k as keyof typeof dict];
      expect(v.ru.length, k).toBeGreaterThan(0);
      expect(v.kk.length, k).toBeGreaterThan(0);
    }
  });
  it("в русском нет глаголов с родом и эмодзи", () => {
    for (const k of keys) {
      const ru = dict[k as keyof typeof dict].ru;
      expect(ru, k).not.toMatch(/\b(сделал|сделала|получил|получила|прошёл|прошла)\b/i);
      expect(ru, k).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("ответ с подсказкой — не идеально (идеально — сам, с первой попытки)", () => {
    const a = { stepId: "q1", correct: true, score: 1, given: "", expected: "", prompt: "", retry: false, timeMs: 1 };
    expect(isPerfectSession({ answers: [a], skipped: 0 } as never)).toBe(true);
    expect(isPerfectSession({ answers: [{ ...a, hinted: true }], skipped: 0 } as never)).toBe(false);
  });
});
