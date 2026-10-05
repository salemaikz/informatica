// Прогресс ученика (решения #66, #67, #71): % курса, разделы, темы ЕНТ, динамика, слабые места.
// Чистая логика без React; экраны — components/progress, страница /stats. Тесты — tests/progress.test.ts.
//
// - Курс считается по готовым урокам на карте (UNITS): уроки вне карты (например ns-1-binary) и «скоро» в % не входят.
// - Темы ЕНТ и слабые места — по дневному срезу навыков (skillDays, 60 дней) и оценкам освоения (skills).
// - Данных мало — честно «нет данных», а не 0%: порог слабых мест — MIN_ANSWERS ответов.

import { UNITS } from "@/content/course-map";
import { hasBank as bankExists, lessonMeta } from "@/content/catalog";
import { ENT_TOPICS, topicWeight } from "@/content/ent-topics";
import { SKILLS } from "@/content/skills";
import type { SchoolGradePlan } from "@/content/school-program";
import { daysAccuracy, type DaysAccuracy } from "./accuracy";
import { MASTERED_FROM, WEAK_BELOW, masteryLevel, masteryNeeds, type MasteryLevel, type SkillStat } from "./mastery";
import type { LessonsDone } from "./school";
import type { SkillDays } from "./skill-days";
import type { DayStat } from "./store";
import { todayKey } from "./text";
import type { EntTopicId, L, Unit } from "./types";

const DAY_MS = 86_400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Раздел «Старт: компьютер с нуля»: ученик, знающий основы, его пропускает (profile.skipBasics). */
export const BASICS_UNIT = "u0";

/** Слабое место требует не меньше стольких ответов по навыку (#71). */
export const MIN_ANSWERS = 3;
/** Изменение точности по теме считаем, если в каждой из двух недель не меньше стольких заданий. */
export const TREND_MIN = 5;
/** То же для одного навыка (заданий по навыку меньше, чем по теме). */
export const FELL_MIN = 3;
/** Падение точности навыка (доля, 0..1), с которого оно считается «упала». */
export const FELL_DROP = 0.15;
/** Навык без практики столько дней считается «давно не было практики». */
export const STALE_DAYS = 14;

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

// ---------- Курс и разделы ----------

export interface CourseProgress {
  /** Пройдено готовых уроков на карте. */
  done: number;
  /** Готовых уроков на карте. */
  ready: number;
  /** Все места на карте (готовые и «скоро»): «ещё total − ready скоро». */
  total: number;
  /** done / ready, 0..1 (готовых нет — 0). */
  ratio: number;
}

export interface ProgressOptions {
  /** Основы знакомы: раздел «Старт» можно пропустить — из счёта исключается целиком (иначе 100% недостижимо); на карте он остаётся. */
  skipBasics?: boolean;
  /** Карта курса (для тестов). По умолчанию UNITS. */
  units?: readonly Unit[];
}

const isDone = (lessons: LessonsDone, id: string): boolean => num(lessons?.[id]?.completions) > 0;
/** Урок на карте готов: помечен «доступен» и действительно есть в курсе. */
const isReady = (ref: { id: string; status: string }): boolean => ref.status === "available" && !!lessonMeta(ref.id);

function shownUnits(opts: ProgressOptions): Unit[] {
  const units = opts.units ?? UNITS;
  return units.filter((u) => !(opts.skipBasics && u.id === BASICS_UNIT));
}

/** Прогресс курса: только готовые уроки на карте. Пройденный урок вне карты (старый ns-1-binary) не считается. */
export function courseProgress(lessons: LessonsDone, opts: ProgressOptions = {}): CourseProgress {
  let done = 0;
  let ready = 0;
  let total = 0;
  for (const unit of shownUnits(opts)) {
    for (const ref of unit.lessons) {
      total++;
      if (!isReady(ref)) continue;
      ready++;
      if (isDone(lessons, ref.id)) done++;
    }
  }
  return { done, ready, total, ratio: ready > 0 ? done / ready : 0 };
}

