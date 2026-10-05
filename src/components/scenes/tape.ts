import type { DictKey } from "@/i18n/dict";
import type { Scene, SceneTone, Text } from "@/lib/types";
import { estimateTextWidth } from "./text-width";

// Чистая раскладка сцены «лента ячеек» (tape): координаты в системе SVG, срезы как у Python range, уровни подписей.
// Компонент только рисует результат; всё, что может обрезаться на 360 px, считается здесь.

export type TapeData = Extract<Scene, { kind: "tape" }>;
type Tr = (key: DictKey, params?: Record<string, string | number>) => string;

/** Ширина «экрана» по умолчанию (px viewBox): телефон. Если содержимое шире — viewBox растёт, рисунок уменьшается целиком. */
export const TAPE_W = 360;
const PAD = 6;
const MIN_CELL = 18;
const MAX_CELL = 44;
const MIN_FONT = 8;
const MAX_FONT = 18;
const ROW_INDEX = 14;
const LABEL_FS = 11;
const MONO_EM = 0.6;

/** Индексы ячеек, взятые срезом: как range(start, stop, step), только внутри ленты длины n. */
export function sliceIndices(n: number, slice: { start: number; stop: number; step?: number }): number[] {
  const step = slice.step ?? 1;
  if (!Number.isInteger(step) || step === 0) return [];
  const out: number[] = [];
  // защита от бесконечного цикла: не больше n шагов
  for (let i = slice.start, k = 0; (step > 0 ? i < slice.stop : i > slice.stop) && k <= n + 1; i += step, k++) {
    if (i >= 0 && i < n) out.push(i);
  }
  return out;
}

/** Граница «не включая» в долях ячейки (0..n): при шаге > 0 — слева от ячейки stop, при шаге < 0 — справа от неё. */
export function stopBoundary(n: number, slice: { stop: number; step?: number }): number {
  const b = (slice.step ?? 1) > 0 ? slice.stop : slice.stop + 1;
  return Math.min(n, Math.max(0, b));
}

/** Подпись индекса ячейки. */
export function indexLabel(mode: NonNullable<TapeData["index"]>, i: number, n: number, side: "top" | "bottom"): string | null {
  if (mode === "none") return null;
  if (mode === "one") return side === "top" ? String(i + 1) : null;
  if (mode === "py") return side === "top" ? String(i) : null;
  return side === "top" ? String(i) : `\u2212${n - i}`;
}

/** Ширина строки: моноширинный шрифт — по 0.6 em на символ, иначе — оценка Nunito. */
export function textWidth(text: string, fontPx: number, mono: boolean): number {
  return mono ? [...text].length * MONO_EM * fontPx : estimateTextWidth(text, fontPx);
}

/** Центр подписи, прижатый к границам [lo, hi] (если подпись шире — по центру отрезка). */
export function clampCenter(cx: number, halfW: number, lo: number, hi: number): number {
  if (hi - lo < halfW * 2) return (lo + hi) / 2;
  return Math.min(hi - halfW, Math.max(lo + halfW, cx));
}

/**
 * Уровни подписей: жадно, слева направо; подпись идёт на самый нижний уровень, где не пересекается (с зазором gap) с уже стоящими.
 * Возвращает уровень каждого элемента в исходном порядке.
 */
export function assignLevels(items: { x0: number; x1: number }[], gap = 3): number[] {
  const order = items.map((_, i) => i).sort((a, b) => items[a].x0 - items[b].x0 || a - b);
  const ends: number[] = [];
  const levels = new Array<number>(items.length).fill(0);
  for (const i of order) {
    let lv = ends.findIndex((e) => items[i].x0 >= e + gap);
    if (lv < 0) lv = ends.length;
    ends[lv] = items[i].x1;
    levels[i] = lv;
  }
  return levels;
}

