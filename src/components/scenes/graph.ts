// Раскладка сцены graph (граф, дерево): размеры вершин, координаты по четырём режимам (free, tree, circle, chain),
// подрезка рёбер по краю вершины, наконечники стрелок, место подписи веса, место степени. Чистая логика без React.
//
// Система координат — «логический экран» шириной GRAPH_W (320): на телефоне 360 px он растягивается почти 1:1,
// на широком экране ограничен max-w компонента. Если содержимое не влезает, layoutGraph перебирает коэффициенты размера
// (GRAPH_SCALES) и варианты: узкие подписи, у дерева — листья в два яруса или дерево слева направо, у круга — эллипс.
// Область шире 320 (картинка сжимается, текст мельчает) — только если ничего не помогло.

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

/** Подпись веса. anchor — точка на ребре, если подпись пришлось сдвинуть в сторону (тонкая выноска от подписи к ребру). */
export type GPill = { x: number; y: number; w: number; h: number; text: string; fontPx: number; anchor?: [number, number] };

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
  /** Вся линия ребра ломаной (кривая — выборкой точек): для проверок и тестов. */
  poly: [number, number][];
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
  /** Вершины не налезают, подписи весов не на вершинах, рёбра не задевают чужие вершины, всё влезло в GRAPH_W. */
  fits: boolean;
};

type Pos = { x: number; y: number };
type Box = { cx: number; cy: number; w: number; h: number; shape: "circle" | "rect"; r: number };

// ---------- Размеры вершин ----------

/** Предел ширины вершины-прямоугольника: обычный и «узкий» (подписи переносятся плотнее, когда ширины не хватает). */
const MAX_NODE_W = 112;
const NARROW_NODE_W = 64;

function baseSize(n: number): { r: number; font: number } {
  if (n <= 7) return { r: 17, font: 14 };
  if (n <= 12) return { r: 15, font: 13 };
  return { r: 13, font: 12 };
}

/** Куски строки для переноса: слова (между ними пробел) и части длинного слова после «.», «_», «/», «\\» (без пробела). */
function atoms(line: string): { text: string; space: boolean }[] {
  const out: { text: string; space: boolean }[] = [];
  for (const word of line.split(/\s+/).filter(Boolean)) {
    const parts = word.match(/[^._/\\]*[._/\\]+|[^._/\\]+/g) ?? [word];
    parts.forEach((p, i) => out.push({ text: p, space: i === 0 }));
  }
  return out;
}