export interface UnitRow {
  id: string;
  title: L;
  color: string;
  done: number;
  ready: number;
  total: number;
  /** Уроков «скоро». */
  soon: number;
  ratio: number;
  /** Средняя оценка освоения навыков готовых уроков раздела, 0..1 (не тронутые — 0); null — готовых уроков нет. */
  mastery: number | null;
  /** Навыков раздела всего и «освоено» по правилу #67 (этап 16В). */
  skillsTotal: number;
  skillsMastered: number;
}

/** Сколько навыков из списка «освоено» (masteryLevel) — для строк разделов. */
const masteredCount = (ids: readonly string[], skills: Record<string, SkillStat>): number => ids.filter((id) => masteryLevel(skills?.[id]) === "mastered").length;

/** Строки «Разделы курса»: пройдено/готово/скоро, средняя оценка освоения и освоенные навыки. */
export function unitRows(lessons: LessonsDone, skills: Record<string, SkillStat>, opts: ProgressOptions = {}): UnitRow[] {
  return shownUnits(opts).map((unit) => {
    let done = 0;
    let ready = 0;
    const skillIds = new Set<string>();
    for (const ref of unit.lessons) {
      if (!isReady(ref)) continue;
      ready++;
      if (isDone(lessons, ref.id)) done++;
      lessonMeta(ref.id)?.skills.forEach((s) => skillIds.add(s));
    }
    return {
      id: unit.id,
      title: unit.title,
      color: unit.color,
      done,
      ready,
      total: unit.lessons.length,
      soon: unit.lessons.length - ready,
      ratio: ready > 0 ? done / ready : 0,
      mastery: skillIds.size ? avgMastery([...skillIds], skills) : null,
      skillsTotal: skillIds.size,
      skillsMastered: masteredCount([...skillIds], skills),
    };
  });
}

/** Строка «Разделы программы» школьного трека: уроки раздела (уникальные) и темы без уроков («скоро»). */
export interface SchoolSectionRow {
  id: string;
  title: L;
  done: number;
  ready: number;
  soon: number;
  ratio: number;
  /** Навыков раздела всего и «освоено» (навык засчитывается в первом разделе класса, где встретился). */
  skillsTotal: number;
  skillsMastered: number;
}

/** Навыки готовых уроков каждого раздела плана (по порядку плана). Навык — только в первом разделе, где встретился. */
function schoolSectionSkillIds(plan: SchoolGradePlan): string[][] {
  const seen = new Set<string>();
  return plan.sections.map((s) => {
    const ids: string[] = [];
    for (const t of s.topics) {
      for (const lesson of t.lessonIds) {
        for (const sk of lessonMeta(lesson)?.skills ?? []) {
          if (!TOPIC_OF.has(sk) || seen.has(sk)) continue;
          seen.add(sk);
          ids.push(sk);
        }
      }
    }
    return ids;
  });
}

export function schoolSectionRows(plan: SchoolGradePlan, lessons: LessonsDone, skills: Record<string, SkillStat> = {}): SchoolSectionRow[] {
  const skillIds = schoolSectionSkillIds(plan);
  return plan.sections.map((s, i) => {
    const ids = new Set<string>();
    let soon = 0;
    for (const t of s.topics) {
      if (!t.lessonIds.length) soon++;
      t.lessonIds.forEach((id) => ids.add(id));
    }
    const done = [...ids].filter((id) => isDone(lessons, id)).length;
    return {
      id: s.id,
      title: s.title,
      done,
      ready: ids.size,
      soon,
      ratio: ids.size ? done / ids.size : 0,
      skillsTotal: skillIds[i].length,
      skillsMastered: masteredCount(skillIds[i], skills),
    };
  });
}

// ---------- Навыки по разделам (этап 16В, N) ----------
// «Освоение навыков» на /stats: навыки сгруппированы по разделам трека (разделы курса ЕНТ или разделы программы класса),
// в группе — ВСЕ навыки раздела, в том числе ещё не начатые. Навык числится в одном разделе — в первом, где встретился.

