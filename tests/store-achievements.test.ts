import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useApp, type ExamSummary } from "@/lib/store";
import { ACHIEVEMENT_CHIPS, START_WALLET } from "@/lib/economy";
import { levelStart } from "@/lib/gamification";
import type { AnswerRecord, SessionResult } from "@/lib/types";

// Достижения этапа 16В в сторе: условия считаются по данным стора, чипы — по редкости.

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

const lesson = (id: string, accuracy = 1): SessionResult => ({
  kind: "lesson",
  lessonId: id,
  title: "Урок",
  answers: [rec({ stepId: `${id}a`, correct: accuracy >= 1, score: accuracy })],
  xp: 10,
  maxCombo: 1,
  durationSec: 60,
  accuracy,
});

const exam = (over: Partial<ExamSummary> = {}): ExamSummary => ({
  id: "ex1",
  kind: "full",
  seed: 7,
  at: Date.now(),
  points: 20,
  maxPoints: 50,
  durationSec: 600,
  byTopic: {},
  ...over,
});

const st = () => useApp.getState();
const achievementChipsTotal = () => st().ledger.filter((e) => e.reason === "achievement").reduce((a, e) => a + e.amount, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
  st().resetProgress();
  useApp.setState({ plan: { tier: "free" }, aiUsage: { day: "", count: 0, free: 0, freeTotal: 0 } });
  // Дневная цель в этих тестах не нужна: чипы за неё посчитались бы в «прочие».
  useApp.setState({ profile: { ...st().profile, dailyGoalXp: 0 } });
});
afterEach(() => vi.useRealTimers());

describe("стор: новые достижения", () => {
  it("«Десять уроков» — на десятом уроке, один раз; чипы — обычное достижение", () => {
    for (let i = 1; i <= 9; i++) st().finishSession(lesson(`l${i}`, 0.5));
    expect(st().achievements.lessons_10).toBeUndefined();
    st().finishSession(lesson("l10", 0.5));
    expect(st().achievements.lessons_10).toBeTypeOf("number");
    expect(st().newAchievements).toContain("lessons_10");
    // повторное прохождение уже выданного не дублирует
    st().finishSession(lesson("l10", 0.5));
    expect(st().newAchievements.filter((id) => id === "lessons_10")).toHaveLength(1);
  });

  it("за новое достижение чипы по редкости: «Десять уроков» (обычное) даёт 5", () => {
    // Десять уроков без «первого шага» и «без ошибок»: их чипы тоже считаются, поэтому сверяем сумму по словарю редкости.
    for (let i = 1; i <= 10; i++) st().finishSession(lesson(`l${i}`, 0.5));
    const got = Object.keys(st().achievements);
    expect(got).toContain("lessons_10");
    // first_lesson (обычное) + lessons_10 (обычное)
    expect(achievementChipsTotal()).toBe(ACHIEVEMENT_CHIPS.common * got.length);
    expect(got.sort()).toEqual(["first_lesson", "lessons_10"]);
  });

  it("уровень 5 по XP: «Пятый уровень» (редкое) — 10 чипов, и сразу ничего лишнего", () => {
    st().recordAnswer(rec(), levelStart(5));
    expect(st().achievements.level_5).toBeTypeOf("number");
    expect(st().achievements.level_10).toBeUndefined();
    // xp_500 (обычное) + level_5 (редкое)
    expect(achievementChipsTotal()).toBe(ACHIEVEMENT_CHIPS.common + ACHIEVEMENT_CHIPS.rare);
    expect(st().wallet.chips).toBe(START_WALLET.chips + ACHIEVEMENT_CHIPS.common + ACHIEVEMENT_CHIPS.rare);
  });

  it("перескок через несколько уровней выдаёт все пройденные пороги разом", () => {
    st().recordAnswer(rec(), levelStart(20));
    for (const id of ["level_5", "level_10", "level_20"]) expect(st().achievements[id], id).toBeTypeOf("number");
    expect(st().achievements.level_30).toBeUndefined();
    // xp_500 + level_5 (10) + level_10 (20) + level_20 (40)
    expect(achievementChipsTotal()).toBe(ACHIEVEMENT_CHIPS.common + ACHIEVEMENT_CHIPS.rare + ACHIEVEMENT_CHIPS.epic + ACHIEVEMENT_CHIPS.legendary);
  });

  it("пробный ЕНТ на 96%: «Пробный старт» (редкое) + «Высокий балл» (легендарное)", () => {
    st().recordExam(exam({ points: 48 }), { "ns.bin2dec": [1] });
    expect(st().achievements.exam_first).toBeTypeOf("number");
    expect(st().achievements.exam_90).toBeTypeOf("number");
    expect(achievementChipsTotal()).toBe(ACHIEVEMENT_CHIPS.rare + ACHIEVEMENT_CHIPS.legendary);
  });

  it("тест по разделу сдан (от 80%) — «Раздел сдан»; 70% — нет", () => {
    st().recordExam(exam({ id: "u1", kind: "unit", unit: "u1", points: 7, maxPoints: 10 }), { "ns.bin2dec": [1] });
    expect(st().achievements.unit_pass).toBeUndefined();
    st().recordExam(exam({ id: "u2", kind: "unit", unit: "u2", points: 8, maxPoints: 10 }), { "ns.bin2dec": [1] });
    expect(st().achievements.unit_pass).toBeTypeOf("number");
  });

  it("комбо 20 — через noteCombo", () => {
    st().noteCombo(19);
    expect(st().achievements.combo_20).toBeUndefined();
    st().noteCombo(20);
    expect(st().achievements.combo_20).toBeTypeOf("number");
    expect(st().achievements.combo_7).toBeTypeOf("number");
  });

  it("сброс прогресса забывает достижения", () => {
    st().recordAnswer(rec(), levelStart(5));
    expect(Object.keys(st().achievements).length).toBeGreaterThan(0);
    st().resetProgress();
    expect(st().achievements).toEqual({});
  });
});
