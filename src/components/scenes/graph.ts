// Раскладка сцены graph (граф, дерево): размеры вершин, координаты по четырём режимам (free, tree, circle, chain),
// подрезка рёбер по краю вершины, наконечники стрелок, место подписи веса, место степени. Чистая логика без React.
//
// Система координат — «логический экран» шириной GRAPH_W (320): на телефоне 360 px он растягивается почти 1:1,
// на широком экране ограничен max-w компонента. Если содержимое не влезает (например, дерево-«ёжик» из 15 листьев),
// сначала уменьшаются вершины и шрифт (GRAPH_SCALES), и только потом ширина области растёт (картинка чуть сжимается).

import type { DictKey } from "@/i18n/dict";
import type { SceneTone } from "@/lib/types";
import { estimateTextWidth } from "./text-width";

export const GRAPH_W = 320;
/** Поля вокруг содержимого. */
export const GRAPH_MARGIN = 6;
/** Коэффициенты размера вершин и шрифта: пробуем по порядку, пока всё не влезет без наложений. */
export const GRAPH_SCALES = [1, 0.92, 0.84, 0.76, 0.68];

export type GraphLayoutKind = "free" | "tree" | "circle" | "chain";

/** Вход раскладки: подписи уже переведены на язык ученика (в компоненте — через l()). */
export type GraphInput = {
  nodes: { id: string; label: string; x?: number; y?: number; tone?: SceneTone }[];
  edges: { from: string; to: string; weight?: string; tone?: SceneTone }[];
  layout: GraphLayoutKind;
  root?: string;
  directed: boolean;
  path: string[];
  highlight: string[];
  degrees: boolean;
};

export type GNode = {
  id: string;
  cx: number;
  cy: number;
  shape: "circle" | "rect";
  w: number;
  h: number;
  /** Радиус скругления (rect) или радиус (circle). */
  r: number;
  lines: string[];
  fontPx: number;
  lineH: number;
  /** Цвет вершины: собственный tone > highlight (warning) > путь (primary). null — нейтральная. */
  tone: SceneTone | null;
  onPath: boolean;
  degree?: number;
};

export type GPill = { x: number; y: number; w: number; h: number; text: string; fontPx: number };

export type GEdge = {
  key: string;
  from: string;
  to: string;
  /** Линия (до основания стрелки у ориентированных). */
  d: string;
  /** Наконечник — замкнутый контур; пусто у неориентированных. */
  arrow: string;
  onPath: boolean;
  tone: SceneTone | null;
  /** Концы видимой части (на краях вершин) и опорная точка изгиба — для проверок и тестов. */
  p0: [number, number];
  p1: [number, number];
  ctrl?: [number, number];
  pill?: GPill;
};

export type GBadge = { id: string; x: number; y: number; r: number; text: string; fontPx: number };

export type GraphLayout = {
  width: number;
  height: number;
  nodes: GNode[];
  edges: GEdge[];
  badges: GBadge[];
  /** Какой коэффициент размера подошёл (1 — полный). */
  scale: number;
  /** Вершины не налезают друг на друга и всё влезло в GRAPH_W. */
  fits: boolean;
};

type Pos = { x: number; y: number };
type Box = { cx: number; cy: number; w: number; h: number; shape: "circle" | "rect"; r: number };

// ---------- Размеры вершин ----------

const MAX_NODE_W = 112;

function baseSize(n: number): { r: number; font: number } {
  if (n <= 7) return { r: 17, font: 14 };
  if (n <= 12) return { r: 15, font: 13 };
  return { r: 13, font: 12 };
}

