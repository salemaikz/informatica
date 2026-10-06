import type { Scene } from "@/lib/types";

/**
 * Образцы сцены gates: все шесть вентилей, подсветка, малые наборы, 4 вентиля (сетка 2×2).
 * В подписях название вентиля с дефисом не рвётся: после дефиса — word joiner (U+2060), как у «Wi-Fi» в названиях устройств.
 */
export const SAMPLES: Extract<Scene, { kind: "gates" }>[] = [
  { kind: "gates", ops: ["and", "or", "not", "xor", "nand", "nor"], highlight: ["xor"] },
  { kind: "gates", ops: ["nand", "nor", "xor"], highlight: ["nand", "nor"], caption: { ru: "Две инверсии: И-\u2060НЕ и ИЛИ-\u2060НЕ", kk: "Екі инверсия: ЖӘНЕ-\u2060ЕМЕС және НЕМЕСЕ-\u2060ЕМЕС" } },
  { kind: "gates", ops: ["and", "or", "not"] },
  { kind: "gates", ops: ["xor", "nor", "and", "not"], highlight: ["not"] },
  { kind: "gates", ops: ["nor"], highlight: ["nor"] },
];
