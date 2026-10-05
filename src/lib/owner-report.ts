// Сводка для страницы владельца /owner (решение #69): из суточных счётчиков (поля хеша `ev:<день>`, lib/analytics-fields.ts)
// в таблицы: итоги по дням, воронка уроков, трудные задания, удержание, спрос, сердечки, онбординг, диагностика и т. д.
// Чистая функция без React и сервера: покрыта tests/owner-report.test.ts. Названия уроков и заданий приходят снаружи (ReportNames).

import { EVENT_SCHEMA } from "@/lib/analytics-schema";

/** Счётчики одних суток: поля хеша `ev:<день>` (пусто, если за день ничего не пришло). */
export interface DayFields {
  /** День по Астане «ГГГГ-ММ-ДД». */
  day: string;
  fields: Record<string, number>;
}

/** Как называть уроки и задания: из контента на сервере. undefined — такого нет в контенте (покажем сырой id). */
export interface ReportNames {
  lesson(id: string): string | undefined;
  task(key: string): { title: string; lesson?: string } | undefined;
}

/** Минимум первых ответов, чтобы задание попало в «трудные» (на меньшем числе доля неверных случайна). */
export const HARD_MIN_N = 10;
/** Сколько строк в воронке уроков и в трудных заданиях. */
export const TOP_ROWS = 20;

const EVENT_NAMES = new Set(Object.keys(EVENT_SCHEMA));

// ---------- Вспомогательное ----------

/** Целый процент a от b или null, если b = 0. */
export function share(a: number, b: number): number | null {
  return b > 0 ? Math.round((100 * a) / b) : null;
}

/** Сумма полей за несколько суток. */
export function sumFields(days: readonly DayFields[]): Record<string, number> {
  const sum: Record<string, number> = {};
  for (const d of days) {
    for (const [k, n] of Object.entries(d.fields)) if (Number.isFinite(n)) sum[k] = (sum[k] ?? 0) + n;
  }
  return sum;
}

/** Поля вида `<prefix><rest>`: вызывает fn(rest, n). */
function each(sum: Record<string, number>, prefix: string, fn: (rest: string, n: number) => void) {
  for (const [k, n] of Object.entries(sum)) if (k.startsWith(prefix) && n > 0) fn(k.slice(prefix.length), n);
}

export interface Count {
  key: string;
  n: number;
}