/** Раздел для группировки: название, цвет и навыки готовых уроков раздела (в порядке курса). */
export interface SkillSection {
  id: string;
  title: L;
  color: string;
  skillIds: string[];
}

/** Разделы курса ЕНТ → навыки готовых уроков. Раздел «Старт» при skipBasics не входит (как в «Разделах курса»). */
export function unitSkillSections(opts: ProgressOptions = {}): SkillSection[] {
  const seen = new Set<string>();
  const out: SkillSection[] = [];
  for (const unit of shownUnits(opts)) {
    const skillIds: string[] = [];
    for (const ref of unit.lessons) {
      if (!isReady(ref)) continue;
      for (const sk of lessonMeta(ref.id)?.skills ?? []) {
        if (!TOPIC_OF.has(sk) || seen.has(sk)) continue;
        seen.add(sk);
        skillIds.push(sk);
      }
    }
    if (skillIds.length) out.push({ id: unit.id, title: unit.title, color: unit.color, skillIds });
  }
  return out;
}

/** Разделы программы класса → навыки готовых уроков. Разделы без готовых уроков (нет навыков) в список не попадают. */
export function schoolSkillSections(plan: SchoolGradePlan): SkillSection[] {
  const skillIds = schoolSectionSkillIds(plan);
  const out: SkillSection[] = [];
  plan.sections.forEach((s, i) => {
    // Цвет раздела — по номеру в плане (как в «Разделах программы»).
    if (skillIds[i].length) out.push({ id: s.id, title: s.title, color: UNITS[i % UNITS.length].color, skillIds: skillIds[i] });
  });
  return out;
}

/** Строка навыка в группе: уровень по правилу #67, оценка и (для «почти освоено») чего не хватает. */
export interface SkillRow {
  id: string;
  level: MasteryLevel;
  /** Оценка 0..1 (у не начатого — 0). */
  mastery: number;
  /** Чего не хватает до «освоено»: только у «в процессе» с оценкой от MASTERED_FROM. */
  needs: { clean: number; days: number } | null;
}

export type SkillCounts = Record<MasteryLevel, number>;

export interface SkillGroup {
  id: string;
  /** null — группа «Другие навыки» (названия нет в данных, подпись берёт экран). */
  title: L | null;
  color: string;
  /** Сначала слабые, затем в процессе, освоенные и не начатые; внутри уровня — порядок курса. */
  rows: SkillRow[];
  counts: SkillCounts;
}

/** Порядок уровней в группе: что требует внимания — выше. */
const LEVEL_ORDER: Record<MasteryLevel, number> = { weak: 0, progress: 1, mastered: 2, new: 3 };

/** Цвет группы «Другие навыки» — нейтральный токен. */
const OTHER_COLOR = "var(--muted)";

function skillRow(id: string, skills: Record<string, SkillStat>): SkillRow {
  const st = skills?.[id];
  const level = masteryLevel(st);
  const mastery = level === "new" ? 0 : Math.min(1, num(st?.mastery));
  return { id, level, mastery, needs: level === "progress" && mastery >= MASTERED_FROM ? masteryNeeds(st) : null };
}

function groupOf(id: string, title: L | null, color: string, ids: readonly string[], skills: Record<string, SkillStat>): SkillGroup {
  const counts: SkillCounts = { mastered: 0, progress: 0, weak: 0, new: 0 };
  const rows = ids.map((sk, i) => ({ row: skillRow(sk, skills), i }));
  for (const { row } of rows) counts[row.level]++;
  rows.sort((a, b) => LEVEL_ORDER[a.row.level] - LEVEL_ORDER[b.row.level] || a.i - b.i);
  return { id, title, color, rows: rows.map((r) => r.row), counts };
}

/**
 * Группы навыков по разделам. Навыки, которых нет ни в одном разделе трека (например, школьные навыки у ученика ЕНТ
 * или «Старт» при skipBasics), показываются отдельной группой «Другие навыки» — только те, по которым уже были ответы.
 */
