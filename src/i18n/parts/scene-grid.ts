import type { L } from "@/lib/types";

// Этап 16Б, волна 3 (сцена grid; ТЗ — docs/specs/stage16b-wave3*.md). Ключи — `scene.grid.*`.
// Казахский — литературный, термины по глоссарию НЦТ, без глаголов с родом в русском. Вычитано моделью, носителем — нет.
export const sceneGridDict = {
  "scene.grid.aria": { ru: "Сетка {rows} × {cols}.", kk: "Тор {rows} × {cols}." },
  "scene.grid.aria.values": { ru: "Значения по строкам: {list}.", kk: "Жолдар бойынша мәндер: {list}." },
  "scene.grid.aria.marks": { ru: "Выделено клеток: {n}.", kk: "Бөлектелген ұяшықтар: {n}." },
  "scene.grid.aria.merges": { ru: "Объединений: {n}.", kk: "Біріктірулер саны: {n}." },
  "scene.grid.aria.path": { ru: "Клеток в обходе: {n}.", kk: "Аралап шығу: {n} ұяшық." },
} satisfies Record<string, L>;
