import { ENT_TOPICS, topicWeight } from "@/content/ent-topics";
import { SKILLS } from "@/content/skills";
import { dayDiff, todayKey } from "./text";
import type { EntTopicId, Lang } from "./types";

// Цели ученика: отсчёт до ЕНТ, уроки за неделю, сравнение прогноза с целью, план недели.
// Чистая логика без React — тесты в tests/goals.test.ts.

/** Дней от today до даты ЕНТ (0 — сегодня, меньше 0 — уже прошёл); null — даты нет или она неверна. */
export function daysUntil(examDate: string | null | undefined, today: string): number | null {
  if (!examDate || !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return null;
  const n = dayDiff(today, examDate);
  return Number.isFinite(n) ? n : null;
}

/** Насколько вперёд разумно ставить дату ЕНТ, дней (чуть больше двух лет): дальше — скорее всего опечатка. */
export const EXAM_DATE_MAX_DAYS = 800;

/** Дата ЕНТ годится: «ГГГГ-ММ-ДД», не раньше сегодняшнего дня и не дальше EXAM_DATE_MAX_DAYS. */
export function isExamDateValid(day: string | null | undefined, today: string): boolean {
  const n = daysUntil(day, today);
  return n !== null && n >= 0 && n <= EXAM_DATE_MAX_DAYS;
}

/** Целевые баллы из 50 на экране онбординга (дальше — ползунок в профиле, шаг 5). */
export const TARGET_CHOICES = [25, 30, 35, 40, 45] as const;

/** Склонение русского существительного по числу: 1 день, 2 дня, 5 дней. */
export function pluralRu(n: number, forms: readonly [string, string, string]): string {
  const a = Math.abs(Math.trunc(n));
  const m10 = a % 10;
  const m100 = a % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}

/** «1 день», «3 дня», «214 дней» / «214 күн». */
export function daysText(n: number, lang: Lang): string {
  return lang === "kk" ? `${n} күн` : `${n} ${pluralRu(n, ["день", "дня", "дней"])}`;
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + n);
  return todayKey(d);
}

/** Понедельник недели, в которую входит день «ГГГГ-ММ-ДД». */
export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  return addDays(day, -((d.getDay() + 6) % 7));
}

export interface WeekDay {
  key: string;
  lessons: number;
  today: boolean;
  /** День ещё не наступил. */
  future: boolean;
}

export interface WeekProgress {
  done: number;
  goal: number;
  /** 0..1 */
  ratio: number;
  reached: boolean;
  days: WeekDay[];
}

/** Уроки за текущую неделю (пн–вс) против цели «уроков в неделю». */
export function weekProgress(days: Record<string, { lessons?: number } | undefined>, weeklyLessons: number, today: string): WeekProgress {
  const start = weekStart(today);
  const list: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(start, i);
    const n = days[key]?.lessons;
    return { key, lessons: typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0, today: key === today, future: key > today };
  });
  const done = list.reduce((s, d) => s + d.lessons, 0);
  const goal = Math.max(1, Math.round(weeklyLessons) || 1);
  return { done, goal, ratio: Math.min(1, done / goal), reached: done >= goal, days: list };
}

export type GoalStatus = "none" | "below" | "on" | "above";

/** Допуск «на уровне цели», баллов. */
export const GOAL_TOLERANCE = 2;

/**
 * Прогноз против цели: нет данных / ниже / на уровне (±2 балла) / выше. gap — сколько баллов не хватает (меньше 0 — запас).
 * Цель не выбрана (`targetSet` = false, «пока не знаю») — сравнивать не с чем: status "none", разрыва нет (gap 0).
 */
export function goalStatus(forecast: { score: number; basis: string }, targetScore: number, targetSet = true): { status: GoalStatus; gap: number } {
  if (!targetSet) return { status: "none", gap: 0 };
  if (forecast.basis === "none") return { status: "none", gap: targetScore };
  const gap = targetScore - forecast.score;
  const status: GoalStatus = gap > GOAL_TOLERANCE ? "below" : gap < -GOAL_TOLERANCE ? "above" : "on";
  return { status, gap };
}