export function skillGroups(sections: readonly SkillSection[], skills: Record<string, SkillStat>): SkillGroup[] {
  const groups = sections.map((s) => groupOf(s.id, s.title, s.color, s.skillIds, skills));
  const inSections = new Set(sections.flatMap((s) => s.skillIds));
  const extra = SKILLS.filter((s) => !inSections.has(s.id) && num(skills?.[s.id]?.attempts) > 0).map((s) => s.id);
  if (extra.length) groups.push(groupOf("other", null, OTHER_COLOR, extra, skills));
  return groups;
}

/** Сумма по всем группам: «освоено · в процессе · слабо · не начато». */
export function skillTotals(groups: readonly SkillGroup[]): SkillCounts {
  const total: SkillCounts = { mastered: 0, progress: 0, weak: 0, new: 0 };
  for (const g of groups) for (const k of Object.keys(total) as MasteryLevel[]) total[k] += g.counts[k];
  return total;
}

/** Какая группа раскрыта по умолчанию: первая со слабыми навыками, иначе первая. Групп нет — null. */
export function defaultOpenGroup(groups: readonly SkillGroup[]): string | null {
  return (groups.find((g) => g.counts.weak > 0) ?? groups[0])?.id ?? null;
}

// ---------- Итоги по дням (плитки статистики) ----------

export interface DayTotals {
  /** Точность по #66 (daysAccuracy): approx — только старые дни, поля «сам / с подсказкой / пропущено» тогда не показываем. */
  accuracy: DaysAccuracy;
  /** Задания новых дней (с полем asked): самостоятельно / с подсказкой / пропущено. Сумма = accuracy.asked, если не approx. */
  self: number;
  hinted: number;
  skipped: number;
  /** Активное время, с (DayStat.seconds), и «из них игры». */
  seconds: number;
  gameSeconds: number;
  /** Игры отдельно: действий и верных. */
  games: number;
  gameCorrect: number;
}

/** Итоги за набор дней (по умолчанию — все): точность, «сам / с подсказкой / пропущено», время, игры. */
export function dayTotals(days: Record<string, DayStat>, keys?: readonly string[]): DayTotals {
  const list = (keys ?? Object.keys(days ?? {})).map((k) => days?.[k]).filter((d): d is DayStat => !!d && typeof d === "object");
  let hinted = 0;
  let skipped = 0;
  let asked = 0;
  let seconds = 0;
  let gameSeconds = 0;
  let games = 0;
  let gameCorrect = 0;
  for (const d of list) {
    // Только дни с новым учётом (#66): у старых дней поля подсказок и пропусков не велись.
    if (num(d.asked) > 0) {
      asked += num(d.asked);
      hinted += num(d.hinted);
      skipped += num(d.skipped);
    }
    seconds += num(d.seconds);
    gameSeconds += num(d.gameSeconds);
    games += num(d.games);
    gameCorrect += num(d.gameCorrect);
  }
  return {
    accuracy: daysAccuracy(days ?? {}, keys),
    self: Math.max(0, asked - hinted - skipped),
    hinted,
    skipped,
    seconds,
    gameSeconds: Math.min(gameSeconds, seconds),
    games,
    gameCorrect,
  };
}

// ---------- Дни ----------

/** Последние n дней «ГГГГ-ММ-ДД» по местному времени, от старого к новому (последний — день `now`). */
export function lastDays(now: number, n: number): string[] {
  if (!Number.isFinite(now) || n <= 0) return [];
  const base = new Date(now);
  base.setHours(12, 0, 0, 0); // полдень — чтобы сдвиг часов не перескочил через сутки
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push(todayKey(d));
  }
  return out;
}

/** Самый ранний день срезa по навыкам (с него копятся данные) или null — среза нет. */
export function skillDaysSince(skillDays: SkillDays): string | null {
  let min: string | null = null;
  for (const [day, row] of Object.entries(skillDays ?? {})) {
    if (!DAY_RE.test(day) || !row || typeof row !== "object" || !Object.keys(row).length) continue;
    if (min === null || day < min) min = day;
  }
  return min;
}

