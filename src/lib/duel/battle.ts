import type { Level } from "../types";
import { DRAW_TIME_MS } from "./score";
import type { DuelEvent } from "./types";

// Битва (docs/specs/battle.md §2, §3, §7): урон, удары, нокаут и победитель по событиям матча.
// Чистый модуль: один код у клиента, сервера и бота.

/** Здоровье персонажа. */
export const BATTLE_HP = 100;
/** Базовый удар по уровню задания. */
export const BASE_DAMAGE: Readonly<Record<Level, number>> = { 1: 10, 2: 12, 3: 15 };
/** «Норма» времени на задание по уровню, мс. */
export const SPEED_NORM_MS: Readonly<Record<Level, number>> = { 1: 6_000, 2: 9_000, 3: 13_000 };
/** Множитель скорости. */
export const SPEED_MULT = { lightning: 1.3, fast: 1.15, normal: 1 } as const;
export type SpeedTier = keyof typeof SPEED_MULT;
/** Прибавка комбо за каждый следующий верный подряд. */
export const COMBO_STEP = 0.1;
export const COMBO_MAX = 0.5;
/** С какого верного подряд удар — «Крит!» (только зрелище). */
export const CRIT_COMBO = 5;
export const STREAK_DAYS_PER_STEP = 5;
export const STREAK_STEP_BONUS = 0.01;
export const STREAK_BONUS_MAX = 0.05;

/** ms ≤ норма/2 → "lightning"; ms ≤ норма → "fast"; иначе "normal". Негодный ms (NaN, < 0) → "normal". */
export function speedTier(level: Level, ms: number): SpeedTier {
  if (!Number.isFinite(ms) || ms < 0) return "normal";
  const norm = SPEED_NORM_MS[level] ?? SPEED_NORM_MS[1];
  if (ms <= norm / 2) return "lightning";
  if (ms <= norm) return "fast";
  return "normal";
}

/** Бонус серии дней: floor(days / 5) × 1%, в пределах 0…5%. NaN, Infinity, отрицательное → 0. */
export function streakBonus(days: number): number {
  if (!Number.isFinite(days) || days < 0) return 0;
  return Math.min(Math.floor(days / STREAK_DAYS_PER_STEP) * STREAK_STEP_BONUS, STREAK_BONUS_MAX);
}

/** Бонус комбо для k-го верного подряд (k ≥ 1): min(0,1 × (k − 1), 0,5); k < 1 → 0. */
export function comboBonus(k: number): number {
  if (!Number.isFinite(k) || k < 1) return 0;
  return Math.min(COMBO_STEP * (k - 1), COMBO_MAX);
}

export interface Hit {
  i: number;
  /** Мс от старта матча (как у события). */
  t: number;
  ok: boolean;
  /** Урон удара; 0 у неверного. */
  dmg: number;
  /** Сколько верных подряд, включая этот; 0 у неверного. */
  combo: number;
  /** Скорость; null у неверного. */
  speed: SpeedTier | null;
  crit: boolean;
}

export interface BattleOpts {
  /** Пауза после ошибки режима, мс (вычитается из времени следующего задания). */
  errorPauseMs: number;
  /** Серия дней атакующей стороны. */
  streakDays: number;
}

/**
 * Удары по событиям стороны. levels[i] — уровень задания i набора; нет такого → уровень 1.
 * Время задания k: t[k] − t[k−1] (для k = 0 — t[0]) минус errorPauseMs, если предыдущий ответ неверный; не меньше 0.
 */
export function battleHits(events: readonly DuelEvent[], levels: readonly Level[], opts: BattleOpts): Hit[] {
  const streak = streakBonus(opts.streakDays);
  const hits: Hit[] = [];
  let combo = 0;
  for (let k = 0; k < events.length; k++) {
    const e = events[k];
    const prev = k > 0 ? events[k - 1] : null;
    if (!e.ok) {
      combo = 0;
      hits.push({ i: e.i, t: e.t, ok: false, dmg: 0, combo: 0, speed: null, crit: false });
      continue;
    }
    const level: Level = levels[e.i] ?? 1;
    const ms = Math.max(0, e.t - (prev ? prev.t + (prev.ok ? 0 : opts.errorPauseMs) : 0));
    const speed = speedTier(level, ms);
    combo++;
    const dmg = Math.round(BASE_DAMAGE[level] * SPEED_MULT[speed] * (1 + comboBonus(combo) + streak));
    hits.push({ i: e.i, t: e.t, ok: true, dmg, combo, speed, crit: combo >= CRIT_COMBO });
  }
  return hits;
}