/** Разбить строку по пробелам (и после «.», «_», «/») так, чтобы каждая часть влезала в maxW; кусок длиннее maxW остаётся целым. */
export function wrapWords(line: string, font: number, maxW: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const a of atoms(line)) {
    const next = cur ? (a.space ? `${cur} ${a.text}` : `${cur}${a.text}`) : a.text;
    if (cur && estimateTextWidth(next, font) > maxW) {
      out.push(cur);
      cur = a.text;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Строки подписи: явные переносы, перенос по пробелам для слишком длинных, не больше 3 строк.
 * Строк больше трёх или кусок не влезает — кегль уменьшается до 10; всё ещё много строк — ширина растёт (остаток не склеивается).
 */
export function fitLines(text: string, font: number, maxW: number): { lines: string[]; font: number } {
  const raw = text.split("\n").map((s) => s.trim()).filter(Boolean);
  const src = raw.length ? raw : [text.trim() || " "];
  const wrapAll = (f: number, w: number) => src.flatMap((line) => (estimateTextWidth(line, f) > w ? wrapWords(line, f, w) : [line]));
  const widest = (ls: string[], f: number) => Math.max(...ls.map((s) => estimateTextWidth(s, f)));
  let f = font;
  let w = maxW;
  let lines = wrapAll(f, w);
  while (f > 10 && (widest(lines, f) > w || (lines.length > 3 && lines.length > src.length))) {
    f -= 0.5;
    lines = wrapAll(f, w);
  }
  for (let i = 0; i < 40 && lines.length > 3 && lines.length > src.length; i++) {
    w += 8;
    lines = wrapAll(f, w);
  }
  return { lines, font: f };
}

type Sized = Box & { lines: string[]; fontPx: number; lineH: number };

function sizeNode(label: string, n: number, k: number, maxNodeW: number): Sized {
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
  const fit = fitLines(label, font, maxNodeW - 18);
  const lineH = fit.font * 1.15;
  const tw = Math.max(...fit.lines.map((s) => estimateTextWidth(s, fit.font)));
  // ширина по тексту: если подпись не влезла в предел (одно длинное слово), вершина шире предела
  const w = Math.max(2 * R, tw + 18);
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

/** Задевает ли прямоугольник вершину (для круглой — по расстоянию до центра, а не по квадрату вокруг неё). */
function rectHitsBox(r: Rect, n: Box, pad = 2): boolean {
  if (n.shape === "circle") {
    const nx = Math.max(r.x0, Math.min(n.cx, r.x1));
    const ny = Math.max(r.y0, Math.min(n.cy, r.y1));
    return Math.hypot(n.cx - nx, n.cy - ny) < n.r + pad;
  }
  return rectsOverlap(r, boxRect(n, pad));
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

/** Ломаная вдоль ребра: отрезок или выборка кривой Безье (steps звеньев). */
function samplePoly(p0: Pos, p1: Pos, c: Pos | undefined, steps = 16): Pos[] {
  if (!c) return [p0, p1];
  return Array.from({ length: steps + 1 }, (_, i) => quadAt(p0, c, p1, i / steps));
}

/** Точка на ломаной на доле t её длины. */
function pointAlong(poly: Pos[], t: number): Pos {
  const lens = poly.slice(1).map((p, i) => Math.hypot(p.x - poly[i].x, p.y - poly[i].y));
  let want = lens.reduce((a, b) => a + b, 0) * t;
  for (let i = 0; i < lens.length; i++) {
    if (want <= lens[i] || i === lens.length - 1) {
      const u = lens[i] ? Math.min(1, want / lens[i]) : 0;
      return { x: poly[i].x + (poly[i + 1].x - poly[i].x) * u, y: poly[i].y + (poly[i + 1].y - poly[i].y) * u };
    }
    want -= lens[i];
  }
  return poly[0];
}

/** Расстояние от точки до отрезка. */
function segDist(a: Pos, b: Pos, p: Pos): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
}

/** Запас между ребром и чужой вершиной: половина толщины линии (1) + обводка вершины (1). */
const EDGE_CLEAR = 2;

/** Идёт ли ломаная ребра вплотную к вершине (касается обводки или проходит сквозь неё). */
function polyHitsNode(poly: Pos[], n: Box): boolean {
  for (let i = 0; i + 1 < poly.length; i++) {
    if (n.shape === "circle") {
      if (segDist(poly[i], poly[i + 1], { x: n.cx, y: n.cy }) < n.r + EDGE_CLEAR) return true;
    } else if (segmentHitsRect(poly[i], poly[i + 1], boxRect(n, EDGE_CLEAR))) return true;
  }
  return false;
}

// ---------- Раскладки: координаты центров ----------

/** Варианты раскладки, которые layoutGraph пробует, когда обычная не влезает. */
type Opts = {
  /** Добавка к расстоянию между уровнями дерева (рёбра не должны идти сквозь чужие вершины). */
  extraY: number;
  /** Подписи переносятся плотнее (вершина уже). */
  narrow: boolean;
  /** Дерево: нижний ряд листьев — в два яруса в шахматном порядке, рёбра к ним с изломом. */
  stagger: boolean;
  /** Дерево слева направо: корень слева, листья столбцом (высота не ограничена). */
  horizontal: boolean;
  /** Круг: вытянутый по вертикали эллипс, когда на круге не хватает длины контура. */
  ellipse: boolean;
};
const PLAIN: Opts = { extraY: 0, narrow: false, stagger: false, horizontal: false, ellipse: false };

type Built = { pos: Map<string, Pos>; bulge: Map<number, number>; via: Map<number, Pos[]> };

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
  return { pos, bulge: new Map(), via: new Map() };
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
  return Math.max(10, 11 * k);
}

/**
 * tree: уровни сверху вниз; ширина поддерева = сумма детей (или свой размер), родитель — над серединой детей. Пересечений нет.
 * Подписи весов у дерева стоят ближе к ребёнку (доля 0.66 длины), поэтому у соседних листьев они разведены и место под них — 1/0.7 ширины подписи.
 * horizontal: те же правила, но уровни идут слева направо, а «ширина» поддерева — высота.
 * stagger: листья нижнего уровня чередуются по высоте (два яруса), рёбра к ним идут с изломом по общей «шине» — падают в зазор между верхними листьями.
 */
function buildTree(input: GraphInput, sized: Map<string, Sized>, k: number, o: Opts): Built {
  const { roots, children, depth } = treeChildren(input);
  const hasWeights = input.edges.some((e) => e.weight);
  const horiz = o.horizontal;
  const pw = maxPillWidth(input, k);
  const ph = pillFont(k) + 7;
  const maxD = Math.max(...depth.values());
  const stagger = o.stagger && !horiz && maxD >= 1;
  // шахматный порядок — для листьев того уровня, где их больше всего (при равенстве — нижнего)
  const leafCount = Array.from({ length: maxD + 1 }, () => 0);
  for (const [id, d] of depth) if (!children.get(id)!.length) leafCount[d]++;
  let stagD = 0;
  leafCount.forEach((c, d) => {
    if (c >= leafCount[stagD]) stagD = d;
  });
  const isBottom = (u: string) => stagger && depth.get(u) === stagD && !children.get(u)!.length;
  const gapAlong = 8 * k;
  const pillSpan = hasWeights ? ((horiz ? ph : pw) + 2) / 0.7 : 0;
  // у листьев шахматного уровня одинаковый шаг (по самой широкой подписи): листья одного яруса стоят через один и не налезают
  const bottomW = Math.max(0, ...[...sized.entries()].filter(([id]) => isBottom(id)).map(([, s]) => s.w));
  const ownOf = (u: string) => {
    const s = sized.get(u)!;
    const along = horiz ? s.h : s.w;
    return isBottom(u) ? Math.max((bottomW + gapAlong) / 2, pillSpan / 2) : Math.max(along + gapAlong, pillSpan);
  };

  const span = new Map<string, number>();
  const measure = (u: string): number => {
    const kids = children.get(u)!;
    const sum = kids.reduce((a, c) => a + measure(c), 0);
    const sp = Math.max(ownOf(u), sum);
    span.set(u, sp);
    return sp;
  };
  for (const r of roots) measure(r);

  const along = new Map<string, number>();
  const bottomOrder: string[] = [];
  const place = (u: string, left: number) => {
    const kids = children.get(u)!;
    if (!kids.length) {
      along.set(u, left + span.get(u)! / 2);
      if (isBottom(u)) bottomOrder.push(u);
      return;
    }
    const sum = kids.reduce((a, c) => a + span.get(c)!, 0);
    let x = left + (span.get(u)! - sum) / 2;
    for (const c of kids) {
      place(c, x);
      x += span.get(c)!;
    }
    along.set(u, (along.get(kids[0])! + along.get(kids[kids.length - 1])!) / 2);
  };
  let left = 0;
  for (const r of roots) {
    place(r, left);
    left += span.get(r)!;
  }

  // уровни: размер по оси уровней — по самой крупной вершине уровня
  const levelHalf = Array.from({ length: maxD + 1 }, () => 0);
  for (const [id, d] of depth) levelHalf[d] = Math.max(levelHalf[d], (horiz ? sized.get(id)!.w : sized.get(id)!.h) / 2);
  const gapLevel = horiz
    ? hasWeights
      ? Math.max(32, pw + 18)
      : 34
    : (hasWeights ? 36 : 26) * Math.max(k, 0.85) + (input.degrees ? 4 : 0) + o.extraY;
  const lv: number[] = [];
  let y = levelHalf[0];
  for (let d = 0; d <= maxD; d++) {
    lv.push(y);
    if (d < maxD) y += levelHalf[d] + gapLevel + levelHalf[d + 1];
  }
  const stagDy = stagger ? 2 * levelHalf[stagD] + 6 : 0;
  const lower = new Set(bottomOrder.filter((_, i) => i % 2 === 1));
  const pos = new Map<string, Pos>();
  for (const [id, d] of depth) {
    const a = along.get(id)!;
    pos.set(id, horiz ? { x: lv[d], y: a } : { x: a, y: lv[d] + (lower.has(id) ? stagDy : 0) });
  }

  // «шина»: при stagger — для рёбер к листьям шахматного уровня, при horizontal — для всех рёбер (как в файловом дереве)
  const via = new Map<number, Pos[]>();
  if (stagger || horiz) {
    input.edges.forEach((e, i) => {
      const a = depth.get(e.from);
      const b = depth.get(e.to);
      if (a === undefined || b === undefined || a === b) return;
      const [par, kid] = a < b ? [e.from, e.to] : [e.to, e.from];
      if (!horiz && !isBottom(kid)) return;
      const pp = pos.get(par)!;
      const kp = pos.get(kid)!;
      let pts: Pos[];
      if (horiz) {
        if (Math.abs(pp.y - kp.y) < 1) return;
        const busX = pp.x + levelHalf[depth.get(par)!] + gapLevel / 2;
        pts = [{ x: busX, y: pp.y }, { x: busX, y: kp.y }];
      } else {
        if (Math.abs(pp.x - kp.x) < 1) return;
        const busY = pp.y + sized.get(par)!.h / 2 + gapLevel / 2;
        pts = [{ x: pp.x, y: busY }, { x: kp.x, y: busY }];
      }
      via.set(i, par === e.from ? pts : pts.reverse());
    });
  }
  return { pos, bulge: new Map(), via };
}

/** circle: по кругу по часовой стрелке, первая — сверху (при двух вершинах — слева направо). Эллипс — вытянутый по вертикали, вершины через равные длины дуги. */
function buildCircle(input: GraphInput, sized: Map<string, Sized>, W: number, o: Opts): Built {
  const n = input.nodes.length;
  const all = [...sized.values()];
  const hw = Math.max(...all.map((s) => s.w / 2));
  const room = input.degrees ? 8 : 0;
  const maxR = n <= 3 ? 70 : n <= 5 ? 92 : 120;
  const fullR = W / 2 - hw - GRAPH_MARGIN - room;
  const pos = new Map<string, Pos>();
  if (o.ellipse && n > 2) {
    const Rx = Math.max(30, fullR);
    const ring = (Ry: number): Pos[] => {
      // равномерно по длине дуги, начиная сверху
      const N = 720;
      const pts = Array.from({ length: N + 1 }, (_, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / N;
        return { x: Rx * Math.cos(a), y: Ry * Math.sin(a) };
      });
      const cum = [0];
      for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      const out: Pos[] = [];
      let j = 0;
      for (let i = 0; i < n; i++) {
        const want = (cum[N] * i) / n;
        while (j < N && cum[j + 1] < want) j++;
        out.push(pts[j]);
      }
      return out;
    };
    const free = (ps: Pos[]) =>
      ps.every((p, i) => ps.every((q, j) => j <= i || !boxesOverlap({ ...all[i], cx: p.x, cy: p.y }, { ...all[j], cx: q.x, cy: q.y }, 3)));
    let best = ring(Rx);
    for (let Ry = Rx; Ry <= 250; Ry += 6) {
      best = ring(Ry);
      if (free(best)) break;
    }
    input.nodes.forEach((v, i) => pos.set(v.id, best[i]));
    return { pos, bulge: new Map(), via: new Map() };
  }
  const R = Math.max(30, Math.min(maxR, fullR));
  const start = n === 2 ? Math.PI : -Math.PI / 2;
  input.nodes.forEach((v, i) => {
    const a = start + (2 * Math.PI * i) / n;
    pos.set(v.id, { x: R * Math.cos(a) * (n === 2 ? 1.1 : 1), y: R * Math.sin(a) });
  });
  return { pos, bulge: new Map(), via: new Map() };
}

/** Геометрия одного ребра: концы на краях вершин, изгиб (bulge) или маршрут через опорные точки (via). */
function edgeGeom(A: Box, B: Box, bulge: number, via: Pos[] | undefined, gap: number): { p0: Pos; p1: Pos; c?: Pos; poly: Pos[] } {
  if (via && via.length) {
    const p0 = borderPoint(A, via[0].x, via[0].y);
    const last = via[via.length - 1];
    const p1 = borderPoint(B, last.x, last.y, gap);
    return { p0, p1, poly: [p0, ...via, p1] };
  }
  const dx = B.cx - A.cx;
  const dy = B.cy - A.cy;
  const len = Math.hypot(dx, dy) || 1;
  const c: Pos | undefined = bulge ? { x: (A.cx + B.cx) / 2 + (dy / len) * 2 * bulge, y: (A.cy + B.cy) / 2 - (dx / len) * 2 * bulge } : undefined;
  const p0 = borderPoint(A, c ? c.x : B.cx, c ? c.y : B.cy);
  const p1 = borderPoint(B, c ? c.x : A.cx, c ? c.y : A.cy, gap);
  return { p0, p1, c, poly: samplePoly(p0, p1, c) };
}

/**
 * chain: в линию слева направо; не влезает — змейкой (чётные ряды слева направо, нечётные справа налево), ряды выровнены по сетке.
 * Ребро между несоседними вершинами обходит чужие: прямая, дуга (в обе стороны), иначе ломаная по просветам между рядами
 * и по полю слева или справа от змейки. Выбирается первый вариант, не задевающий чужие вершины.
 */
function buildChain(input: GraphInput, sized: Map<string, Sized>, W: number, k: number): Built {
  const n = input.nodes.length;
  const all = [...sized.values()];
  const maxW = Math.max(...all.map((s) => s.w));
  const maxH = Math.max(...all.map((s) => s.h));
  const hasWeights = input.edges.some((e) => e.weight);
  const minGap = Math.max(input.directed ? 22 : 14, hasWeights ? maxPillWidth(input, k) + 8 + (input.directed ? 12 : 0) : 0);
  const idx = new Map(input.nodes.map((v, i) => [v.id, i]));
  const gapOf = (e: GraphInput["edges"][number]) => Math.abs(idx.get(e.from)! - idx.get(e.to)!);
  const hasArcs = input.edges.some((e) => gapOf(e) > 1);
  const split = (reserve: number) => {
    const avail = W - 2 * GRAPH_MARGIN - 2 * reserve;
    const perRowMax = Math.max(1, Math.floor(avail / (maxW + minGap)));
    const rows = Math.ceil(n / perRowMax);
    return { avail, rows, perRow: Math.ceil(n / rows) };
  };
  // в несколько рядов с дугами — слева и справа оставляем поле для обхода змейки
  let g = split(0);
  const reserve = g.rows > 1 && hasArcs ? 16 : 0;
  if (reserve) g = split(reserve);
  const { avail, rows, perRow } = g;
  const cell = Math.min(avail / perRow, maxW + 60);
  const rowGap = 34 + (hasArcs ? 22 : 0) + (hasWeights ? 6 : 0);
  const rowStep = maxH + rowGap;
  const rowOf = (i: number) => Math.floor(i / perRow);
  const pos = new Map<string, Pos>();
  input.nodes.forEach((v, i) => {
    const row = rowOf(i);
    const colIn = i % perRow;
    const col = row % 2 === 0 ? colIn : perRow - 1 - colIn;
    // неполный ряд: сетка та же, ряд просто короче (змейка идёт от края, где закончился предыдущий)
    pos.set(v.id, { x: reserve + cell * (col + 0.5), y: maxH / 2 + row * rowStep });
    const s = sized.get(v.id)!;
    s.cx = pos.get(v.id)!.x;
    s.cy = pos.get(v.id)!.y;
  });

  const bulge = new Map<number, number>();
  const via = new Map<number, Pos[]>();
  const gapPx = input.directed ? 1.5 : 0;
  const minX = Math.min(...all.map((s) => s.cx - s.w / 2));
  const maxX = Math.max(...all.map((s) => s.cx + s.w / 2));
  // поле, в которое можно выходить рёбрам, не растягивая область
  const slack = (W - 2 * GRAPH_MARGIN - (maxX - minX)) / 2 - 3;
  const lanes = new Map<number, number>();
  /** Линия просвета между рядами b-1 и b (b = 0 — над первым рядом, b = rows — под последним). */
  const lineY = (b: number): number => {
    const lane = lanes.get(b) ?? 0;
    const off = lane * 5;
    if (b <= 0) return -12 - off;
    if (b >= rows) return maxH / 2 + (rows - 1) * rowStep + maxH / 2 + 12 + off;
    return maxH / 2 + (b - 1) * rowStep + maxH / 2 + rowGap / 2 + (lane % 2 ? off : -off) / 2;
  };
  input.edges.forEach((e, ei) => {
    const gap = gapOf(e);
    if (gap <= 1) return;
    const A = sized.get(e.from)!;
    const B = sized.get(e.to)!;
    const others = all.filter((s) => s !== A && s !== B);
    const ok = (poly: Pos[]) =>
      poly.every((p) => p.x >= minX - slack && p.x <= maxX + slack) && !others.some((s) => polyHitsNode(poly, s));
    const tryCurve = (b: number): boolean => (ok(edgeGeom(A, B, b, undefined, gapPx).poly) ? (bulge.set(ei, b), true) : false);
    const rs = rowOf(idx.get(e.from)!);
    const rt = rowOf(idx.get(e.to)!);
    // 1) прямая (соседние ряды, один столбец) 2) дуги
    if (rs !== rt && tryCurve(0)) return;
    const bulges = [18 + 8 * (gap - 2), 26, 34, 42, 52, 64].map((b) => Math.min(b, 64));
    const sorted = [...new Set([Math.min(18 + 8 * (gap - 2), 40), ...bulges])];
    for (const b of sorted) if (tryCurve(b)) return;
    for (const b of sorted) if (tryCurve(-b)) return;
    // 3) ломаная: из вершины в просвет между рядами, по просвету, при необходимости по боковому полю, в цель
    const routes: Pos[][] = [];
    const dedupe = (pts: Pos[]) => pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 0.5);
    if (rs === rt) {
      for (const b of [rs, rs + 1]) {
        const y = lineY(b);
        routes.push([{ x: A.cx, y }, { x: B.cx, y }]);
      }
    } else {
      const dir = rt > rs ? 1 : -1;
      const be = dir > 0 ? rs + 1 : rs;
      const bt = dir > 0 ? rt : rt + 1;
      const ye = lineY(be);
      const yt = lineY(bt);
      // выход из вершины чуть в сторону движения: иначе линия ляжет на ребро цепочки, которое подходит к вершине сверху или снизу
      const exit = (toward: number): Pos[] => {
        const d = Math.min(9, A.w / 4) * (toward >= A.cx ? 1 : -1);
        const dy = A.shape === "circle" ? Math.sqrt(Math.max(0, A.r * A.r - d * d)) : A.h / 2;
        return [{ x: A.cx + d, y: A.cy + dir * dy }];
      };
      if (be === bt) routes.push(dedupe([...exit(B.cx), { x: A.cx + (B.cx >= A.cx ? 1 : -1) * Math.min(9, A.w / 4), y: ye }, { x: B.cx, y: yt }]));
      else {
        const sides = [minX - 8, maxX + 8];
        sides.sort((p, q) => Math.abs(A.cx - p) + Math.abs(B.cx - p) - (Math.abs(A.cx - q) + Math.abs(B.cx - q)));
        for (const xo of sides) {
          const ex = exit(xo)[0];
          routes.push(dedupe([ex, { x: ex.x, y: ye }, { x: xo, y: ye }, { x: xo, y: yt }, { x: B.cx, y: yt }]));
        }
      }
    }
    for (const r of routes) {
      if (ok(edgeGeom(A, B, 0, r, gapPx).poly)) {
        via.set(ei, r);
        for (const b of [rs === rt ? rs : (rt > rs ? rs + 1 : rs), rs === rt ? rs : (rt > rs ? rt : rt + 1)]) lanes.set(b, (lanes.get(b) ?? 0) + 1);
        return;
      }
    }
    bulge.set(ei, Math.min(18 + 8 * (gap - 2), 40));
  });
  return { pos, bulge, via };
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

/** Раскладка с диагностикой: чем она плоха (наложения вершин, выход за ширину, подписи на вершинах, рёбра сквозь вершины). */
type Cand = { lay: GraphLayout; overlaps: number; widthEx: number; pillBad: number; hits: number };

function build(input: GraphInput, k: number, W: number, opt: Opts): Cand {
  const n = input.nodes.length;
  const maxNodeW = opt.narrow ? NARROW_NODE_W : MAX_NODE_W;
  const sized = new Map<string, Sized>(input.nodes.map((v) => [v.id, sizeNode(v.label, n, k, maxNodeW)]));
  const built =
    input.layout === "tree"
      ? buildTree(input, sized, k, opt)
      : input.layout === "circle"
        ? buildCircle(input, sized, W, opt)
        : input.layout === "chain"
          ? buildChain(input, sized, W, k)
          : buildFree(input, sized, W);
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

  // ---- рёбра: концы на краях вершин, изгиб или маршрут ----
  const pairs = new Set(input.edges.map((e) => `${e.from}>${e.to}`));
  type Raw = { e: GraphInput["edges"][number]; i: number; p0: Pos; p1: Pos; c?: Pos; via?: Pos[]; poly: Pos[]; onPath: boolean };
  const raws: Raw[] = input.edges.map((e, i) => {
    const A = byId.get(e.from)!;
    const B = byId.get(e.to)!;
    const via = built.via.get(i);
    let bulge = built.bulge.get(i) ?? 0;
    if (!bulge && !via && input.directed && pairs.has(`${e.to}>${e.from}`)) bulge = 11;
    const g = edgeGeom(A, B, bulge, via, input.directed ? 1.5 : 0);
    return { e, i, ...g, via, onPath: pathEdges.has(edgeKey(input.directed, e.from, e.to)) };
  });

  // ---- стрелки ----
  const arrowOf = (r: Raw): { arrow: number[]; end: Pos } | null => {
    if (!input.directed) return null;
    const L = r.onPath ? 11 : 9;
    const half = r.onPath ? 5.5 : 4.5;
    const from = r.via ? r.via[r.via.length - 1] : (r.c ?? r.p0);
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

  // ---- подписи весов: подбор места вдоль ребра, при нехватке места — рядом с ребром (со сдвигом по нормали и выноской) ----
  const boxes = [...byId.values()];
  const placed: Rect[] = [];
  const pills = new Map<number, GPill>();
  const T = input.layout === "tree" ? [0.66, 0.58, 0.74, 0.5, 0.42, 0.34, 0.26] : [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74];
  const centroid = { x: boxes.reduce((a, s) => a + s.cx, 0) / boxes.length, y: boxes.reduce((a, s) => a + s.cy, 0) / boxes.length };
  let pillBad = 0;
  for (const r of raws) {
    if (!r.e.weight) continue;
    const w = estimateTextWidth(r.e.weight, pf) + 10;
    const h = pf + 7;
    const scoreAt = (pos: Pos): number => {
      const rect: Rect = { x0: pos.x - w / 2, y0: pos.y - h / 2, x1: pos.x + w / 2, y1: pos.y + h / 2 };
      let score = 0;
      for (const nb of boxes) if (rectHitsBox(rect, nb)) score += 100;
      for (const pr of placed) if (rectsOverlap(rect, pr)) score += 80;
      const grown = { x0: rect.x0 - 1, y0: rect.y0 - 1, x1: rect.x1 + 1, y1: rect.y1 + 1 };
      for (const other of raws) {
        if (other === r) continue;
        for (let q = 0; q + 1 < other.poly.length; q++)
          if (segmentHitsRect(other.poly[q], other.poly[q + 1], grown)) {
            score += 20;
            break;
          }
      }
      return score;
    };
    let best: { pos: Pos; anchor?: Pos; score: number } | null = null;
    for (const t of T) {
      const pos = pointAlong(r.poly, t);
      const score = scoreAt(pos) + Math.abs(t - T[0]) * 10;
      if (!best || score < best.score) best = { pos, score };
    }
    if (best!.score >= 80) {
      // на самом ребре места нет (короткое ребро, подпись длиннее видимой части): сдвигаем в сторону, чаще наружу от центра графа
      for (const t of T) {
        const base = pointAlong(r.poly, t);
        const a = pointAlong(r.poly, Math.max(0, t - 0.03));
        const b = pointAlong(r.poly, Math.min(1, t + 0.03));
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const nx = -(b.y - a.y) / len;
        const ny = (b.x - a.x) / len;
        for (const off of [12, 18, 24, 30, 38]) {
          for (const sign of [1, -1]) {
            const pos = { x: base.x + nx * off * sign, y: base.y + ny * off * sign };
            const inward = (centroid.x - base.x) * nx * sign + (centroid.y - base.y) * ny * sign > 0;
            const score = scoreAt(pos) + Math.abs(t - T[0]) * 10 + off * 0.4 + (inward ? 4 : 0);
            if (score < best!.score) best = { pos, anchor: base, score };
          }
        }
      }
    }
    const pos = best!.pos;
    if (best!.score >= 80) pillBad++;
    placed.push({ x0: pos.x - w / 2, y0: pos.y - h / 2, x1: pos.x + w / 2, y1: pos.y + h / 2 });
    pills.set(r.i, { x: pos.x, y: pos.y, w, h, text: r.e.weight, fontPx: pf, anchor: best!.anchor ? [best!.anchor.x, best!.anchor.y] : undefined });
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
        const atFrom = r.e.from === v.id;
        const other = atFrom ? byId.get(r.e.to)! : byId.get(r.e.from)!;
        const aim = r.via ? (atFrom ? r.via[0] : r.via[r.via.length - 1]) : r.c ? r.c : { x: other.cx, y: other.cy };
        incident.push(Math.atan2(aim.y - s.cy, aim.x - s.cx));
      }
      let best: { pos: Pos; score: number } | null = null;
      cand.forEach((a, ci) => {
        const edge = borderPoint(s, s.cx + Math.cos(a), s.cy + Math.sin(a));
        const pos = { x: edge.x + Math.cos(a) * 5, y: edge.y + Math.sin(a) * 5 };
        const rect: Rect = { x0: pos.x - br, y0: pos.y - br, x1: pos.x + br, y1: pos.y + br };
        let score = incident.length ? Math.min(...incident.map((b) => angleDiff(a, b))) * 10 : 10;
        score -= ci * 0.05;
        for (const o of input.nodes) if (o.id !== v.id && rectHitsBox(rect, byId.get(o.id)!, 1)) score -= 100;
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
  for (const s of byId.values()) grow(s.cx - s.w / 2 - 1.5, s.cy - s.h / 2 - 1.5, s.cx + s.w / 2 + 1.5, s.cy + s.h / 2 + 1.5);
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
    const mid = r.via ? r.via.map((p) => `L${px(p).join(" ")}`).join("") : "";
    const d = r.c ? `M${x0} ${y0}Q${px(r.c).join(" ")} ${x1} ${y1}` : `M${x0} ${y0}${mid}L${x1} ${y1}`;
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
      poly: r.poly.map(px),
      pill: pill ? { ...pill, x: f(pill.x + dx), y: f(pill.y + dy), w: f(pill.w), h: f(pill.h), anchor: pill.anchor ? px({ x: pill.anchor[0], y: pill.anchor[1] }) : undefined } : undefined,
    };
  });
  const outBadges = badges.map((b) => ({ ...b, x: f(b.x + dx), y: f(b.y + dy) }));

  // ---- чем плоха: наложения вершин, выход за ширину, подписи весов на вершинах, рёбра сквозь вершины ----
  const list = [...byId.values()];
  let overlaps = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (boxesOverlap(list[i], list[j], 2)) overlaps++;
  const lay: GraphLayout = { width, height, nodes, edges, badges: outBadges, scale: k, fits: false };
  const widthEx = Math.max(0, width - W);
  const hits = countEdgeHits(lay);
  lay.fits = overlaps === 0 && widthEx === 0 && pillBad === 0 && hits === 0;
  return { lay, overlaps, widthEx, pillBad, hits };
}

/** Сколько рёбер идёт вплотную к чужой вершине или сквозь неё (проверяется вся линия: дуга или ломаная, а не хорда). */
export function countEdgeHits(layout: GraphLayout): number {
  let n = 0;
  for (const e of layout.edges) {
    const poly = e.poly.map(([x, y]) => ({ x, y }));
    if (layout.nodes.some((v) => v.id !== e.from && v.id !== e.to && polyHitsNode(poly, { cx: v.cx, cy: v.cy, w: v.w, h: v.h, shape: v.shape, r: v.r }))) n++;
  }
  return n;
}

/** Проходит ли ребро (не по своим концам) сквозь чужую вершину или вплотную к ней. */
export function edgeThroughNode(layout: GraphLayout): boolean {
  return countEdgeHits(layout) > 0;
}

/** Добавки к расстоянию между уровнями дерева: у «ёжика» рёбра к дальним листьям иначе идут сквозь соседние листья. */
const TREE_EXTRA_Y = [0, 10, 22, 36, 52, 70];

/** Варианты, которые пробуем при каждом коэффициенте размера, от самого «чистого» к самому «грубому». */
function variantsFor(layout: GraphLayoutKind): Opts[] {
  const narrow = { ...PLAIN, narrow: true };
  if (layout === "tree") return [PLAIN, narrow, { ...narrow, stagger: true }, { ...narrow, horizontal: true }];
  if (layout === "circle") return [PLAIN, narrow, { ...narrow, ellipse: true }];
  if (layout === "free" || layout === "chain") return [PLAIN, narrow];
  return [PLAIN];
}

/**
 * Раскладка графа. Для каждого коэффициента размера (от крупного к мелкому) пробует варианты: обычный, с узкими подписями,
 * у дерева — листья в два яруса и дерево слева направо, у круга — эллипс; у дерева ещё раздвигает уровни, пока рёбра не перестанут
 * идти сквозь чужие вершины. Берёт первую раскладку без наложений вершин и подписей, с рёбрами мимо вершин и в пределах GRAPH_W.
 * Если такой нет — наименее плохую.
 */
export function layoutGraph(input: GraphInput, W: number = GRAPH_W): GraphLayout {
  let best: { lay: GraphLayout; rank: number } | null = null;
  for (const k of GRAPH_SCALES) {
    for (const v of variantsFor(input.layout)) {
      for (const extra of input.layout === "tree" && !v.horizontal ? TREE_EXTRA_Y : [0]) {
        const c = build(input, k, W, { ...v, extraY: extra });
        if (c.lay.fits) return c.lay;
        const rank = c.overlaps * 1000 + c.widthEx * 3 + c.pillBad * 100 + c.hits * 30 + (1 - k) * 5;
        if (!best || rank < best.rank) best = { lay: c.lay, rank };
        // раздвижка уровней помогает только против рёбер сквозь вершины
        if (c.overlaps || c.widthEx || c.pillBad) break;
      }
    }
  }
  return best!.lay;
}

// ---------- Вспомогательное для компонента и тестов ----------

/** Число пар рёбер, пересекающихся внутри (без общих концов; ломаные и дуги — по всем звеньям) — у дерева должно быть 0. */
export function countCrossings(layout: GraphLayout): number {
  const ccw = (a: [number, number], b: [number, number], c: [number, number]) => (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
  const cross = (a0: [number, number], a1: [number, number], b0: [number, number], b1: [number, number]) =>
    ccw(a0, b0, b1) !== ccw(a1, b0, b1) && ccw(a0, a1, b0) !== ccw(a0, a1, b1);
  let n = 0;
  for (let i = 0; i < layout.edges.length; i++)
    for (let j = i + 1; j < layout.edges.length; j++) {
      const a = layout.edges[i];
      const b = layout.edges[j];
      if (a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to) continue;
      let hit = false;
      for (let p = 0; !hit && p + 1 < a.poly.length; p++) for (let q = 0; !hit && q + 1 < b.poly.length; q++) hit = cross(a.poly[p], a.poly[p + 1], b.poly[q], b.poly[q + 1]);
      if (hit) n++;
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
