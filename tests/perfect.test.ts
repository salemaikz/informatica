import { describe, expect, it } from "vitest";
import { isPerfectExam, isPerfectSession, nextPerfectRun, PERFECT_RUN_GOAL, rollPerfectDrop, sanitizePerfectDrop } from "@/lib/perfect";
import { PERFECT_DROP } from "@/lib/economy";
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

const NOT_FULL = { heartsFull: false, unlimited: false };

describe("rollPerfectDrop (этап 16В, решение B)", () => {
  it("r < 0,2 — пол-сердечка", () => {
    expect(rollPerfectDrop(0, NOT_FULL)).toEqual({ kind: "heart", amount: 0.5 });
    expect(rollPerfectDrop(0.1, NOT_FULL)).toEqual({ kind: "heart", amount: 0.5 });
    expect(rollPerfectDrop(0.1999, NOT_FULL)).toEqual({ kind: "heart", amount: 0.5 });
  });
  it("0,2 ≤ r < 0,4 — 3 чипа", () => {
    expect(rollPerfectDrop(0.2, NOT_FULL)).toEqual({ kind: "chips", amount: 3 });
    expect(rollPerfectDrop(0.3, NOT_FULL)).toEqual({ kind: "chips", amount: PERFECT_DROP.chips });
    expect(rollPerfectDrop(0.3999, NOT_FULL)).toEqual({ kind: "chips", amount: 3 });
  });
  it("r ≥ 0,4 — ничего (в том числе 0,4 и почти 1)", () => {
    expect(rollPerfectDrop(0.4, NOT_FULL)).toEqual({ kind: "none" });
    expect(rollPerfectDrop(0.9, NOT_FULL)).toEqual({ kind: "none" });
    expect(rollPerfectDrop(0.999999, NOT_FULL)).toEqual({ kind: "none" });
  });
  it("запас полон или «Безлимит» — вместо пол-сердечка 3 чипа; остальные исходы не меняются", () => {
    for (const o of [{ heartsFull: true, unlimited: false }, { heartsFull: false, unlimited: true }, { heartsFull: true, unlimited: true }]) {
      expect(rollPerfectDrop(0.05, o)).toEqual({ kind: "chips", amount: 3 });
      expect(rollPerfectDrop(0.3, o)).toEqual({ kind: "chips", amount: 3 });
      expect(rollPerfectDrop(0.7, o)).toEqual({ kind: "none" });
    }
  });
  it("мусорное число (NaN, отрицательное) — «ничего»", () => {
    expect(rollPerfectDrop(Number.NaN, NOT_FULL)).toEqual({ kind: "none" });
    expect(rollPerfectDrop(-0.1, NOT_FULL)).toEqual({ kind: "none" });
  });
  it("доли за миллион бросков: 20% / 20% / 60% (с допуском)", () => {
    const n = 100_000;
    const count = { heart: 0, chips: 0, none: 0 };
    for (let i = 0; i < n; i++) count[rollPerfectDrop(i / n, NOT_FULL).kind]++;
    expect(count.heart / n).toBeCloseTo(0.2, 2);
    expect(count.chips / n).toBeCloseTo(0.2, 2);
    expect(count.none / n).toBeCloseTo(0.6, 2);
  });
});

describe("isPerfectExam / sanitizePerfectDrop", () => {
  it("тест на 100% — баллы равны максимуму; пустой вариант — нет", () => {
    expect(isPerfectExam(10, 10)).toBe(true);
    expect(isPerfectExam(9, 10)).toBe(false);
    expect(isPerfectExam(0, 0)).toBe(false);
  });
  it("исход из сохранения: известные виды проходят, мусор — null", () => {
    expect(sanitizePerfectDrop({ kind: "heart", amount: 5 })).toEqual({ kind: "heart", amount: 0.5 });
    expect(sanitizePerfectDrop({ kind: "chips", amount: 3 })).toEqual({ kind: "chips", amount: 3 });
    expect(sanitizePerfectDrop({ kind: "none" })).toEqual({ kind: "none" });
    for (const bad of [null, undefined, 5, "x", [], {}, { kind: "gold" }, { kind: "chips" }, { kind: "chips", amount: -1 }, { kind: "chips", amount: "3" }]) {
      expect(sanitizePerfectDrop(bad)).toBeNull();
    }
  });
});

describe("строки R1/R2 и сюрприз (16В)", () => {
  const keys = Object.keys(dict).filter((k) => k.startsWith("perfect.") || k.startsWith("economy.earn.") || k.startsWith("economy.ledger.") || k.startsWith("econ16c.drop.") || k.startsWith("econ16c.earn."));
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
