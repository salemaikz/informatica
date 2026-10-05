import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneView } from "@/components/scenes/SceneView";
import { SAMPLES } from "@/components/scenes/samples/grid";
import { GRID_VB, cellLayers, cellSize, fitFont, gridAria, gridLayout, inRegion, markedCount, pathArrow } from "@/components/scenes/grid";
import { estimateTextWidth } from "@/components/scenes/text-width";
import { dict } from "@/i18n/dict";
import type { Scene } from "@/lib/types";
import { validateScene } from "./validate";

type G = Extract<Scene, { kind: "grid" }>;
const mkT = (lang: "ru" | "kk") => (key: keyof typeof dict, p?: Record<string, string | number>) =>
  dict[key][lang].replace(/\{(\w+)\}/g, (_, k) => String(p?.[k]));
const t = mkT("ru");

describe("grid: области", () => {
  it("диагональ, побочная, над и под", () => {
    const n = 4;
    const cells = (reg: Parameters<typeof inRegion>[0]) => {
      let k = 0;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (inRegion(reg, r, c, n)) k++;
      return k;
    };
    expect(cells("diag")).toBe(4);
    expect(cells("anti")).toBe(4);
    expect(cells("upper")).toBe(6);
    expect(cells("lower")).toBe(6);
    expect(inRegion("anti", 0, 3, 4)).toBe(true);
    expect(inRegion("upper", 0, 1, 4)).toBe(true);
    expect(inRegion("lower", 0, 1, 4)).toBe(false);
  });
  it("слои сохраняют порядок, строки и столбцы пересекаются", () => {
    const s: G = { kind: "grid", rows: 3, cols: 3, marks: [{ tone: "ai", rows: [1] }, { tone: "success", cols: [1] }] };
    expect(cellLayers(s, 1, 1)).toEqual([{ layer: 0, tone: "ai" }, { layer: 1, tone: "success" }]);
    expect(cellLayers(s, 0, 0)).toEqual([]);
    expect(markedCount(s)).toBe(5);
  });
});

describe("grid: раскладка", () => {
  it("10 × 10 с осями влезает в 360 px", () => {
    const s = SAMPLES[2];
    const L = gridLayout(s);
    expect(L.w).toBeLessThanOrEqual(GRID_VB);
    expect(L.cell).toBeGreaterThanOrEqual(30);
    expect(L.blocks).toHaveLength(100);
    expect(L.rowNums).toHaveLength(10);
    expect(L.colNums[9].n).toBe(9);
  });
  it("все образцы укладываются в ширину и клетка не больше предела", () => {
    for (const s of SAMPLES) {
      const L = gridLayout(s);
      expect(L.w).toBeLessThanOrEqual(GRID_VB);
      expect(L.cell).toBeLessThanOrEqual(44);
      expect(validateScene(s)).toEqual([]);
    }
  });
  it("нумерация осей с 1", () => {
    const L = gridLayout({ kind: "grid", rows: 2, cols: 3, axes: { from: 1 } });
    expect(L.rowNums.map((q) => q.n)).toEqual([1, 2]);
    expect(L.colNums.map((q) => q.n)).toEqual([1, 2, 3]);
    expect(L.rowName).toBeUndefined();
  });
  it("без осей номеров нет", () => {
    const L = gridLayout({ kind: "grid", rows: 2, cols: 2 });
    expect(L.rowNums).toEqual([]);
    expect(L.ox).toBe(4);
  });
  it("размер клетки", () => {
    expect(cellSize(3, false, false)).toBe(44);
    expect(cellSize(10, true, true)).toBe(Math.floor((360 - 8 - 36) / 10));
  });
  it("значение из 4 символов влезает в клетку", () => {
    const L = gridLayout(SAMPLES[4]);
    const b = L.blocks.find((x) => x.value === "1024")!;
    expect(b.fontSize).toBeLessThan(18);
    expect(fitFont("1024", L.cell - 6, 18) * 1).toBe(b.fontSize);
  });
});

