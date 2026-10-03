import { daysUntil } from "./goals";
import { dayDiff, todayKey } from "./text";
import type { Lang } from "./types";

// План подготовки: оставшиеся готовые уроки раскладываются по неделям до ЕНТ.
// Чистая логика без React и без «текущего времени» (today передаёт вызывающий) — тесты в tests/plan.test.ts.

/** Недель в плане, когда даты ЕНТ нет. */
export const DEFAULT_WEEKS = 12;
/** Потолок длины плана (ЕНТ может быть через год и больше). */
export const MAX_WEEKS = 52;
/** Не больше уроков в неделю. */
export const MAX_LESSONS_PER_WEEK = 7;
/** Раздел «Старт: компьютер с нуля» — его пропускают те, кто знает основы (profile.skipBasics). */
export const START_UNIT_ID = "u0";
/** Ответов за неделю, чтобы засчитать «повторение» (разминка, работа над ошибками). */
export const REVIEW_ANSWERS = 15;
/** Последние недели — повторение и полные пробные ЕНТ. */
export const MAX_REVIEW_WEEKS = 2;

// ---------- Входные данные (структурные подмножества типов приложения) ----------

export interface PlanUnit {
  id: string;
  lessons: readonly { id: string; status: "available" | "soon" }[];
}

export interface PlanLessonStat {
  completions?: number;
  firstAt?: number;
}

export interface PlanExam {
  kind: string;
  at: number;
  /** Для kind = "unit": id раздела. */
  unit?: string;
}

export interface PlanInput {
  units: readonly PlanUnit[];
  /** Сегодня, «ГГГГ-ММ-ДД». */
  today: string;
  /** День начала плана (якорь, см. resolveAnchor). */
  start: string;
  examDate: string | null | undefined;
  skipBasics: boolean;
  lessons: Record<string, PlanLessonStat | undefined>;
  exams: readonly PlanExam[];
  days: Record<string, { answers?: number } | undefined>;
  /**
   * Разделы, у которых есть контрольная (хватает заданий ЕНТ, см. components/exam/checkpoint).
   * Не передан — контрольная у каждого раздела с уроками в плане.
   */
  checkpoints?: ReadonlySet<string>;
}

// ---------- Результат ----------

export type PlanTask =
  | { key: string; type: "lesson"; id: string; unit: string; done: boolean }
  | { key: string; type: "checkpoint"; unit: string; done: boolean }
  | { key: string; type: "exam"; exam: "mini" | "full"; done: boolean }
  | { key: string; type: "review"; done: boolean };

export type WeekStatus = "past" | "current" | "future";

export interface PlanWeek {
  /** Номер недели, с 1. */
  n: number;
  /** Первый и последний день недели, «ГГГГ-ММ-ДД» (последняя неделя обрезается по дате ЕНТ). */
  start: string;
  end: string;
  status: WeekStatus;
  /** Неделя повторения (последние недели перед ЕНТ). */
  review: boolean;
  tasks: PlanTask[];
  done: number;
  total: number;
}

export interface Plan {
  /** past — дата ЕНТ уже прошла: плана нет. */
  state: "ok" | "past";
  weeks: PlanWeek[];
  totalWeeks: number;
  /** Номер текущей недели (с 1). */
  currentWeek: number;
  start: string;
  end: string;
  hasDate: boolean;
  /** Дней до ЕНТ (null — даты нет). */
  daysLeft: number | null;
  /** Уроки плана: всего (включая сделанные в ходе плана) и сделано. */
  lessonsTotal: number;
  lessonsDone: number;
  /** Сколько готовых уроков ещё не пройдено (с учётом тех, что не влезли в план). */
  lessonsLeft: number;
  /** Не влезло в план из-за потолка «7 в неделю». */
  overflow: number;
  /** Уроков, которых ещё нет в курсе («скоро»), — в план не входят. */
  notReady: number;
  /** Сколько уроков в неделю нужно, чтобы успеть; null — уроков нет или недели для уроков кончились. */
  perWeekNeeded: number | null;
  /** Дел в прошедших неделях, которые так и не сделаны. */
  behind: number;
}