/** Срез копится меньше `days` дней: данные с `since` — честная подпись «Данные с …» (since = null — данных нет совсем). */
export function isPartialWindow(since: string | null, now: number, days: number): boolean {
  if (!since) return true;
  const start = lastDays(now, days)[0];
  return !!start && since > start;
}

// ---------- Темы ЕНТ ----------

const TOPIC_OF: Map<string, EntTopicId | undefined> = new Map(SKILLS.map((s) => [s.id, s.ent]));

export type TopicLevel = "none" | "weak" | "progress" | "mastered";

/**
 * Освоение темы — как на «Карте ЕНТ» (components/learn/map.ts → topicMastery): value — среднее по всем навыкам темы
 * (не тронутые — 0); none — попыток нет; weak — среднее по тронутым < WEAK_BELOW; mastered — value ≥ MASTERED_FROM
 * И каждый навык темы «освоен» по правилу #67 (4 верных без подсказки в 2 разных днях): три ответа подряд за один присест
 * тему не «осваивают».
 */
function topicMasteryOf(topic: EntTopicId, skills: Record<string, SkillStat>): { value: number; level: TopicLevel } {
  const ids = SKILLS.filter((s) => s.ent === topic).map((s) => s.id);
  const touched = ids.filter((id) => num(skills[id]?.attempts) > 0);
  const value = avgMastery(ids, skills);
  if (!touched.length) return { value, level: "none" };
  const touchedAvg = touched.reduce((a, id) => a + num(skills[id].mastery), 0) / touched.length;
  if (touchedAvg < WEAK_BELOW) return { value, level: "weak" };
  const allMastered = ids.every((id) => masteryLevel(skills[id]) === "mastered");
  return { value, level: value >= MASTERED_FROM && allMastered ? "mastered" : "progress" };
}

function avgMastery(ids: string[], skills: Record<string, SkillStat>): number {
  if (!ids.length) return 0;
  const sum = ids.reduce((a, id) => a + (num(skills[id]?.attempts) > 0 ? num(skills[id].mastery) : 0), 0);
  return Math.round((sum / ids.length) * 1000) / 1000;
}

export interface TopicStat {
  topic: EntTopicId;
  /** Заданий за период (первые попытки, пропуск тоже). */
  n: number;
  /** Сумма баллов. */
  score: number;
  /** Точность 0..1 или null — заданий не было. */
  acc: number | null;
  /** Активных секунд на ответы. */
  sec: number;
  /** Из них с подсказкой. */
  hinted: number;
  /** Оценка освоения темы 0..1 и её уровень (для цвета). */
  mastery: number;
  level: TopicLevel;
}

interface Sum {
  n: number;
  s: number;
  h: number;
  sec: number;
}

/** Итог навыка за набор дней. */
function sumSkill(skillDays: SkillDays, skill: string, keys: readonly string[]): Sum {
  const r: Sum = { n: 0, s: 0, h: 0, sec: 0 };
  for (const day of keys) {
    const d = skillDays?.[day]?.[skill];
    if (!d || typeof d !== "object") continue;
    r.n += num(d.n);
    r.s += num(d.s);
    r.h += num(d.h);
    r.sec += num(d.sec);
  }
  return r;
}

const accOf = (n: number, s: number): number | null => (n > 0 ? Math.min(1, s / n) : null);

/** Итог по темам ЕНТ за 7 или 30 дней: заданий, точность, время, подсказки, освоение. Все 13 тем, по порядку спецификации. */
export function topicStats(skillDays: SkillDays, skills: Record<string, SkillStat>, days: 7 | 30, now: number): TopicStat[] {
  const keys = lastDays(now, days);
  const acc = new Map<EntTopicId, Sum>(ENT_TOPICS.map((t) => [t.id, { n: 0, s: 0, h: 0, sec: 0 }]));
  for (const s of SKILLS) {
    if (!s.ent) continue;
    const r = sumSkill(skillDays, s.id, keys);
    const to = acc.get(s.ent)!;
    to.n += r.n;
    to.s += r.s;
    to.h += r.h;
    to.sec += r.sec;
  }
  return ENT_TOPICS.map((t) => {
    const a = acc.get(t.id)!;
    const m = topicMasteryOf(t.id, skills);
    return {
      topic: t.id,
      n: a.n,
      score: a.s,
      acc: accOf(a.n, a.s),
      sec: Math.round(a.sec),
      hinted: a.h,
      mastery: m.value,
      level: m.level,
    };
  });
}

