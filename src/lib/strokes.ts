// Векторные штрихи холста: типы, упрощение линии, санитизация недоверенных данных, сериализация.
// Чистая логика без React и DOM — покрыта тестами (tests/strokes.test.ts).

export type ToolId = "pen" | "marker" | "eraser";
export type ColorId = "ink" | "blue" | "red" | "green" | "orange" | "yellow";
export type Point = [number, number];

export interface Stroke {
  tool: ToolId;
  color: ColorId;
  /** Толщина линии в CSS-пикселях. */
  size: number;
  /** Координаты в CSS-пикселях холста, округлены до 0.5. */
  points: Point[];
}

export const TOOL_IDS: readonly ToolId[] = ["pen", "marker", "eraser"];
export const COLOR_IDS: readonly ColorId[] = ["ink", "blue", "red", "green", "orange", "yellow"];
/** Цвета ручки (жёлтый — только у маркера). */
export const PEN_COLORS: readonly ColorId[] = ["ink", "blue", "red", "green", "orange"];

/** Доступные размеры по инструментам. */
export const TOOL_SIZES: Record<ToolId, readonly number[]> = {
  pen: [2, 4, 7, 12],
  marker: [16, 28],
  eraser: [12, 24, 40, 64],
};
/** Индекс размера по умолчанию. */
export const DEFAULT_SIZE_INDEX: Record<ToolId, number> = { pen: 1, marker: 0, eraser: 1 };

export type ThemeName = "light" | "dark";

/**
 * Цвета штрихов для каждой темы. «Чернила» — цвет текста темы; остальные подобраны так, чтобы читаться
 * и на светлом (#fff / клетка), и на тёмном (#171d2b) фоне. На бумаге (экспорт) всегда используется "light".
 */
export const PALETTE: Record<ThemeName, Record<ColorId, string>> = {
  light: { ink: "#1b2333", blue: "#1d5fd1", red: "#d92d2d", green: "#15803d", orange: "#d9650b", yellow: "#facc15" },
  dark: { ink: "#e8ecf4", blue: "#6aaeff", red: "#ff7a7a", green: "#4ade80", orange: "#ffa24d", yellow: "#fde047" },
};

/** Прозрачность маркера по темам (светлая — вместе с multiply при рисовании поверх, тёмная — обычное наложение). */
export const MARKER_ALPHA: Record<ThemeName, number> = { light: 0.55, dark: 0.35 };

/** Допуск упрощения линии Рамера — Дугласа — Пекера, px. */
export const SIMPLIFY_EPS = 0.6;
/** Лимиты для санитизации (защита от раздутых/испорченных данных). */
export const MAX_STROKES = 3000;
export const MAX_STROKE_POINTS = 5000;
export const MAX_TOTAL_POINTS = 150_000;
const MAX_COORD = 20_000;
const MIN_SIZE = 1;
const MAX_SIZE = 80;

export const roundHalf = (v: number): number => Math.round(v * 2) / 2;

/** Расстояние от точки до отрезка ab (если a и b совпадают — до точки). */
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Упрощение ломаной Рамера — Дугласа — Пекера (без рекурсии: длинные штрихи не переполнят стек). */
export function simplifyPoints(pts: readonly Point[], eps: number = SIMPLIFY_EPS): Point[] {
  const n = pts.length;
  if (n < 3) return pts.map((p) => [p[0], p[1]]);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distToSegment(pts[i], pts[a], pts[b]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > eps) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out: Point[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push([pts[i][0], pts[i][1]]);
  return out;
}

/** Цвет по умолчанию для инструмента (маркер — жёлтый, остальным — чернила). */
export function defaultColor(tool: ToolId): ColorId {
  return tool === "marker" ? "yellow" : "ink";
}

/** Готовый штрих из «сырых» точек: округление до 0.5, удаление повторов, упрощение. */
export function makeStroke(tool: ToolId, color: ColorId, size: number, raw: readonly Point[]): Stroke {
  const rounded: Point[] = [];
  for (const p of raw) {
    const q: Point = [roundHalf(p[0]), roundHalf(p[1])];
    const last = rounded[rounded.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) rounded.push(q);
  }
  return { tool, color, size, points: simplifyPoints(rounded) };
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Данные из хранилища недоверенные: оставляем только корректные штрихи в разумных пределах. */
export function sanitizeStrokes(raw: unknown): Stroke[] {
  if (!Array.isArray(raw)) return [];
  const out: Stroke[] = [];
  let total = 0;
  for (const item of raw) {
    if (out.length >= MAX_STROKES || total >= MAX_TOTAL_POINTS) break;
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    if (!TOOL_IDS.includes(s.tool as ToolId)) continue;
    const tool = s.tool as ToolId;
    if (!Array.isArray(s.points)) continue;
    const points: Point[] = [];
    for (const p of s.points) {
      if (points.length >= MAX_STROKE_POINTS || total + points.length >= MAX_TOTAL_POINTS) break;
      if (!Array.isArray(p) || p.length < 2 || !isNum(p[0]) || !isNum(p[1])) continue;
      if (Math.abs(p[0]) > MAX_COORD || Math.abs(p[1]) > MAX_COORD) continue;
      points.push([roundHalf(p[0]), roundHalf(p[1])]);
    }
    if (!points.length) continue;
    // Цвет: маркер всегда жёлтый, ластику цвет не нужен, у ручки жёлтого нет.
    let color: ColorId = defaultColor(tool);
    if (tool === "pen" && COLOR_IDS.includes(s.color as ColorId) && s.color !== "yellow") color = s.color as ColorId;
    const size = isNum(s.size) ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, s.size)) : TOOL_SIZES[tool][DEFAULT_SIZE_INDEX[tool]];
    total += points.length;
    out.push({ tool, color, size, points });
  }
  return out;
}

export function serializeStrokes(strokes: readonly Stroke[]): string {
  return JSON.stringify(strokes);
}

/** Обратное к serializeStrokes; любой мусор → пустой список. */
export function parseStrokes(json: string): Stroke[] {
  try {
    return sanitizeStrokes(JSON.parse(json));
  } catch {
    return [];
  }
}

/** Есть ли «настоящие» штрихи (ластик сам по себе содержимого не создаёт). */
export function hasInk(strokes: readonly Stroke[] | undefined): boolean {
  return !!strokes && strokes.some((s) => s.tool !== "eraser");
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Рамка вокруг всех штрихов, кроме ластика (с учётом толщины линии) плюс поля; null — рисовать нечего. */
export function strokesBounds(strokes: readonly Stroke[], margin = 0): Box | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of strokes) {
    if (s.tool === "eraser") continue;
    const r = s.size / 2;
    for (const [x, y] of s.points) {
      if (x - r < x0) x0 = x - r;
      if (y - r < y0) y0 = y - r;
      if (x + r > x1) x1 = x + r;
      if (y + r > y1) y1 = y + r;
    }
  }
  if (x0 === Infinity) return null;
  return { x: x0 - margin, y: y0 - margin, w: x1 - x0 + 2 * margin, h: y1 - y0 + 2 * margin };
}

/** Масштаб экспорта: не больше `maxScale` пикселей на CSS-пиксель и не шире `maxWidth` пикселей. */
export function exportScale(boxWidth: number, maxScale: number, maxWidth: number): number {
  if (boxWidth <= 0) return maxScale;
  return Math.min(maxScale, maxWidth / boxWidth);
}