export interface PlanTopic {
  topic: EntTopicId;
  /** Доля темы в 50 баллах ЕНТ (0..1, `topicWeight`). */
  weight: number;
  /** Освоение 0..1. */
  mastery: number;
  /** weight × (1 − mastery): какую долю 50 баллов можно «забрать» на этой теме (× 50 — баллы). */
  gain: number;
}

/** Темы, которые уже освоены, в план недели не берём. */
export const PLAN_MASTERED = 0.8;

/**
 * План недели: до n тем, где больше всего баллов можно добрать — вес темы × (1 − освоение).
 * Освоенные (≥ 0.8) пропускаем. При равенстве — по номеру темы.
 */
export function weeklyPlan(byTopic: Partial<Record<EntTopicId, number>>, n = 3): PlanTopic[] {
  const fin = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
  return ENT_TOPICS.map((t) => {
    const mastery = fin(byTopic[t.id]);
    const weight = topicWeight(t.id);
    return { topic: t.id, weight, mastery, gain: weight * (1 - mastery) };
  })
    .filter((x) => x.mastery < PLAN_MASTERED)
    .sort((a, b) => b.gain - a.gain || a.topic.localeCompare(b.topic))
    .slice(0, Math.max(0, n));
}

export interface TrendPoint {
  at: number;
  /** Балл, приведённый к 50. */
  score: number;
  kind: string;
}

/** История пробников для мини-графика: от старых к новым, без тестов по теме, баллы приведены к 50. */
export function examTrend(exams: { at: number; points: number; maxPoints: number; kind: string }[], limit = 8): TrendPoint[] {
  return exams
    .filter((e) => e && e.maxPoints > 0 && Number.isFinite(e.points) && Number.isFinite(e.at) && (e.kind === "full" || e.kind === "mini"))
    .sort((a, b) => a.at - b.at)
    .slice(-limit)
    .map((e) => ({ at: e.at, kind: e.kind, score: Math.round(Math.max(0, Math.min(1, e.points / e.maxPoints)) * 50) }));
}

/** Первый готовый урок, который ученик ещё не проходил (по порядку курса). */
export function nextLessonId(units: { lessons: { id: string; status: string }[] }[], done: Record<string, unknown>): string | null {
  for (const u of units) for (const l of u.lessons) if (l.status === "available" && !done[l.id]) return l.id;
  return null;
}

/** Готовые уроки темы ЕНТ: по навыкам урока (у навыка есть `ent`) и по `entTopics` урока. */
export function lessonsForTopic(topic: EntTopicId, lessons: { id: string; skills: string[]; entTopics?: EntTopicId[] }[]): string[] {
  const bySkill = new Set(SKILLS.filter((s) => s.ent === topic).map((s) => s.id));
  return lessons.filter((l) => l.entTopics?.includes(topic) || l.skills.some((s) => bySkill.has(s))).map((l) => l.id);
}

// ---------- Даты по-русски и по-казахски ----------
// Intl с локалью kk-KZ есть не во всех браузерах (Chromium без полного ICU отдаёт английский),
// поэтому месяцы — свои.

const MONTHS_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_KK = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"];

/** «ГГГГ-ММ-ДД» → «30 января 2027» / «2027 жылғы 30 қаңтар»; неверная строка → "". */
export function formatExamDate(day: string, lang: Lang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return "";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return lang === "kk" ? `${y} жылғы ${d} ${MONTHS_KK[mo - 1]}` : `${d} ${MONTHS_RU[mo - 1]} ${y}`;
}

/** Короткая дата для подписи графика: «30.01». */
export function formatDayMonth(at: number): string {
  const d = new Date(at);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}
