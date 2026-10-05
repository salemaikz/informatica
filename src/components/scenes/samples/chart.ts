import type { Scene } from "@/lib/types";

/** Образцы сцены chart. Дополняет исполнитель сцены. */
export const SAMPLES: Extract<Scene, { kind: "chart" }>[] = [
  { kind: "chart", type: "bar", labels: ["Пн", "Вт", "Ср", "Чт"], series: [{ values: [3, 5, 2, 6] }], values: true, highlight: [3] },
  { kind: "chart", type: "pie", labels: [{ ru: "Сон", kk: "Ұйқы" }, { ru: "Учёба", kk: "Оқу" }, { ru: "Отдых", kk: "Демалыс" }], series: [{ values: [8, 8, 8] }], values: true },
];
