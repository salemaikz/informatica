// Цвет и подпись слабого места по причине — общие для «Слабых мест» на /stats и боковой карточки.
// Отдельный модуль без React: ленивая боковая карточка не тянет за собой большую карточку.

import type { DictKey } from "@/i18n/dict";
import type { WeakReason } from "@/lib/progress";

/** Причина → тон по смыслу: слабая тема — danger, точность упала — warning, давность — нейтрально. */
export const REASON_TONE: Record<WeakReason, "danger" | "warning" | "muted"> = { low: "danger", fell: "warning", stale: "muted" };

export const REASON_KEY: Record<WeakReason, DictKey> = { low: "progress.weak.low", fell: "progress.weak.fell", stale: "progress.weak.stale" };

/** Классы строки-ссылки по причине (фон + текст) — только токены цветов. */
export const REASON_ROW: Record<WeakReason, string> = {
  low: "bg-danger-soft text-danger",
  fell: "bg-warning-soft text-warning-strong",
  stale: "bg-surface-2 text-text",
};
