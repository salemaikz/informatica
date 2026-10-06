// Чистые помощники плеера урока, игр и пробника (этап 12, пакет P4): запись-пропуск, итоги по общей точности (#66)
// и сборка событий статистики (#69). Без React, без обращения к стору и часам — всё приходит аргументами.

import { accuracyOf, tallyOf } from "./accuracy";
import { pct, type AnalyticsEvent } from "./analytics";
import { isSafeId } from "./analytics-schema";
import type { AnswerRecord, LessonVia, SessionResult, SkillId } from "./types";

/** Идентификатор в событии: ровно как у белого списка сервера (lib/analytics-schema.ts → isSafeId). */
const isId = (v: string | undefined): v is string => isSafeId(v);

const whole = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);
/** Шаги и их число в событиях — целые 0–200 (потолок схемы). */
const steps200 = (n: number) => Math.min(200, whole(n));

/** Режим урока для событий: «Проверить себя» — check, всё остальное — learn. */
export const eventVia = (via: LessonVia | undefined): "learn" | "check" => (via === "check" ? "check" : "learn");

/** Режим тренировки для событий (по умолчанию — умная). */
export const eventMode = (mode: string | undefined): string => (isId(mode) ? mode : "smart");

// ---------- ответ-пропуск и подсказка ----------

export interface SkipInput {
  stepId: string;
  skill?: SkillId;
  expected: string;
  prompt: string;
  /** Активное время на задание, мс. */
  timeMs: number;
}

/**
 * Запись о пропуске («Пропустить» у решения с фото): задание предъявлено, счёт 0 (#66).
 * Стор сам не делает из пропуска ошибку и не меняет освоение; повтором он не бывает.
 */
export function skipRecord(i: SkipInput): AnswerRecord {
  return {
    stepId: i.stepId,
    ...(i.skill ? { skill: i.skill } : {}),
    correct: false,
    score: 0,
    given: "",
    expected: i.expected,
    prompt: i.prompt,
    retry: false,
    timeMs: whole(i.timeMs),
    skipped: true,
  };
}

// ---------- итоги ----------

export type SessionTotals = Pick<SessionResult, "accuracy" | "asked" | "hinted" | "skipped">;

/**
 * Честные цифры итога по ответам сессии (tallyOf): точность (без заданий — 1), предъявлено, с подсказкой, пропущено.
 * skippedCount — счётчик плеера: в сохранении до этой версии пропуски лежали только в нём (записи о них не было). Такие пропуски
 * считаются предъявленными заданиями со счётом 0: попадают в asked и в знаменатель точности (иначе пропуск «давал» бы 100%).
 */
export function sessionTotals(records: readonly AnswerRecord[], skippedCount = 0): SessionTotals {
  const t = tallyOf(records);
  const extra = Math.max(0, whole(skippedCount) - t.skipped);
  const asked = t.asked + extra;
  return { accuracy: accuracyOf({ asked, score: t.score }) ?? 1, asked, hinted: t.hinted, skipped: t.skipped + extra };
}

/** Из чего сложилось число заданий в итогах: сам, с подсказкой, пропущено (сумма = asked). */
export function breakdownOf(r: Pick<SessionResult, "answers" | "asked" | "hinted" | "skipped">): { asked: number; self: number; hinted: number; skipped: number } {
  // Итог без новых полей (сохранён до этой версии) — считаем по ответам.
  const t = tallyOf(r.answers);
  const asked = r.asked ?? t.asked;
  const hinted = r.hinted ?? t.hinted;
  const skipped = r.skipped ?? t.skipped;
  return { asked, hinted, skipped, self: Math.max(0, asked - hinted - skipped) };
}

// ---------- события (контракт — lib/analytics.ts) ----------

interface PlayerKind {
  kind: "lesson" | "drill";
  lessonId?: string;
  via?: LessonVia;
  mode?: string;
}

/** Вход в плеер: урок — lesson_start (resume — продолжение сохранённого), тренировка и экстерн — drill_start. */
export function startEvent(p: PlayerKind & { resumed: boolean }): AnalyticsEvent | null {
  if (p.kind === "drill") return { e: "drill_start", mode: eventMode(p.mode) };
  if (!isId(p.lessonId)) return null;
  return { e: "lesson_start", lesson: p.lessonId, via: eventVia(p.via), resume: p.resumed ? 1 : 0 };
}

/** Конец: lesson_finish (acc — точность в %, sec — активные секунды) или drill_finish. */
export function finishEvent(p: PlayerKind & { accuracy: number; durationSec: number }): AnalyticsEvent | null {
  if (p.kind === "drill") return { e: "drill_finish", mode: eventMode(p.mode), acc: pct(p.accuracy) };
  if (!isId(p.lessonId)) return null;
  return { e: "lesson_finish", lesson: p.lessonId, via: eventVia(p.via), acc: pct(p.accuracy), sec: Math.min(7200, whole(p.durationSec)) };
}

/** Подтверждённый выход из урока: пройдено шагов из всех. Для тренировки события нет. */
export function quitEvent(p: PlayerKind & { done: number; total: number }): AnalyticsEvent | null {
  if (p.kind !== "lesson" || !isId(p.lessonId)) return null;
  return { e: "lesson_quit", lesson: p.lessonId, via: eventVia(p.via), step: steps200(p.done), of: steps200(p.total) };
}

/**
 * Первая попытка задания урока: ok — верно (частичный балл — 0), skip — пропущено, hint — с подсказкой.
 * Повтор ошибки — не событие. Шаги, которых нет в самом уроке (банк в «Проверить себя»), и тренировка не считаются:
 * их id разные при каждом запуске и только раздули бы счётчики (stable — id шагов урока).
 * Ключ задания — `<урок>:<шаг>`: id шага уникален лишь внутри урока (у разных уроков бывают одинаковые id и разные вопросы).
 * Без id урока события нет.
 */
export function taskEvent(rec: AnswerRecord, stable: ReadonlySet<string> | null, lessonId?: string): AnalyticsEvent | null {
  if (rec.retry || !stable || !lessonId || !stable.has(rec.stepId)) return null;
  const step = `${lessonId}:${rec.stepId}`;
  if (!isId(step)) return null;
  return {
    e: "task",
    step,
    ok: rec.correct && !rec.skipped ? 1 : 0,
    skip: rec.skipped ? 1 : 0,
    hint: rec.hinted && !rec.skipped ? 1 : 0,
  };
}

/** Игра: доля верных в %. Раундов не было — 0. */
export function gameFinishEvent(game: string, correct: number, total: number): AnalyticsEvent | null {
  if (!isId(game)) return null;
  return { e: "game_finish", game, acc: pct(total > 0 ? correct / total : 0) };
}

/** Пробный ЕНТ / контрольная: баллы от максимума в %. */
export function examFinishEvent(kind: "full" | "mini" | "topic" | "unit", points: number, maxPoints: number): Extract<AnalyticsEvent, { e: "exam_finish" }> {
  return { e: "exam_finish", kind, pct: pct(maxPoints > 0 ? points / maxPoints : 0) };
}