export interface TapeCell {
  i: number;
  x: number;
  y: number;
  text: string;
  /** sliceHl — ячейка и в срезе, и подсвечена: заливка среза, обводка подсветки (приоритет: срез задаёт заливку, подсветка не теряется). */
  state: "slice" | "sliceHl" | "highlight" | "dim" | "plain";
}
export interface TapeArc {
  key: string;
  /** Центры концов по x и нижняя линия дуги. */
  xa: number;
  xb: number;
  y: number;
  height: number;
  kind: "jump" | "swap";
}
export interface TapeLabelBox {
  /** Центр подписи и её ширина (оценка). */
  cx: number;
  w: number;
  y: number;
  text: string;
}

export interface TapeLayout {
  vbW: number;
  vbH: number;
  cellW: number;
  cellH: number;
  cellFs: number;
  mono: boolean;
  x0: number;
  cells: TapeCell[];
  /** Вторая лента («после»): ячейки и стрелка между лентами. */
  after: { cells: TapeCell[]; arrow: { x: number; y1: number; y2: number }; empty: { x: number; y: number; text: string } | null } | null;
  indexTop: { x: number; y: number; text: string }[];
  indexBottom: { x: number; y: number; text: string }[];
  indexFs: number;
  arcs: TapeArc[];
  groups: { key: string; x1: number; x2: number; y: number; label: TapeLabelBox; level: number }[];
  /** line — соединительная линия вниз до подписи (не рисуется, если пересекла бы чужую подпись); triangle — свой треугольник. */
  pointers: { key: string; at: number; x: number; yTop: number; yEnd: number; label: TapeLabelBox; tone: SceneTone; level: number; line: boolean; triangle: boolean }[];
  stop: { x: number; y1: number; y2: number; label: TapeLabelBox } | null;
  empty: { x: number; y: number; text: string } | null;
  names: { text: string; x: number; y: number; rowCy: number }[];
  /** Короткая стрелка от имён к ленте (если есть alias): x от..до, y. */
  nameArrows: { x1: number; x2: number; y: number }[];
  taken: number[];
}

const NAME_FS = 13;

