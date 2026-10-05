import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeState, useApp } from "@/lib/store";
import { masteryLevel } from "@/lib/mastery";
import { todayKey } from "@/lib/text";
import type { AnswerRecord, SessionResult } from "@/lib/types";

const rec = (o: Partial<AnswerRecord> = {}): AnswerRecord => ({
  stepId: "q1",
  skill: "ns.bin2dec",
  correct: true,
  score: 1,
  given: "5",
  expected: "5",
  prompt: "?",
  retry: false,
  timeMs: 3000,
  ...o,
});
const st = () => useApp.getState();
const day = () => st().days[todayKey()];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
  useApp.getState().resetProgress();
  useApp.setState({ plan: { tier: "free" } });
});
afterEach(() => vi.useRealTimers());

describe("стор: честные цифры (#66, #67, #68)", () => {
  it("первая попытка — в точность дня и срез навыка; повтор — нет", () => {
    st().recordAnswer(rec({ correct: false, score: 0 }), 0);
    st().recordAnswer(rec({ retry: true }), 5);
    expect(day()).toMatchObject({ asked: 1, score: 0, answers: 2, correct: 1 });
    expect(st().skillDays[todayKey()]["ns.bin2dec"]).toMatchObject({ n: 1, s: 0, sec: 3 });
  });
  it("пропуск: в точность со счётом 0, без ошибки, без освоения, без XP", () => {
    st().recordAnswer(rec({ skipped: true, correct: false, score: 0 }), 0);
    expect(day()).toMatchObject({ asked: 1, skipped: 1 });
    expect(day().score ?? 0).toBe(0);
    expect(st().mistakes).toHaveLength(0);
    expect(st().skills["ns.bin2dec"]).toBeUndefined();
    expect(st().xp).toBe(0);
  });
  it("подсказка: ответ «с подсказкой», освоение — вполсилы", () => {
    st().recordAnswer(rec({ hinted: true }), 10);
    expect(day()).toMatchObject({ asked: 1, score: 1, hinted: 1 });
    expect(st().skills["ns.bin2dec"]).toMatchObject({ mastery: 0.45, clean: 0 });
  });
  it("три верных за раз — не «освоено»", () => {
    for (let i = 0; i < 3; i++) st().recordAnswer(rec({ stepId: `q${i}` }), 10);
    expect(st().skills["ns.bin2dec"].mastery).toBeGreaterThan(0.8);
    expect(masteryLevel(st().skills["ns.bin2dec"])).toBe("progress");
  });
  it("игры — отдельно от ответов", () => {
    st().recordGame("bit-rush", { score: 5, correct: 4, total: 5, attempts: [] }, "normal");
    expect(day()).toMatchObject({ games: 5, gameCorrect: 4, answers: 0 });
    expect(day().asked ?? 0).toBe(0);
  });
  it("время: только трекер; завершение урока секунды не добавляет", () => {
    const res: SessionResult = { kind: "lesson", lessonId: "ns-2-read", title: "У", answers: [rec()], xp: 10, maxCombo: 1, durationSec: 600, accuracy: 1 };
    st().finishSession(res);
    expect(day().seconds).toBe(0);
    st().addActiveSeconds(15);
    st().addActiveSeconds(15, true);
    st().addActiveSeconds(999);
    st().addActiveSeconds(-5);
    expect(day()).toMatchObject({ seconds: 90, gameSeconds: 15 });
    // время не даёт серию и XP
    expect(st().xp).toBeGreaterThan(0);
  });
  it("addActiveSeconds не трогает серию", () => {
    st().addActiveSeconds(30);
    expect(st().streak.current).toBe(0);
  });
  it("пробник: знаменатель — весь вариант, повторная запись не удваивает", () => {
    const summary = { id: "e1", kind: "mini" as const, seed: 1, at: Date.now(), points: 3, maxPoints: 15, durationSec: 60, byTopic: {}, questions: 15 };
    st().recordExam(summary, { "ns.bin2dec": [1, 1, 0.5] });
    st().recordExam(summary, { "ns.bin2dec": [1, 1, 0.5] });
    expect(day()).toMatchObject({ asked: 15, score: 2.5 });
    expect(day().seconds).toBe(0);
  });
  it("пробник, записанный второй раз, не удваивает освоение, срез, счётчики дня и серию (C14)", () => {
    const summary = { id: "e2", kind: "mini" as const, seed: 1, at: Date.now(), points: 2, maxPoints: 15, durationSec: 60, byTopic: {}, questions: 15 };
    st().recordExam(summary, { "ns.bin2dec": [1, 1] });
    const skill = st().skills["ns.bin2dec"];
    const sd = st().skillDays;
    const d = { ...day() };
    st().recordExam({ ...summary, points: 3 }, { "ns.bin2dec": [1, 1] });
    expect(st().skills["ns.bin2dec"]).toBe(skill);
    expect(st().skillDays).toBe(sd);
    expect(day()).toEqual(d);
    // запись в истории обновлена (баллы исправлены), а не задвоена
    expect(st().history.filter((h) => h.examId === "e2")).toHaveLength(1);
    expect(st().history[0].points).toBe(3);
  });
  it("пробник: вес в истории — весь вариант, задания без ответа — «пропущено» (C17, C23)", () => {
    const summary = { id: "e3", kind: "mini" as const, seed: 1, at: Date.now(), points: 8, maxPoints: 50, durationSec: 60, byTopic: {}, questions: 40 };
    st().recordExam(summary, { "ns.bin2dec": [1, 1, 0, 1, 0, 1, 1, 0, 1, 1] });
    expect(st().history[0].total).toBe(40);
    expect(day()).toMatchObject({ asked: 40, skipped: 30 });
  });
  it("история: частичный балл — как в итогах урока (C13)", () => {
    const res: SessionResult = {
      kind: "lesson", lessonId: "ns-2-read", title: "У", xp: 10, maxCombo: 1, durationSec: 60, accuracy: 0.75,
      answers: [rec(), rec({ stepId: "q2", correct: false, score: 0.5 })],
    };
    st().finishSession(res);
    expect(st().history[0]).toMatchObject({ correct: 1, total: 2, score: 1.5 });
  });
  it("диагностика: итог в профиль, мягкий посев только новых навыков, skipBasics", () => {
    st().recordAnswer(rec({ skill: "logic.and" }), 10);
    const before = st().skills["logic.and"];
    st().recordDiagnostic({ at: 1, points: 6, max: 10, byTopic: { t04: { points: 2, max: 2 } } }, { "ns.bin2dec": [true, true], "logic.and": [false], "x.y": [true, false] }, { skipBasics: true });
    expect(st().profile.diagnostic).toMatchObject({ points: 6, max: 10 });
    expect(st().profile.skipBasics).toBe(true);
    expect(st().skills["ns.bin2dec"]).toMatchObject({ mastery: 0.45, attempts: 1, clean: 0 });
    expect(st().skills["x.y"]).toMatchObject({ mastery: 0.15 });
    expect(st().skills["logic.and"]).toBe(before);
    expect(st().streak.current).toBe(0); // серия — только за завершённое занятие: ни ответ, ни диагностика её не трогают
    expect(st().history).toHaveLength(0);
  });
  it("загрузка: профиль с новыми полями, старые навыки переводятся на #67, мусор отбрасывается", () => {
    const m = mergeState(
      {
        profile: { targetScore: 40, diagnostic: { at: 1, points: 20, max: 10, byTopic: {} } },
        skills: { a: { attempts: 8, correct: 8, mastery: 0.9, lastSeen: 1 }, b: "x" },
        skillDays: { "2027-01-15": { a: { n: 1, s: 1 } } },
      },
      st(),
    );
    expect(m.profile).toMatchObject({ targetScoreSet: true, diagnostic: null, analytics: true });
    expect(Object.keys(m.skills)).toEqual(["a"]);
    expect(masteryLevel(m.skills.a)).toBe("mastered");
    expect(m.skillDays["2027-01-15"].a).toEqual({ n: 1, s: 1 });
    expect(mergeState({ profile: {} }, st()).profile.targetScoreSet).toBe(false);
  });
});
