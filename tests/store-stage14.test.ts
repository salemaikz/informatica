import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeState, useApp } from "@/lib/store";
import { XP, lengthFactor } from "@/lib/gamification";
import type { AnswerRecord, SessionResult } from "@/lib/types";
import type { GameResult } from "@/games/types";

const st = () => useApp.getState();
const rec = (i: number): AnswerRecord => ({ stepId: `q${i}`, skill: "py.if", correct: true, score: 1, given: "1", expected: "1", prompt: "?", retry: false, timeMs: 1000 });
const session = (over: Partial<SessionResult>): SessionResult => ({
  kind: "lesson",
  lessonId: "py-2a-if",
  title: "Урок",
  answers: [rec(1), rec(2)],
  xp: 20,
  maxCombo: 1,
  durationSec: 60,
  accuracy: 1,
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
  st().resetProgress();
  useApp.setState({ plan: { tier: "free" } });
});
afterEach(() => vi.useRealTimers());

describe("награда по длине (этап 14, #46)", () => {
  it("коэффициенты: до 5 заданий 0,6, 6–9 — 1, от 10 — 1,5", () => {
    expect([1, 5, 6, 9, 10, 15].map(lengthFactor)).toEqual([0.6, 0.6, 1, 1, 1.5, 1.5]);
  });

  it("микроурок — меньше, обычный урок — как раньше, без planned — как раньше", () => {
    expect(st().finishSession(session({ planned: 5, answers: [rec(1), rec(2), { ...rec(3), correct: false, score: 0 }] })).bonusXp).toBe(Math.round(XP.lessonComplete * 0.6));
    expect(st().finishSession(session({ lessonId: "py-2-if", planned: 8, answers: [rec(1), { ...rec(2), correct: false, score: 0 }] })).bonusXp).toBe(XP.lessonComplete);
    expect(st().finishSession(session({ lessonId: "py-2b-logic", answers: [rec(1), { ...rec(2), correct: false, score: 0 }] })).bonusXp).toBe(XP.lessonComplete);
  });

  it("практика из 12 заданий — полуторный бонус тренировки", () => {
    expect(st().finishSession(session({ kind: "drill", lessonId: undefined, mode: "practice", planned: 12 })).bonusXp).toBe(Math.round(XP.drillComplete * 1.5));
  });

  it("мини-тест не возвращает сердечко", () => {
    useApp.setState({ hearts: { ...st().hearts, count: 2 } as never });
    const answers = Array.from({ length: 8 }, (_, i) => rec(i));
    expect(st().finishSession(session({ kind: "drill", lessonId: undefined, mode: "minitest", planned: 8, answers })).heart).toBe(false);
  });
});

describe("узлы курса 3.0 и «Спокойно» в играх", () => {
  it("recordCourseNode копит практику и мини-тест, чужой id не пишет", () => {
    st().recordCourseNode("practice:py-2a-if", "practice", 0.7);
    st().recordCourseNode("practice:py-2a-if", "minitest", 0.5);
    st().recordCourseNode("плохой id", "practice", 1);
    expect(st().courseNodes).toEqual({ "practice:py-2a-if": { runs: 1, best: 0.7, at: Date.now(), testRuns: 1, testBest: 0.5, testAt: Date.now() } });
    // переживает сохранение и загрузку
    const merged = mergeState(JSON.parse(JSON.stringify(st())), st());
    expect(merged.courseNodes["practice:py-2a-if"].runs).toBe(1);
  });

  it("игра в темпе «Спокойно» сдвигает освоение вдвое слабее", () => {
    const res: GameResult = { score: 5, correct: 5, total: 5, attempts: Array.from({ length: 5 }, () => ({ skill: "ns.bin2dec", correct: true })) };
    const base = { attempts: 5, correct: 2, mastery: 0.4, lastSeen: Date.now(), clean: 1, okDays: 1, okDay: "" };
    useApp.setState({ skills: { "ns.bin2dec": base } });
    st().recordGame("bit-rush", res, "calm");
    const calm = st().skills["ns.bin2dec"].mastery;
    useApp.setState({ skills: { "ns.bin2dec": base } });
    st().recordGame("bit-rush", res, "normal");
    const normal = st().skills["ns.bin2dec"].mastery;
    expect(normal - 0.4).toBeCloseTo(0.3 * 0.6, 3);
    expect(calm - 0.4).toBeCloseTo(0.15 * 0.6, 3);
  });
});