/** Разбить строку по пробелам так, чтобы каждая часть влезала в maxW (слово длиннее maxW остаётся целым). */
export function wrapWords(line: string, font: number, maxW: number): string[] {
  const words = line.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && estimateTextWidth(next, font) > maxW) {
      out.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

/** Строки подписи: явные переносы, перенос по пробелам для слишком длинных, не больше 3 строк; шрифт уменьшается до 10, если слово не влезает. */
export function fitLines(text: string, font: number, maxW: number): { lines: string[]; font: number } {
  const raw = text.split("\n").map((s) => s.trim()).filter(Boolean);
  let lines: string[] = [];
  for (const line of raw.length ? raw : [text.trim() || " "]) {
    lines.push(...(estimateTextWidth(line, font) > maxW ? wrapWords(line, font, maxW) : [line]));
  }
  if (lines.length > 3) lines = [lines[0], lines[1], lines.slice(2).join(" ")];
  let f = font;
  while (f > 10 && Math.max(...lines.map((s) => estimateTextWidth(s, f))) > maxW) f -= 0.5;
  return { lines, font: f };
}

type Sized = Box & { lines: string[]; fontPx: number; lineH: number };

function sizeNode(label: string, n: number, k: number): Sized {
  const base = baseSize(n);
  const R = base.r * k;
  const font = Math.max(10, Math.round(base.font * k * 2) / 2);
  const explicit = label.split("\n").map((s) => s.trim()).filter(Boolean);
  const circle = explicit.length >= 1 && explicit.length <= 2 && explicit.every((s) => [...s].length <= 3);
  if (circle) {
    const lineH = font * 1.15;
    const tw = Math.max(...explicit.map((s) => estimateTextWidth(s, font)));
    const r = Math.max(R, Math.hypot(tw / 2, (explicit.length * lineH) / 2) + 3);
    return { cx: 0, cy: 0, w: 2 * r, h: 2 * r, shape: "circle", r, lines: explicit, fontPx: font, lineH };
  }
  const fit = fitLines(label, font, MAX_NODE_W - 18);
  const lineH = fit.font * 1.15;
  const tw = Math.max(...fit.lines.map((s) => estimateTextWidth(s, fit.font)));
  const w = Math.min(MAX_NODE_W, Math.max(2 * R, tw + 18));
  const h = Math.max(2 * R, fit.lines.length * lineH + 10);
  return { cx: 0, cy: 0, w, h, shape: "rect", r: Math.min(10, h / 2), lines: fit.lines, fontPx: fit.font, lineH };
}

// ---------- Геометрия ----------

/** Точка на контуре вершины в направлении (tx, ty) от её центра; extra — отступ наружу. Углы скруглённого прямоугольника учтены. */
export function borderPoint(n: Box, tx: number, ty: number, extra = 0): Pos {
  const dx = tx - n.cx;
  const dy = ty - n.cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  if (n.shape === "circle") return { x: n.cx + ux * (n.r + extra), y: n.cy + uy * (n.r + extra) };
  const hw = n.w / 2;
  const hh = n.h / 2;
  const rx = Math.min(n.r, hw, hh);
  const s = Math.min(ux === 0 ? Infinity : hw / Math.abs(ux), uy === 0 ? Infinity : hh / Math.abs(uy));
  let px = ux * s;
  let py = uy * s;
  if (Math.abs(px) > hw - rx && Math.abs(py) > hh - rx) {
    // угол: пересечение луча с окружностью скругления
    const ccx = Math.sign(px) * (hw - rx);
    const ccy = Math.sign(py) * (hh - rx);
    const b = ux * ccx + uy * ccy;
    const c = ccx * ccx + ccy * ccy - rx * rx;
    const disc = b * b - c;
    if (disc >= 0) {
      const t = b + Math.sqrt(disc);
      px = ux * t;
      py = uy * t;
    }
  }
  return { x: n.cx + px + ux * extra, y: n.cy + py + uy * extra };
}

/** Налезают ли две вершины друг на друга (с зазором m). */
export function boxesOverlap(a: Box, b: Box, m = 2): boolean {
  if (a.shape === "circle" && b.shape === "circle") return Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.r + b.r + m;
  if (a.shape === "rect" && b.shape === "rect") return Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 + m && Math.abs(a.cy - b.cy) < (a.h + b.h) / 2 + m;
  const [c, r] = a.shape === "circle" ? [a, b] : [b, a];
  const nx = Math.max(r.cx - r.w / 2, Math.min(c.cx, r.cx + r.w / 2));
  const ny = Math.max(r.cy - r.h / 2, Math.min(c.cy, r.cy + r.h / 2));
  return Math.hypot(c.cx - nx, c.cy - ny) < c.r + m;
}

type Rect = { x0: number; y0: number; x1: number; y1: number };

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

function boxRect(n: Box, pad = 0): Rect {
  return { x0: n.cx - n.w / 2 - pad, y0: n.cy - n.h / 2 - pad, x1: n.cx + n.w / 2 + pad, y1: n.cy + n.h / 2 + pad };
}

/** Пересекает ли отрезок прямоугольник (Лианга — Барски). */
export function segmentHitsRect(a: Pos, b: Pos, r: Rect): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - r.x0, r.x1 - a.x, a.y - r.y0, r.y1 - a.y];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        t0 = Math.max(t0, t);
      } else {
        if (t < t0) return false;
        t1 = Math.min(t1, t);
      }
    }
  }
  return true;
}

