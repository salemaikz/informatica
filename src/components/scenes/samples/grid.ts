import type { Scene } from "@/lib/types";

/** Образцы сцены grid. Дополняет исполнитель сцены. */
export const SAMPLES: Extract<Scene, { kind: "grid" }>[] = [
  {
    kind: "grid",
    rows: 4,
    cols: 4,
    axes: { row: "i", col: "j" },
    values: [["1", "2", "3", "4"], ["5", "6", "7", "8"], ["9", "10", "11", "12"], ["13", "14", "15", "16"]],
    marks: [{ tone: "primary", region: "diag" }, { tone: "warning", region: "upper" }],
  },
  { kind: "grid", rows: 3, cols: 3, axes: { from: 1 }, merges: [{ r: 0, c: 0, cs: 2 }, { r: 1, c: 2, rs: 2 }], hatch: true },
];
