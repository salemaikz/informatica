import type { L } from "@/lib/types";

// Этап 16Б, волна 3 (сцены gates, switches и выходы circuit; ТЗ — docs/specs/stage16b-wave3*.md). Ключи — `scene.gates.*, scene.switches.*, scene.circuit.*`.
// Казахский — литературный, термины по глоссарию НЦТ, без глаголов с родом в русском. Вычитано моделью, носителем — нет.
export const sceneLogicDict = {} satisfies Record<string, L>;
