import { ENT_TOPICS } from "@/content/ent-topics";
import { forecastScore, type ForecastBasis } from "./forecast";
import { MASTERED_FROM } from "./mastery";
import type { AppState } from "./store";
import { todayKey } from "./text";
import type { EntTopicId, Lang } from "./types";

// Отчёт для родителей: компактный снимок прогресса, который целиком живёт в ссылке /report#d=…

export interface ReportPeriod {
  /** Дней с занятиями за период. */
  active: number;
  lessons: number;
}

export interface ReportExam {
  at: number;
  points: number;
  max: number;
  kind: "full" | "mini" | "topic";
}

export interface ReportData {
  v: 1;
  /** Когда снят отчёт. */
  at: number;
  name: string;
  /** Язык ученика: на нём отчёт открывается у родителя (переключатель на странице меняет). */
  lang?: Lang;
  streak: number;
  xp: number;
  /** Окна 7 и 30 дней. */
  days: { d7: ReportPeriod; d30: ReportPeriod };
  /** Освоение 13 тем ЕНТ, % (0..100), в порядке ENT_TOPICS. */
  topics: number[];
  /** До 5 последних пробников, новые первыми. */
  exams: ReportExam[];
  forecast: { basis: ForecastBasis; score: number; low: number; high: number };
  /** До 3 слабых тем. */
  weak: EntTopicId[];
}

export const REPORT_NAME_MAX = 30;
const TOPIC_IDS: EntTopicId[] = ENT_TOPICS.map((t) => t.id);
const BASES: ForecastBasis[] = ["none", "mastery", "exams", "both"];
const KINDS = ["full", "mini", "topic"] as const;

type ReportInput = Pick<AppState, "profile" | "xp" | "streak" | "days" | "skills" | "exams">;

function period(days: AppState["days"], now: number, n: number): ReportPeriod {
  let active = 0;
  let lessons = 0;
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const s = days[todayKey(d)];
    if (!s) continue;
    const l = Number.isFinite(s.lessons) ? (s.lessons ?? 0) : 0;
    if (s.xp > 0 || s.answers > 0 || l > 0) active++;
    lessons += l;
  }
  return { active, lessons };
}

export function buildReport(state: ReportInput, now: number): ReportData {
  const exams = Array.isArray(state.exams) ? state.exams : [];
  const f = forecastScore({ skills: state.skills ?? {}, exams, now });
  const topics = TOPIC_IDS.map((t) => Math.round(f.byTopic[t] * 100));
  const weak =
    f.basis === "none"
      ? []
      : TOPIC_IDS.filter((t) => f.byTopic[t] < MASTERED_FROM)
          .sort((a, b) => f.byTopic[a] - f.byTopic[b])
          .slice(0, 3);
  return {
    v: 1,
    at: now,
    name: (state.profile.name ?? "").trim().slice(0, REPORT_NAME_MAX),
    lang: state.profile.lang === "kk" ? "kk" : "ru",
    streak: state.streak?.current ?? 0,
    xp: state.xp,
    days: { d7: period(state.days ?? {}, now, 7), d30: period(state.days ?? {}, now, 30) },
    topics,
    exams: [...exams]
      .filter((e) => e && Number.isFinite(e.at) && Number.isFinite(e.points) && e.maxPoints > 0)
      .sort((a, b) => b.at - a.at)
      .slice(0, 5)
      .map((e) => ({ at: e.at, points: e.points, max: e.maxPoints, kind: e.kind })),
    forecast: { basis: f.basis, score: f.score, low: f.low, high: f.high },
    weak,
  };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : null;

function parsePeriod(v: unknown, maxDays: number): ReportPeriod | null {
  if (!isObj(v)) return null;
  const active = num(v.active, 0, maxDays);
  const lessons = num(v.lessons, 0, 10_000);
  return active === null || lessons === null ? null : { active: Math.floor(active), lessons: Math.floor(lessons) };
}

/** Ссылка приходит извне: пропускаем только известные поля нужных типов, числа ограничиваем. */
export function parseReport(raw: unknown): ReportData | null {
  if (!isObj(raw) || raw.v !== 1) return null;
  const at = num(raw.at, 0, 8.64e15);
  const streak = num(raw.streak, 0, 100_000);
  const xp = num(raw.xp, 0, 100_000_000);
  if (at === null || streak === null || xp === null || typeof raw.name !== "string") return null;
  if (!isObj(raw.days) || !Array.isArray(raw.topics) || raw.topics.length !== TOPIC_IDS.length) return null;
  const d7 = parsePeriod(raw.days.d7, 7);
  const d30 = parsePeriod(raw.days.d30, 30);
  if (!d7 || !d30) return null;
  const topics = raw.topics.map((x) => num(x, 0, 100));
  if (topics.some((x) => x === null)) return null;
  if (!isObj(raw.forecast) || !BASES.includes(raw.forecast.basis as ForecastBasis)) return null;
  const score = num(raw.forecast.score, 0, 50);
  const low = num(raw.forecast.low, 0, 50);
  const high = num(raw.forecast.high, 0, 50);
  if (score === null || low === null || high === null) return null;
  const exams: ReportExam[] = [];
  for (const e of Array.isArray(raw.exams) ? raw.exams.slice(0, 5) : []) {
    if (!isObj(e)) return null;
    const eat = num(e.at, 0, 8.64e15);
    const max = num(e.max, 1, 1000);
    const points = num(e.points, 0, 1000);
    if (eat === null || max === null || points === null || !KINDS.includes(e.kind as (typeof KINDS)[number])) return null;
    exams.push({ at: eat, points: Math.min(points, max), max, kind: e.kind as ReportExam["kind"] });
  }
  const weak = (Array.isArray(raw.weak) ? raw.weak : []).filter((t): t is EntTopicId => TOPIC_IDS.includes(t as EntTopicId)).slice(0, 3);
  return {
    v: 1,
    at,
    name: raw.name.slice(0, REPORT_NAME_MAX),
    ...(raw.lang === "kk" || raw.lang === "ru" ? { lang: raw.lang } : {}),
    streak: Math.floor(streak),
    xp: Math.floor(xp),
    days: { d7, d30 },
    topics: topics as number[],
    exams,
    forecast: { basis: raw.forecast.basis as ForecastBasis, score: Math.round(score), low: Math.round(low), high: Math.round(high) },
    weak,
  };
}