export interface TrendPoint {
  day: string;
  n: number;
  acc: number | null;
}

export interface TopicTrend {
  /** Точки по дням за период, от старого к новому. */
  points: TrendPoint[];
  /** Последние 7 дней и 7 дней до них. */
  recent: { n: number; acc: number | null };
  prev: { n: number; acc: number | null };
  /** Изменение точности: последние 7 дней минус предыдущие (доля, -1..1); null — в любой из недель меньше TREND_MIN заданий. */
  change: number | null;
}

/** Динамика точности по теме: точки по дням и изменение «неделя к неделе». */
export function topicTrend(skillDays: SkillDays, topic: EntTopicId, now: number, days = 30): TopicTrend {
  const skillIds = SKILLS.filter((s) => s.ent === topic).map((s) => s.id);
  const dayTotal = (day: string): { n: number; s: number } => {
    let n = 0;
    let s = 0;
    for (const id of skillIds) {
      const r = sumSkill(skillDays, id, [day]);
      n += r.n;
      s += r.s;
    }
    return { n, s };
  };
  // Две недели для сравнения берём независимо от длины графика.
  const span = Math.max(days, 14);
  const keys = lastDays(now, span);
  const totals = keys.map((day) => ({ day, ...dayTotal(day) }));
  const window = (list: typeof totals) => {
    const n = list.reduce((a, x) => a + x.n, 0);
    const s = list.reduce((a, x) => a + x.s, 0);
    return { n, acc: accOf(n, s) };
  };
  const recent = window(totals.slice(-7));
  const prev = window(totals.slice(-14, -7));
  const change = recent.n >= TREND_MIN && prev.n >= TREND_MIN && recent.acc !== null && prev.acc !== null ? recent.acc - prev.acc : null;
  const points = totals.slice(-Math.max(days, 1)).map((x) => ({ day: x.day, n: x.n, acc: accOf(x.n, x.s) }));
  return { points, recent, prev, change };
}

// ---------- Слабые места ----------

export type WeakReason = "low" | "fell" | "stale";

export interface WeakSpot {
  skill: string;
  topic?: EntTopicId;
  /** Главная причина: low — низкая оценка, fell — точность упала за неделю, stale — давно не было практики. */
  reason: WeakReason;
  mastery: number;
  attempts: number;
  /** Точность за 30 дней или null — заданий за 30 дней не было. */
  acc30: number | null;
  n30: number;
  /** Падение точности (последние 7 дней против предыдущих), доля 0..1; 0 — нет или данных мало. */
  drop: number;
  /** Дней с последнего ответа. */
  idleDays: number;
  /** Ранг: (1 − оценка) × вес темы + падение + давность (те же веса темы). Чем больше — тем важнее. */
  score: number;
  /** Адресная кнопка «Потренировать». */
  href: string;
}

export interface WeakInput {
  skills: Record<string, SkillStat>;
  skillDays: SkillDays;
  now: number;
  /** Есть ли банк заданий у навыка (для тестов). По умолчанию — реальный (lib/drill → hasBank). */
  hasBank?: (skill: string) => boolean;
}

/** Вес темы для ранга; у навыка без темы — средний (1/13). */
const DEFAULT_WEIGHT = 1 / ENT_TOPICS.length;
/** Коэффициенты слагаемых ранга относительно (1 − оценка): падение — в полную силу, давность — слабее. */
const FELL_K = 1;
const STALE_K = 0.3;

