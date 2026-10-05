import type { Scene } from "@/lib/types";

/** Образцы сцены tape. Дополняет исполнитель сцены. */
export const SAMPLES: Extract<Scene, { kind: "tape" }>[] = [
  { kind: "tape", cells: ["P", "y", "t", "h", "o", "n"], index: "both", name: "s", slice: { start: 1, stop: 5, step: 2 } },
  { kind: "tape", cells: ["3", "8", "1", "9", "4"], name: "a", pointers: [{ at: 1, label: "i" }], swaps: [[1, 2]] },
];
