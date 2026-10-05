import type { Scene } from "@/lib/types";

/** Образцы сцены wave. Дополняет исполнитель сцены. */
export const SAMPLES: Extract<Scene, { kind: "wave" }>[] = [
  { kind: "wave", samples: 12, bits: 3, digital: true },
  { kind: "wave", samples: 16, bits: 4, digital: true, compare: { samples: 6, bits: 2 } },
];
