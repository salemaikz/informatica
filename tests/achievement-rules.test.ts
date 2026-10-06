import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_RULES, achievementFacts, earnedByState, type AchievementSource } from "@/lib/achievement-rules";
import { levelStart } from "@/lib/gamification";
import type { ExamSummary } from "@/lib/store";

const mastered = { attempts: 10, correct: 10, mastery: 0.95, lastSeen: 1, clean: 6, okDays: 3 };
const weak = { attempts: 3, correct: 1, mastery: 0.3, lastSeen: 1 };

const exam = (over: Partial<ExamSummary> = {}): ExamSummary => ({
  id: "e",
  kind: "full",
  seed: 1,
  at: 1,
  points: 30,
  maxPoints: 50,
  durationSec: 600,
  byTopic: {},
  ...over,
});

function source(over: Partial<AchievementSource> = {}): AchievementSource {
  return { xp: 0, streak: { current: 0, best: 0, lastDay: null }, lessons: {}, maxCombo: 0, exams: [], codeTasks: {}, skills: {}, history: [], ...over };
}

/** perfect — флаг LessonStat.perfect: ставит только finishSession за идеальное прохождение (точность 100% его не заменяет). */
const lessons = (n: number, bestAccuracy = 0.8, perfect = false) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`l${i}`, { completions: 1, bestAccuracy, lastAt: 1, totalXp: 10, ...(perfect ? { perfect: true as const } : {}) }]));

describe("achievementFacts: числа из стора", () => {
  it("пустой стор — нули", () => {
    expect(achievementFacts(source())).toEqual({
      level: 1,
      streakBest: 0,
      lessonsDone: 0,
      lessonsPerfect: 0,
      maxCombo: 0,
      fullExams: 0,
      bestFullExam: 0,
      unitsPassed: 0,
      codeSolved: 0,
      skillsMastered: 0,
      mistakesFixed: 0,
    });
  });

  it("уровень — по XP", () => {
    expect(achievementFacts(source({ xp: levelStart(5) })).level).toBe(5);
    expect(achievementFacts(source({ xp: levelStart(5) - 1 })).level).toBe(4);
  });

  it("серия — лучшая, а не только текущая", () => {
    expect(achievementFacts(source({ streak: { current: 2, best: 31, lastDay: "2026-10-01" } })).streakBest).toBe(31);
    expect(achievementFacts(source({ streak: { current: 5, best: 3, lastDay: "2026-10-01" } })).streakBest).toBe(5);
  });

  it("уроки: пройденные хотя бы раз и пройденные идеально (по флагу, а не по точности)", () => {
    const f = achievementFacts(
      source({
        lessons: {
          ...lessons(3),
          p1: { completions: 2, bestAccuracy: 1, lastAt: 1, totalXp: 1, perfect: true },
          // точность 100% без флага (были подсказки или повторы) — не идеальный урок
          p2: { completions: 1, bestAccuracy: 1, lastAt: 1, totalXp: 1 },
        },
      }),
    );
    expect(f.lessonsDone).toBe(5);
    expect(f.lessonsPerfect).toBe(1);
  });

  it("полные пробные ЕНТ: считаем только full и лучшую долю баллов", () => {
    const f = achievementFacts(source({ exams: [exam({ points: 20 }), exam({ id: "b", points: 46 }), exam({ id: "c", kind: "mini", points: 10, maxPoints: 10 })] }));
    expect(f.fullExams).toBe(2);
    expect(f.bestFullExam).toBeCloseTo(0.92);
  });

  it("полный пробный ЕНТ засчитывается, только если отвечено не меньше половины заданий (как чипы за пробный)", () => {
    const f = (e: Partial<ExamSummary>) => achievementFacts(source({ exams: [exam({ questions: 40, ...e })] })).fullExams;
    expect(f({ answered: 20 })).toBe(1); // ровно половина
    expect(f({ answered: 19 })).toBe(0);
    expect(f({ answered: 0 })).toBe(0);
    expect(f({ answered: 40, points: 0 })).toBe(1); // ответил на всё, но все неверно — завершил
    // старая запись без числа ответов — по баллам: нет баллов, значит и ответов не было
    expect(f({ points: 12 })).toBe(1);
    expect(f({ points: 0 })).toBe(0);
    // мини-ЕНТ в «полные» не идёт, даже если ответов много
    expect(f({ kind: "mini", answered: 40 })).toBe(0);
  });

  it("тест по разделу сдан только от 80%", () => {
    expect(achievementFacts(source({ exams: [exam({ kind: "unit", unit: "u1", points: 7, maxPoints: 10 })] })).unitsPassed).toBe(0);
    expect(achievementFacts(source({ exams: [exam({ kind: "unit", unit: "u1", points: 8, maxPoints: 10 })] })).unitsPassed).toBe(1);
  });

  it("код: только решённые задачи; освоено: только «освоено»; ошибки: исправленные в истории", () => {
    const f = achievementFacts(
      source({
        codeTasks: { a: { solved: true, attempts: 1, at: 1 }, b: { solved: false, attempts: 4, at: 1 } },
        skills: { x: mastered, y: weak },
        history: [{ fixed: ["a", "b"] }, { fixed: [] }, { fixed: ["c"] }] as unknown as AchievementSource["history"],
      }),
    );
    expect(f.codeSolved).toBe(1);
    expect(f.skillsMastered).toBe(1);
    expect(f.mistakesFixed).toBe(3);
  });
});