/** Раскладка сцены. `txt` превращает Text в строку на языке ученика; `t` — словарь (подписи «не включая», «пусто»). */
export function tapeLayout(scene: TapeData, txt: (v: Text) => string, t: Tr): TapeLayout {
  const n = scene.cells.length;
  const after = scene.after ?? null;
  const mono = scene.mono ?? false;
  const mode = scene.index ?? "py";
  const cols = Math.max(n, after?.length ?? 0);
  const allTexts = [...scene.cells, ...(after ?? [])];

  // ---- имена слева ----
  const nameTexts = [scene.name, scene.alias].filter((s): s is string => !!s).map((s) => `${s} =`);
  const nameW = nameTexts.length ? Math.max(...nameTexts.map((s) => textWidth(s, NAME_FS, true))) : 0;
  const leftW = nameTexts.length ? nameW + (scene.alias ? 26 : 8) : 0;

  // ---- размер ячейки и шрифта ----
  const avail = TAPE_W - 2 * PAD - leftW;
  let cellW = Math.min(MAX_CELL, Math.max(MIN_CELL, Math.floor(avail / cols)));
  const baseCellW = cellW;
  const fits = (fs: number, w: number) => allTexts.every((s) => textWidth(s, fs, mono) <= w - 4);
  let cellFs = Math.min(MAX_FONT, Math.floor(cellW * 0.52));
  while (cellFs > MIN_FONT && !fits(cellFs, cellW)) cellFs--;
  if (!fits(cellFs, cellW)) {
    // Даже самый мелкий шрифт не влезает — ячейка становится прямоугольной (высота прежняя, ширина по тексту);
    // рисунок целиком уменьшится вместе с viewBox. Такие сцены validate.ts не пропускает (tapeLegible).
    cellW = Math.ceil(Math.max(...allTexts.map((s) => textWidth(s, cellFs, mono))) + 4);
  }
  const cellH = Math.min(MAX_CELL, Math.max(MIN_CELL, baseCellW));
  const vbW = Math.max(TAPE_W, Math.ceil(2 * PAD + leftW + cols * cellW));
  // лента выравнивается по центру свободного места, но не левее имён
  const x0 = PAD + leftW + Math.max(0, Math.floor((vbW - 2 * PAD - leftW - cols * cellW) / 2));
  const cx = (i: number) => x0 + i * cellW + cellW / 2;

  const taken = scene.slice ? sliceIndices(n, scene.slice) : [];
  const takenSet = new Set(taken);
  const hl = new Set(scene.highlight ?? []);
  const dim = new Set(scene.dim ?? []);
  const stateOf = (i: number): TapeCell["state"] => (takenSet.has(i) ? (hl.has(i) ? "sliceHl" : "slice") : hl.has(i) ? "highlight" : dim.has(i) ? "dim" : "plain");

  // ---- дуги ----
  const arcSpec: { key: string; xa: number; xb: number; kind: "jump" | "swap"; h: number }[] = [];
  const step = scene.slice?.step ?? 1;
  if (scene.slice && taken.length >= 2 && step !== 1) {
    for (let k = 0; k + 1 < taken.length; k++) arcSpec.push({ key: `j${taken[k]}-${taken[k + 1]}`, xa: cx(taken[k]), xb: cx(taken[k + 1]), kind: "jump", h: 12 });
  }
  const jumpH = arcSpec.length ? 12 : 0;
  const swaps = (scene.swaps ?? []).map(([a, b], k) => ({ a, b, k, span: Math.abs(cx(a) - cx(b)) }));
  [...swaps]
    .sort((p, q) => p.span - q.span || p.k - q.k)
    .forEach((s, level) => {
      arcSpec.push({ key: `s${s.a}-${s.b}-${s.k}`, xa: cx(s.a), xb: cx(s.b), kind: "swap", h: (jumpH ? jumpH + 4 : 0) + 14 + 9 * level + Math.min(10, s.span * 0.1) });
    });
  const arcZone = arcSpec.length ? Math.ceil(Math.max(...arcSpec.map((a) => a.h)) + 8) : 0;

  // ---- группы (скобки с подписью) ----
  const groupItems = (scene.groups ?? []).map((g, k) => {
    const text = txt(g.label);
    const w = textWidth(text, LABEL_FS, false) + 4;
    const mid = (cx(g.from) + cx(g.to)) / 2;
    const c = clampCenter(mid, w / 2, 2, vbW - 2);
    const bx1 = cx(g.from) - cellW / 2 + 2;
    const bx2 = cx(g.to) + cellW / 2 - 2;
    return { k, g, text, w, c, bx1, bx2 };
  });
  // уровень считаем по объединению скобки и подписи: чужая скобка не повисает над соседней подписью
  const groupLevels = assignLevels(groupItems.map((it) => ({ x0: Math.min(it.bx1, it.c - it.w / 2), x1: Math.max(it.bx2, it.c + it.w / 2) })));
  const groupLv = groupItems.length ? Math.max(...groupLevels) + 1 : 0;
  const GROUP_ROW = 20;
  const groupZone = groupLv * GROUP_ROW;

  // ---- вертикаль ----
  // граница «не включая» не нужна, если совпадает с краем ленты (ничего не исключено)
  const stopB = scene.slice ? stopBoundary(n, scene.slice) : 0;
  const hasStop = !!scene.slice && !((scene.slice.step ?? 1) > 0 ? stopB === n : stopB === 0);
  let y = 4;
  const stopRowY = y;
  if (hasStop) y += 14;
  const arcBase = y + arcZone; // нижняя линия дуг
  y = arcBase;
  const groupTop = y;
  y += groupZone;
  const indexTopY = y;
  if (mode !== "none") y += ROW_INDEX;
  const cellsY = y;
  y += cellH;
  const bottomIdx = mode === "both";
  const indexBottomY = y;
  if (bottomIdx) y += ROW_INDEX;

  // ---- указатели ----
  const ptrItems = (scene.pointers ?? []).map((p, k) => {
    const w = textWidth(p.label, 12, true) + 2;
    const c = clampCenter(cx(p.at), w / 2, 2, vbW - 2);
    return { k, p, w, c };
  });
  const ptrLevels = assignLevels(ptrItems.map((it) => ({ x0: it.c - it.w / 2, x1: it.c + it.w / 2 })));
  const ptrLv = ptrItems.length ? Math.max(...ptrLevels) + 1 : 0;
  // линия вниз к подписи нижнего уровня не должна проходить сквозь чужую подпись более близкого уровня
  const crossesLabel = (i: number) =>
    ptrItems.some((o, j) => j !== i && ptrLevels[j] < ptrLevels[i] && Math.abs(cx(ptrItems[i].p.at) - o.c) < o.w / 2 + 1);
  const ptrTop = y + 1;
  const PTR_ARROW = 8;
  const PTR_ROW = 15;
  if (ptrLv) y += PTR_ARROW + ptrLv * PTR_ROW + 2;

  let empty: TapeLayout["empty"] = null;
  if (scene.slice && taken.length === 0) {
    empty = { x: x0 + (n * cellW) / 2, y: y + 9, text: t("scene.tape.empty") };
    y += 18;
  }

  // ---- вторая лента ----
  let afterBlock: TapeLayout["after"] = null;
  const afterCells: TapeCell[] = [];
  let afterY = 0;
  if (after) {
    const gap = 26;
    const arrow = { x: x0 + (cols * cellW) / 2, y1: y + 4, y2: y + gap - 4 };
    y += gap;
    afterY = y;
    after.forEach((text, i) => afterCells.push({ i, x: x0 + i * cellW, y: afterY, text, state: "plain" }));
    const emptyAfter = after.length === 0 ? { x: arrow.x, y: afterY + cellH / 2, text: t("scene.tape.empty") } : null;
    y += cellH;
    afterBlock = { cells: afterCells, arrow, empty: emptyAfter };
  }
  const vbH = y + 4;

  // ---- имена ----
  const names: TapeLayout["names"] = [];
  const nameArrows: TapeLayout["nameArrows"] = [];
  const nameX = PAD + nameW; // правый край подписей (text-anchor end)
  const addNames = (rowY: number) => {
    const rc = rowY + cellH / 2;
    if (scene.name && scene.alias) {
      names.push({ text: `${scene.name} =`, x: nameX, y: rc - 8, rowCy: rc });
      names.push({ text: `${scene.alias} =`, x: nameX, y: rc + 8, rowCy: rc });
      nameArrows.push({ x1: nameX + 3, x2: x0 - 3, y: rc - 8 }, { x1: nameX + 3, x2: x0 - 3, y: rc + 8 });
    } else if (scene.name) {
      names.push({ text: `${scene.name} =`, x: nameX, y: rc, rowCy: rc });
    }
  };
  if (scene.name) {
    addNames(cellsY);
    if (after) {
      // у кадра «после» — только основное имя
      const rc = afterY + cellH / 2;
      names.push({ text: `${scene.name} =`, x: nameX, y: rc, rowCy: rc });
    }
  }

  // ---- итог ----
  const cells: TapeCell[] = scene.cells.map((text, i) => ({ i, x: x0 + i * cellW, y: cellsY, text, state: stateOf(i) }));
  const indexFs = (() => {
    let fs = 11;
    const worst = `\u2212${n}`;
    // зазор между соседними индексами не меньше 4 px
    while (fs > 6 && estimateTextWidth(worst, fs) > cellW - 4) fs--;
    return fs;
  })();

  let stop: TapeLayout["stop"] = null;
  if (scene.slice && hasStop) {
    const text = t("scene.tape.stop");
    const w = textWidth(text, LABEL_FS, false);
    const bx = x0 + stopB * cellW;
    stop = {
      x: bx,
      y1: stopRowY + 12,
      y2: cellsY + cellH + 2,
      label: { cx: clampCenter(bx, w / 2, 2, vbW - 2), w, y: stopRowY + 7, text },
    };
  }

  return {
    vbW,
    vbH,
    cellW,
    cellH,
    cellFs,
    mono,
    x0,
    cells,
    after: afterBlock,
    indexTop: mode === "none" ? [] : cells.map((c) => ({ x: c.x + cellW / 2, y: indexTopY + 8, text: indexLabel(mode, c.i, n, "top") ?? "" })),
    indexBottom: bottomIdx ? cells.map((c) => ({ x: c.x + cellW / 2, y: indexBottomY + 9, text: indexLabel(mode, c.i, n, "bottom") ?? "" })) : [],
    indexFs,
    arcs: arcSpec.map((a) => ({ key: a.key, xa: a.xa, xb: a.xb, y: arcBase - 1, height: a.h, kind: a.kind })),
    groups: groupItems.map((it) => {
      const lv = groupLevels[it.k];
      // уровень 0 — ближе к ленте
      const bottom = groupTop + groupZone - lv * GROUP_ROW;
      return {
        key: `g${it.k}`,
        x1: it.bx1,
        x2: it.bx2,
        y: bottom - 6, // горизонтальная линия скобки; засечки идут вниз, к ячейкам, подпись — над линией
        level: lv,
        label: { cx: it.c, w: it.w, y: bottom - 14, text: it.text },
      };
    }),
    pointers: ptrItems.map((it) => {
      const lv = ptrLevels[it.k];
      const crossed = lv > 0 && crossesLabel(it.k);
      return {
        key: `p:${it.p.label}:${ptrItems.filter((o) => o.k < it.k && o.p.label === it.p.label).length}`,
        at: it.p.at,
        line: lv > 0 && !crossed,
        triangle: !crossed,
        x: cx(it.p.at),
        yTop: ptrTop,
        yEnd: ptrTop + PTR_ARROW + lv * PTR_ROW,
        level: lv,
        tone: it.p.tone ?? "primary",
        label: { cx: it.c, w: it.w, y: ptrTop + PTR_ARROW + lv * PTR_ROW + 8, text: it.p.label },
      };
    }),
    stop,
    empty,
    names,
    nameArrows,
    taken,
  };
}

