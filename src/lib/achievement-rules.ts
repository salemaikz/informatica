// Условия достижений, которые считаются по общему состоянию (этап 16В, K). Чистая логика без React: стор зовёт
// `earnedByState(state)` в `evaluate` после каждого начисления. Данные — только то, что уже лежит в сторе.
// Тесты — tests/achievement-rules.test.ts.

import { levelInfo } from "./gamification";
import { fullExamCounts, unitPassed } from "./exam-pass";
import { masteryLevel } from "./mastery";
import type { AppState, ExamSummary } from "./store";

/**
 * Версия правил достижений. Правила 16В считаются задним числом: старый ученик при загрузке получает всё, что уже выполнено,
 * молча — без чипов и показа (mergeState в store.ts). Нет поля в сохранении или оно меньше — миграция один раз.
 */
export const ACH_RULES_VERSION = 2;

/** Из чего считаются условия (часть AppState). */
export type AchievementSource = Pick<AppState, "xp" | "streak" | "lessons" | "maxCombo" | "exams" | "codeTasks" | "skills" | "history">;

/** «Факты» о прогрессе: числа, которые сравниваются с порогами достижений. */
export interface AchievementFacts {
  level: number;
  /** Лучшая серия дней (не «живая»: серия, которую уже потеряли, тоже была достигнута). */
  streakBest: number;
  /** Уроки, пройденные хотя бы раз (в плеере, игрой или тестом по разделу). */
  lessonsDone: number;
  /** Уроки, хотя бы раз пройденные идеально: все задания с первой попытки и без подсказок (флаг LessonStat.perfect). */
  lessonsPerfect: number;
  maxCombo: number;
  /** Завершённые полные пробные ЕНТ (отвечено не меньше половины заданий). */
  fullExams: number;
  /** Лучшая доля баллов в полном пробном ЕНТ (0..1). */
  bestFullExam: number;
  /** Сданные тесты по разделам (≥ 80%). */
  unitsPassed: number;
  codeSolved: number;
  skillsMastered: number;
  /** Исправленные ошибки (по истории тестов). */
  mistakesFixed: number;
}

/**
 * Полный пробный ЕНТ засчитывается, если отвечено не меньше половины заданий — то же правило, что у чипов за пробный ЕНТ.
 * У старых записей числа ответов нет (поле `answered`): считаем их по баллам — хоть один балл значит, что отвечали.
 */
export function fullExamDone(e: Pick<ExamSummary, "kind" | "points" | "maxPoints" | "answered" | "questions">): boolean {
  if (e.kind !== "full" || !(e.maxPoints > 0)) return false;
  if (typeof e.answered === "number") return fullExamCounts(e.answered, Math.max(e.answered, e.questions ?? 0));
  return e.points > 0;
}

export function achievementFacts(s: AchievementSource): AchievementFacts {
  const lessons = Object.values(s.lessons);
  const full = s.exams.filter(fullExamDone);
  return {
    level: levelInfo(s.xp).level,
    streakBest: Math.max(s.streak.best, s.streak.current),
    lessonsDone: lessons.filter((l) => (l?.completions ?? 0) > 0).length,
    lessonsPerfect: lessons.filter((l) => l?.perfect === true).length,
    maxCombo: s.maxCombo,
    fullExams: full.length,
    bestFullExam: full.reduce((best, e) => Math.max(best, e.points / e.maxPoints), 0),
    unitsPassed: s.exams.filter((e) => e.kind === "unit" && unitPassed(e.points, e.maxPoints)).length,
    codeSolved: Object.values(s.codeTasks).filter((t) => t?.solved).length,
    skillsMastered: Object.values(s.skills).filter((st) => masteryLevel(st) === "mastered").length,
    mistakesFixed: s.history.reduce((n, e) => n + (e.fixed?.length ?? 0), 0),
  };
}

/** id достижения → условие по фактам. Остальные (первый урок, серии 3/7, комбо 7, ИИ, игры…) стор выдаёт сам. */
export const ACHIEVEMENT_RULES: Record<string, (f: AchievementFacts) => boolean> = {
  lessons_10: (f) => f.lessonsDone >= 10,
  lessons_25: (f) => f.lessonsDone >= 25,
  lessons_50: (f) => f.lessonsDone >= 50,
  lessons_100: (f) => f.lessonsDone >= 100,
  streak_30: (f) => f.streakBest >= 30,
  streak_100: (f) => f.streakBest >= 100,
  perfect_10: (f) => f.lessonsPerfect >= 10,
  perfect_50: (f) => f.lessonsPerfect >= 50,
  exam_5: (f) => f.fullExams >= 5,
  exam_90: (f) => f.bestFullExam >= 0.9,
  unit_pass: (f) => f.unitsPassed >= 1,
  level_5: (f) => f.level >= 5,
  level_10: (f) => f.level >= 10,
  level_20: (f) => f.level >= 20,
  level_30: (f) => f.level >= 30,
  code_1: (f) => f.codeSolved >= 1,
  code_10: (f) => f.codeSolved >= 10,
  mastery_5: (f) => f.skillsMastered >= 5,
  mastery_20: (f) => f.skillsMastered >= 20,
  fixer_5: (f) => f.mistakesFixed >= 5,
  combo_20: (f) => f.maxCombo >= 20,
};

/** Какие достижения из таблицы условий выполнены сейчас (уже полученные отфильтровывает стор). */
export function earnedByState(s: AchievementSource): string[] {
  const facts = achievementFacts(s);
  return Object.entries(ACHIEVEMENT_RULES)
    .filter(([, rule]) => rule(facts))
    .map(([id]) => id);
}