// ---------- Даты ----------

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + n);
  return todayKey(d);
}

/** Начало дня (мс, локальное время). */
export function dayStartMs(day: string): number {
  return new Date(`${day}T00:00:00`).getTime();
}

/** Сколько недель в плане: по дате ЕНТ (с дня начала включительно), без даты — 12. Дата раньше начала — 0. */
export function planWeekCount(start: string, examDate: string | null | undefined): number {
  if (examDate && DAY_RE.test(examDate)) {
    const d = dayDiff(start, examDate);
    if (!Number.isFinite(d) || d < 0) return 0;
    return Math.min(MAX_WEEKS, Math.max(1, Math.ceil((d + 1) / 7)));
  }
  return DEFAULT_WEEKS;
}

/** Сколько последних недель отдано повторению: 0 при плане до 2 недель, 1 при 3–5, 2 при 6 и больше. */
export function reviewWeekCount(totalWeeks: number): number {
  return Math.min(MAX_REVIEW_WEEKS, Math.floor(totalWeeks / 3));
}

export interface SavedAnchor {
  start: string;
  exam: string | null;
}

/** Достаёт сохранённый якорь из недоверенных данных (localStorage). */
export function parseAnchor(raw: unknown): SavedAnchor | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.start !== "string" || !DAY_RE.test(r.start) || Number.isNaN(dayDiff(r.start, r.start))) return null;
  const exam = typeof r.exam === "string" && DAY_RE.test(r.exam) ? r.exam : null;
  return { start: r.start, exam };
}

/**
 * День начала плана. Сохранённый якорь действует, пока дата ЕНТ та же и сегодня внутри плана;
 * иначе (первый вход, цель изменили, план закончился) план начинается сегодня.
 */
export function resolveAnchor(saved: SavedAnchor | null, examDate: string | null | undefined, today: string): string {
  const exam = examDate && DAY_RE.test(examDate) ? examDate : null;
  if (saved && saved.exam === exam && saved.start <= today) {
    const weeks = planWeekCount(saved.start, exam);
    if (dayDiff(saved.start, today) < 7 * weeks) return saved.start;
  }
  return today;
}

// ---------- Раскладка уроков ----------

export interface LessonGroup {
  unit: string;
  ids: string[];
  /** false — у раздела нет контрольной (мало заданий ЕНТ): после его уроков ничего не добавляем. */
  checkpoint?: boolean;
}

/** Готовые уроки, которые ещё предстоит пройти: по порядку курса, группами по разделам. */
function lessonGroups(input: PlanInput): { groups: LessonGroup[]; notReady: number } {
  const startMs = dayStartMs(input.start);
  const groups: LessonGroup[] = [];
  let notReady = 0;
  for (const unit of input.units) {
    if (input.skipBasics && unit.id === START_UNIT_ID) continue;
    const ids: string[] = [];
    for (const ref of unit.lessons) {
      const st = input.lessons[ref.id];
      const passed = (st?.completions ?? 0) > 0;
      // Пройденное до начала плана — не в плане; пройденное после — остаётся в плане с галочкой.
      if (passed && (st?.firstAt ?? 0) < startMs) continue;
      if (ref.status === "available") ids.push(ref.id);
      else if (!passed) notReady++;
    }
    if (ids.length) groups.push({ unit: unit.id, ids, checkpoint: input.checkpoints ? input.checkpoints.has(unit.id) : true });
  }
  return { groups, notReady };
}

export type DraftTask = { type: "lesson"; id: string; unit: string } | { type: "checkpoint"; unit: string };

/**
 * Равномерная раскладка по `weeks` неделям: цель недели пересчитывается от остатка (ceil), не больше 7.
 * Раздел не рвётся без нужды: целиком влезающий раздел не начинают в конце загруженной недели,
 * а последний урок раздела может «перелезть» цель на единицу (если цель недели от 2 уроков). Контрольная — сразу после последнего урока раздела.
 * overflow — сколько уроков не поместилось из-за потолка 7 в неделю.
 */