describe("правила достижений: пороги", () => {
  const earned = (over: Partial<AchievementSource>) => new Set(earnedByState(source(over)));

  it("пустой стор — ничего", () => {
    expect(earnedByState(source())).toEqual([]);
  });

  it("уроки 10 / 25 / 50 / 100", () => {
    expect(earned({ lessons: lessons(9) }).has("lessons_10")).toBe(false);
    expect(earned({ lessons: lessons(10) }).has("lessons_10")).toBe(true);
    const e25 = earned({ lessons: lessons(25) });
    expect(e25.has("lessons_25") && !e25.has("lessons_50")).toBe(true);
    expect(earned({ lessons: lessons(50) }).has("lessons_50")).toBe(true);
    const e100 = earned({ lessons: lessons(100) });
    expect(e100.has("lessons_100") && e100.has("lessons_50")).toBe(true);
  });

  it("идеальные уроки 10 / 50 — по уроку, а не по числу прохождений", () => {
    expect(earned({ lessons: lessons(10, 0.95) }).has("perfect_10")).toBe(false);
    // 100% точности без флага «идеально» (были подсказки) — не считается
    expect(earned({ lessons: lessons(10, 1) }).has("perfect_10")).toBe(false);
    expect(earned({ lessons: lessons(9, 1, true) }).has("perfect_10")).toBe(false);
    expect(earned({ lessons: lessons(10, 1, true) }).has("perfect_10")).toBe(true);
    expect(earned({ lessons: lessons(49, 1, true) }).has("perfect_50")).toBe(false);
    expect(earned({ lessons: lessons(50, 1, true) }).has("perfect_50")).toBe(true);
  });

  it("серии 30 и 100 дней", () => {
    expect(earned({ streak: { current: 29, best: 29, lastDay: null } }).has("streak_30")).toBe(false);
    expect(earned({ streak: { current: 30, best: 30, lastDay: null } }).has("streak_30")).toBe(true);
    expect(earned({ streak: { current: 0, best: 100, lastDay: null } }).has("streak_100")).toBe(true);
  });

  it("уровни 5 / 10 / 20 / 30 — по порогам XP", () => {
    for (const lvl of [5, 10, 20, 30]) {
      expect(earned({ xp: levelStart(lvl) - 1 }).has(`level_${lvl}`), `level_${lvl} за 1 XP до`).toBe(false);
      expect(earned({ xp: levelStart(lvl) }).has(`level_${lvl}`), `level_${lvl}`).toBe(true);
    }
  });

  it("пробные ЕНТ: пять полных; 90% на полном", () => {
    const five = Array.from({ length: 5 }, (_, i) => exam({ id: `e${i}` }));
    expect(earned({ exams: five.slice(0, 4) }).has("exam_5")).toBe(false);
    expect(earned({ exams: five }).has("exam_5")).toBe(true);
    // пять попыток, но одна — почти пустая (отвечено меньше половины): пять завершённых не набралось
    const lazy = five.map((e, i) => ({ ...e, questions: 40, answered: i === 4 ? 5 : 30 }));
    expect(earned({ exams: lazy }).has("exam_5")).toBe(false);
    // мини-ЕНТ в счёт «полных» не идёт
    expect(earned({ exams: [...five.slice(0, 4), exam({ id: "m", kind: "mini" })] }).has("exam_5")).toBe(false);
    expect(earned({ exams: [exam({ points: 44 })] }).has("exam_90")).toBe(false);
    expect(earned({ exams: [exam({ points: 45 })] }).has("exam_90")).toBe(true);
    expect(earned({ exams: [exam({ kind: "topic", points: 10, maxPoints: 10 })] }).has("exam_90")).toBe(false);
  });

  it("тест по разделу: сдан от 80%", () => {
    expect(earned({ exams: [exam({ kind: "unit", points: 79, maxPoints: 100 })] }).has("unit_pass")).toBe(false);
    expect(earned({ exams: [exam({ kind: "unit", points: 80, maxPoints: 100 })] }).has("unit_pass")).toBe(true);
  });

  it("практикум кода: 1 и 10 решённых задач", () => {
    const tasks = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`t${i}`, { solved: true, attempts: 1, at: 1 }]));
    expect(earned({ codeTasks: tasks(1) }).has("code_1")).toBe(true);
    expect(earned({ codeTasks: tasks(1) }).has("code_10")).toBe(false);
    expect(earned({ codeTasks: tasks(10) }).has("code_10")).toBe(true);
  });

  it("освоение: 5 и 20 навыков; комбо 20; ошибки 5", () => {
    const skills = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`s${i}`, mastered]));
    expect(earned({ skills: skills(4) }).has("mastery_5")).toBe(false);
    expect(earned({ skills: skills(5) }).has("mastery_5")).toBe(true);
    expect(earned({ skills: skills(20) }).has("mastery_20")).toBe(true);
    expect(earned({ maxCombo: 19 }).has("combo_20")).toBe(false);
    expect(earned({ maxCombo: 20 }).has("combo_20")).toBe(true);
    const fixed = (n: number) => [{ fixed: Array.from({ length: n }, (_, i) => `s${i}`) }] as unknown as AchievementSource["history"];
    expect(earned({ history: fixed(4) }).has("fixer_5")).toBe(false);
    expect(earned({ history: fixed(5) }).has("fixer_5")).toBe(true);
  });

  it("у каждого правила есть достижение с таким id (проверено в gamification.test.ts), а ключи не повторяются", () => {
    const ids = Object.keys(ACHIEVEMENT_RULES);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(21);
  });
});
