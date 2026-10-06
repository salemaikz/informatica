import { describe, expect, it } from "vitest";
import {
  DAILY_COUNTED_LIMIT,
  IDLE_WIN_MS,
  challengePoints,
  countedFor,
  eventPts,
  technicalResult,
  totals,
  weekPoints,
  winner,
  type SideStatus,
} from "@/lib/duel/score";
import type { DuelEvent } from "@/lib/duel/types";

const ev = (oks: boolean[], step = 3000): DuelEvent[] => oks.map((ok, i) => ({ i, ok, t: (i + 1) * step }));

describe("очки", () => {
  it("блиц: +2 / −1; верю — не верю: ±1; 10 вопросов: +1 / 0", () => {
    expect([eventPts("blitz", true), eventPts("blitz", false)]).toEqual([2, -1]);
    expect([eventPts("truth", true), eventPts("truth", false)]).toEqual([1, -1]);
    expect([eventPts("ten", true), eventPts("ten", false)]).toEqual([1, 0]);
    expect([eventPts("topic", true), eventPts("topic", false)]).toEqual([1, 0]);
  });

  it("итоги стороны", () => {
    expect(totals("blitz", ev([true, false, true]))).toEqual({ answered: 3, correct: 2, score: 3, timeMs: 9000 });
    expect(totals("truth", ev([false, false]))).toEqual({ answered: 2, correct: 0, score: -2, timeMs: 6000 });
    expect(totals("ten", [])).toEqual({ answered: 0, correct: 0, score: 0, timeMs: 0 });
  });

  it("штраф: 4 случайных нажатия с одним попаданием дают меньше, чем 2 честных верных", () => {
    const tapper = totals("blitz", ev([true, false, false, false], 800));
    const honest = totals("blitz", ev([true, true], 9000));
    expect(tapper.score).toBe(-1);
    expect(winner(honest, tapper).winner).toBe("a");
  });
});

describe("победитель", () => {
  const side = (score: number, correct: number, timeMs: number) => ({ answered: correct, correct, score, timeMs });
  it("сначала очки, затем верные, затем время", () => {
    expect(winner(side(5, 3, 50_000), side(4, 4, 10_000))).toEqual({ winner: "a", reason: "score" });
    expect(winner(side(4, 3, 50_000), side(4, 4, 60_000))).toEqual({ winner: "b", reason: "correct" });
    expect(winner(side(7, 7, 90_000), side(7, 7, 80_000))).toEqual({ winner: "b", reason: "time" });
  });
  it("ничья — разница во времени меньше 1 с", () => {
    expect(winner(side(7, 7, 80_000), side(7, 7, 80_999))).toEqual({ winner: "draw", reason: "draw" });
    expect(winner(side(7, 7, 80_000), side(7, 7, 81_000))).toEqual({ winner: "a", reason: "time" });
  });
});

describe("техническая победа", () => {
  const ok: SideStatus = { done: false, left: false, idleMs: 0 };
  it("до старта — обычный подсчёт", () => {
    expect(technicalResult({ ...ok, left: true }, ok, false)).toBeNull();
  });
  it("ушёл после старта — поражение; оба ушли — матч аннулирован", () => {
    expect(technicalResult({ ...ok, left: true }, ok, true)).toEqual({ winner: "b", reason: "left" });
    expect(technicalResult(ok, { ...ok, left: true }, true)).toEqual({ winner: "a", reason: "left" });
    expect(technicalResult({ ...ok, left: true }, { ...ok, left: true }, true)).toBe("void");
  });
  it("соперник молчит ≥ 30 с, а я доиграл, — победа; меньше — ждём", () => {
    expect(technicalResult({ ...ok, done: true }, { ...ok, idleMs: IDLE_WIN_MS }, true)).toEqual({ winner: "a", reason: "idle" });
    expect(technicalResult({ ...ok, done: true }, { ...ok, idleMs: IDLE_WIN_MS - 1 }, true)).toBeNull();
    expect(technicalResult({ ...ok, idleMs: IDLE_WIN_MS }, { ...ok, done: true }, true)).toEqual({ winner: "b", reason: "idle" });
    // Я не доиграл — молчание соперника победы не даёт.
    expect(technicalResult(ok, { ...ok, idleMs: 60_000 }, true)).toBeNull();
  });
});

describe("засчитан ли матч и очки недели", () => {
  const base = { opponent: "human" as const, flags: 0, answered: 10, pairToday: 0, countedToday: 0 };
  it("бот, флаги, короткий матч, пара, суточный предел", () => {
    expect(countedFor(base)).toEqual({ counted: true });
    expect(countedFor({ ...base, opponent: "bot" })).toEqual({ counted: false, why: "bot" });
    expect(countedFor({ ...base, flags: 3 })).toEqual({ counted: false, why: "fast" });
    expect(countedFor({ ...base, flags: 2 }).counted).toBe(true);
    expect(countedFor({ ...base, answered: 4 })).toEqual({ counted: false, why: "short" });
    expect(countedFor({ ...base, pairToday: 1 }).counted).toBe(true);
    expect(countedFor({ ...base, pairToday: 2 })).toEqual({ counted: false, why: "pair_limit" });
    expect(countedFor({ ...base, countedToday: DAILY_COUNTED_LIMIT })).toEqual({ counted: false, why: "daily_limit" });
    expect(countedFor({ ...base, opponent: "ghost" }).counted).toBe(true);
  });
  it("победа 3, ничья 2, доигранный 1, ушёл 0; незасчитанный — 0", () => {
    expect(["win", "draw", "loss", "left"].map((o) => weekPoints(o as "win", true))).toEqual([3, 2, 1, 0]);
    expect(weekPoints("win", false)).toBe(0);
    expect(challengePoints(true, true)).toBe(2);
    expect(challengePoints(false, true)).toBe(1);
    expect(challengePoints(true, false)).toBe(0);
  });
});
