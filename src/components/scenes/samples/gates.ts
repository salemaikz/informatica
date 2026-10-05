import type { Scene } from "@/lib/types";

/** Образцы сцены gates: все шесть вентилей, подсветка, малые наборы, 4 вентиля (сетка 2×2). */
export const SAMPLES: Extract<Scene, { kind: "gates" }>[] = [
  { kind: "gates", ops: ["and", "or", "not", "xor", "nand", "nor"], highlight: ["xor"] },
  { kind: "gates", ops: ["nand", "nor", "xor"], highlight: ["nand", "nor"], caption: { ru: "Две инверсии: И-НЕ и ИЛИ-НЕ", kk: "Екі инверсия: ЖӘНЕ-ЕМЕС және НЕМЕСЕ-ЕМЕС" } },
  { kind: "gates", ops: ["and", "or", "not"] },
  { kind: "gates", ops: ["xor", "nor", "and", "not"], highlight: ["not"] },
  { kind: "gates", ops: ["nor"], highlight: ["nor"] },
];
