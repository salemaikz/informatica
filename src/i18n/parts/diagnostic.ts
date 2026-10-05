import type { L } from "@/lib/types";

// Входная диагностика и короткий онбординг (этап 12, пакет P3). Ключи diag.*
// Каждый ключ — { ru, kk }. Казахский — литературный, ҰБТ вместо ЕНТ, без глаголов с родом.
export const diagnosticDict = {} satisfies Record<string, L>;
