// Сцена gates: галерея значков вентилей (чистая логика: формулы, геометрия значка, число колонок).

import { CIRCUIT_GEO, GATE_STYLE, type GateOp, type Pt } from "./circuit";
import { estimateTextWidth } from "./text-width";

/** Формула вентиля (знаки ∧ ∨ ¬ ⊕ — как в учебнике и на ЕНТ). */
export const GATE_FORMULA: Record<GateOp, string> = {
  and: "A ∧ B",
  or: "A ∨ B",
  not: "¬A",
  xor: "A ⊕ B",
  nand: "¬(A ∧ B)",
  nor: "¬(A ∨ B)",
};

/** Число входов вентиля. */
export const gateInputs = (op: GateOp): number => (op === "not" ? 1 : 2);

/** Геометрия значка (в единицах viewBox): рамка того же размера, что в CircuitScene, выводы по краям. */
export interface GateGlyph {
  w: number;
  h: number;
  box: { x: number; y: number; w: number; h: number };
  /** Концы выводов входов (слева) и выход (справа, за кружком инверсии). */
  inputs: Pt[];
  out: Pt;
  /** Центр кружка инверсии (null — без него). */
  bubble: Pt | null;
  symbol: string;
}

/** Длина вывода по обе стороны рамки. */
const LEAD = 14;
/** Отступ от края значка по вертикали. */
const PAD_Y = 3;

export function gateGlyph(op: GateOp): GateGlyph {
  const G = CIRCUIT_GEO;
  const style = GATE_STYLE[op];
  // Место под кружок инверсии резервируется у всех вентилей: единый viewBox — одинаковый масштаб в галерее.
  const bubble = G.bubble * 2;
  const h = G.gateH + PAD_Y * 2;
  const cy = h / 2;
  const x = LEAD;
  const n = gateInputs(op);
  const inputs: Pt[] = n === 1 ? [[0, cy]] : [[0, cy - G.portDy], [0, cy + G.portDy]];
  return {
    w: x + G.gateW + bubble + LEAD,
    h,
    box: { x, y: PAD_Y, w: G.gateW, h: G.gateH },
    inputs,
    out: [x + G.gateW + bubble + LEAD, cy],
    bubble: style.inverted ? [x + G.gateW + G.bubble, cy] : null,
    symbol: style.symbol,
  };
}

/** Слова названия, которые не делятся: перенос возможен по пробелу и дефису. */
export function longestWord(label: string): string {
  return label.split(/[\s-]+/).reduce((a, b) => (b.length > a.length ? b : a), "");
}

/** Отступы карточки (px): рамка 2 + поля по 6 с каждой стороны. */
const CARD_PAD = 14;
/** Зазор между карточками, px. */
export const GATES_GAP = 8;
const GAP = GATES_GAP;

/**
 * Число колонок сетки: по числу вентилей (1–3 — в один ряд, 4 — 2×2, 5–6 — по 3), но если самое длинное
 * слово названия (после переноса по дефису/пробелу) не влезает в карточку, колонок становится меньше.
 */
export function gatesColumns(count: number, labels: string[], availPx = 328, fontPx = 13): number {
  let cols = count <= 3 ? Math.max(1, count) : count === 4 ? 2 : 3;
  const word = Math.max(0, ...labels.map((s) => estimateTextWidth(longestWord(s), fontPx)));
  while (cols > 1 && (availPx - GAP * (cols - 1)) / cols - CARD_PAD < word) cols--;
  return cols;
}

/** Ширина значка не больше доли карточки, чтобы рисунок оставался крупным и целым. */
export const GLYPH_MAX_PX = 96;
