// Логическая схема: вычисление значений на проводах и автоматическая раскладка (чистая логика, без React).

import type { Scene } from "@/lib/types";
import { estimateTextWidth } from "./text-width";

export type CircuitScene = Extract<Scene, { kind: "circuit" }>;
export type GateOp = CircuitScene["gates"][number]["op"];
export type Bit = 0 | 1;

/** Значение вентиля по входам. */
export function applyGate(op: GateOp, a: Bit, b: Bit = 0): Bit {
  switch (op) {
    case "and":
      return a & b ? 1 : 0;
    case "or":
      return a | b ? 1 : 0;
    case "not":
      return a ? 0 : 1;
    case "xor":
      return a ^ b ? 1 : 0;
    case "nand":
      return a & b ? 0 : 1;
    case "nor":
      return a | b ? 0 : 1;
  }
}

/**
 * Значения на всех проводах: входы (недостающие — 0) и выходы вентилей.
 * Вентили идут в порядке «от входов к выходу» (проверяет validateScene).
 */
export function evalCircuit(scene: CircuitScene, values: Record<string, Bit> = {}): Record<string, Bit> {
  const res: Record<string, Bit> = {};
  for (const name of scene.inputs) res[name] = values[name] === 1 ? 1 : 0;
  for (const g of scene.gates) {
    const a = res[g.in[0]] ?? 0;
    const b = res[g.in[1]] ?? 0;
    res[g.id] = applyGate(g.op, a, b);
  }
  return res;
}

/** Значок в рамке вентиля (школьный стиль) и наличие кружка инверсии на выходе. */
export const GATE_STYLE: Record<GateOp, { symbol: string; inverted: boolean }> = {
  and: { symbol: "&", inverted: false },
  or: { symbol: "1", inverted: false },
  not: { symbol: "1", inverted: true },
  xor: { symbol: "=1", inverted: false },
  nand: { symbol: "&", inverted: true },
  nor: { symbol: "1", inverted: true },
};

// ---------- Раскладка ----------

export const CIRCUIT_GEO = {
  /** Расстояние между столбцами (центр к центру). */
  pitch: 76,
  /** Центр первого столбца (входы). */
  x0: 18,
  /** Радиус кружка входа/выхода. */
  r: 14,
  gateW: 40,
  gateH: 40,
  /** Шаг по вертикали (рамка + подпись под ней). */
  row: 66,
  /** Верхний отступ до центра первого ряда. */
  top: 26,
  /** Нижний отступ под последним рядом (подпись вентиля: базовая линия на y + 35, плюс выносные элементы). */
  bottom: 40,
  /** Высота строки подписи вентиля (подпись в две строки — длинные казахские «ЖӘНЕ-ЕМЕС», «НЕМЕСЕ-ЕМЕС»). */
  labelLine: 15,
  /** Сдвиг входных клемм двухвходового вентиля от центра по вертикали. */
  portDy: 11,
  /** Радиус кружка инверсии. */
  bubble: 4.5,
  /** Правый запас. */
  right: 8,
} as const;

export type Pt = [number, number];

export interface CircuitNode {
  id: string;
  /** Подпись терминала (у выхода — «F»; id выхода внутренний, чтобы не совпасть с id вентиля). */
  label: string;
  kind: "input" | "gate" | "output";
  op?: GateOp;
  /** Столбец: входы — 0, вентиль — 1 + максимум столбцов его входов, выход F — последний. */
  col: number;
  /** Центр. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Подпись вентиля — над рамкой (по умолчанию под ней): снизу её пересёк бы провод или соседняя подпись. */
  labelAbove?: boolean;
}

export interface CircuitWire {
  from: string;
  to: string;
  /** Номер входной клеммы приёмника (0 — верхняя). */
  port: number;
  points: Pt[];
}

export interface CircuitLayout {
  width: number;
  height: number;
  nodes: CircuitNode[];
  wires: CircuitWire[];
  /** Идентификатор выходного узла F (первого выхода). */
  outId: string;
  /** Волна 3: выходные узлы с подписями (у старых схем — один, «F»). */
  outputs: { id: string; gate: string; name: string }[];
  /** Волна 3 (только при `outputs` в сцене): точки ответвления проводов одного источника — рисуется точка-узел. */
  junctions: Pt[];
  /** Волна 3: число пересечений проводов разных источников (при `outputs` — минимизируется перебором изломов). */
  crossings: number;
}

