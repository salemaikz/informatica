import type { L } from "@/lib/types";

// Этап 16Б, волна 3 (сцена chart; ТЗ — docs/specs/stage16b-wave3*.md). Ключи — `scene.chart.*`.
// Казахский — литературный, термины по глоссарию НЦТ, без глаголов с родом в русском. Вычитано моделью, носителем — нет.
export const sceneChartDict = {
  "scene.chart.ariaBar": { ru: "Столбчатая диаграмма. {items}.", kk: "Бағанды диаграмма. {items}." },
  "scene.chart.ariaLine": { ru: "Линейный график. {items}.", kk: "Сызықтық график. {items}." },
  "scene.chart.ariaPie": { ru: "Круговая диаграмма. {items}.", kk: "Дөңгелек диаграмма. {items}." },
  "scene.chart.ariaThreshold": { ru: "Пунктирная линия: {value}.", kk: "Үзік сызық: {value}." },
  "scene.chart.ariaFunnel": {
    ru: "Над столбцами указана доля от предыдущего.",
    kk: "Бағандардың үстінде алдыңғысына қатысты үлес көрсетілген.",
  },
  "scene.chart.ariaHighlight": { ru: "Выделено: {items}.", kk: "Бөлектелгені: {items}." },
  "scene.chart.funnelFrom": { ru: "от предыдущего", kk: "алдыңғысынан" },
  "scene.chart.funnelNote": {
    ru: "% — доля от предыдущего столбца",
    kk: "% — алдыңғы бағанға қатысты үлес",
  },
} satisfies Record<string, L>;