function quadAt(p0: Pos, c: Pos, p1: Pos, t: number): Pos {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y };
}

function samplePoly(p0: Pos, p1: Pos, c: Pos | undefined, steps = 10): Pos[] {
  if (!c) return [p0, p1];
  return Array.from({ length: steps + 1 }, (_, i) => quadAt(p0, c, p1, i / steps));
}

function pointOn(p0: Pos, p1: Pos, c: Pos | undefined, t: number): Pos {
  return c ? quadAt(p0, c, p1, t) : { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
}

// ---------- Раскладки: координаты центров ----------

type Built = { pos: Map<string, Pos>; bulge: Map<number, number> };

/** free: x, y 0..100 → поле с отступами по размеру вершин. */
function buildFree(input: GraphInput, sized: Map<string, Sized>, W: number): Built {
  const n = input.nodes.length;
  const all = [...sized.values()];
  const padX = Math.max(...all.map((s) => s.w / 2)) + 4;
  const padY = Math.max(...all.map((s) => s.h / 2)) + 4 + (input.degrees ? 8 : 0);
  const fieldW = Math.max(40, W - 2 * padX);
  const fieldH = (n <= 6 ? 200 : n <= 10 ? 240 : 280) + (input.edges.some((e) => e.weight) ? 30 : 0);
  const pos = new Map<string, Pos>();
  for (const v of input.nodes) pos.set(v.id, { x: padX + ((v.x ?? 50) / 100) * fieldW, y: padY + ((v.y ?? 50) / 100) * fieldH });
  return { pos, bulge: new Map() };
}

/** Дети вершин дерева: обход в ширину от корня, порядок детей — порядок рёбер в сцене. Недостижимые вершины (в корректной сцене их нет) — отдельные корни. */
export function treeChildren(input: GraphInput): { roots: string[]; children: Map<string, string[]>; depth: Map<string, number> } {
  const children = new Map<string, string[]>(input.nodes.map((v) => [v.id, []]));
  const depth = new Map<string, number>();
  const roots: string[] = [];
  const grow = (start: string) => {
    roots.push(start);
    depth.set(start, 0);
    const queue = [start];
    for (let qi = 0; qi < queue.length; qi++) {
      const u = queue[qi];
      for (const e of input.edges) {
        const other = e.from === u ? e.to : !input.directed && e.to === u ? e.from : null;
        if (other === null || depth.has(other)) continue;
        depth.set(other, depth.get(u)! + 1);
        children.get(u)!.push(other);
        queue.push(other);
      }
    }
  };
  const first = input.root && children.has(input.root) ? input.root : input.nodes[0].id;
  grow(first);
  for (const v of input.nodes) if (!depth.has(v.id)) grow(v.id);
  return { roots, children, depth };
}

function maxPillWidth(input: GraphInput, k: number): number {
  const ws = input.edges.filter((e) => e.weight).map((e) => estimateTextWidth(e.weight!, pillFont(k)) + 10);
  return ws.length ? Math.max(...ws) : 0;
}

function pillFont(k: number): number {
  return Math.max(9.5, 11 * k);
}

/** tree: уровни сверху вниз; ширина поддерева = сумма детей (или свой размер), родитель — над серединой детей. Пересечений нет. */
function buildTree(input: GraphInput, sized: Map<string, Sized>, k: number, extraY: number): Built {
  const { roots, children, depth } = treeChildren(input);
  const hasWeights = input.edges.some((e) => e.weight);
  const gapX = Math.max(8 * k, hasWeights ? maxPillWidth(input, k) + 2 : 0);
  const gapY = (hasWeights ? 36 : 26) * Math.max(k, 0.85) + (input.degrees ? 4 : 0) + extraY;

  const span = new Map<string, number>();
  const measure = (u: string): number => {
    const own = sized.get(u)!.w + gapX;
    const kids = children.get(u)!;
    const sum = kids.reduce((a, c) => a + measure(c), 0);
    const s = Math.max(own, sum);
    span.set(u, s);
    return s;
  };
  for (const r of roots) measure(r);

  const xs = new Map<string, number>();
  const place = (u: string, left: number) => {
    const kids = children.get(u)!;
    if (!kids.length) {
      xs.set(u, left + span.get(u)! / 2);
      return;
    }
    const sum = kids.reduce((a, c) => a + span.get(c)!, 0);
    let x = left + (span.get(u)! - sum) / 2;
    for (const c of kids) {
      place(c, x);
      x += span.get(c)!;
    }
    xs.set(u, (xs.get(kids[0])! + xs.get(kids[kids.length - 1])!) / 2);
  };
  let left = 0;
  for (const r of roots) {
    place(r, left);
    left += span.get(r)!;
  }

  // высота уровней: по самой высокой вершине уровня
  const maxD = Math.max(...depth.values());
  const levelHalf = Array.from({ length: maxD + 1 }, () => 0);
  for (const [id, d] of depth) levelHalf[d] = Math.max(levelHalf[d], sized.get(id)!.h / 2);
  const ys: number[] = [];
  let y = levelHalf[0];
  for (let d = 0; d <= maxD; d++) {
    ys.push(y);
    if (d < maxD) y += levelHalf[d] + gapY + levelHalf[d + 1];
  }
  const pos = new Map<string, Pos>();
  for (const [id, d] of depth) pos.set(id, { x: xs.get(id)!, y: ys[d] });
  return { pos, bulge: new Map() };
}

/** circle: по кругу по часовой стрелке, первая — сверху (при двух вершинах — слева направо). */
function buildCircle(input: GraphInput, sized: Map<string, Sized>, W: number): Built {
  const n = input.nodes.length;
  const all = [...sized.values()];
  const hw = Math.max(...all.map((s) => s.w / 2));
  const room = input.degrees ? 8 : 0;
  const maxR = n <= 3 ? 70 : n <= 5 ? 92 : 120;
  const R = Math.max(30, Math.min(maxR, W / 2 - hw - GRAPH_MARGIN - room));
  const start = n === 2 ? Math.PI : -Math.PI / 2;
  const pos = new Map<string, Pos>();
  input.nodes.forEach((v, i) => {
    const a = start + (2 * Math.PI * i) / n;
    pos.set(v.id, { x: R * Math.cos(a) * (n === 2 ? 1.1 : 1), y: R * Math.sin(a) });
  });
  return { pos, bulge: new Map() };
}

/** chain: в линию слева направо; не влезает — змейкой (чётные ряды слева направо, нечётные справа налево), ряды выровнены по сетке. */
function buildChain(input: GraphInput, sized: Map<string, Sized>, W: number, k: number): Built {
  const n = input.nodes.length;
  const all = [...sized.values()];
  const maxW = Math.max(...all.map((s) => s.w));
  const maxH = Math.max(...all.map((s) => s.h));
  const hasWeights = input.edges.some((e) => e.weight);
  const minGap = Math.max(input.directed ? 22 : 14, hasWeights ? maxPillWidth(input, k) + 8 + (input.directed ? 12 : 0) : 0);
  const avail = W - 2 * GRAPH_MARGIN;
  const perRowMax = Math.max(1, Math.floor(avail / (maxW + minGap)));
  const rows = Math.ceil(n / perRowMax);
  const perRow = Math.ceil(n / rows);
  const cell = Math.min(avail / perRow, maxW + 60);
  const idx = new Map(input.nodes.map((v, i) => [v.id, i]));
  const hasArcs = input.edges.some((e) => Math.abs(idx.get(e.from)! - idx.get(e.to)!) > 1);
  const rowGap = 34 + (hasArcs ? 22 : 0) + (hasWeights ? 6 : 0);
  const rowStep = maxH + rowGap;
  const pos = new Map<string, Pos>();
  input.nodes.forEach((v, i) => {
    const row = Math.floor(i / perRow);
    const colIn = i % perRow;
    const col = row % 2 === 0 ? colIn : perRow - 1 - colIn;
    // неполный ряд: сетка та же, ряд просто короче (змейка идёт от края, где закончился предыдущий)
    pos.set(v.id, { x: cell * (col + 0.5), y: maxH / 2 + row * rowStep });
  });
  const bulge = new Map<number, number>();
  input.edges.forEach((e, ei) => {
    const gap = Math.abs(idx.get(e.from)! - idx.get(e.to)!);
    if (gap > 1) bulge.set(ei, Math.min(18 + 8 * (gap - 2), 40));
  });
  return { pos, bulge };
}

// ---------- Общая сборка ----------

function edgeKey(directed: boolean, a: string, b: string): string {
  return directed ? `${a}>${b}` : [a, b].sort().join("~");
}

/** Степени вершин: число инцидентных рёбер (у ориентированного графа — входящие плюс исходящие). */
export function graphDegrees(input: Pick<GraphInput, "nodes" | "edges">): Map<string, number> {
  const d = new Map(input.nodes.map((v) => [v.id, 0]));
  for (const e of input.edges) {
    d.set(e.from, (d.get(e.from) ?? 0) + 1);
    d.set(e.to, (d.get(e.to) ?? 0) + 1);
  }
  return d;
}

function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
}

