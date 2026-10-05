import type { L } from "@/lib/types";

// Этап 16Б, волна 3 (сцена wave и расширения binary, decimal; ТЗ — docs/specs/stage16b-wave3*.md). Ключи — `scene.wave.*, scene.binary.*, scene.decimal.*`.
// Казахский — литературный, термины по глоссарию НЦТ, без глаголов с родом в русском. Вычитано моделью, носителем — нет.
export const sceneSignalDict = {} satisfies Record<string, L>;
