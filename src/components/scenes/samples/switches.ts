import type { Scene } from "@/lib/types";

/** Образцы сцены switches: все режимы, лампа горит и не горит, 2 и 3 ключа, без значений и имён. */
export const SAMPLES: Extract<Scene, { kind: "switches" }>[] = [
  { kind: "switches", mode: "and", values: [1, 0], names: ["A", "B"] },
  { kind: "switches", mode: "and", values: [1, 1, 1], names: ["A", "B", "C"], caption: { ru: "Все ключи замкнуты — лампа горит", kk: "Барлық кілт тұйықталған — шам жанып тұр" } },
  { kind: "switches", mode: "or", values: [1, 0], names: ["A", "B"] },
  { kind: "switches", mode: "or", values: [0, 0, 0], names: ["A", "B", "C"] },
  { kind: "switches", mode: "or", values: [0, 1, 0] },
  { kind: "switches", mode: "not", values: [1], names: ["A"] },
  { kind: "switches", mode: "not", values: [0], names: ["A"] },
  { kind: "switches", mode: "xor", values: [1, 1], names: ["A", "B"] },
  { kind: "switches", mode: "xor", values: [0, 1], names: ["A", "B"] },
  { kind: "switches", mode: "xor" },
];
