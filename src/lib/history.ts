import type { AnswerRecord, SessionResult } from "./types";

// История тестов: все проверочные сессии в одном списке — урок, «Проверить себя», тренировки, пробный ЕНТ.
// У каждой записи — неверные ответы с первой попытки, по ним работает «работа над ошибками этого теста».
// Чистая логика без React; хранится в сторе (AppState.history), экраны — components/history.

export type HistoryKind = "lesson" | "check" | "drill" | "exam";

/** Неверный ответ теста. */
export interface WrongItem {
  /**
   * id задания: шаг урока/банка или ссылка на задание ЕНТ «ent:<id>» / «ent:<id>:<n>»
   * (n — номер вопроса контекстного задания или пункта соответствия).
   */
  stepId: string;
  lessonId?: string;
  skill?: string;
  prompt: string;
  given: string;
  expected: string;
}

export interface HistoryEntry {
  id: string;
  at: number;
  kind: HistoryKind;
  /** Тренировка — режим (smart, mistakes, skill, review, extern, topic, history); пробный ЕНТ — mini/full/topic. */
  mode?: string;
  /** Заголовок на языке ученика в момент прохождения. */
  title: string;
  lessonId?: string;
  /** Попытка пробного ЕНТ (экран разбора /exam/result/<examId>). */
  examId?: string;
  /** Верных с первой попытки / всего заданий. */
  correct: number;
  total: number;
  /** Баллы — у пробного ЕНТ. */
  points?: number;
  maxPoints?: number;
  durationSec: number;
  xp: number;
  wrong: WrongItem[];
  /** stepId ошибок, которые уже исправлены (работой над ошибками или верным ответом позже). */
  fixed: string[];
}

export const MAX_HISTORY = 100;
export const MAX_WRONG_PER_ENTRY = 25;
const TEXT_LIMIT = 400;

const clip = (s: string) => (s.length > TEXT_LIMIT ? `${s.slice(0, TEXT_LIMIT - 1)}…` : s);

export function wrongFromAnswer(a: AnswerRecord, lessonId?: string): WrongItem {
  return {
    stepId: a.stepId,
    lessonId,
    skill: a.skill,
    prompt: clip(a.prompt),
    given: clip(a.given),
    expected: clip(a.expected),
  };
}

/**
 * Запись истории по итогу урока или тренировки. Считаются только первые попытки;
 * сессия без заданий (одна теория) в историю не попадает — вернётся null.
 */
export function entryFromSession(result: SessionResult, id: string, at: number, mode?: string): HistoryEntry | null {
  const first = result.answers.filter((a) => !a.retry);
  if (!first.length) return null;
  const kind: HistoryKind = result.kind === "drill" ? "drill" : result.via === "check" ? "check" : "lesson";
  const wrong: WrongItem[] = [];
  for (const a of first) {
    if (a.correct || wrong.some((w) => w.stepId === a.stepId)) continue;
    wrong.push(wrongFromAnswer(a, result.lessonId));
  }
  return {
    id,
    at,
    kind,
    mode: kind === "drill" ? mode : undefined,
    title: result.title,
    lessonId: result.lessonId,
    correct: first.filter((a) => a.correct).length,
    total: first.length,
    durationSec: Math.max(0, Math.round(result.durationSec)),
    xp: result.xp,
    wrong: wrong.slice(0, MAX_WRONG_PER_ENTRY),
    fixed: [],
  };
}

/** Новые первыми, не больше MAX_HISTORY; запись с тем же id заменяется. */
export function pushHistory(list: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, MAX_HISTORY);
}

/** Пометить ошибки исправленными во всех записях, где они есть. */
export function markFixed(list: HistoryEntry[], stepIds: string[]): HistoryEntry[] {
  if (!stepIds.length) return list;
  let changed = false;
  const next = list.map((e) => {
    const add = stepIds.filter((id) => e.wrong.some((w) => w.stepId === id) && !e.fixed.includes(id));
    if (!add.length) return e;
    changed = true;
    return { ...e, fixed: [...e.fixed, ...add] };
  });
  return changed ? next : list;
}

