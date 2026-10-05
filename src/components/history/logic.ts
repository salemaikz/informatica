// Чистая логика экранов «История тестов»: группировка по дням, названия, результат, ссылки. Без React (тесты — tests/history-redo.test.ts).

import type { DictKey } from "@/i18n/dict";
import { toneOf, type Tone } from "@/components/exam/logic";
import { entryScore, filterHistory, type HistoryEntry, type HistoryFilter } from "@/lib/history";
import { dayDiff, todayKey } from "@/lib/text";

export const HISTORY_FILTERS: readonly HistoryFilter[] = ["all", "lessons", "drills", "exams", "open"];

type Translate = (key: DictKey, params?: Record<string, string | number>) => string;

const DRILL_MODES = new Set(["smart", "mistakes", "history", "skill", "review", "extern", "topic", "practice", "recap", "minitest", "context"]);
const EXAM_KINDS = new Set(["mini", "full", "topic"]);

/** Цвет результата: зелёный ≥ 80%, янтарный 50–79%, красный < 50%. */
export const entryTone = (e: HistoryEntry): Tone => toneOf(entryScore(e));

/** Заголовок записи. У пробного ЕНТ он пустой — берём по виду; у тренировки — по режиму, если заголовка нет. */
export function entryTitle(e: HistoryEntry, t: Translate): string {
  if (e.title.trim()) return e.title.trim();
  if (e.kind === "exam") return t((e.mode && EXAM_KINDS.has(e.mode) ? `history.exam.${e.mode}` : "history.kind.exam") as DictKey);
  if (e.kind === "drill") return t((e.mode && DRILL_MODES.has(e.mode) ? `history.mode.${e.mode}` : "history.kind.drill") as DictKey);
  return t(`history.kind.${e.kind}` as DictKey);
}

/** «8 / 10» или «32 / 50 баллов». */
export function entryResult(e: HistoryEntry, t: Translate): string {
  return e.maxPoints
    ? t("history.result.points", { a: e.points ?? 0, b: e.maxPoints })
    : t("history.result.count", { a: e.correct, b: e.total });
}

/** Результат в процентах (целое). */
export const entryPercent = (e: HistoryEntry): number => Math.round(entryScore(e) * 100);

export interface MistakeCounts {
  total: number;
  fixed: number;
  open: number;
}

/** Ошибки записи: всего, исправлено, осталось. */
export function mistakeCounts(e: HistoryEntry): MistakeCounts {
  const fixed = e.wrong.filter((w) => e.fixed.includes(w.stepId)).length;
  return { total: e.wrong.length, fixed, open: e.wrong.length - fixed };
}

export interface DayGroup {
  /** Местная дата «ГГГГ-ММ-ДД». */
  key: string;
  /** Время первой записи группы — для подписи даты. */
  at: number;
  entries: HistoryEntry[];
}

/** Записи по дням (порядок как в списке — новые первыми). */
export function groupByDay(list: HistoryEntry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const e of list) {
    const key = todayKey(new Date(e.at));
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(e);
    else groups.push({ key, at: e.at, entries: [e] });
  }
  return groups;
}

/** Сегодня / вчера / иначе — null (подпись даты строит экран). */
export function relativeDay(key: string, now: number): "today" | "yesterday" | null {
  const diff = dayDiff(key, todayKey(new Date(now)));
  return diff === 0 ? "today" : diff === 1 ? "yesterday" : null;
}

/** Время записи «ЧЧ:ММ» (местное). */
export function entryClock(at: number): string {
  if (!Number.isFinite(at) || at <= 0) return "";
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const redoHref = (id: string): string => `/drill?mode=history&entry=${encodeURIComponent(id)}`;
export const detailHref = (id: string): string => `/history/${encodeURIComponent(id)}`;
export const examResultHref = (examId: string): string => `/exam/result/${encodeURIComponent(examId)}`;

/** Пройти урок снова: проверка себя возвращает в режим check. */
export function replayHref(e: HistoryEntry): string | null {
  if (!e.lessonId || (e.kind !== "lesson" && e.kind !== "check")) return null;
  return `/lesson/${encodeURIComponent(e.lessonId)}${e.kind === "check" ? "?mode=check" : ""}`;
}

/** Сколько записей попадает под каждый фильтр (для счётчиков на чипах). */
export function filterCounts(list: HistoryEntry[]): Record<HistoryFilter, number> {
  return Object.fromEntries(HISTORY_FILTERS.map((f) => [f, filterHistory(list, f).length])) as Record<HistoryFilter, number>;
}

/**
 * Показывать ли в истории пробный ЕНТ (фильтр и тексты про него). В треке ЕНТ — всегда; в школьном (#52) — только
 * если старые пробники в истории уже есть: их нужно уметь найти.
 */
export const showExamsInHistory = (ent: boolean, counts: Record<HistoryFilter, number>): boolean => ent || counts.exams > 0;

/** Фильтры для строки чипов: без «Пробный ЕНТ», если его не показываем. */
export const visibleFilters = (showExams: boolean): readonly HistoryFilter[] => (showExams ? HISTORY_FILTERS : HISTORY_FILTERS.filter((f) => f !== "exams"));
