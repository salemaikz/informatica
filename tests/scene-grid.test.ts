import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneView } from "@/components/scenes/SceneView";
import { SAMPLES } from "@/components/scenes/samples/grid";
import { GRID_VB, NUM_FONT_MIN, STEP_LANE, STEP_LEN_MAX, STEP_LEN_MIN, cellLayers, cellSize, fitFont, gridAria, gridLayout, inRegion, markedCount, pathArrow, type GridStep } from "@/components/scenes/grid";
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
  it("ревью v18b: при номерах обхода у ВСЕХ значений один кегль и один сдвиг (10×10 и 4×4), строка «0 1 2 3» ровная", () => {
    for (const s of SAMPLES.filter((x) => x.numbered && x.values)) {
      const L = gridLayout(s);
      const withValue = L.blocks.filter((b) => b.value !== "");
      expect(withValue.length).toBeGreaterThan(0);
      const sizes = new Set(withValue.map((b) => b.fontSize));
      expect(sizes.size, `кегли значений в сетке ${s.rows}×${s.cols}`).toBe(1);
      const shifts = new Set(withValue.map((b) => +(b.textY - (b.y + b.h / 2)).toFixed(3)));
      expect(shifts.size, `сдвиги значений в сетке ${s.rows}×${s.cols}`).toBe(1);
      expect([...shifts][0]).toBeGreaterThan(0);
      // в одной строке базовая линия цифр одна и та же, и цифры не мельче 11 единиц (≈ 9 px на телефоне) в 10×10
      const row0 = withValue.filter((b) => b.r === 0);
      expect(new Set(row0.map((b) => b.textY)).size).toBe(1);
      expect(withValue[0].fontSize).toBeGreaterThanOrEqual(11);
    }
  });
  it("ревью v18b: 10×10 с путём — значения «0», «1», «10» не мельче соседних «2», «11» и не сдвинуты относительно них", () => {
    const s = SAMPLES.find((x) => x.rows === 10 && x.numbered)!;
    const L = gridLayout(s);
    const get = (k: string) => L.blocks.find((b) => b.key === k)!;
    const path = [get("0:0"), get("0:1"), get("1:0")];
    const others = [get("0:2"), get("1:1"), get("5:5")];
    for (const p of path) for (const o of others) {
      expect(p.fontSize).toBe(o.fontSize);
      expect(p.textY - p.y).toBeCloseTo(o.textY - o.y, 6);
    }
    // значение не касается номера «1,3» и «4» в углу своей клетки
    const nl = L.numLabels.get("0:0")!;
    expect(get("0:0").textY - get("0:0").fontSize * 0.36).toBeGreaterThanOrEqual(get("0:0").y + 2 + nl.font * 0.95 - 1.5);
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

// ---------- Ревью v18: путь не перечёркивает значения ----------

describe("grid: ревью v18 — путь в просветах между значениями", () => {
  const withSteps = SAMPLES.filter((s) => s.values && (s.path?.length ?? 0) >= 2);
  const valueBox = (L: ReturnType<typeof gridLayout>, key: string) => {
    const b = L.blocks.find((x) => x.key === key)!;
    const hw = estimateTextWidth(b.value, b.fontSize) / 2;
    return b.value === "" ? null : { x0: b.textX - hw, x1: b.textX + hw, y0: b.textY - b.fontSize * 0.36, y1: b.textY + b.fontSize * 0.36 };
  };
  /** Все точки шага: отрезок и наконечник. */
  const stepPoints = (st: GridStep) => [st.from, st.to, ...st.head];
  const hitsBox = (pts: { x: number; y: number }[], r: { x0: number; x1: number; y0: number; y1: number }, pad = 0) => {
    // отрезки и контур наконечника (по шагам вдоль звеньев)
    const segs: [{ x: number; y: number }, { x: number; y: number }][] = [];
    for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i], pts[i + 1]]);
    return segs.some(([a, b]) => {
      for (let t = 0; t <= 1; t += 0.05) {
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        if (x > r.x0 - pad && x < r.x1 + pad && y > r.y0 - pad && y < r.y1 + pad) return true;
      }
      return false;
    });
  };

  it("образцы со значениями и путём: шагов столько, сколько переходов; ни одна стрелка не задевает значения", () => {
    expect(withSteps.length).toBeGreaterThanOrEqual(2);
    for (const s of withSteps) {
      const L = gridLayout(s);
      expect(L.steps.length).toBe(s.path!.length - 1);
      for (const st of L.steps) {
        for (const b of L.blocks) {
          const box = valueBox(L, b.key);
          if (!box) continue;
          expect(hitsBox([st.from, st.to], box, 0.5), `линия шага задевает «${b.value}»`).toBe(false);
          expect(hitsBox([st.head[0], st.head[1], st.head[2], st.head[0]], box, 0.5), `наконечник шага задевает «${b.value}»`).toBe(false);
        }
      }
    }
  });

  it("стрелка шага: длина в пределах STEP_LEN_MIN..STEP_LEN_MAX (с наконечником), лежит между центрами своих клеток", () => {
    for (const s of withSteps) {
      const L = gridLayout(s);
      L.steps.forEach((st, i) => {
        const a = L.path[i];
        const b = L.path[i + 1];
        const len = Math.hypot(st.head[0].x - st.from.x, st.head[0].y - st.from.y);
        expect(len).toBeGreaterThanOrEqual(STEP_LEN_MIN - 0.01);
        expect(len).toBeLessThanOrEqual(STEP_LEN_MAX + 0.01);
        // обе точки на отрезке между центрами (с боковым сдвигом полос) и ближе к соседней клетке, чем её центр
        for (const p of [st.from, st.head[0]]) {
          expect(Math.min(Math.hypot(p.x - a.x, p.y - a.y), Math.hypot(p.x - b.x, p.y - b.y))).toBeLessThanOrEqual(L.cell);
        }
      });
    }
  });

  it("номера шагов не мельче NUM_FONT_MIN (10×10 — тоже), значение под номером не крупнее 0.42 клетки и не касается номера", () => {
    for (const s of SAMPLES.filter((x) => x.numbered)) {
      const L = gridLayout(s);
      expect(L.numFont).toBeGreaterThanOrEqual(NUM_FONT_MIN - 0.01);
      for (const nl of L.numLabels.values()) expect(nl.font).toBeGreaterThanOrEqual(NUM_FONT_MIN - 0.01);
      for (const b of L.blocks) {
        const nl = L.numLabels.get(b.key);
        if (!nl || b.value === "") continue;
        const numBottom = b.y + 2 + nl.font * 0.95;
        const valueTop = b.textY - b.fontSize * 0.36;
        expect(valueTop, `клетка ${b.key}`).toBeGreaterThanOrEqual(numBottom - 1.5);
      }
    }
  });

  it("10×10: «1,3» — компактно, в клетке, а повторный переход туда и обратно идёт двумя параллельными стрелками", () => {
    const s = SAMPLES.find((x) => x.rows === 10 && x.numbered)!;
    const L = gridLayout(s);
    expect(L.numLabels.get("0:0")!.text).toBe("1,3");
    expect(estimateTextWidth("1,3", L.numLabels.get("0:0")!.font)).toBeLessThanOrEqual(L.cell - 4);
    // шаги 1 и 2: (0,0)→(0,1) и обратно — одна пара клеток, стрелки сдвинуты поперёк на STEP_LANE и смотрят в разные стороны
    const [s1, s2] = L.steps;
    expect(Math.abs(s1.from.y - s2.from.y)).toBeGreaterThanOrEqual(STEP_LANE - 0.01);
    expect(Math.sign(s1.head[0].x - s1.from.x)).toBe(-Math.sign(s2.head[0].x - s2.from.x));
  });

  it("стрелки шагов не задевают номера обхода в углах клеток (вертикальные при номерах сдвинуты вправо, горизонтальные — на уровне значений)", () => {
    for (const s of withSteps.filter((x) => x.numbered)) {
      const L = gridLayout(s);
      expect(L.steps.length).toBeGreaterThan(0);
      for (const st of L.steps) {
        for (const [k, nl] of L.numLabels) {
          const [r, c] = k.split(":").map(Number);
          const box = { x0: L.ox + c * L.cell + 2, x1: L.ox + c * L.cell + 2.5 + estimateTextWidth(nl.text, nl.font), y0: L.oy + r * L.cell + 2, y1: L.oy + r * L.cell + 2 + nl.font };
          expect(hitsBox(stepPoints(st), box, 1), `стрелка задевает номер «${nl.text}» (клетка ${k})`).toBe(false);
        }
      }
    }
    // вертикальные шаги четырёхклеточной матрицы действительно сдвинуты вправо от центра клетки
    const four = gridLayout(withSteps.find((x) => x.rows === 4 && x.numbered)!);
    const vertical = four.steps.filter((st) => Math.abs(st.head[0].x - st.from.x) < 0.5);
    expect(vertical.length).toBeGreaterThan(0);
    for (const st of vertical) expect(st.from.x - (four.ox + 3 * four.cell + four.cell / 2)).toBeGreaterThan(four.cell * 0.15);
  });

  it("путь из одной клетки со значением — кольцо внутри клетки, а не кружок в центре; без значения — точка", () => {
    const withValue = SAMPLES.find((x) => x.path?.length === 1 && x.values)!;
    const L = gridLayout(withValue);
    expect(L.ring).not.toBeNull();
    expect(L.ring!.x).toBeGreaterThan(L.ox);
    expect(L.ring!.x + L.ring!.w).toBeLessThan(L.ox + L.cell);
    expect(L.ring!.y + L.ring!.h).toBeLessThan(L.oy + L.cell);
    const html = renderToStaticMarkup(createElement(SceneView, { scene: withValue }));
    expect(html).not.toMatch(/<circle[^>]*fill="var\(--ink-primary\)"/);
    expect(html).toContain('stroke="var(--ink-primary)"');
    // пустая клетка: ring нет, точка есть
    const empty: G = { kind: "grid", rows: 2, cols: 2, path: [[0, 0]] };
    expect(gridLayout(empty).ring).toBeNull();
    expect(renderToStaticMarkup(createElement(SceneView, { scene: empty }))).toMatch(/<circle[^>]*fill="var\(--ink-primary\)"/);
  });

  it("без значений путь — ломаная через центры (без коротких стрелок); цвет — ink-primary, не бледнее 0.9", () => {
    const s = SAMPLES.find((x) => (x.path?.length ?? 0) >= 2 && !x.values)!;
    const L = gridLayout(s);
    expect(L.steps).toHaveLength(0);
    const html = renderToStaticMarkup(createElement(SceneView, { scene: s }));
    expect(html).toContain("<polyline");
    expect(html).toContain('stroke="var(--ink-primary)"');
    expect(html).toContain('stroke-opacity="0.9"');
    expect(html).not.toContain("var(--primary-strong)");
  });

  it("образец «Объединённая ячейка»: после A1:B1 следующая ячейка строки — C1", () => {
    const s = SAMPLES.find((x) => x.merges?.length === 1 && x.caption)!;
    expect(s.values![0]).toEqual(["A1", "", "C1"]);
  });
});