function build(input: GraphInput, k: number, W: number, extraY = 0): GraphLayout {
  const n = input.nodes.length;
  const sized = new Map<string, Sized>(input.nodes.map((v) => [v.id, sizeNode(v.label, n, k)]));
  const built =
    input.layout === "tree" ? buildTree(input, sized, k, extraY) : input.layout === "circle" ? buildCircle(input, sized, W) : input.layout === "chain" ? buildChain(input, sized, W, k) : buildFree(input, sized, W);
  for (const [id, p] of built.pos) {
    const s = sized.get(id)!;
    s.cx = p.x;
    s.cy = p.y;
  }
  const byId = sized;
  const pathSet = new Set(input.path);
  const hlSet = new Set(input.highlight);
  const pathEdges = new Set(input.path.slice(1).map((v, i) => edgeKey(input.directed, input.path[i], v)));
  const pf = pillFont(k);

  // ---- рёбра: концы на краях вершин, изгиб ----
  const pairs = new Set(input.edges.map((e) => `${e.from}>${e.to}`));
  type Raw = { e: GraphInput["edges"][number]; i: number; p0: Pos; p1: Pos; c?: Pos; poly: Pos[]; onPath: boolean };
  const raws: Raw[] = input.edges.map((e, i) => {
    const A = byId.get(e.from)!;
    const B = byId.get(e.to)!;
    let bulge = built.bulge.get(i) ?? 0;
    if (!bulge && input.directed && pairs.has(`${e.to}>${e.from}`)) bulge = 11;
    const dx = B.cx - A.cx;
    const dy = B.cy - A.cy;
    const len = Math.hypot(dx, dy) || 1;
    let c: Pos | undefined;
    if (bulge) c = { x: (A.cx + B.cx) / 2 + (dy / len) * 2 * bulge, y: (A.cy + B.cy) / 2 - (dx / len) * 2 * bulge };
    const onPath = pathEdges.has(edgeKey(input.directed, e.from, e.to));
    const gap = input.directed ? 1.5 : 0;
    const p0 = borderPoint(A, c ? c.x : B.cx, c ? c.y : B.cy);
    const p1 = borderPoint(B, c ? c.x : A.cx, c ? c.y : A.cy, gap);
    return { e, i, p0, p1, c, poly: samplePoly(p0, p1, c), onPath };
  });

  // ---- стрелки ----
  const arrowOf = (r: Raw): { arrow: number[]; end: Pos } | null => {
    if (!input.directed) return null;
    const L = r.onPath ? 11 : 9;
    const half = r.onPath ? 5.5 : 4.5;
    const from = r.c ?? r.p0;
    const dx = r.p1.x - from.x;
    const dy = r.p1.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const bx = r.p1.x - ux * L;
    const by = r.p1.y - uy * L;
    return { arrow: [r.p1.x, r.p1.y, bx - uy * half, by + ux * half, bx + uy * half, by - ux * half], end: { x: bx + ux * 1, y: by + uy * 1 } };
  };
  const arrows = raws.map(arrowOf);

  // ---- подписи весов: подбор места вдоль ребра ----
  const nodeRects = [...byId.values()].map((s) => boxRect(s, 2));
  const placed: Rect[] = [];
  const pills = new Map<number, GPill>();
  const T = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74];
  for (const r of raws) {
    if (!r.e.weight) continue;
    const w = estimateTextWidth(r.e.weight, pf) + 10;
    const h = pf + 7;
    let best: { t: number; pos: Pos; score: number } | null = null;
    for (const t of T) {
      const pos = pointOn(r.p0, r.p1, r.c, t);
      const rect: Rect = { x0: pos.x - w / 2, y0: pos.y - h / 2, x1: pos.x + w / 2, y1: pos.y + h / 2 };
      let score = Math.abs(t - 0.5) * 10;
      for (const nr of nodeRects) if (rectsOverlap(rect, nr)) score += 100;
      for (const pr of placed) if (rectsOverlap(rect, pr)) score += 80;
      const grown = { x0: rect.x0 - 1, y0: rect.y0 - 1, x1: rect.x1 + 1, y1: rect.y1 + 1 };
      for (const o of raws) {
        if (o === r) continue;
        for (let s = 0; s + 1 < o.poly.length; s++) if (segmentHitsRect(o.poly[s], o.poly[s + 1], grown)) {
          score += 20;
          break;
        }
      }
      if (!best || score < best.score) best = { t, pos, score };
    }
    const pos = best!.pos;
    placed.push({ x0: pos.x - w / 2, y0: pos.y - h / 2, x1: pos.x + w / 2, y1: pos.y + h / 2 });
    pills.set(r.i, { x: pos.x, y: pos.y, w, h, text: r.e.weight, fontPx: pf });
  }

  // ---- степени: значок у вершины со стороны, где нет рёбер ----
  const badges: GBadge[] = [];
  const deg = graphDegrees(input);
  if (input.degrees) {
    const bf = Math.max(9.5, 10.5 * k);
    const br = 8.5 * Math.max(k, 0.9);
    const cand = [-45, 45, -135, 135, 0, 180, -90, 90].map((d) => (d * Math.PI) / 180);
    for (const v of input.nodes) {
      const s = byId.get(v.id)!;
      const incident: number[] = [];
      for (const r of raws) {
        if (r.e.from !== v.id && r.e.to !== v.id) continue;
        const other = r.e.from === v.id ? byId.get(r.e.to)! : byId.get(r.e.from)!;
        const tx = r.c ? r.c.x : other.cx;
        const ty = r.c ? r.c.y : other.cy;
        incident.push(Math.atan2(ty - s.cy, tx - s.cx));
      }
      let best: { pos: Pos; score: number } | null = null;
      cand.forEach((a, ci) => {
        const edge = borderPoint(s, s.cx + Math.cos(a), s.cy + Math.sin(a));
        const pos = { x: edge.x + Math.cos(a) * 5, y: edge.y + Math.sin(a) * 5 };
        const rect: Rect = { x0: pos.x - br, y0: pos.y - br, x1: pos.x + br, y1: pos.y + br };
        let score = incident.length ? Math.min(...incident.map((b) => angleDiff(a, b))) * 10 : 10;
        score -= ci * 0.05;
        for (const o of input.nodes) if (o.id !== v.id && rectsOverlap(rect, boxRect(byId.get(o.id)!, 1))) score -= 100;
        for (const pr of placed) if (rectsOverlap(rect, pr)) score -= 60;
        for (const r of raws) for (let q = 0; q + 1 < r.poly.length; q++) if (segmentHitsRect(r.poly[q], r.poly[q + 1], rect)) score -= 8;
        if (!best || score > best.score) best = { pos, score };
      });
      badges.push({ id: v.id, x: best!.pos.x, y: best!.pos.y, r: br, text: String(deg.get(v.id) ?? 0), fontPx: bf });
    }
  }

  // ---- габариты и сдвиг ----
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x0: number, y0: number, x1: number, y1: number) => {
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  };
  let nodeMinX = Infinity;
  let nodeMaxX = -Infinity;
  for (const s of byId.values()) {
    grow(s.cx - s.w / 2 - 1.5, s.cy - s.h / 2 - 1.5, s.cx + s.w / 2 + 1.5, s.cy + s.h / 2 + 1.5);
    nodeMinX = Math.min(nodeMinX, s.cx - s.w / 2);
    nodeMaxX = Math.max(nodeMaxX, s.cx + s.w / 2);
  }
  for (const r of raws) for (const p of r.poly) grow(p.x - 2, p.y - 2, p.x + 2, p.y + 2);
  for (const p of pills.values()) grow(p.x - p.w / 2, p.y - p.h / 2, p.x + p.w / 2, p.y + p.h / 2);
  for (const b of badges) grow(b.x - b.r, b.y - b.r, b.x + b.r, b.y + b.r);
  const bbW = maxX - minX;
  const width = Math.max(W, Math.ceil(bbW + 2 * GRAPH_MARGIN));
  const dx = (width - bbW) / 2 - minX;
  const dy = GRAPH_MARGIN - minY;
  const height = Math.ceil(maxY - minY + 2 * GRAPH_MARGIN);

  // ---- итог ----
  const f = (v: number) => Math.round(v * 100) / 100;
  const px = (p: Pos): [number, number] => [f(p.x + dx), f(p.y + dy)];
  const nodes: GNode[] = input.nodes.map((v) => {
    const s = byId.get(v.id)!;
    return {
      id: v.id,
      cx: f(s.cx + dx),
      cy: f(s.cy + dy),
      shape: s.shape,
      w: f(s.w),
      h: f(s.h),
      r: f(s.r),
      lines: s.lines,
      fontPx: s.fontPx,
      lineH: f(s.lineH),
      tone: v.tone ?? (hlSet.has(v.id) ? "warning" : pathSet.has(v.id) ? "primary" : null),
      onPath: pathSet.has(v.id),
      degree: input.degrees ? deg.get(v.id) : undefined,
    };
  });
  const edges: GEdge[] = raws.map((r, ri) => {
    const a = arrows[ri];
    const end = a ? a.end : r.p1;
    const [x0, y0] = px(r.p0);
    const [x1, y1] = px(end);
    const d = r.c ? `M${x0} ${y0}Q${px(r.c).join(" ")} ${x1} ${y1}` : `M${x0} ${y0}L${x1} ${y1}`;
    const arrow = a ? `M${f(a.arrow[0] + dx)} ${f(a.arrow[1] + dy)}L${f(a.arrow[2] + dx)} ${f(a.arrow[3] + dy)}L${f(a.arrow[4] + dx)} ${f(a.arrow[5] + dy)}Z` : "";
    const pill = pills.get(r.i);
    return {
      key: `${r.e.from}>${r.e.to}`,
      from: r.e.from,
      to: r.e.to,
      d,
      arrow,
      onPath: r.onPath,
      tone: r.e.tone ?? (r.onPath ? "primary" : null),
      p0: px(r.p0),
      p1: px(r.p1),
      ctrl: r.c ? px(r.c) : undefined,
      pill: pill ? { ...pill, x: f(pill.x + dx), y: f(pill.y + dy), w: f(pill.w), h: f(pill.h) } : undefined,
    };
  });
  const outBadges = badges.map((b) => ({ ...b, x: f(b.x + dx), y: f(b.y + dy) }));

  // ---- влезло ли: нет наложений вершин и ширина вершин в пределах экрана ----
  const list = [...byId.values()];
  let fits = nodeMaxX - nodeMinX <= W - 2 * GRAPH_MARGIN + 0.5;
  for (let i = 0; fits && i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (boxesOverlap(list[i], list[j], 2)) fits = false;
  return { width, height, nodes, edges, badges: outBadges, scale: k, fits };
}

