import type { Scene } from "@/lib/types";

/** Образцы сцены box. Дополняет исполнитель сцены. */
export const SAMPLES: Extract<Scene, { kind: "box" }>[] = [
  { kind: "box", width: 200, padding: 20, border: 5, margin: 10, total: true, highlight: "padding" },
  { kind: "box", width: 200, padding: [10, 20, 10, 20], border: 2, margin: 30, borderBox: true, total: true, collapse: { top: 20 } },
];