export function layoutLessons(groups: readonly LessonGroup[], weeks: number): { weeks: DraftTask[][]; overflow: number } {
  const out: DraftTask[][] = Array.from({ length: Math.max(0, weeks) }, () => []);
  let remaining = groups.reduce((s, g) => s + g.ids.length, 0);
  let gi = 0;
  let li = 0; // следующий урок в группе gi
  for (let w = 0; w < out.length && remaining > 0; w++) {
    const target = Math.min(MAX_LESSONS_PER_WEEK, Math.max(1, Math.ceil(remaining / (out.length - w))));
    let load = 0;
    while (gi < groups.length) {
      const g = groups[gi];
      const left = g.ids.length - li;
      if (li === 0 && load > 0 && w < out.length - 1) {
        // Новый раздел в уже начатой неделе: если целиком не влезает и неделя наполовину занята — переносим,
        // но только если остаток всё равно помещается в следующие недели (иначе перенос родил бы overflow).
        const fits = load + left <= Math.min(MAX_LESSONS_PER_WEEK, target + 1);
        const laterRoom = MAX_LESSONS_PER_WEEK * (out.length - w - 1);
        if (!fits && load >= Math.ceil(target / 2) && g.ids.length <= MAX_LESSONS_PER_WEEK && remaining <= laterRoom) break;
      }
      const room = load < target || (target >= 2 && left === 1 && load < MAX_LESSONS_PER_WEEK && load < target + 1);
      if (!room) break;
      out[w].push({ type: "lesson", id: g.ids[li++], unit: g.unit });
      load++;
      remaining--;
      if (li >= g.ids.length) {
        if (g.checkpoint !== false) out[w].push({ type: "checkpoint", unit: g.unit });
        gi++;
        li = 0;
      }
    }
  }
  return { weeks: out, overflow: remaining };
}

// ---------- Сборка плана ----------

/** Пробный в окне [from, to): мини засчитывается и полным, полный — только полным. */
function examInWindow(exams: readonly PlanExam[], from: number, to: number, exam: "mini" | "full"): boolean {
  return exams.some((e) => e.at >= from && e.at < to && (exam === "full" ? e.kind === "full" : e.kind === "mini" || e.kind === "full"));
}

