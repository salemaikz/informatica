// Оплаченный вход в тренировку (этап 16В, E7): перезагрузка страницы или случайный выход не списывают сердечко второй раз.
// Чистые функции без React; поле стора `drillPaid` меняет только payDrill / finishSession (store.ts), экран — app/drill/DrillScreen.tsx.
//
// Правило как у урока (lib/lesson-run.ts): вернулся в ту же тренировку не позже RUN_GRACE_MS после оплаты — вход бесплатный.
// Тренировка закончена (finishSession) — отметка снимается: следующая такая же тренировка снова платная.

import { RUN_GRACE_MS } from "./lesson-run";

/** Сколько после оплаты та же тренировка открывается бесплатно, мс (20 минут — как продолжение урока). */
export const DRILL_PAID_GRACE_MS = RUN_GRACE_MS;

const KEY_MAX = 160;

/** Запомненная оплата: ключ тренировки и когда оплачена. */
export interface DrillPaid {
  key: string;
  at: number;
}

/** Параметры тренировки, как их передаёт страница /drill в DrillScreen. */
export interface DrillKeyParams {
  skill?: string;
  unit?: string;
  topic?: string;
  entry?: string;
  node?: string;
  item?: string;
  area?: string;
}

/**
 * Ключ тренировки: режим + то, что её определяет (навык, раздел, тема, запись истории, узел курса, задание, область).
 * Набор заданий каждый раз новый (seed по времени), поэтому «та же тренировка» — это тот же режим с теми же параметрами.
 */
export function drillPaidKey(mode: string, p: DrillKeyParams = {}): string {
  return [mode, p.skill, p.unit, p.topic, p.entry, p.node, p.item, p.area].map((x) => (typeof x === "string" ? x : "")).join("|").slice(0, KEY_MAX);
}

/** Вход в тренировку с этим ключом уже оплачен и срок не вышел. */
export function drillPaidActive(paid: DrillPaid | null | undefined, key: string, now: number): boolean {
  return !!paid && paid.key === key && now - paid.at >= 0 && now - paid.at <= DRILL_PAID_GRACE_MS;
}

/** Из хранилища: только корректная и не просроченная отметка (данные недоверенные). */
export function sanitizeDrillPaid(raw: unknown, now: number): DrillPaid | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as { key?: unknown; at?: unknown };
  if (typeof r.key !== "string" || !r.key || r.key.length > KEY_MAX) return null;
  if (typeof r.at !== "number" || !Number.isFinite(r.at)) return null;
  if (now - r.at < 0 || now - r.at > DRILL_PAID_GRACE_MS) return null;
  return { key: r.key, at: r.at };
}
