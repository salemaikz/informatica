import type { Scene } from "@/lib/types";

/** Образцы сцены box. */
export const SAMPLES: Extract<Scene, { kind: "box" }>[] = [
  { kind: "box", width: 200, padding: 20, border: 5, margin: 10, total: true, highlight: "padding" },
  { kind: "box", width: 200, padding: [10, 20, 10, 20], border: 2, margin: 30, borderBox: true, total: true, collapse: { top: 20 } },
  // без highlight и линейки: все слои яркие
  { kind: "box", width: 300, padding: [5, 15, 25, 35], border: [1, 2, 3, 4], margin: [8, 16, 24, 32] },
  // худший случай по ширине: все стороны по 200 px (три цифры), width 2000
  { kind: "box", width: 2000, padding: 200, border: 200, margin: 200, total: true },
  // стороны 0 — полосы и подписи нет; фиксированная высота
  { kind: "box", width: 160, height: 80, padding: 12, highlight: "content", total: true },
  { kind: "box", width: 240, border: 4, margin: [0, 24, 0, 24], highlight: "border", total: true },
  // border-box: линейка в две строки (width и margin)
  { kind: "box", width: 250, padding: 25, border: 10, margin: 15, borderBox: true, total: true, highlight: "margin" },
  // схлопывание: нижний margin больше верхнего второго блока
  { kind: "box", width: 180, padding: 10, border: 2, margin: [0, 10, 40, 10], collapse: { top: 15 }, highlight: "margin" },
  // схлопывание без margin у первого
  { kind: "box", width: 180, padding: 10, collapse: { top: 25 } },
];
