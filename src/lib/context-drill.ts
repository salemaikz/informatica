import type { EntContext, QuestionStep } from "./types";

// ЗАГЛУШКА каркаса этапа 14 — реализует пакет P4 (docs/specs/stage14.md, раздел P4).
// Контекстные задания в практикуме: программа (её можно запустить) + 5 вопросов → 5 шагов плеера.

/** Все контекстные задания из банка ЕНТ (t06, t07) в порядке курса. */
export function contextItems(): EntContext[] {
  return [];
}

/** Сессия по одному контекстному заданию: 5 вопросов, у сцены кода — кнопка «Запустить» (scene.run). */
export function buildContextDrill(itemId: string): QuestionStep[] {
  void itemId;
  return [];
}
