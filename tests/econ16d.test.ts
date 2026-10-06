import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeState, useApp } from "@/lib/store";
import { dropRandom } from "@/lib/perfect";
import { repeatedMistakes } from "@/lib/progress";
import { fullExamChipsAllowed, lessonCounted } from "@/lib/exam-pass";
import type { AnswerRecord, SessionResult } from "@/lib/types";

const rec = (over: Partial<AnswerRecord> = {}): AnswerRecord => ({
  stepId: "s1",
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
const skip = (stepId: string): AnswerRecord => rec({ stepId, skipped: true, correct: false, score: 0, given: "", expected: "5" });
const lesson = (answers: AnswerRecord[], over: Partial<SessionResult> = {}): SessionResult => ({
  kind: "lesson",
  lessonId: "ns-2-read",
  title: "Урок",
  answers,
  xp: 10,
  maxCombo: 1,
  durationSec: 60,
  accuracy: 1,
  ...over,
});
const st = () => useApp.getState();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
  st().resetProgress();
  vi.spyOn(dropRandom, "next").mockReturnValue(0.99);
  useApp.setState({ plan: { tier: "free" }, aiUsage: { day: "", count: 0, free: 0, freeTotal: 0 } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("урок засчитывается при ответах на 70% заданий", () => {
  it("lessonCounted: границы, повторы ошибок не считаются", () => {
    const ten = (skipped: number) => Array.from({ length: 10 }, (_, i) => (i < skipped ? skip(`k${i}`) : rec({ stepId: `k${i}` })));
    expect(lessonCounted({ answers: ten(3), asked: 10, skipped: 3 })).toBe(true); // ровно 70%
    expect(lessonCounted({ answers: ten(4), asked: 10, skipped: 4 })).toBe(false);
    expect(lessonCounted({ answers: [] })).toBe(true);
    expect(lessonCounted({ answers: [rec(), rec({ retry: true }), rec({ retry: true })] })).toBe(true);
  });

  it("мало ответов: нет чипов, бонуса, отметки «пройден», серии идеальных; серия дней и время — как раньше", () => {
    useApp.setState({ profile: { ...st().profile, dailyGoalXp: 0 } });
    const answers = [rec({ stepId: "a" }), skip("b"), skip("c"), skip("d")];
    const chipsBefore = st().wallet.chips;
    const out = st().finishSession(lesson(answers, { asked: 4, skipped: 3, accuracy: 0.25 }));
    expect(out).toMatchObject({ counted: false, bonusXp: 0, lessonChips: 0, firstPass: false, perfect: false });
    expect(st().lessons["ns-2-read"]).toBeUndefined();
    expect(st().wallet.chips).toBe(chipsBefore);
    expect(st().perfectRun.current).toBe(0);
    expect(st().streak.current).toBe(1);
  });

  it("достаточно ответов: засчитывается как раньше", () => {
    const out = st().finishSession(lesson([rec({ stepId: "a" }), rec({ stepId: "b" }), rec({ stepId: "c" }), skip("d")], { asked: 4, skipped: 1, accuracy: 0.75 }));
    expect(out.counted).toBe(true);
    expect(out.firstPass).toBe(true);
    expect(st().lessons["ns-2-read"]).toBeDefined();
  });

  it("тренировка всегда засчитывается", () => {
    const out = st().finishSession({ kind: "drill", title: "T", mode: "smart", answers: [skip("a"), skip("b")], xp: 0, maxCombo: 0, durationSec: 5, accuracy: 0, asked: 2, skipped: 2 });
    expect(out.counted).toBe(true);
  });
});

describe("правило ЕНТ +5", () => {
  const e = (over: object) => ({ id: "x", kind: "full", seed: 1, at: new Date(2027, 0, 15, 9).getTime(), points: 5, answered: 10, questions: 20, ...over });
  it("тот же seed или тот же день запрещают, незасчитанные попытки не мешают", () => {
    const cur = { id: "n", seed: 2, at: new Date(2027, 0, 16, 9).getTime() };
    expect(fullExamChipsAllowed([], cur)).toBe(true);
    expect(fullExamChipsAllowed([e({})], cur)).toBe(true);
    expect(fullExamChipsAllowed([e({ seed: 2 })], cur)).toBe(false);
    expect(fullExamChipsAllowed([e({ at: new Date(2027, 0, 16, 1).getTime() })], cur)).toBe(false);
    expect(fullExamChipsAllowed([e({ answered: 3 })], cur)).toBe(true); // меньше половины
    expect(fullExamChipsAllowed([e({ kind: "mini", seed: 2 })], cur)).toBe(true);
    expect(fullExamChipsAllowed([e({ id: "n", seed: 2 })], cur)).toBe(true); // это же попытка
  });
});

describe("повторяющиеся ошибки", () => {
  it("misses растёт при новой ошибке и сбрасывается верным ответом", () => {
    st().recordAnswer(rec({ stepId: "q", correct: false, score: 0, given: "1" }), 0);
    expect(st().mistakes[0].misses).toBe(1);
    st().recordAnswer(rec({ stepId: "q", correct: false, score: 0, given: "2" }), 0);
    expect(st().mistakes[0].misses).toBe(2);
    st().recordAnswer(rec({ stepId: "q", correct: false, score: 0, retry: true }), 0); // повтор внутри урока не считается
    expect(st().mistakes[0].misses).toBe(2);
    st().recordAnswer(rec({ stepId: "q" }), 5);
    expect(st().mistakes).toHaveLength(0);
  });

  it("mergeState: старые записи получают misses = 1", () => {
    const m = mergeState({ mistakes: [{ id: "a", stepId: "s", prompt: "p", given: "", expected: "", at: 1 }, { id: "b", stepId: "t", prompt: "p", given: "", expected: "", at: 2, misses: 3 }, null] }, st());
    expect(m.mistakes.map((x) => x.misses)).toEqual([1, 3]);
  });

  it("repeatedMistakes: только misses ≥ 2, до трёх, сначала больше ошибок", () => {
    const mk = (id: string, misses: number | undefined, at: number) => ({ id, stepId: id, prompt: id, misses, at });
    const r = repeatedMistakes([mk("a", 1, 9), mk("b", undefined, 9), mk("c", 2, 1), mk("d", 5, 1), mk("e", 2, 5), mk("f", 3, 1)]);
    expect(r.map((x) => x.id)).toEqual(["d", "f", "e"]);
    expect(repeatedMistakes([mk("a", 1, 1)])).toEqual([]);
  });
});
