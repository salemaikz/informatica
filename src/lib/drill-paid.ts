// Ключ тренировки (этап 16В, E7): под ним запоминается оплаченный вход (lib/entry-paid.ts, поле стора `entryPaid`, этап 16Г) —
// перезагрузка страницы или случайный выход в течение 20 минут не списывают сердечко второй раз. Экран — app/drill/DrillScreen.tsx.
// Тренировка закончена (finishSession) — отметка снимается: следующая такая же тренировка снова платная.

import { ENTRY_PAID_GRACE_MS } from "./entry-paid";

/** Сколько после оплаты та же тренировка открывается бесплатно, мс (20 минут — как продолжение урока). */
export const DRILL_PAID_GRACE_MS = ENTRY_PAID_GRACE_MS;

const KEY_MAX = 160;

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
