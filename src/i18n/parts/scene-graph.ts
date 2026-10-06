import type { L } from "@/lib/types";

// Этап 16Б, волна 3 (сцена graph; ТЗ — docs/specs/stage16b-wave3*.md). Ключи — `scene.graph.*`.
// Казахский — литературный, термины по глоссарию НЦТ, без глаголов с родом в русском. Вычитано моделью, носителем — нет.
export const sceneGraphDict = {
  "scene.graph.aria": { ru: "Граф. Вершины: {nodes}. Рёбра: {edges}.", kk: "Граф. Төбелер: {nodes}. Қабырғалар: {edges}." },
  "scene.graph.ariaTree": { ru: "Дерево. Корень: {root}. Вершины: {nodes}. Рёбра: {edges}.", kk: "Ағаш. Түбір: {root}. Төбелер: {nodes}. Қабырғалар: {edges}." },
  "scene.graph.ariaPath": { ru: "Путь: {path}.", kk: "Жол: {path}." },
  "scene.graph.ariaHighlight": { ru: "Выделено: {list}.", kk: "Бөлектелгені: {list}." },
  "scene.graph.degreesNote": { ru: "Число в кружке рядом с вершиной — её степень (сколько рёбер к ней подходит).", kk: "Төбенің жанындағы дөңгелектегі сан — оның дәрежесі (оған қанша қабырға қосылған)." },
  "scene.graph.ariaDegrees": { ru: "Степени вершин: {list}.", kk: "Төбелердің дәрежелері: {list}." },
} satisfies Record<string, L>;
