import { ENT_TOPICS } from "@/content/ent-topics";
import type { ForecastBasis } from "./forecast";
import type { EntTopicId, Lang } from "./types";

// Отчёт для родителей (#74): компактный снимок прогресса, который целиком живёт в ссылке /report#d=…
// Схема v2 (волна 3B была v1: имя шло всегда, не было времени, точности и % курса).
// Здесь — схема и разбор недоверенной ссылки (лёгкие: их грузит страница /report); сборка из стора —
// lib/parent-report-build.ts (тянет курс и банки заданий).

export type ReportExamKind = "full" | "mini" | "topic";
/** Основа прогноза в отчёте: «none» в отчёт не попадает — там `forecast: null`. */
export type ReportBasis = Exclude<ForecastBasis, "none">;

export interface ReportWeek {
  /** Дней с занятиями за 7 дней. */
  active: number;
  lessons: number;
  /** Активное время, минут. */
  min: number;
  /** Точность, % (0..100); null — за неделю не было ответов. */
  acc: number | null;
}

export interface ReportMonth {
  active: number;
  lessons: number;
}

export interface ReportExam {
  at: number;
  kind: ReportExamKind;
  /** Баллы и максимум. */
  p: number;
  m: number;
}

export interface ReportEnt {
  /** null — данных для прогноза нет («пока рано судить»). */
  forecast: { basis: ReportBasis; score: number; low: number; high: number } | null;
  /**
   * Освоение 13 тем, % (0..100), в порядке ENT_TOPICS. `-1` (TOPIC_NO_DATA) — по теме нет собственных данных:
   * ни ответов по навыкам, ни баллов пробника, ни заданий диагностики (схема v2 допускает значение).
   */
  topics: number[];
  /** До 5 последних пробников (без контрольных по разделу), новые первыми. */
  exams: ReportExam[];
  /** До 3 тем «стоит подтянуть». */
  weak: EntTopicId[];
}

export interface ParentReport {
  v: 2;
  /** Когда снят отчёт. */
  at: number;
  /** Язык отчёта: на нём он открывается у родителя (переключатель на странице меняет). */
  lang: Lang;
  /** Имя — только если ученик включил переключатель; иначе поля нет. */
  name?: string;
  track: "ent" | "school";
  streak: { cur: number; best: number };
  xp: number;
  d7: ReportWeek;
  d30: ReportMonth;
  course: { pct: number; done: number; total: number; grade?: string };
  /** Только у ученика ЕНТ. */
  ent?: ReportEnt;
}

export const REPORT_NAME_MAX = 30;
/** Значение `topics[i]`: по теме нет данных (в отчёте — серая полоса «нет данных»). */
export const TOPIC_NO_DATA = -1;
const TOPIC_IDS: EntTopicId[] = ENT_TOPICS.map((t) => t.id);
const BASES: ReportBasis[] = ["mastery", "exams", "both", "diagnostic"];
export const REPORT_EXAM_KINDS: ReportExamKind[] = ["full", "mini", "topic"];
const KINDS = REPORT_EXAM_KINDS;

/**
 * Имя для ссылки: без управляющих и bidi-символов, без `<>`, лишние пробелы схлопнуты,
 * не длиннее 30 символов (по символам, а не по байтам).
 */
export function cleanName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff<>]/g, " ").replace(/\s+/g, " ").trim();
  return Array.from(s).slice(0, REPORT_NAME_MAX).join("").trim();
}


// ---------- Разбор ссылки (недоверенные данные) ----------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : null;
const int = (v: unknown, min: number, max: number): number | null => {
  const n = num(v, min, max);
  return n === null ? null : Math.floor(n);
};