/** Проходит ли ребро (не по своим концам) сквозь чужую вершину. */
export function edgeThroughNode(layout: GraphLayout): boolean {
  for (const e of layout.edges) {
    const a = { x: e.p0[0], y: e.p0[1] };
    const b = { x: e.p1[0], y: e.p1[1] };
    for (const n of layout.nodes) {
      if (n.id === e.from || n.id === e.to) continue;
      if (n.shape === "circle") {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((n.cx - a.x) * dx + (n.cy - a.y) * dy) / (dx * dx + dy * dy || 1)));
        if (Math.hypot(a.x + dx * t - n.cx, a.y + dy * t - n.cy) < n.r - 0.5) return true;
      } else if (segmentHitsRect(a, b, { x0: n.cx - n.w / 2 + 1, y0: n.cy - n.h / 2 + 1, x1: n.cx + n.w / 2 - 1, y1: n.cy + n.h / 2 - 1 })) return true;
    }
  }
  return false;
}

/** Добавки к расстоянию между уровнями дерева: у «ёжика» рёбра к дальним листьям иначе идут сквозь соседние листья. */
const TREE_EXTRA_Y = [0, 10, 22, 36, 52, 70];

/**
 * Раскладка графа. Перебирает коэффициенты размера, пока вершины не перестанут налезать друг на друга и всё не влезет в GRAPH_W;
 * у дерева дополнительно раздвигает уровни, пока рёбра не перестанут проходить сквозь чужие вершины.
 */