/** Внутренний id узла-выхода: не может совпасть с именем входа или id вентиля из контента. */
export const OUT_ID = "@out";
/** Подпись выхода схемы. */
export const OUT_LABEL = "F";

/**
 * Подпись вентиля в одну или две строки: длинную подпись с дефисом («НЕМЕСЕ-ЕМЕС») переносим после дефиса,
 * чтобы подписи соседних столбцов (шаг 76) не наезжали друг на друга.
 */
export function gateLabelLines(label: string): string[] {
  const dash = label.indexOf("-");
  if (label.length <= 7 || dash <= 0 || dash === label.length - 1) return [label];
  return [label.slice(0, dash + 1), label.slice(dash + 1)];
}

/** Столбцы вентилей: 1 + максимум столбцов входов. Входы — столбец 0. */
export function circuitColumns(scene: CircuitScene): Record<string, number> {
  const col: Record<string, number> = {};
  for (const name of scene.inputs) col[name] = 0;
  for (const g of scene.gates) col[g.id] = 1 + Math.max(...g.in.map((x) => col[x] ?? 0));
  return col;
}

/** Точка выхода узла (справа; у инвертирующего вентиля — за кружком). */
export function outPort(n: CircuitNode): Pt {
  const g = n.op ? GATE_STYLE[n.op] : null;
  const extra = g?.inverted ? CIRCUIT_GEO.bubble * 2 : 0;
  return [n.x + n.w / 2 + extra, n.y];
}

/** Точка входной клеммы вентиля/выхода (слева). */
export function inPort(n: CircuitNode, port: number, count: number): Pt {
  const dy = count === 2 ? (port === 0 ? -CIRCUIT_GEO.portDy : CIRCUIT_GEO.portDy) : 0;
  return [n.x - n.w / 2, n.y + dy];
}

/** Размер шрифта подписи вентиля (как в CircuitScene). */
const LABEL_FONT = 13;