export interface BattleSide {
  /** Удары, которые засчитаны (до конца боя). */
  hits: Hit[];
  /** Нанесённый урон: сумма dmg засчитанных ударов, не больше BATTLE_HP. */
  dealt: number;
  /** t удара, после которого dealt ≥ BATTLE_HP; null — нокаута нет. */
  koAt: number | null;
  correct: number;
  answered: number;
  /** t последнего засчитанного события; 0 — событий нет. */
  timeMs: number;
}

/** Сторона без учёта соперника: удары до своего нокаута (после него — не считаются). */
export function battleSide(events: readonly DuelEvent[], levels: readonly Level[], opts: BattleOpts): BattleSide {
  const all = battleHits(events, levels, opts);
  const hits: Hit[] = [];
  let sum = 0;
  let koAt: number | null = null;
  let correct = 0;
  let timeMs = 0;
  for (const h of all) {
    hits.push(h);
    if (h.ok) correct++;
    timeMs = h.t;
    sum += h.dmg;
    if (sum >= BATTLE_HP) {
      koAt = h.t;
      break;
    }
  }
  return { hits, dealt: Math.min(sum, BATTLE_HP), koAt, correct, answered: hits.length, timeMs };
}

export interface BattleResult {
  a: BattleSide;
  b: BattleSide;
  /** Момент первого нокаута в матче; null — нокаута не было. События обеих сторон после него отброшены. */
  endAt: number | null;
  winner: "a" | "b" | "draw";
  reason: "ko" | "hp" | "correct" | "time";
}

/**
 * Матч целиком. endAt — min(a.koAt, b.koAt). Если endAt есть, у обеих сторон отбрасываются события с t > endAt.
 * Победитель по §3: нокаут → раньше; одновременно → ничья. Иначе: dealt → correct → answered → время (|Δt| < 1 с — ничья).
 */
export function battleMatch(
  aEvents: readonly DuelEvent[],
  bEvents: readonly DuelEvent[],
  levels: readonly Level[],
  opts: { errorPauseMs: number; aStreakDays: number; bStreakDays: number },
): BattleResult {
  const oa: BattleOpts = { errorPauseMs: opts.errorPauseMs, streakDays: opts.aStreakDays };
  const ob: BattleOpts = { errorPauseMs: opts.errorPauseMs, streakDays: opts.bStreakDays };
  let a = battleSide(aEvents, levels, oa);
  let b = battleSide(bEvents, levels, ob);
  const kos = [a.koAt, b.koAt].filter((x): x is number => x !== null);
  const endAt = kos.length ? Math.min(...kos) : null;

  if (endAt !== null) {
    // Пересчёт по усечённым событиям: после первого нокаута персонажи уже упали
    a = battleSide(aEvents.filter((e) => e.t <= endAt), levels, oa);
    b = battleSide(bEvents.filter((e) => e.t <= endAt), levels, ob);
    if (a.koAt !== null && b.koAt !== null) return { a, b, endAt, winner: "draw", reason: "ko" };
    return { a, b, endAt, winner: a.koAt !== null ? "a" : "b", reason: "ko" };
  }

  if (a.dealt !== b.dealt) return { a, b, endAt, winner: a.dealt > b.dealt ? "a" : "b", reason: "hp" };
  if (a.correct !== b.correct) return { a, b, endAt, winner: a.correct > b.correct ? "a" : "b", reason: "correct" };
  if (a.answered !== b.answered) return { a, b, endAt, winner: a.answered > b.answered ? "a" : "b", reason: "time" };
  const dt = a.timeMs - b.timeMs;
  if (Math.abs(dt) < DRAW_TIME_MS) return { a, b, endAt, winner: "draw", reason: "time" };
  return { a, b, endAt, winner: dt < 0 ? "a" : "b", reason: "time" };
}

/** Здоровье защитника в момент nowMs: BATTLE_HP − Σ dmg ударов атакующего с t ≤ nowMs, не меньше 0. */
export function hpAt(attacker: Pick<BattleSide, "hits">, nowMs: number): number {
  let dmg = 0;
  for (const h of attacker.hits) if (h.t <= nowMs) dmg += h.dmg;
  return Math.max(0, BATTLE_HP - dmg);
}
