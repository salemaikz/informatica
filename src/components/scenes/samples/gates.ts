import type { Scene } from "@/lib/types";

/** Образцы сцены gates. Дополняет исполнитель сцены. */
export const SAMPLES: Extract<Scene, { kind: "gates" }>[] = [{ kind: "gates", ops: ["and", "or", "not", "xor", "nand", "nor"], highlight: ["xor"] }];
