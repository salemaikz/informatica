import { SKILLS } from "@/content/skills";
import { ENT_POINTS, ENT_TOPICS, topicWeight } from "@/content/ent-topics";
import type { ExamKind } from "./exam";
import type { SkillStat } from "./mastery";
import type { DiagnosticSummary } from "./store";
import type { EntTopicId } from "./types";

// Прогноз балла ЕНТ (из 50): по освоению навыков и по результатам пробников.
// Честность: нет данных — basis "none", балл 0 (UI просит пройти мини-ЕНТ).
// Входная диагностика (#70) даёт предварительный прогноз, пока нет ни пробников, ни достаточно ответов по навыкам.

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
  /** Итог входной диагностики (профиль): используется, только если нет пробников и мало ответов по навыкам. */
  diagnostic?: DiagnosticSummary | null;
}

/** "diagnostic" — предварительно, по входной диагностике (10 заданий). */
export type ForecastBasis = "none" | "mastery" | "exams" | "both" | "diagnostic";

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
/** Погрешность прогноза по диагностике, баллов: 10 заданий — это лишь первый взгляд (показываем диапазоном). */
export const DIAGNOSTIC_MARGIN = 8;
/**
 * Пока по навыкам меньше стольких ответов (там же посеянные диагностикой — по одному на навык) и нет пробников,
 * прогноз остаётся диагностическим. 30 — граница, до которой интервал по навыкам тоже ±8 (`forecastMargin`).
 */
export const DIAGNOSTIC_UNTIL_ANSWERS = 30;
/**
 * После диагностики освоение темы смешивается по навыкам: у каждого навыка вес собственной оценки
 * w = min(1, ответов / TOPIC_PRACTICE_MIN), остальное — доля темы по диагностике. Нетронутые навыки берут оценку
 * диагностики, а не 0 — поэтому нет обвала ни на 30-м ответе, ни на 5-м ответе по теме.
 */
export const TOPIC_PRACTICE_MIN = 5;

/** Освоение тем с опорой на диагностику (см. TOPIC_PRACTICE_MIN). */
export function blendedTopicMastery(skills: Record<string, SkillStat>, diagByTopic: Record<EntTopicId, number>): Record<EntTopicId, number> {
  const out = Object.fromEntries(TOPIC_IDS.map((t) => [t, 0])) as Record<EntTopicId, number>;
  for (const t of TOPIC_IDS) {
    const ids = SKILLS.filter((s) => s.ent === t);
    const prior = clamp01(diagByTopic[t]);
    if (!ids.length) {
      out[t] = prior;
      continue;
    }
    const sum = ids.reduce((acc, s) => {
      const st = skills[s.id];
      const w = Math.min(1, attemptsOf(st) / TOPIC_PRACTICE_MIN);
      return acc + w * (w > 0 ? clamp01(st!.mastery) : 0) + (1 - w) * prior;
    }, 0);
    out[t] = sum / ids.length;
  }
  return out;
}

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

/**
 * Прогноз по входной диагностике: доля верных по каждой теме × вес темы (`topicWeight`) × 50.
 * Темы, которых не было в диагностике, оцениваются по среднему оценённых тем. null — диагностики нет или она пустая.
 */
export function forecastFromDiagnostic(d: DiagnosticSummary | null | undefined): { score: number; low: number; high: number; byTopic: Record<EntTopicId, number> } | null {
  if (!d || !fin(d.max) || d.max <= 0 || !fin(d.points)) return null;
  const rated = new Map<EntTopicId, number>();
  for (const t of TOPIC_IDS) {
    const x = d.byTopic?.[t];
    if (x && fin(x.max) && x.max > 0 && fin(x.points)) rated.set(t, clamp01(x.points / x.max));
  }
  const mean = rated.size ? [...rated.values()].reduce((a, b) => a + b, 0) / rated.size : clamp01(d.points / d.max);
  const byTopic = {} as Record<EntTopicId, number>;
  for (const t of TOPIC_IDS) byTopic[t] = Math.round((rated.get(t) ?? mean) * 1000) / 1000;
  const raw = TOPIC_IDS.reduce((s, t) => s + topicWeight(t) * byTopic[t], 0) * MAX_SCORE;
  return {
    score: Math.max(0, Math.min(MAX_SCORE, Math.round(raw))),
    low: Math.max(0, Math.round(raw - DIAGNOSTIC_MARGIN)),
    high: Math.min(MAX_SCORE, Math.round(raw + DIAGNOSTIC_MARGIN)),
    byTopic,
  };
}

export function forecastScore(input: ForecastInput): Forecast {
  const masteryAnswers = skillAnswers(input.skills);
  const hasMastery = masteryAnswers > 0;
  const diagnostic = forecastFromDiagnostic(input.diagnostic);
  // Освоение по темам; после диагностики — смешивание по навыкам (плавный переход, без обвала прогноза).
  const mastery = diagnostic ? blendedTopicMastery(input.skills, diagnostic.byTopic) : topicMastery(input.skills);
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

  // Диагностика — только пока нет пробников и ответов по навыкам набралось мало (посеянные диагностикой — тоже «мало»).
  const diag = !hasExams && masteryAnswers < DIAGNOSTIC_UNTIL_ANSWERS ? diagnostic : null;
  if (diag) return { score: diag.score, low: diag.low, high: diag.high, basis: "diagnostic", answers: Math.round(input.diagnostic!.max), byTopic: diag.byTopic };

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
