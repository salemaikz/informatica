// «Идеальный урок» и серия идеальных подряд (этап 16Б, R2). Чистая логика без React; тесты — tests/perfect.test.ts.
// Поле стора `perfectRun` (тип и санитайзер — lib/rewards-state.ts) меняет только finishSession.

import type { SessionResult } from "./types";
import type { PerfectRun } from "./rewards-state";
import { PERFECT_DROP } from "./economy";

/** Достижение «5 идеальных подряд». */
export const PERFECT_RUN_GOAL = 5;

/** Серию показываем на итогах с этого значения («Идеальных подряд: 3», с 2-го). */
export const PERFECT_RUN_SHOW_FROM = 2;

/** Идеально: все задания с первой попытки верно и сам — без подсказок, ничего не пропущено; хотя бы одно задание было. */
export function isPerfectSession(r: Pick<SessionResult, "answers" | "skipped">): boolean {
  const firstTry = r.answers.filter((a) => !a.retry);
  return firstTry.length > 0 && firstTry.every((a) => a.correct && !a.hinted) && !r.skipped;
}

/**
 * Серия после урока. Тренировки её не трогают (вызывать только для уроков).
 * - первое прохождение идеальное — серия растёт;
 * - первое прохождение с ошибкой или пропуском — серия сбрасывается;
 * - повтор урока (уже пройден раньше) серию не меняет: повторами «накрутить» серию нельзя, а ошибка в повторе её не рушит.
 */
export function nextPerfectRun(run: PerfectRun, o: { perfect: boolean; first: boolean }): PerfectRun {
  if (!o.first) return run;
  if (!o.perfect) return run.current === 0 ? run : { ...run, current: 0 };
  const current = run.current + 1;
  return { current, best: Math.max(run.best, current) };
}

// ---------- «Сюрприз за идеальный урок» (этап 16В, решение B) ----------

/**
 * Источник случайного числа для броска. Тесты подменяют `next` (vi.spyOn), а не Math.random: им же пользуется uid() стора,
 * и общий мок склеил бы идентификаторы записей.
 */
export const dropRandom = { next: (): number => Math.random() };

/** Что выпало за идеальный урок или тест на 100%: пол-сердечка, чипы или ничего. */
export type PerfectDrop = { kind: "heart"; amount: 0.5 } | { kind: "chips"; amount: number } | { kind: "none" };

/**
 * Бросок «сюрприза»: `r` — число из [0, 1) (`dropRandom.next()` вызывает действие стора ровно один раз).
 * r < 0,2 — пол-сердечка (запас полон или «Безлимит» — вместо него чипы: показанное = выданное); r < 0,4 — чипы; иначе ничего.
 * Множитель тарифа и бустера к чипам не применяется.
 */
export function rollPerfectDrop(r: number, o: { heartsFull: boolean; unlimited: boolean }): PerfectDrop {
  const chips: PerfectDrop = { kind: "chips", amount: PERFECT_DROP.chips };
  if (!(r >= 0)) return { kind: "none" };
  if (r < PERFECT_DROP.heartChance) return o.heartsFull || o.unlimited ? chips : { kind: "heart", amount: PERFECT_DROP.heart };
  if (r < PERFECT_DROP.heartChance + PERFECT_DROP.chipsChance) return chips;
  return { kind: "none" };
}

/** Тест засчитан «на 100%»: баллы равны максимуму (максимум > 0). */
export function isPerfectExam(points: number, maxPoints: number): boolean {
  return maxPoints > 0 && points >= maxPoints;
}

/** Проверка сохранённого броска (данные из localStorage недоверенные): неизвестное — null. */
export function sanitizePerfectDrop(raw: unknown): PerfectDrop | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as { kind?: unknown; amount?: unknown };
  if (d.kind === "none") return { kind: "none" };
  if (d.kind === "heart") return { kind: "heart", amount: PERFECT_DROP.heart };
  if (d.kind === "chips" && typeof d.amount === "number" && Number.isFinite(d.amount) && d.amount > 0) {
    return { kind: "chips", amount: Math.min(99, Math.floor(d.amount)) || PERFECT_DROP.chips };
  }
  return null;
}

// ---------- Предел сюрпризов от тестов (этап 16В, E8) ----------

/** Сколько раз за день тесты уже бросали сюрприз: счётчик сбрасывается со сменой даты. Уроки в счётчик не входят. */
export interface DropDay {
  day: string;
  count: number;
}

export const EMPTY_DROP_DAY: DropDay = { day: "", count: 0 };

/** Сколько бросков сюрприза за тесты осталось на сегодня (мини-тест, тест по теме, тест по разделу; PERFECT_DROP.testsPerDay). */
export function testDropsLeft(d: DropDay, today: string): number {
  return Math.max(0, PERFECT_DROP.testsPerDay - (d.day === today ? d.count : 0));
}

/** Записать бросок сюрприза за тест: «ничего» тоже считается броском. */
export function noteTestDrop(d: DropDay, today: string): DropDay {
  return { day: today, count: (d.day === today ? d.count : 0) + 1 };
}

/** Из хранилища: день «ГГГГ-ММ-ДД» и счётчик 0…99 (данные недоверенные). */
export function sanitizeDropDay(raw: unknown): DropDay {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...EMPTY_DROP_DAY };
  const r = raw as { day?: unknown; count?: unknown };
  if (typeof r.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.day)) return { ...EMPTY_DROP_DAY };
  if (typeof r.count !== "number" || !Number.isFinite(r.count) || r.count < 0) return { ...EMPTY_DROP_DAY };
  return { day: r.day, count: Math.min(99, Math.floor(r.count)) };
}
