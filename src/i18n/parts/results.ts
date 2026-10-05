import type { L } from "@/lib/types";

// Итоги урока и тренировки: точность, «сам / с подсказкой», пропуски (этап 12, пакет P4). Ключи res2.*
// Каждый ключ — { ru, kk }. Казахский — литературный, ҰБТ вместо ЕНТ, без глаголов с родом.
export const resultsDict = {} satisfies Record<string, L>;
