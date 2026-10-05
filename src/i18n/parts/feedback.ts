import type { L } from "@/lib/types";

// Обратная связь — страница отзывов, «Что помешало?», выключатель статистики (этап 12, пакет P1). Ключи feedback.*, break.*, privacy.*
// Каждый ключ — { ru, kk }. Казахский — литературный, ҰБТ вместо ЕНТ, без глаголов с родом.
export const feedbackDict = {} satisfies Record<string, L>;