/** Читаемо ли сцену на телефоне: эффективный шрифт ячеек (с учётом сжатия viewBox к 360 px) не меньше MIN_FONT. Для validate.ts. */
export function tapeLegible(scene: TapeData): boolean {
  const L = tapeLayout(scene, (v) => (typeof v === "string" ? v : v.ru), () => "");
  return (L.cellFs * TAPE_W) / Math.max(TAPE_W, L.vbW) >= MIN_FONT - 0.01;
}

/** Текст для aria-label: что лежит в ленте, срез, обмены, указатели, группы, кадр «после». Номера — как на рисунке (при index "one" с 1). */
export function tapeAria(scene: TapeData, txt: (v: Text) => string, t: Tr): string {
  const n = scene.cells.length;
  const off = scene.index === "one" ? 1 : 0;
  const parts = [t("scene.tape.aria", { n, cells: scene.cells.join(", ") })];
  if (scene.name) parts.push(t("scene.tape.ariaName", { name: scene.name }));
  if (scene.alias) parts.push(t("scene.tape.ariaAlias", { alias: scene.alias }));
  if (scene.slice) {
    const taken = sliceIndices(n, scene.slice);
    parts.push(taken.length ? t("scene.tape.ariaSlice", { cells: taken.map((i) => scene.cells[i]).join(", ") }) : t("scene.tape.ariaEmpty"));
  }
  if (scene.highlight?.length) parts.push(t("scene.tape.ariaHighlight", { cells: scene.highlight.map((i) => scene.cells[i]).join(", ") }));
  if (scene.dim?.length) parts.push(t("scene.tape.ariaDim", { cells: scene.dim.map((i) => scene.cells[i]).join(", ") }));
  for (const [a, b] of scene.swaps ?? []) parts.push(t("scene.tape.ariaSwap", { a: a + off, b: b + off }));
  for (const p of scene.pointers ?? []) parts.push(t("scene.tape.ariaPointer", { label: p.label, at: p.at + off }));
  for (const g of scene.groups ?? []) parts.push(t("scene.tape.ariaGroup", { from: g.from + off, to: g.to + off, label: txt(g.label) }));
  if (scene.after) parts.push(t("scene.tape.ariaAfter", { cells: scene.after.length ? scene.after.join(", ") : t("scene.tape.empty") }));
  return parts.join(" ");
}