/** Базовая линия первой строки подписи вентиля: под рамкой (по умолчанию) или над ней. */
export function gateLabelBaseline(n: CircuitNode, lineCount: number): number {
  const G = CIRCUIT_GEO;
  return n.labelAbove ? n.y - n.h / 2 - 6 - (lineCount - 1) * G.labelLine : n.y + n.h / 2 + 15;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Прямоугольник подписи вентиля (по оценке ширины текста) — для проверки пересечений. */
export function gateLabelRect(n: CircuitNode, lines: string[], above: boolean): Rect {
  const wd = Math.max(0, ...lines.map((l) => estimateTextWidth(l, LABEL_FONT)));
  const base = gateLabelBaseline({ ...n, labelAbove: above }, lines.length);
  return { x0: n.x - wd / 2 - 1.5, x1: n.x + wd / 2 + 1.5, y0: base - 11, y1: base + (lines.length - 1) * CIRCUIT_GEO.labelLine + 3 };
}

const rectsHit = (a: Rect, b: Rect) => a.x1 > b.x0 && a.x0 < b.x1 && a.y1 > b.y0 && a.y0 < b.y1;

/** Задевает ли провод (ломаная с запасом на толщину линии) прямоугольник. */
const wireHits = (pts: Pt[], r: Rect): boolean => {
  for (let i = 0; i + 1 < pts.length; i++) {
    const seg: Rect = {
      x0: Math.min(pts[i][0], pts[i + 1][0]) - 1.5,
      x1: Math.max(pts[i][0], pts[i + 1][0]) + 1.5,
      y0: Math.min(pts[i][1], pts[i + 1][1]) - 1.5,
      y1: Math.max(pts[i][1], pts[i + 1][1]) + 1.5,
    };
    if (rectsHit(seg, r)) return true;
  }
  return false;
};

/**
 * Автоматическая раскладка: вентиль стоит в столбце 1 + max(столбцов входов), по вертикали — напротив
 * среднего положения своих входов; внутри столбца вентили не ближе одного шага (порядок сохраняется).
 * Провода — ломаные: горизонталь от источника, вертикаль перед приёмником, горизонталь в клемму.
 */
export function layoutCircuit(scene: CircuitScene, opts: { labelLines?: number; labels?: Partial<Record<GateOp, string[]>> } = {}): CircuitLayout {
  const G = CIRCUIT_GEO;
  // Подписи вентилей в две строки — ряды и нижний отступ больше на строку.
  const extra = Math.max(0, (opts.labelLines ?? 1) - 1) * G.labelLine;
  const rowStep = G.row + extra;
  const cols = circuitColumns(scene);
  const nodes = new Map<string, CircuitNode>();

  scene.inputs.forEach((name, i) => {
    nodes.set(name, { id: name, label: name, kind: "input", col: 0, x: G.x0, y: G.top + i * rowStep, w: G.r * 2, h: G.r * 2 });
  });

  const lastY: Record<number, number> = {};
  for (const name of scene.inputs) lastY[0] = Math.max(lastY[0] ?? -Infinity, nodes.get(name)!.y);
  for (const g of scene.gates) {
    const col = cols[g.id];
    const ys = g.in.map((s) => nodes.get(s)?.y ?? G.top);
    const desired = ys.reduce((a, b) => a + b, 0) / ys.length;
    const prev = lastY[col];
    const y = prev === undefined ? desired : Math.max(desired, prev + rowStep);
    lastY[col] = y;
    nodes.set(g.id, { id: g.id, label: g.id, kind: "gate", op: g.op, col, x: G.x0 + col * G.pitch, y, w: G.gateW, h: G.gateH });
  }

  const maxCol = Math.max(0, ...scene.gates.map((g) => cols[g.id]));
  const outCol = maxCol + 1;
  // Выходы: у старой схемы один («F»); при `outputs` — несколько со своими подписями (первый — всегда OUT_ID).
  const multi = !!scene.outputs?.length;
  const outDefs = multi ? scene.outputs! : [{ gate: scene.output, name: OUT_LABEL }];
  const outNodes: CircuitNode[] = [];
  outDefs.forEach((o, i) => {
    const gateNode = nodes.get(o.gate);
    let y = gateNode?.y ?? G.top;
    // Два выхода одного вентиля (или близких) не должны слипаться: сдвигаем вниз от занятых.
    for (const prev of outNodes) if (Math.abs(prev.y - y) < G.r * 2 + 6) y = Math.max(y, prev.y + G.r * 2 + 6);
    const node: CircuitNode = {
      id: i === 0 ? OUT_ID : `${OUT_ID}:${i}`,
      label: o.name,
      kind: "output",
      col: outCol,
      x: G.x0 + outCol * G.pitch,
      y,
      w: G.r * 2,
      h: G.r * 2,
    };
    outNodes.push(node);
    nodes.set(node.id, node);
  });
  const outNode = outNodes[0];

  /** Описание провода: излом (bendX) пересчитывается при подборе. */
  interface WireDef {
    from: CircuitNode;
    to: CircuitNode;
    port: number;
    count: number;
  }
  const defs: WireDef[] = [];
  for (const g of scene.gates) {
    const to = nodes.get(g.id)!;
    g.in.forEach((src, port) => {
      const from = nodes.get(src);
      if (from) defs.push({ from, to, port, count: g.in.length });
    });
  }
  outDefs.forEach((o, i) => {
    const from = nodes.get(o.gate);
    if (from) defs.push({ from, to: outNodes[i], port: 0, count: 1 });
  });
  // Излом у двухвходового вентиля — на разном расстоянии для клемм, чтобы вертикали проводов не слились.
  const defaultBend = (d: WireDef) => inPort(d.to, d.port, d.count)[0] - (d.count === 2 ? (d.port === 0 ? 16 : 8) : 12);
  const routeWire = (d: WireDef, bendX: number): CircuitWire => {
    const [sx, sy] = outPort(d.from);
    const [tx, ty] = inPort(d.to, d.port, d.count);
    const points: Pt[] = sy === ty ? [[sx, sy], [tx, ty]] : [[sx, sy], [bendX, sy], [bendX, ty], [tx, ty]];
    return { from: d.from.id, to: d.to.id, port: d.port, points };
  };
  let bends = defs.map(defaultBend);
  if (multi) bends = bestBends(defs.map((d) => ({ route: (b: number) => routeWire(d, b), choices: d.count === 2 ? [inPort(d.to, d.port, 2)[0] - 16, inPort(d.to, d.port, 2)[0] - 8] : [defaultBend(d)] })));
  const wires: CircuitWire[] = defs.map((d, i) => routeWire(d, bends[i]));

  // Подписи вентилей: по умолчанию под рамкой. Если там провод, рамка соседа или чужая подпись — часть подписей переносим над рамкой.
  // Вентилей не больше шести — перебираем все варианты и берём с наименьшим числом наложений (при нуле наложений снизу ничего не меняется).
  if (opts.labels) {
    const labels = opts.labels;
    const gates = [...nodes.values()].filter((n) => n.kind === "gate" && (labels[n.op!] ?? []).length > 0);
    const boxes = [...nodes.values()].map((n) => ({ n, r: { x0: n.x - n.w / 2, x1: n.x + n.w / 2, y0: n.y - n.h / 2, y1: n.y + n.h / 2 } as Rect }));
    if (gates.length > 0 && gates.length <= 8) {
      let bestMask = 0;
      let bestCost = Infinity;
      for (let mask = 0; mask < 1 << gates.length; mask++) {
        const rects = gates.map((g, i) => gateLabelRect(g, labels[g.op!]!, (mask >> i & 1) === 1));
        let cost = 0;
        rects.forEach((r, i) => {
          if (r.y0 < 2) cost += 100;
          cost += 10 * wires.filter((w) => wireHits(w.points, r)).length;
          cost += 10 * boxes.filter((b) => b.n !== gates[i] && rectsHit(b.r, r)).length;
          cost += 10 * rects.filter((o, j) => j > i && rectsHit(o, r)).length;
          if (mask >> i & 1) cost += 1;
        });
        if (cost < bestCost) {
          bestCost = cost;
          bestMask = mask;
        }
        if (cost === 0) break;
      }
      gates.forEach((g, i) => {
        if (bestMask >> i & 1) g.labelAbove = true;
      });
    }
  }

  const all = [...nodes.values()];
  const maxY = Math.max(...all.map((n) => n.y));
  return {
    // При нескольких выходах справа остаётся место под плашку со значением выхода.
    width: outNode.x + G.r + G.right + (multi ? OUT_CHIP_W : 0),
    height: maxY + G.bottom + extra,
    nodes: all,
    wires,
    outId: OUT_ID,
    outputs: outNodes.map((n, i) => ({ id: n.id, gate: outDefs[i].gate, name: n.label })),
    junctions: multi ? findJunctions(wires) : [],
    crossings: countCrossings(wires),
  };
}

/** Место справа от выхода под плашку «0/1» (только у схем с несколькими выходами). */
export const OUT_CHIP_W = 22;

// ---------- Пересечения проводов и точки-узлы (волна 3) ----------

type Seg = [Pt, Pt];
const segsOf = (pts: Pt[]): Seg[] => pts.slice(0, -1).map((p, i) => [p, pts[i + 1]] as Seg);
const isH = (s: Seg) => s[0][1] === s[1][1];

/** Штраф за взаимное положение двух отрезков разных источников: 0 — не касаются, 1 — пересекаются крест-накрест, 100 — касаются/накладываются. */
function segPenalty(a: Seg, b: Seg): number {
  const ah = isH(a);
  const bh = isH(b);
  const lo = (s: Seg, k: 0 | 1) => Math.min(s[0][k], s[1][k]);
  const hi = (s: Seg, k: 0 | 1) => Math.max(s[0][k], s[1][k]);
  if (ah === bh) {
    // Параллельны: беда, только если на одной линии и перекрываются по длине (или касаются концами).
    const k = ah ? 1 : 0;
    const o = ah ? 0 : 1;
    if (a[0][k] !== b[0][k]) return 0;
    return Math.min(hi(a, o), hi(b, o)) >= Math.max(lo(a, o), lo(b, o)) ? 100 : 0;
  }
  const [h, v] = ah ? [a, b] : [b, a];
  const vx = v[0][0];
  const hy = h[0][1];
  const inX = vx >= lo(h, 0) && vx <= hi(h, 0);
  const inY = hy >= lo(v, 1) && hy <= hi(v, 1);
  if (!inX || !inY) return 0;
  // Точка пересечения — конец одного из отрезков: касание (Т-образное соединение) разных источников недопустимо.
  const endH = vx === lo(h, 0) || vx === hi(h, 0);
  const endV = hy === lo(v, 1) || hy === hi(v, 1);
  return endH || endV ? 100 : 1;
}

/** Суммарный штраф раскладки проводов: пересечения разных источников (1) и касания/наложения (100). */
function wiresPenalty(wires: CircuitWire[]): number {
  const { cross, bad } = wireStats(wires);
  return cross + 100 * bad;
}

/** Число пересечений крест-накрест и число недопустимых касаний/наложений проводов разных источников. */
export function wireStats(wires: CircuitWire[]): { cross: number; bad: number } {
  let cross = 0;
  let bad = 0;
  const segs = wires.map((w) => segsOf(w.points));
  for (let i = 0; i < wires.length; i++) {
    for (let j = i + 1; j < wires.length; j++) {
      if (wires[i].from === wires[j].from) continue;
      for (const a of segs[i]) {
        for (const b of segs[j]) {
          const p = segPenalty(a, b);
          if (p === 1) cross++;
          else if (p > 1) bad++;
        }
      }
    }
  }
  return { cross, bad };
}

/** Число честных пересечений проводов разных источников (крест-накрест). */
export function countCrossings(wires: CircuitWire[]): number {
  return wireStats(wires).cross;
}

/** Перебор изломов проводов (2 варианта у каждого провода к двухвходовому вентилю) с наименьшим штрафом; при равенстве — ближе к прежним изломам. */
function bestBends(items: { route: (b: number) => CircuitWire; choices: number[] }[]): number[] {
  const varIdx = items.map((it, i) => (it.choices.length > 1 ? i : -1)).filter((i) => i >= 0);
  const base = items.map((it) => it.choices[0]);
  // Больше 12 переменных проводов не бывает (не больше шести вентилей), но на всякий случай — без перебора.
  if (varIdx.length > 12) return base;
  let best = base;
  let bestCost = Infinity;
  for (let mask = 0; mask < 1 << varIdx.length; mask++) {
    const cur = base.slice();
    varIdx.forEach((wi, bit) => {
      cur[wi] = items[wi].choices[(mask >> bit) & 1];
    });
    const cost = wiresPenalty(items.map((it, i) => it.route(cur[i])));
    if (cost < bestCost) {
      bestCost = cost;
      best = cur;
    }
    if (cost === 0) break;
  }
  return best;
}

const onSeg = (p: Pt, s: Seg) => p[0] >= Math.min(s[0][0], s[1][0]) && p[0] <= Math.max(s[0][0], s[1][0]) && p[1] >= Math.min(s[0][1], s[1][1]) && p[1] <= Math.max(s[0][1], s[1][1]);
const dirOf = (a: Pt, b: Pt) => `${Math.sign(b[0] - a[0])},${Math.sign(b[1] - a[1])}`;

/** Точки ответвления: провод одного источника уходит в сторону от другого провода того же источника. */
export function findJunctions(wires: CircuitWire[]): Pt[] {
  const found = new Map<string, Pt>();
  for (let i = 0; i < wires.length; i++) {
    for (let j = 0; j < wires.length; j++) {
      if (i === j || wires[i].from !== wires[j].from) continue;
      const a = wires[i].points;
      const b = wires[j].points;
      const bSegs = segsOf(b);
      for (let k = 1; k < a.length - 1; k++) {
        const p = a[k];
        if (!bSegs.some((sg) => onSeg(p, sg))) continue;
        const m = b.findIndex((q) => q[0] === p[0] && q[1] === p[1]);
        // Общий излом, после которого провода идут одинаково, — не ответвление.
        if (m >= 0 && m < b.length - 1 && dirOf(a[k], a[k + 1]) === dirOf(b[m], b[m + 1])) continue;
        found.set(`${p[0]},${p[1]}`, p);
      }
    }
  }
  return [...found.values()];
}

/** Строка points для SVG-polyline. */
export const pointsAttr = (pts: Pt[]): string => pts.map(([x, y]) => `${x},${y}`).join(" ");
