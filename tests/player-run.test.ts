import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LESSONS } from "@/content/course";
import { daysAccuracy } from "@/lib/accuracy";
import { sanitizeLessonRuns, usableRun } from "@/lib/lesson-run";
import { sessionTotals, skipRecord } from "@/lib/player-events";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import type { AnswerRecord, SessionResult } from "@/lib/types";
import { activeElapsed, buildRun, freshQueue, restoreRun, type RunSnapshotInput } from "@/components/lesson/run-snapshot";

// Плеер урока (этап 12, P4): активное время в снимке и итогах, пропуск и подсказка до стора.

const lesson = LESSONS["ns-1-bits"];
const steps = lesson.steps;
const T0 = Date.UTC(2027, 0, 15, 12);

const rec = (o: Partial<AnswerRecord> = {}): AnswerRecord => ({
  stepId: "bits-q-bit-values",
  skill: "ns.base",
  correct: true,
  score: 1,
  given: "2",
  expected: "2",
  prompt: "?",
  retry: false,
  timeMs: 2000,
  ...o,
});

describe("activeElapsed — активное время прохождения", () => {
  it("с нуля: разница показаний часов вкладки", () => {
    expect(activeElapsed(0, 5_000, 65_000)).toBe(60_000);
  });
  it("при продолжении — плюс сохранённое", () => {
    expect(activeElapsed(90_000, 10_000, 40_000)).toBe(120_000);
  });
  it("простой и фон часы не считают — значит, и в сумму не попадают", () => {
    // Часы вкладки стояли (ученик ушёл с вкладки): показания не изменились — время не растёт.
    expect(activeElapsed(30_000, 8_000, 8_000)).toBe(30_000);
  });
  it("часы перезапущены (показание меньше, чем при показе) — не уходим в минус", () => {
    expect(activeElapsed(30_000, 50_000, 1_000)).toBe(30_000);
  });
  it("мусор не ломает: NaN и отрицательное сохранённое", () => {
    expect(activeElapsed(Number.NaN, 0, 4_000)).toBe(4_000);
    expect(activeElapsed(-10, 0, 4_000)).toBe(4_000);
    expect(activeElapsed(0, Number.NaN, 4_000)).toBe(0);
  });
});

describe("снимок с активным временем", () => {
  const snap = (over: Partial<RunSnapshotInput> = {}): RunSnapshotInput => ({
    lessonId: lesson.id,
    steps,
    queue: freshQueue(steps),
    pos: 5,
    done: 4,
    records: [rec()],
    xp: 10,
    combo: 1,
    maxCombo: 1,
    skipped: 0,
    activeMs: 75_000,
    xpFactor: 1,
    chipsEarned: 0,
    cost: 1,
    startedAt: T0 - 600_000,
    paidAt: T0 - 5000,
    now: T0,
    ...over,
  });

  it("в снимок кладётся активное время, после продолжения оно идёт дальше от сохранённого", () => {
    const run = buildRun(snap({ activeMs: activeElapsed(0, 1_000, 76_000) }));
    expect(run.activeMs).toBe(75_000);
    const restored = restoreRun(run, steps, T0 + 1000)!;
    // Продолжение: плеер берёт показание часов при показе (500 000) и прибавляет к сохранённому 75 000.
    expect(activeElapsed(restored.activeMs, 500_000, 530_000)).toBe(105_000);
  });

  it("пропуск и подсказка переживают сохранение (sanitizeLessonRuns их не теряет)", () => {
    const records = [rec({ hinted: true }), skipRecord({ stepId: "bits-q-lamps3", skill: "ns.base", expected: "8", prompt: "?", timeMs: 900 })];
    const run = buildRun(snap({ records, skipped: 1 }));
    const back = sanitizeLessonRuns({ [lesson.id]: run }, T0)[lesson.id];
    expect(back.records[0].hinted).toBe(true);
    expect(back.records[1]).toMatchObject({ skipped: true, correct: false, score: 0 });
    expect(usableRun(back, lesson, T0 + 1000)).toBe(back);
    expect(sessionTotals(restoreRun(back, steps, T0 + 1000)!.records, back.skipped)).toMatchObject({ asked: 2, hinted: 1, skipped: 1 });
  });
});

describe("пропуск и подсказка: плеер → стор → итог (одна цифра везде)", () => {
  const st = () => useApp.getState();
  const day = () => st().days[todayKey()];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
    useApp.getState().resetProgress();
    useApp.setState({ plan: { tier: "free" } });
  });
  afterEach(() => vi.useRealTimers());

  /** Что делает плеер: пишет каждый ответ в стор, потом собирает итог по тем же записям. */
  function play(records: AnswerRecord[]): SessionResult {
    for (const r of records) st().recordAnswer(r, r.correct ? 10 : 0, lesson.id);
    const totals = sessionTotals(records, records.filter((r) => r.skipped).length);
    const result: SessionResult = { kind: "lesson", lessonId: lesson.id, title: "У", answers: records, xp: 10, maxCombo: 1, durationSec: 90, ...totals };
    st().finishSession(result);
    return result;
  }

  it("пропуск решения по фото: точность меньше 100%, пропуск в итоге, не в ошибках", () => {
    const result = play([rec(), rec({ stepId: "bits-q-lamps3" }), skipRecord({ stepId: "q-solution", skill: "ns.dec2bin", expected: "101101", prompt: "45", timeMs: 500 })]);
    expect(result.accuracy).toBeCloseTo(2 / 3);
    expect(result).toMatchObject({ asked: 3, skipped: 1, hinted: 0 });
    expect(st().mistakes).toHaveLength(0);
    // Освоение навыка пропуска не меняется.
    expect(st().skills["ns.dec2bin"]).toBeUndefined();
    // История: пропуск входит в «из N» и не идёт в ошибки.
    expect(st().history[0]).toMatchObject({ correct: 2, total: 3, wrong: [] });
  });

  it("с подсказкой: считается отдельно, в итоге и в дне", () => {
    const result = play([rec({ hinted: true }), rec({ stepId: "bits-q-lamps3" })]);
    expect(result).toMatchObject({ asked: 2, hinted: 1, skipped: 0 });
    expect(day()).toMatchObject({ asked: 2, hinted: 1 });
  });

  it("точность итога урока совпадает со статистикой дня", () => {
    const records = [rec(), rec({ stepId: "a", correct: false, score: 0 }), rec({ stepId: "b", score: 0.5, correct: false }), rec({ stepId: "a", retry: true }), skipRecord({ stepId: "c", expected: "", prompt: "", timeMs: 1 })];
    const result = play(records);
    const stats = daysAccuracy(st().days);
    expect(stats.approx).toBe(false);
    expect(stats.value).toBeCloseTo(result.accuracy);
    expect(Math.round(result.accuracy * 100)).toBe(Math.round((stats.value ?? 0) * 100));
    expect(stats.asked).toBe(result.asked);
  });
});
