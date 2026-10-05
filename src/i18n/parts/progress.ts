import type { L } from "@/lib/types";

// Прогресс ученика — % курса, разделы, темы, слабые места (этап 12, пакет P2). Ключи progress.*
// Каждый ключ — { ru, kk }. Казахский — литературный, ҰБТ вместо ЕНТ, без глаголов с родом.
export const progressDict = {} satisfies Record<string, L>;