/** Счётчики по префиксу, от большего к меньшему (при равенстве — по ключу). */
function counts(sum: Record<string, number>, prefix: string): Count[] {
  const out: Count[] = [];
  each(sum, prefix, (key, n) => out.push({ key, n }));
  return out.sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

const total = (list: readonly Count[]) => list.reduce((s, c) => s + c.n, 0);

// ---------- Итоги по дням ----------

export interface DayRow {
  day: string;
  events: number;
  lessonStarts: number;
  lessonFinishes: number;
}

/** Строки по дням, свежие сверху. */
export function dayRows(days: readonly DayFields[]): DayRow[] {
  return [...days]
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
    .map((d) => {
      let events = 0;
      for (const [k, n] of Object.entries(d.fields)) if (EVENT_NAMES.has(k) && n > 0) events += n;
      return { day: d.day, events, lessonStarts: d.fields.lesson_start ?? 0, lessonFinishes: d.fields.lesson_finish ?? 0 };
    });
}

// ---------- Воронка уроков ----------

export interface FunnelRow {
  lesson: string;
  /** Название из контента или undefined. */
  title?: string;
  starts: number;
  resumes: number;
  finishes: number;
  /** Доля дошедших до конца, %: концы / (старты − продолжения), не больше 100. Продолжение сохранённого урока — не новый ученик. */
  reach: number | null;
  /** Средняя точность по законченным, %. */
  avgAcc: number | null;
  /** Сколько выходов до конца и на каком шаге их больше всего (шаг из всего). */
  quits: number;
  quitStep: number | null;
  quitOf: number | null;
}

/**
 * Доля дошедших до конца, %. Старт и продолжение того же урока — один ученик, поэтому в знаменателе только «свежие» старты
 * (старты − продолжения). Сутки бывают разрезаны (старт вчера, продолжение и конец сегодня), поэтому знаменатель не меньше числа концов:
 * доля не бывает больше 100%.
 */
export function reachOf(finishes: number, starts: number, resumes: number): number | null {
  return share(finishes, Math.max(finishes, starts - resumes));
}

/** Топ уроков по стартам. Старты — оба режима (learn и check), в том числе продолжения. */
export function funnelRows(sum: Record<string, number>, names: Pick<ReportNames, "lesson">, limit = TOP_ROWS): FunnelRow[] {
  interface Agg {
    starts: number;
    resumes: number;
    finishes: number;
    acc: number;
    quits: number;
    /** шаг → { выходов, из скольких шагов чаще всего } */
    steps: Map<number, { n: number; ofs: Map<number, number> }>;
  }
  const by = new Map<string, Agg>();
  const get = (lesson: string): Agg => {
    let a = by.get(lesson);
    if (!a) by.set(lesson, (a = { starts: 0, resumes: 0, finishes: 0, acc: 0, quits: 0, steps: new Map() }));
    return a;
  };
  each(sum, "ls:", (rest, n) => {
    // `<lesson>:<via>`; id урока может сам содержать «:», поэтому режим — после последнего двоеточия.
    const i = rest.lastIndexOf(":");
    if (i > 0) get(rest.slice(0, i)).starts += n;
  });
  each(sum, "lr:", (lesson, n) => (get(lesson).resumes += n));
  each(sum, "lf:", (lesson, n) => (get(lesson).finishes += n));
  each(sum, "la:", (lesson, n) => (get(lesson).acc += n));
  each(sum, "lq:", (rest, n) => {
    const m = /^(.+):(\d+)\/(\d+)$/.exec(rest);
    if (!m) return;
    const a = get(m[1]);
    a.quits += n;
    const step = Number(m[2]);
    const of = Number(m[3]);
    const s = a.steps.get(step) ?? { n: 0, ofs: new Map() };
    s.n += n;
    s.ofs.set(of, (s.ofs.get(of) ?? 0) + n);
    a.steps.set(step, s);
  });

  const top = <K>(m: Map<K, number>, order: (a: K, b: K) => number): K | null => {
    let best: K | null = null;
    let bestN = 0;
    for (const [k, n] of m) if (n > bestN || (n === bestN && best !== null && order(k, best) < 0)) [best, bestN] = [k, n];
    return best;
  };

  const rows: FunnelRow[] = [];
  for (const [lesson, a] of by) {
    if (a.starts <= 0) continue;
    let quitStep: number | null = null;
    let quitOf: number | null = null;
    if (a.steps.size > 0) {
      quitStep = top(new Map([...a.steps].map(([s, v]) => [s, v.n])), (x, y) => x - y);
      if (quitStep !== null) quitOf = top(a.steps.get(quitStep)!.ofs, (x, y) => y - x);
    }
    rows.push({
      lesson,
      title: names.lesson(lesson),
      starts: a.starts,
      resumes: a.resumes,
      finishes: a.finishes,
      reach: reachOf(a.finishes, a.starts, a.resumes),
      avgAcc: a.finishes > 0 ? Math.round(a.acc / a.finishes) : null,
      quits: a.quits,
      quitStep,
      quitOf,
    });
  }
  return rows.sort((x, y) => y.starts - x.starts || x.lesson.localeCompare(y.lesson)).slice(0, limit);
}

// ---------- Трудные задания ----------

export interface HardTaskRow {
  step: string;
  title?: string;
  lesson?: string;
  n: number;
  wrong: number;
  /** Доля неверных (и пропущенных) с первой попытки, %. */
  wrongPct: number;
  /** Доля ответов с подсказкой, %. */
  hintPct: number;
}

/** Задания с n ≥ HARD_MIN_N первых ответов; сверху — где чаще всего ошибаются. */
export function hardTaskRows(sum: Record<string, number>, names: Pick<ReportNames, "task">, limit = TOP_ROWS): HardTaskRow[] {
  const by = new Map<string, { n: number; w: number; h: number }>();
  each(sum, "tk:", (rest, n) => {
    const i = rest.lastIndexOf(":");
    if (i <= 0) return;
    const kind = rest.slice(i + 1);
    if (kind !== "n" && kind !== "w" && kind !== "h") return;
    const step = rest.slice(0, i);
    const a = by.get(step) ?? { n: 0, w: 0, h: 0 };
    a[kind] += n;
    by.set(step, a);
  });
  const rows: HardTaskRow[] = [];
  for (const [step, a] of by) {
    if (a.n < HARD_MIN_N) continue;
    const name = names.task(step);
    rows.push({
      step,
      title: name?.title,
      lesson: name?.lesson,
      n: a.n,
      wrong: a.w,
      wrongPct: Math.round((100 * a.w) / a.n),
      hintPct: Math.round((100 * a.h) / a.n),
    });
  }
  return rows.sort((x, y) => y.wrongPct - x.wrongPct || y.n - x.n || x.step.localeCompare(y.step)).slice(0, limit);
}

// ---------- Удержание ----------

export interface RetentionRow {
  /** Через сколько календарных дней после первого запуска вернулись. */
  d: 1 | 7 | 30;
  /** Вернулись и сколько их было в когортах, по которым день возврата уже закончился. */
  returned: number;
  cohort: number;
  pct: number | null;
}

export interface Retention {
  /** Первых запусков (событие active d = 0) за всё время в данных. */
  starts: number;
  rows: RetentionRow[];
}

/** День «ГГГГ-ММ-ДД» плюс k дней (по календарю, без часовых поясов). */
export function addDaysIso(day: string, k: number): string {
  const t = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  return new Date(t + k * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Удержание по когортам: для каждого дня X с первыми запусками (act:0) смотрим, сколько отметилось ровно через k дней
 * (act:k в день X + k). Считаются только дни с записанными первыми запусками (act:0 > 0) и которые уже закончились
 * (самый свежий день — неполный, его пропускаем). Устройства, начавшие до включения сбора, и потерянные act:0 когорту не раздувают:
 * возвраты в день не больше когорты дня (C6).
 */
export function retention(history: readonly DayFields[]): Retention {
  const by = new Map(history.map((d) => [d.day, d.fields]));
  const newest = history.reduce((m, d) => (d.day > m ? d.day : m), "");
  const rows: RetentionRow[] = ([1, 7, 30] as const).map((k) => {
    let returned = 0;
    let cohort = 0;
    for (const [day, f] of by) {
      const c = f["act:0"] ?? 0;
      // Нет записанных первых запусков (данных нет или сбор ещё не шёл) — это не когорта.
      if (!(c > 0)) continue;
      const target = addDaysIso(day, k);
      const back = by.get(target);
      if (!back || target >= newest) continue;
      cohort += c;
      returned += Math.min(back[`act:${k}`] ?? 0, c);
    }
    return { d: k, returned, cohort, pct: share(returned, cohort) };
  });
  let starts = 0;
  for (const d of history) starts += d.fields["act:0"] ?? 0;
  return { starts, rows };
}

// ---------- Сводка ----------

export interface OwnerReport {
  /** Сколько суток в окне. */
  days: number;
  perDay: DayRow[];
  totals: { events: number; lessonStarts: number; lessonFinishes: number };
  funnel: FunnelRow[];
  hardTasks: HardTaskRow[];
  demand: {
    views: Count[];
    viewsTotal: number;
    /** `<тариф>:<период>` (lite:month, unlimited:year…). */
    clicks: Count[];
    clicksTotal: number;
    trials: Count[];
    trialsTotal: number;
    shop: Count[];
    shopTotal: number;
  };
  heartsOut: Count[];
  onboarding: { steps: Count[]; done: Count[] };
  diagnostic: { finished: number; notFinished: number };
  breakReasons: Count[];
  feedback: Count[];
  practice: { games: GameRow[]; drills: StartFinishRow[]; exams: StartFinishRow[] };
}

export interface StartFinishRow {
  key: string;
  starts: number;
  finishes: number;
}
export interface GameRow extends StartFinishRow {
  quits: number;
}

function startFinish(sum: Record<string, number>, startPrefix: string, finishPrefix: string): StartFinishRow[] {
  const by = new Map<string, StartFinishRow>();
  const get = (key: string) => by.get(key) ?? (by.set(key, { key, starts: 0, finishes: 0 }), by.get(key)!);
  each(sum, startPrefix, (k, n) => (get(k).starts += n));
  each(sum, finishPrefix, (k, n) => (get(k).finishes += n));
  return [...by.values()].sort((a, b) => b.starts - a.starts || a.key.localeCompare(b.key));
}

/** Все таблицы страницы владельца из счётчиков окна (days — сутки окна, в любом порядке). */
export function buildOwnerReport(days: readonly DayFields[], names: ReportNames): OwnerReport {
  const sum = sumFields(days);
  const perDay = dayRows(days);

  const views = counts(sum, "pv:");
  const clicks = counts(sum, "pc:");
  const trials = counts(sum, "ts:");
  const shop = counts(sum, "sc:");

  const games = startFinish(sum, "gs:", "gf:").map((r) => ({ ...r, quits: sum[`gq:${r.key}`] ?? 0 }));
  // Игры, из которых только выходили (старта не пришло): тоже показываем.
  for (const q of counts(sum, "gq:")) if (!games.some((g) => g.key === q.key)) games.push({ key: q.key, starts: 0, finishes: 0, quits: q.n });

  return {
    days: days.length,
    perDay,
    totals: {
      events: perDay.reduce((s, d) => s + d.events, 0),
      lessonStarts: perDay.reduce((s, d) => s + d.lessonStarts, 0),
      lessonFinishes: perDay.reduce((s, d) => s + d.lessonFinishes, 0),
    },
    funnel: funnelRows(sum, names),
    hardTasks: hardTaskRows(sum, names),
    demand: {
      views,
      viewsTotal: total(views),
      clicks,
      clicksTotal: total(clicks),
      trials,
      trialsTotal: total(trials),
      shop,
      shopTotal: total(shop),
    },
    heartsOut: counts(sum, "ho:"),
    onboarding: { steps: counts(sum, "ob:"), done: counts(sum, "od:") },
    diagnostic: { finished: sum["dg:1"] ?? 0, notFinished: sum["dg:0"] ?? 0 },
    breakReasons: counts(sum, "br:"),
    feedback: counts(sum, "fb:"),
    practice: { games, drills: startFinish(sum, "ds:", "df:"), exams: startFinish(sum, "xs:", "xf:") },
  };
}
