import { SKILLS } from "@/content/skills";
import { ENT_POINTS, ENT_TOPICS, topicWeight } from "@/content/ent-topics";
import type { ExamKind } from "./exam";
import type { SkillStat } from "./mastery";
import type { EntTopicId } from "./types";

// Прогноз балла ЕНТ (из 50): по освоению навыков и по результатам пробников.
// Честность: нет данных — basis "none", балл 0 (UI просит пройти мини-ЕНТ).

export interface ForecastExam {
  at: number;
  points: number;
  maxPoints: number;
  /** Partial — как в сохранённых попытках (ExamSummary в store). */
  byTopic: Partial<Record<EntTopicId, { points: number; max: number }>>;
  /** Если указан — учитываем только full и mini (тест по теме не показывает всю картину). */
  kind?: ExamKind;
}

export interface ForecastInput {
  skills: Record<string, SkillStat>;
  exams: ForecastExam[];
  now: number;
}

export type ForecastBasis = "none" | "mastery" | "exams" | "both";

export interface Forecast {
  /** Из 50, целое. */
  score: number;
  low: number;
  high: number;
  basis: ForecastBasis;
  /** Сколько ответов за прогнозом (навыки + оценка по пробникам). */
  answers: number;
  /** Освоение темы 0..1. */
  byTopic: Record<EntTopicId, number>;
}

export const MAX_SCORE = ENT_POINTS;
/** Доля пробников в итоговом прогнозе, если есть и они, и навыки. */
export const EXAM_SHARE = 0.6;
const EXAMS_USED = 3;
/** Вес пробника уменьшается вдвое за столько дней (поверх «свежие весомее»). */
const HALF_LIFE_DAYS = 45;
const DAY_MS = 86_400_000;
/** Примерно 0.8 задания на балл (40 заданий — 50 баллов). */
const QUESTIONS_PER_POINT = 0.8;

const TOPIC_IDS: EntTopicId[] = ENT_TOPICS.map((t) => t.id);

const fin = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
/** NaN/мусор из сохранения → 0. */
const clamp01 = (x: unknown) => (fin(x) ? Math.max(0, Math.min(1, x)) : 0);
/** Число попыток навыка (данные из localStorage — недоверенные). */
const attemptsOf = (s: SkillStat | undefined) => (s && fin(s.attempts) && s.attempts > 0 ? Math.floor(s.attempts) : 0);

/** Освоение каждой темы: среднее mastery навыков темы (без попыток — 0). */
export function topicMastery(skills: Record<string, SkillStat>): Record<EntTopicId, number> {
  const out = Object.fromEntries(TOPIC_IDS.map((t) => [t, 0])) as Record<EntTopicId, number>;
  for (const t of TOPIC_IDS) {
    const ids = SKILLS.filter((s) => s.ent === t);
    if (!ids.length) continue;
    const sum = ids.reduce((acc, s) => acc + (attemptsOf(skills[s.id]) ? clamp01(skills[s.id].mastery) : 0), 0);
    out[t] = sum / ids.length;
  }
  return out;
}

function skillAnswers(skills: Record<string, SkillStat>): number {
  const known = new Set(SKILLS.map((s) => s.id));
  return Object.entries(skills).reduce((acc, [id, s]) => acc + (known.has(id) ? attemptsOf(s) : 0), 0);
}

/** Интервал по числу ответов: < 30 — ±8, < 100 — ±5, иначе ±3. */
export function forecastMargin(answers: number): number {
  return answers < 30 ? 8 : answers < 100 ? 5 : 3;
}

export function forecastScore(input: ForecastInput): Forecast {
  const mastery = topicMastery(input.skills);
  const masteryAnswers = skillAnswers(input.skills);
  const hasMastery = masteryAnswers > 0;
  const masteryScore = TOPIC_IDS.reduce((s, t) => s + topicWeight(t) * mastery[t], 0) * MAX_SCORE;

  // Последние 3 попытки: новее — весомее (3, 2, 1) и ещё затухание по возрасту.
  // Попытки из сохранения — недоверенные: без даты/баллов не учитываем, баллы обрезаем до 0..max.
  const used = input.exams
    .filter((e) => e && fin(e.at) && fin(e.points) && fin(e.maxPoints) && e.maxPoints > 0)
    .filter((e) => e.kind === undefined || e.kind === "full" || e.kind === "mini")
    .map((e) => ({ ...e, points: Math.max(0, Math.min(e.maxPoints, e.points)) }))
    .sort((a, b) => b.at - a.at)
    .slice(0, EXAMS_USED)
    .map((e, i) => {
      const ageDays = Math.max(0, (input.now - e.at) / DAY_MS);
      return { e, w: (EXAMS_USED - i) * Math.pow(0.5, ageDays / HALF_LIFE_DAYS) };
    });
  const hasExams = used.length > 0;
  const wSum = used.reduce((s, x) => s + x.w, 0);
  const examScore = hasExams ? used.reduce((s, x) => s + x.w * (x.e.points / x.e.maxPoints), 0) / wSum * MAX_SCORE : 0;
  const examAnswers = used.reduce((s, x) => s + Math.round(x.e.maxPoints * QUESTIONS_PER_POINT), 0);

  const basis: ForecastBasis = hasMastery && hasExams ? "both" : hasExams ? "exams" : hasMastery ? "mastery" : "none";
  const answers = (hasMastery ? masteryAnswers : 0) + examAnswers;

  // Тема: доля баллов по пробникам (взвешенно) и освоение навыков.
  const byTopic = {} as Record<EntTopicId, number>;
  for (const t of TOPIC_IDS) {
    let num = 0;
    let den = 0;
    for (const x of used) {
      const bt = x.e.byTopic?.[t];
      if (bt && fin(bt.max) && bt.max > 0 && fin(bt.points)) {
        num += x.w * clamp01(bt.points / bt.max);
        den += x.w;
      }
    }
    const fromExam = den > 0 ? num / den : null;
    let v: number;
    if (fromExam !== null && hasMastery) v = EXAM_SHARE * fromExam + (1 - EXAM_SHARE) * mastery[t];
    else if (fromExam !== null) v = fromExam;
    else v = hasMastery ? mastery[t] : 0;
    byTopic[t] = Math.round(clamp01(v) * 1000) / 1000;
  }

  if (basis === "none") return { score: 0, low: 0, high: 0, basis, answers: 0, byTopic };

  const raw = basis === "both" ? EXAM_SHARE * examScore + (1 - EXAM_SHARE) * masteryScore : basis === "exams" ? examScore : masteryScore;
  const score = Math.max(0, Math.min(MAX_SCORE, Math.round(raw)));
  const m = forecastMargin(answers);
  return {
    score,
    low: Math.max(0, Math.round(raw - m)),
    high: Math.min(MAX_SCORE, Math.round(raw + m)),
    basis,
    answers,
    byTopic,
  };
}