export function buildPlan(input: PlanInput): Plan {
  const { today, start, examDate } = input;
  const hasDate = !!examDate && DAY_RE.test(examDate);
  const daysLeft = daysUntil(examDate, today);
  const totalWeeks = planWeekCount(start, examDate);
  if (totalWeeks === 0 || (daysLeft !== null && daysLeft < 0)) {
    return {
      state: "past",
      weeks: [],
      totalWeeks: 0,
      currentWeek: 0,
      start,
      end: start,
      hasDate,
      daysLeft,
      lessonsTotal: 0,
      lessonsDone: 0,
      lessonsLeft: 0,
      overflow: 0,
      notReady: 0,
      perWeekNeeded: null,
      behind: 0,
    };
  }

  const reviewWeeks = reviewWeekCount(totalWeeks);
  const lessonWeeks = totalWeeks - reviewWeeks;
  const { groups, notReady } = lessonGroups(input);
  const layout = layoutLessons(groups, lessonWeeks);

  const startMs = dayStartMs(start);
  const currentWeek = Math.min(totalWeeks, Math.floor(Math.max(0, dayDiff(start, today)) / 7) + 1);
  const unitExamDone = (unit: string) => input.exams.some((e) => e.kind === "unit" && e.unit === unit && e.at >= startMs);
  const lessonDone = (id: string) => (input.lessons[id]?.completions ?? 0) > 0;

  const weeks: PlanWeek[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    const n = i + 1;
    const wStart = addDays(start, 7 * i);
    let wEnd = addDays(start, 7 * i + 6);
    if (hasDate && wEnd > examDate!) wEnd = examDate!;
    const from = dayStartMs(wStart);
    const to = dayStartMs(addDays(start, 7 * i + 7));
    const isReview = i >= lessonWeeks;
    const tasks: PlanTask[] = [];

    const draft = layout.weeks[i] ?? [];
    for (const t of draft) {
      if (t.type === "lesson") tasks.push({ key: `l:${t.id}`, type: "lesson", id: t.id, unit: t.unit, done: lessonDone(t.id) });
      else tasks.push({ key: `c:${t.unit}`, type: "checkpoint", unit: t.unit, done: unitExamDone(t.unit) });
    }

    let answers = 0;
    for (let d = 0; d < 7; d++) answers += input.days[addDays(wStart, d)]?.answers ?? 0;
    const reviewTask: PlanTask = { key: `r:${n}`, type: "review", done: answers >= REVIEW_ANSWERS };

    if (isReview) {
      tasks.push(reviewTask, { key: `e:full:${n}`, type: "exam", exam: "full", done: examInWindow(input.exams, from, to, "full") });
    } else {
      if (!draft.some((t) => t.type === "lesson")) tasks.push(reviewTask);
      // Мини-ЕНТ каждые 2 недели; в коротком плане без недель повторения — ещё и в последнюю неделю.
      if (n % 2 === 0 || (reviewWeeks === 0 && n === totalWeeks)) {
        tasks.push({ key: `e:mini:${n}`, type: "exam", exam: "mini", done: examInWindow(input.exams, from, to, "mini") });
      }
    }

    weeks.push({
      n,
      start: wStart,
      end: wEnd,
      status: n < currentWeek ? "past" : n === currentWeek ? "current" : "future",
      review: isReview,
      tasks,
      done: tasks.filter((t) => t.done).length,
      total: tasks.length,
    });
  }

  const planned = weeks.flatMap((w) => w.tasks).filter((t) => t.type === "lesson");
  const lessonsDone = planned.filter((t) => t.done).length;
  const lessonsLeft = planned.length - lessonsDone + layout.overflow;
  const lessonWeeksLeft = Math.max(0, lessonWeeks - currentWeek + 1);

  return {
    state: "ok",
    weeks,
    totalWeeks,
    currentWeek,
    start,
    end: weeks[weeks.length - 1].end,
    hasDate,
    daysLeft,
    lessonsTotal: planned.length,
    lessonsDone,
    lessonsLeft,
    overflow: layout.overflow,
    notReady,
    perWeekNeeded: lessonsLeft > 0 && lessonWeeksLeft > 0 ? Math.ceil(lessonsLeft / lessonWeeksLeft) : null,
    behind: weeks.filter((w) => w.status === "past").reduce((s, w) => s + (w.total - w.done), 0),
  };
}

/** Текущая неделя плана (null, если плана нет). */
export function currentWeekOf(plan: Plan): PlanWeek | null {
  return plan.weeks[plan.currentWeek - 1] ?? null;
}

// ---------- Ссылки ----------

/** Куда ведёт дело. Контрольная и пробные — без seed: экран возьмёт случайный вариант или продолжит начатый. */
export function taskHref(task: PlanTask): string {
  switch (task.type) {
    case "lesson":
      return `/lesson/${task.id}`;
    case "checkpoint":
      return `/exam/run?kind=unit&unit=${encodeURIComponent(task.unit)}`;
    case "exam":
      return `/exam/run?kind=${task.exam}`;
    case "review":
      return "/drill?mode=smart";
  }
}

// ---------- Подписи ----------

const MONTHS_SHORT = {
  ru: ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
  kk: ["қаң", "ақп", "нау", "сәу", "мам", "мау", "шіл", "там", "қыр", "қаз", "қар", "жел"],
} as const;

/** «5–11 окт» / «29 сен – 5 окт» / «5 окт» (одна дата); неверные даты → "". */
export function formatWeekRange(start: string, end: string, lang: Lang): string {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(end);
  if (!a || !b) return "";
  const [ma, da, mb, db] = [Number(a[2]), Number(a[3]), Number(b[2]), Number(b[3])];
  if (ma < 1 || ma > 12 || mb < 1 || mb > 12) return "";
  const names = MONTHS_SHORT[lang];
  if (start === end) return `${da} ${names[ma - 1]}`;
  if (a[1] === b[1] && ma === mb) return `${da}–${db} ${names[mb - 1]}`;
  return `${da} ${names[ma - 1]} – ${db} ${names[mb - 1]}`;
}
