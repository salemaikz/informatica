import type { Scene } from "@/lib/types";

/** Образцы сцены switches. Дополняет исполнитель сцены. */
export const SAMPLES: Extract<Scene, { kind: "switches" }>[] = [
  { kind: "switches", mode: "and", values: [1, 0], names: ["A", "B"] },
  { kind: "switches", mode: "or", values: [1, 0], names: ["A", "B"] },
  { kind: "switches", mode: "not", values: [1], names: ["A"] },
  { kind: "switches", mode: "xor", values: [1, 1], names: ["A", "B"] },
];