/** Неисправленные ошибки записи. */
export function openWrong(e: HistoryEntry): WrongItem[] {
  return e.wrong.filter((w) => !e.fixed.includes(w.stepId));
}

/** Доля результата 0..1: у пробного ЕНТ — по баллам, у остальных — по верным ответам. */
export function entryScore(e: HistoryEntry): number {
  if (e.maxPoints) return Math.max(0, Math.min(1, (e.points ?? 0) / e.maxPoints));
  return e.total ? e.correct / e.total : 0;
}

export interface HistoryTotals {
  tests: number;
  /** Средний результат 0..1. */
  avgScore: number;
  /** Неисправленных ошибок во всех тестах (без повторов одного задания). */
  openMistakes: number;
}

export function historyTotals(list: HistoryEntry[]): HistoryTotals {
  const open = new Set<string>();
  for (const e of list) for (const w of openWrong(e)) open.add(w.stepId);
  return {
    tests: list.length,
    avgScore: list.length ? list.reduce((a, e) => a + entryScore(e), 0) / list.length : 0,
    openMistakes: open.size,
  };
}

export type HistoryFilter = "all" | "lessons" | "drills" | "exams" | "open";

export function filterHistory(list: HistoryEntry[], f: HistoryFilter): HistoryEntry[] {
  switch (f) {
    case "lessons":
      return list.filter((e) => e.kind === "lesson" || e.kind === "check");
    case "drills":
      return list.filter((e) => e.kind === "drill");
    case "exams":
      return list.filter((e) => e.kind === "exam");
    case "open":
      return list.filter((e) => openWrong(e).length > 0);
    default:
      return list;
  }
}

/** Пределы длины строк при проверке истории: хранилище (localStorage) — недоверенное, свои значения короче. */
const ID_LIMIT = 80;
const STEP_ID_LIMIT = 120;
const TITLE_LIMIT = 160;
const MODE_LIMIT = 40;

/** Проверка сохранённой истории (данные из localStorage — недоверенные). */
export function sanitizeHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const optStr = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const optNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const kinds: HistoryKind[] = ["lesson", "check", "drill", "exam"];
  const out: HistoryEntry[] = [];
  for (const r of raw.slice(0, MAX_HISTORY)) {
    if (!r || typeof r !== "object") continue;
    const e = r as Partial<HistoryEntry>;
    if (typeof e.id !== "string" || !kinds.includes(e.kind as HistoryKind)) continue;
    const wrong = Array.isArray(e.wrong)
      ? e.wrong
          .filter((w): w is WrongItem => !!w && typeof w === "object" && typeof (w as WrongItem).stepId === "string")
          .slice(0, MAX_WRONG_PER_ENTRY)
          .map((w) => ({
            stepId: w.stepId.slice(0, STEP_ID_LIMIT),
            lessonId: optStr(w.lessonId, ID_LIMIT),
            skill: optStr(w.skill, ID_LIMIT),
            prompt: clip(str(w.prompt, TEXT_LIMIT * 2)),
            given: clip(str(w.given, TEXT_LIMIT * 2)),
            expected: clip(str(w.expected, TEXT_LIMIT * 2)),
          }))
      : [];
    out.push({
      id: e.id.slice(0, ID_LIMIT),
      at: num(e.at),
      kind: e.kind as HistoryKind,
      mode: optStr(e.mode, MODE_LIMIT),
      title: str(e.title, TITLE_LIMIT),
      lessonId: optStr(e.lessonId, ID_LIMIT),
      examId: optStr(e.examId, ID_LIMIT),
      correct: num(e.correct),
      total: num(e.total),
      points: optNum(e.points),
      maxPoints: optNum(e.maxPoints),
      durationSec: num(e.durationSec),
      xp: num(e.xp),
      wrong,
      // «Исправлено» — это stepId ошибок, их не больше, чем ошибок в записи.
      fixed: Array.isArray(e.fixed) ? e.fixed.filter((x): x is string => typeof x === "string").slice(0, MAX_WRONG_PER_ENTRY).map((x) => x.slice(0, STEP_ID_LIMIT)) : [],
    });
  }
  return out;
}
