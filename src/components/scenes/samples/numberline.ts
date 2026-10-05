import type { Scene } from "@/lib/types";

/** Образцы сцены numberline (галерея /dev/scenes, проверка tests/scene-samples.test.ts). Дополняет исполнитель сцены. */
export const SAMPLES: Extract<Scene, { kind: "numberline" }>[] = [
  {
    kind: "numberline",
    min: 0,
    max: 10,
    ticks: "all",
    rows: [
      { label: "x > 3", ranges: [{ from: 3, to: null }] },
      { label: "x ≤ 7", ranges: [{ from: null, to: 7, toIn: true }] },
      { label: { ru: "оба", kk: "екеуі" }, tone: "success", ranges: [{ from: 3, to: 7, toIn: true }] },
    ],
  },
  { kind: "numberline", min: 0, max: 10, rows: [{ label: "range(2, 9, 3)", jumps: { start: 2, stop: 9, step: 3 } }] },
];
