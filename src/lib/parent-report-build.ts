// Сборка отчёта для родителей (#74) из стора ученика. Отдельно от разбора (lib/parent-report.ts): здесь нужны курс,
// прогноз и банки заданий, а странице /report (её открывает родитель на телефоне) — только разбор, без тяжёлого содержимого.

import { ENT_TOPICS } from "@/content/ent-topics";
import { SKILLS } from "@/content/skills";
import { forecastScore } from "./forecast";
import { liveStreak } from "./gamification";
import { courseViewOf } from "./course-view";
import { MASTERED_FROM } from "./mastery";
import { cleanName, REPORT_EXAM_KINDS as KINDS, TOPIC_NO_DATA, type ParentReport, type ReportEnt, type ReportExam, type ReportExamKind } from "./parent-report";
import { dayTotals, lastDays } from "./progress";
import { entVisible } from "./school";
import type { AppState } from "./store";
import { todayKey } from "./text";
import type { EntTopicId, Lang } from "./types";

const TOPIC_IDS: EntTopicId[] = ENT_TOPICS.map((t) => t.id);

/** Меньше этого времени за день без других занятий днём с занятиями не считается (случайно открытая страница). */
const ACTIVE_DAY_SECONDS = 60;

export type ReportInput = Pick<AppState, "profile" | "xp" | "streak" | "days" | "skills" | "exams" | "lessons">;

export interface ReportOptions {
  /** Показать имя ученика. По умолчанию — нет. */
  withName?: boolean;
  /** Язык отчёта; по умолчанию — язык ученика. */
  lang?: Lang;
}

const pct = (x: number) => Math.round(Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0)) * 100);

/** Дни с занятиями и уроки за набор дней. */
function activity(days: AppState["days"], keys: string[]): { active: number; lessons: number } {
  let active = 0;
  let lessons = 0;
  for (const k of keys) {
    const s = days?.[k];
    if (!s || typeof s !== "object") continue;
    const l = Number.isFinite(s.lessons) ? Math.max(0, s.lessons ?? 0) : 0;
    // Один критерий дня для «дней» и «минут»: любой учебный сигнал — XP, ответы, игры, уроки или заметное время
    // (теория, наставник, диагностика, незавершённый пробник пишут только секунды).
    const secs = Number.isFinite(s.seconds) ? s.seconds : 0;
    if (s.xp > 0 || s.answers > 0 || (s.asked ?? 0) > 0 || (s.games ?? 0) > 0 || l > 0 || secs >= ACTIVE_DAY_SECONDS) active++;
    lessons += l;
  }
  return { active, lessons };
}

export function buildParentReport(state: ReportInput, now: number, opts: ReportOptions = {}): ParentReport {
  const { profile } = state;
  const days = state.days ?? {};
  const keys7 = lastDays(now, 7);
  const keys30 = lastDays(now, 30);

  // Точность и время за 7 дней — как на экране «Прогресс» (#66, #68); нет ответов — null.
  const totals = dayTotals(days, keys7);
  const acc = totals.accuracy.value === null || totals.accuracy.asked <= 0 ? null : pct(totals.accuracy.value);
  const a7 = activity(days, keys7);
  const a30 = activity(days, keys30);

  const view = courseViewOf({ lessons: state.lessons ?? {}, track: profile.track, grade: profile.grade, skipBasics: profile.skipBasics });
  const cur = liveStreak(state.streak, todayKey(new Date(now)));
  const isEnt = entVisible(profile);
  const name = opts.withName ? cleanName(profile.name) : "";

  const report: ParentReport = {
    v: 2,
    at: now,
    lang: opts.lang ?? (profile.lang === "kk" ? "kk" : "ru"),
    ...(name ? { name } : {}),
    track: isEnt ? "ent" : "school",
    streak: { cur, best: Math.max(cur, state.streak?.best ?? 0) },
    xp: Math.max(0, Math.floor(state.xp ?? 0)),
    d7: { active: a7.active, lessons: a7.lessons, min: Math.round(totals.seconds / 60), acc },
    d30: { active: a30.active, lessons: a30.lessons },
    course: { pct: pct(view.ratio), done: view.done, total: view.total, ...(view.kind === "class" ? { grade: view.grade } : {}) },
  };
  if (isEnt) report.ent = buildEnt(state, now);
  return report;
}

function buildEnt(state: ReportInput, now: number): ReportEnt {
  const exams = (Array.isArray(state.exams) ? state.exams : []).filter((e) => e && e.kind !== "unit");
  const f = forecastScore({ skills: state.skills ?? {}, exams, now, diagnostic: state.profile.diagnostic });

  // Тема «с данными»: по ней есть ответы по навыкам, баллы пробника или задания диагностики.
  const hasData = (t: EntTopicId) =>
    SKILLS.some((s) => s.ent === t && (state.skills?.[s.id]?.attempts ?? 0) > 0) ||
    exams.some((e) => (e.byTopic?.[t]?.max ?? 0) > 0) ||
    (state.profile.diagnostic?.byTopic?.[t]?.max ?? 0) > 0;
  // Тема без собственных данных — «нет данных»; тема, чья оценка пока опирается на диагностику (`provisional`),
  // не бывает «освоенной» — как в плане цели (#70).
  const shaky = new Set(f.provisional);
  const topics = TOPIC_IDS.map((t) => {
    if (f.basis === "none" || !hasData(t)) return TOPIC_NO_DATA;
    const v = shaky.has(t) ? Math.min(f.byTopic[t] ?? 0, MASTERED_FROM - 0.01) : (f.byTopic[t] ?? 0);
    return pct(v);
  });
  const weak =
    f.basis === "none"
      ? []
      : TOPIC_IDS.filter((t) => hasData(t) && f.byTopic[t] < MASTERED_FROM)
          .sort((a, b) => f.byTopic[a] - f.byTopic[b])
          .slice(0, 3);

  const recent: ReportExam[] = exams
    .filter((e) => Number.isFinite(e.at) && Number.isFinite(e.points) && e.maxPoints > 0 && KINDS.includes(e.kind as ReportExamKind))
    .sort((a, b) => b.at - a.at)
    .slice(0, 5)
    .map((e) => ({ at: e.at, kind: e.kind as ReportExamKind, p: Math.max(0, Math.min(e.maxPoints, e.points)), m: e.maxPoints }));

  return {
    forecast: f.basis === "none" ? null : { basis: f.basis, score: f.score, low: f.low, high: f.high },
    topics,
    exams: recent,
    weak,
  };
}