/** Ссылка «Потренировать»: по навыку, если у него есть банк; иначе по теме; без темы — умная тренировка. */
export function drillHref(skill: string, hasBank: (skill: string) => boolean = bankExists): string {
  if (hasBank(skill)) return `/drill?mode=skill&skill=${encodeURIComponent(skill)}`;
  const topic = TOPIC_OF.get(skill);
  if (topic && SKILLS.some((s) => s.ent === topic && hasBank(s.id))) return `/drill?mode=topic&topic=${topic}`;
  return "/drill?mode=smart";
}

/** Хватает ли данных, чтобы говорить о слабых местах: хотя бы по одному навыку — MIN_ANSWERS ответов. */
export function hasEnoughData(skills: Record<string, SkillStat>): boolean {
  return Object.entries(skills ?? {}).some(([id, s]) => TOPIC_OF.has(id) && num(s?.attempts) >= MIN_ANSWERS);
}

/**
 * Слабые навыки (оценка < WEAK_BELOW), по которым ответов меньше MIN_ANSWERS: в «Слабые места» они ещё не попадают,
 * но сказать «слабых мест нет» нельзя (диагностика, пара ошибок подряд). Для нейтральной подсказки на карточке.
 */
export function pendingWeakCount(skills: Record<string, SkillStat>): number {
  return Object.entries(skills ?? {}).filter(
    ([id, s]) => TOPIC_OF.has(id) && num(s?.attempts) > 0 && num(s.attempts) < MIN_ANSWERS && masteryLevel(s) === "weak",
  ).length;
}

/**
 * Слабые места: навыки с низкой оценкой (< WEAK_BELOW), упавшей за неделю точностью или давней практикой.
 * Только навыки с MIN_ANSWERS ответами и больше. Ранг — по убыванию score; не больше `limit`.
 */
export function weakSpots(input: WeakInput, limit = 5): WeakSpot[] {
  const { skills, skillDays, now } = input;
  if (!Number.isFinite(now) || limit <= 0) return [];
  const hasBank = input.hasBank ?? bankExists;
  const days30 = lastDays(now, 30);
  const recentKeys = days30.slice(-7);
  const prevKeys = days30.slice(-14, -7);
  const out: WeakSpot[] = [];
  for (const [skill, stat] of Object.entries(skills ?? {})) {
    if (!TOPIC_OF.has(skill) || !stat) continue;
    const attempts = num(stat.attempts);
    if (attempts < MIN_ANSWERS) continue;
    const mastery = Math.min(1, num(stat.mastery));
    const topic = TOPIC_OF.get(skill);

    const month = sumSkill(skillDays, skill, days30);
    const recent = sumSkill(skillDays, skill, recentKeys);
    const prev = sumSkill(skillDays, skill, prevKeys);
    const drop =
      recent.n >= FELL_MIN && prev.n >= FELL_MIN ? Math.max(0, (accOf(prev.n, prev.s) ?? 0) - (accOf(recent.n, recent.s) ?? 0)) : 0;
    const idleDays = num(stat.lastSeen) > 0 ? Math.max(0, (now - stat.lastSeen) / DAY_MS) : 0;

    const low = mastery < WEAK_BELOW;
    const fell = drop >= FELL_DROP;
    const stale = mastery < MASTERED_FROM && idleDays >= STALE_DAYS;
    if (!low && !fell && !stale) continue;

    const weight = topic ? topicWeight(topic) : DEFAULT_WEIGHT;
    const staleness = stale ? Math.min(1, idleDays / (STALE_DAYS * 2)) : 0;
    const score = weight * (1 - mastery + FELL_K * drop + STALE_K * staleness);
    out.push({
      skill,
      topic,
      reason: low ? "low" : fell ? "fell" : "stale",
      mastery,
      attempts,
      acc30: accOf(month.n, month.s),
      n30: month.n,
      drop,
      idleDays: Math.floor(idleDays),
      score,
      href: drillHref(skill, hasBank),
    });
  }
  // Детерминированно: ранг, затем оценка, затем id.
  out.sort((a, b) => b.score - a.score || a.mastery - b.mastery || (a.skill < b.skill ? -1 : 1));
  return out.slice(0, limit);
}