describe("grid: объединения", () => {
  it("съеденные клетки не дают блоков, площадь сохраняется", () => {
    const s: G = { kind: "grid", rows: 3, cols: 3, merges: [{ r: 0, c: 0, cs: 2 }, { r: 1, c: 2, rs: 2 }], hatch: true };
    const L = gridLayout(s);
    expect(L.blocks).toHaveLength(9 - 2);
    const area = L.blocks.reduce((a, b) => a + b.rs * b.cs, 0);
    expect(area).toBe(9);
    const big = L.blocks.find((b) => b.key === "0:0")!;
    expect(big.w).toBe(2 * L.cell);
    expect(big.eaten).toHaveLength(1);
  });
  it("без hatch штриховки нет; текст по центру большой клетки", () => {
    const s: G = { kind: "grid", rows: 2, cols: 3, values: [["ab", "", ""], ["", "", ""]], merges: [{ r: 0, c: 0, cs: 3 }] };
    const L = gridLayout(s);
    const big = L.blocks.find((b) => b.key === "0:0")!;
    expect(big.eaten).toEqual([]);
    expect(big.textX).toBeCloseTo(big.x + big.w / 2);
  });
  it("со штриховкой текст в якорной клетке", () => {
    const s: G = { kind: "grid", rows: 1, cols: 3, values: [["ab", "", ""]], merges: [{ r: 0, c: 0, cs: 3 }], hatch: true };
    const big = gridLayout(s).blocks[0];
    expect(big.textX).toBeCloseTo(big.x + gridLayout(s).cell / 2);
    expect(big.eaten).toHaveLength(2);
  });
  it("подсветка съеденной клетки переходит на блок", () => {
    const s: G = { kind: "grid", rows: 1, cols: 3, merges: [{ r: 0, c: 0, cs: 3 }], marks: [{ tone: "warning", cells: [[0, 2]] }] };
    expect(gridLayout(s).blocks[0].tones).toEqual([{ layer: 0, tone: "warning" }]);
  });
});

describe("grid: путь", () => {
  it("номера обхода и повторное посещение", () => {
    const s: G = { kind: "grid", rows: 2, cols: 2, path: [[0, 0], [0, 1], [0, 0]], numbered: true };
    const L = gridLayout(s);
    expect(L.numbers.get("0:0")).toEqual([1, 3]);
    expect(L.numbers.get("0:1")).toEqual([2]);
    expect(L.path).toHaveLength(3);
  });
  it("без numbered номеров нет", () => {
    expect(gridLayout({ kind: "grid", rows: 2, cols: 2, path: [[0, 0], [1, 1]] }).numbers.size).toBe(0);
  });
  it("стрелка кончается раньше центра, наконечник из 3 точек; одна клетка — без стрелки", () => {
    const a = pathArrow([{ x: 0, y: 0 }, { x: 40, y: 0 }], 40)!;
    expect(a.head).toHaveLength(3);
    expect(a.head[0].x).toBeLessThan(40);
    expect(a.line[a.line.length - 1].x).toBeLessThan(a.head[0].x);
    expect(pathArrow([{ x: 0, y: 0 }], 40)).toBeNull();
  });
});

describe("grid: читаемость", () => {
  it("подпись номеров обхода не шире клетки, повторы сворачиваются", () => {
    const s: G = {
      kind: "grid",
      rows: 10,
      cols: 10,
      axes: { row: "ijk", col: "j" },
      values: Array.from({ length: 10 }, (_, r) => Array.from({ length: 10 }, (_, c) => String(r * 10 + c))),
      path: Array.from({ length: 33 }, (_, i) => (i % 2 ? [0, 1] : [0, 0]) as [number, number]),
      numbered: true,
    };
    const L = gridLayout(s);
    for (const nl of L.numLabels.values()) expect(estimateTextWidth(nl.text, nl.font)).toBeLessThanOrEqual(L.cell);
    expect(L.numLabels.get("0:0")!.text).toBe("1…33");
    // имя оси из 3 символов помещается в колонку имени
    expect(estimateTextWidth("ijk", L.nameFont)).toBeLessThanOrEqual(16);
  });
  it("значение в клетке с номером сдвинуто вниз", () => {
    const s: G = { kind: "grid", rows: 2, cols: 2, values: [["7", ""], ["", ""]], path: [[0, 0], [0, 1]], numbered: true };
    const b = gridLayout(s).blocks[0];
    expect(b.textY).toBeGreaterThan(b.y + gridLayout(s).cell / 2);
  });
});

describe("grid: описание и рендер", () => {
  it("aria на обоих языках без пустых мест", () => {
    for (const lang of ["ru", "kk"] as const)
      for (const s of SAMPLES) {
        const txt = gridAria(s, mkT(lang));
        expect(txt).not.toMatch(/undefined|\{|\}/);
      }
    expect(gridAria(SAMPLES[1], t)).toContain("Объединений: 2");
  });
  it("образцы рисуются через SceneView", () => {
    for (const s of SAMPLES) {
      const html = renderToStaticMarkup(createElement(SceneView, { scene: s }));
      expect(html).toContain("<svg");
      expect(html).toContain("aria-label");
    }
  });
});