function parseEnt(raw: unknown): ReportEnt | null {
  if (!isObj(raw)) return null;
  if (!Array.isArray(raw.topics) || raw.topics.length !== TOPIC_IDS.length) return null;
  const topics = raw.topics.map((x) => int(x, TOPIC_NO_DATA, 100));
  if (topics.some((x) => x === null)) return null;

  let forecast: ReportEnt["forecast"] = null;
  if (raw.forecast !== null && raw.forecast !== undefined) {
    const f = raw.forecast;
    if (!isObj(f) || !BASES.includes(f.basis as ReportBasis)) return null;
    const score = int(f.score, 0, 50);
    const low = int(f.low, 0, 50);
    const high = int(f.high, 0, 50);
    if (score === null || low === null || high === null) return null;
    forecast = { basis: f.basis as ReportBasis, score, low: Math.min(low, score), high: Math.max(high, score) };
  }

  const exams: ReportExam[] = [];
  for (const e of Array.isArray(raw.exams) ? raw.exams.slice(0, 5) : []) {
    if (!isObj(e)) return null;
    const at = num(e.at, 0, 8.64e15);
    const m = int(e.m, 1, 1000);
    const p = int(e.p, 0, 1000);
    if (at === null || m === null || p === null || !KINDS.includes(e.kind as ReportExamKind)) return null;
    exams.push({ at, kind: e.kind as ReportExamKind, p: Math.min(p, m), m });
  }
  const weak = (Array.isArray(raw.weak) ? raw.weak : []).filter((t): t is EntTopicId => TOPIC_IDS.includes(t as EntTopicId)).slice(0, 3);
  return { forecast, topics: topics as number[], exams, weak };
}

/** Ссылка приходит извне: пропускаем только известные поля нужных типов, числа ограничиваем. null — данные негодные. */
export function parseParentReport(raw: unknown): ParentReport | null {
  if (!isObj(raw) || raw.v !== 2) return null;
  const at = num(raw.at, 0, 8.64e15);
  const xp = int(raw.xp, 0, 100_000_000);
  if (at === null || xp === null) return null;
  if (raw.track !== "ent" && raw.track !== "school") return null;
  if (!isObj(raw.streak) || !isObj(raw.d7) || !isObj(raw.d30) || !isObj(raw.course)) return null;

  const cur = int(raw.streak.cur, 0, 100_000);
  const best = int(raw.streak.best, 0, 100_000);
  if (cur === null || best === null) return null;

  const a7 = int(raw.d7.active, 0, 7);
  const l7 = int(raw.d7.lessons, 0, 10_000);
  const min = int(raw.d7.min, 0, 7 * 24 * 60);
  const acc = raw.d7.acc === null ? null : int(raw.d7.acc, 0, 100);
  if (a7 === null || l7 === null || min === null || (raw.d7.acc !== null && acc === null)) return null;
  const a30 = int(raw.d30.active, 0, 30);
  const l30 = int(raw.d30.lessons, 0, 100_000);
  if (a30 === null || l30 === null) return null;

  const cp = int(raw.course.pct, 0, 100);
  const done = int(raw.course.done, 0, 100_000);
  const total = int(raw.course.total, 0, 100_000);
  if (cp === null || done === null || total === null) return null;
  const grade = typeof raw.course.grade === "string" && /^[0-9]{1,2}$/.test(raw.course.grade) ? raw.course.grade : undefined;

  let ent: ReportEnt | undefined;
  if (raw.track === "ent") {
    const e = parseEnt(raw.ent);
    if (!e) return null;
    ent = e;
  }
  const name = cleanName(raw.name);

  return {
    v: 2,
    at,
    lang: raw.lang === "kk" ? "kk" : "ru",
    ...(name ? { name } : {}),
    track: raw.track,
    streak: { cur, best: Math.max(best, cur) },
    xp,
    d7: { active: a7, lessons: l7, min, acc },
    d30: { active: a30, lessons: l30 },
    course: { pct: cp, done: Math.min(done, total || done), total, ...(grade ? { grade } : {}) },
    ...(ent ? { ent } : {}),
  };
}