export function layoutGraph(input: GraphInput, W: number = GRAPH_W): GraphLayout {
  let last: GraphLayout | null = null;
  for (const k of GRAPH_SCALES) {
    const first = build(input, k, W);
    last = first;
    if (!first.fits) continue;
    if (input.layout !== "tree" || !edgeThroughNode(first)) return first;
    for (const extra of TREE_EXTRA_Y.slice(1)) {
      const taller = build(input, k, W, extra);
      if (!edgeThroughNode(taller)) return taller;
    }
    return first;
  }
  // ничего не влезло в GRAPH_W (дерево-«ёжик»): берём самые мелкие вершины, рёбра раздвигаем по высоте
  if (input.layout === "tree" && edgeThroughNode(last!)) {
    for (const extra of TREE_EXTRA_Y.slice(1)) {
      const taller = build(input, GRAPH_SCALES[GRAPH_SCALES.length - 1], W, extra);
      if (!edgeThroughNode(taller)) return taller;
    }
  }
  return last!;
}

// ---------- Вспомогательное для компонента и тестов ----------

/** Число пар рёбер, пересекающихся внутри (без общих концов) — у дерева должно быть 0. */
export function countCrossings(layout: GraphLayout): number {
  const ccw = (a: [number, number], b: [number, number], c: [number, number]) => (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
  let n = 0;
  for (let i = 0; i < layout.edges.length; i++)
    for (let j = i + 1; j < layout.edges.length; j++) {
      const a = layout.edges[i];
      const b = layout.edges[j];
      if (a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to) continue;
      if (ccw(a.p0, b.p0, b.p1) !== ccw(a.p1, b.p0, b.p1) && ccw(a.p0, a.p1, b.p0) !== ccw(a.p0, a.p1, b.p1)) n++;
    }
  return n;
}

/** Классы цвета по тону: static-строки, чтобы Tailwind их увидел. */
export const NODE_TONE: Record<SceneTone | "none", string> = {
  none: "fill-surface stroke-muted",
  primary: "fill-primary-soft stroke-primary",
  success: "fill-success-soft stroke-success",
  danger: "fill-danger-soft stroke-danger",
  warning: "fill-warning-soft stroke-warning",
  ai: "fill-ai-soft stroke-ai",
  gold: "fill-gold-soft stroke-gold",
  muted: "fill-surface-2 stroke-muted",
};
export const NODE_TEXT: Record<SceneTone | "none", string> = {
  none: "fill-text",
  primary: "fill-primary-strong",
  success: "fill-success-strong",
  danger: "fill-danger-strong",
  warning: "fill-warning-strong",
  ai: "fill-ai-strong",
  gold: "fill-warning-strong",
  muted: "fill-text",
};
export const EDGE_STROKE: Record<SceneTone | "none", string> = {
  none: "stroke-muted",
  primary: "stroke-primary",
  success: "stroke-success",
  danger: "stroke-danger",
  warning: "stroke-warning",
  ai: "stroke-ai",
  gold: "stroke-gold",
  muted: "stroke-muted",
};
export const EDGE_FILL: Record<SceneTone | "none", string> = {
  none: "fill-muted",
  primary: "fill-primary",
  success: "fill-success",
  danger: "fill-danger",
  warning: "fill-warning",
  ai: "fill-ai",
  gold: "fill-gold",
  muted: "fill-muted",
};
export const PILL_TEXT: Record<SceneTone | "none", string> = {
  none: "fill-text",
  primary: "fill-primary-strong",
  success: "fill-success-strong",
  danger: "fill-danger-strong",
  warning: "fill-warning-strong",
  ai: "fill-ai-strong",
  gold: "fill-warning-strong",
  muted: "fill-text",
};

type Translate = (key: DictKey, params?: Record<string, string | number>) => string;

/** Краткий пересказ рисунка для скринридера: вершины, рёбра (с весами), путь, выделенное, степени. */
export function graphAria(input: GraphInput, t: Translate): string {
  const name = new Map(input.nodes.map((v) => [v.id, v.label.replace(/\s*\n\s*/g, " ").trim() || v.id]));
  const nm = (id: string) => name.get(id) ?? id;
  const arrow = input.directed ? "→" : "—";
  const edges = input.edges.map((e) => `${nm(e.from)} ${arrow} ${nm(e.to)}${e.weight ? ` (${e.weight})` : ""}`).join(", ") || "—";
  const nodes = input.nodes.map((v) => nm(v.id)).join(", ");
  const parts: string[] =
    input.layout === "tree" && input.root && name.has(input.root)
      ? [t("scene.graph.ariaTree", { root: nm(input.root), nodes, edges })]
      : [t("scene.graph.aria", { nodes, edges })];
  if (input.path.length) parts.push(t("scene.graph.ariaPath", { path: input.path.map(nm).join(" → ") }));
  if (input.highlight.length) parts.push(t("scene.graph.ariaHighlight", { list: input.highlight.map(nm).join(", ") }));
  if (input.degrees) {
    const deg = graphDegrees(input);
    parts.push(t("scene.graph.ariaDegrees", { list: input.nodes.map((v) => `${nm(v.id)} — ${deg.get(v.id) ?? 0}`).join(", ") }));
  }
  return parts.join(" ");
}
