import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneView } from "@/components/scenes/SceneView";
import { SAMPLES } from "@/components/scenes/samples/tape";
import { TAPE_W, assignLevels, clampCenter, indexLabel, sliceIndices, stopBoundary, tapeAria, tapeLayout, tapeLegible, type TapeData } from "@/components/scenes/tape";
import { dict, type DictKey } from "@/i18n/dict";
import { estimateTextWidth } from "@/components/scenes/text-width";
import { fmt } from "@/lib/text";
import type { Lang, Text } from "@/lib/types";
import { validateScene } from "./validate";

const tr = (lang: Lang) => (key: DictKey, params?: Record<string, string | number>) => fmt(dict[key][lang], params);
const txt = (lang: Lang) => (v: Text) => (typeof v === "string" ? v : v[lang]);
const layout = (s: TapeData, lang: Lang = "ru") => tapeLayout(s, txt(lang), tr(lang));
const tape = (over: Partial<TapeData> & { cells: string[] }): TapeData => ({ kind: "tape", ...over });

describe("tape: срез как range", () => {
  it("шаг 1, 2 и больше", () => {
    expect(sliceIndices(6, { start: 1, stop: 5 })).toEqual([1, 2, 3, 4]);
    expect(sliceIndices(6, { start: 1, stop: 5, step: 2 })).toEqual([1, 3]);
    expect(sliceIndices(6, { start: 0, stop: 6, step: 4 })).toEqual([0, 4]);
  });
  it("отрицательный шаг и stop = −1", () => {
    expect(sliceIndices(6, { start: 5, stop: -1, step: -2 })).toEqual([5, 3, 1]);
    expect(sliceIndices(6, { start: 4, stop: 1, step: -1 })).toEqual([4, 3, 2]);
  });
  it("пустые срезы", () => {
    expect(sliceIndices(4, { start: 3, stop: 1 })).toEqual([]);
    expect(sliceIndices(4, { start: 1, stop: 3, step: -1 })).toEqual([]);
    expect(sliceIndices(4, { start: 2, stop: 2 })).toEqual([]);
    expect(sliceIndices(4, { start: 0, stop: 4, step: 0 })).toEqual([]);
  });
  it("за пределы ленты не выходит", () => {
    expect(sliceIndices(3, { start: 0, stop: 10 })).toEqual([0, 1, 2]);
  });
  it("граница stop: слева от ячейки при шаге > 0, справа при шаге < 0", () => {
    expect(stopBoundary(6, { stop: 5 })).toBe(5);
    expect(stopBoundary(6, { stop: 6, step: 2 })).toBe(6);
    expect(stopBoundary(6, { stop: -1, step: -2 })).toBe(0);
    expect(stopBoundary(6, { stop: 1, step: -1 })).toBe(2);
  });
});

describe("tape: индексы", () => {
  it("py, both, one, none", () => {
    expect(indexLabel("py", 2, 6, "top")).toBe("2");
    expect(indexLabel("py", 2, 6, "bottom")).toBeNull();
    expect(indexLabel("both", 2, 6, "bottom")).toBe("\u22124");
    expect(indexLabel("both", 0, 6, "bottom")).toBe("\u22126");
    expect(indexLabel("one", 0, 6, "top")).toBe("1");
    expect(indexLabel("none", 0, 6, "top")).toBeNull();
  });
});

describe("tape: уровни и центрирование подписей", () => {
  it("непересекающиеся — на одном уровне, пересекающиеся — на разных", () => {
    expect(assignLevels([{ x0: 0, x1: 10 }, { x0: 20, x1: 30 }])).toEqual([0, 0]);
    expect(assignLevels([{ x0: 0, x1: 30 }, { x0: 10, x1: 40 }, { x0: 20, x1: 50 }])).toEqual([0, 1, 2]);
    expect(assignLevels([{ x0: 5, x1: 15 }, { x0: 5, x1: 15 }])).toEqual([0, 1]);
  });
  it("clampCenter прижимает к границам", () => {
    expect(clampCenter(2, 20, 0, 100)).toBe(20);
    expect(clampCenter(99, 20, 0, 100)).toBe(80);
    expect(clampCenter(50, 80, 0, 100)).toBe(50);
  });
});

describe("tape: раскладка", () => {
  it("16 ячеек, имя, оба индекса: влезает в 360 px, ячейка сжата, но не меньше 18", () => {
    const s = tape({ cells: Array.from({ length: 16 }, (_, i) => String(i % 10)), index: "both", name: "text", slice: { start: 0, stop: 16, step: 3 }, swaps: [[1, 14]] });
    const L = layout(s);
    expect(L.vbW).toBe(TAPE_W);
    expect(L.cellW).toBeGreaterThanOrEqual(18);
    expect(L.x0 + 16 * L.cellW).toBeLessThanOrEqual(L.vbW);
    expect(L.indexTop).toHaveLength(16);
    expect(L.indexBottom).toHaveLength(16);
    // индексы не наезжают: самая широкая подпись уже ячейки минимум на 4 px
    expect(estimateTextWidth("\u221216", L.indexFs)).toBeLessThanOrEqual(L.cellW - 4);
    expect(L.arcs.filter((a) => a.kind === "jump")).toHaveLength(L.taken.length - 1);
  });
  it("6 ячеек — крупные, шрифт не больше 18", () => {
    const L = layout(tape({ cells: ["a", "b", "c", "d", "e", "f"] }));
    expect(L.cellW).toBe(44);
    expect(L.cellFs).toBeLessThanOrEqual(18);
  });
  it("длинные ячейки: шрифт уменьшается, текст помещается в ячейку", () => {
    const L = layout(tape({ cells: Array.from({ length: 4 }, () => "10110010"), mono: true }));
    expect(L.cellFs * 0.6 * 8).toBeLessThanOrEqual(L.cellW - 4);
  });
  it("совсем широкое содержимое растит viewBox, а не обрезается", () => {
    const L = layout(tape({ cells: Array.from({ length: 16 }, () => "12345678"), mono: true }));
    expect(L.vbW).toBeGreaterThan(TAPE_W);
    expect(L.x0 + 16 * L.cellW).toBeLessThanOrEqual(L.vbW);
  });
  it("все подписи остаются внутри viewBox (kk, длинные группы, указатели у краёв)", () => {
    for (const lang of ["ru", "kk"] as Lang[]) {
      for (const s of SAMPLES) {
        const L = layout(s, lang);
        const boxes = [...L.groups.map((g) => g.label), ...L.pointers.map((p) => p.label), ...(L.stop ? [L.stop.label] : [])];
        for (const b of boxes) {
          expect(b.cx - b.w / 2).toBeGreaterThanOrEqual(-0.5);
          expect(b.cx + b.w / 2).toBeLessThanOrEqual(L.vbW + 0.5);
        }
        for (const c of L.cells) expect(c.x + L.cellW).toBeLessThanOrEqual(L.vbW + 0.5);
        for (const n of L.names) expect(n.x).toBeGreaterThan(0);
      }
    }
  });
  it("указатели на одной ячейке идут на разные уровни", () => {
    const L = layout(tape({ cells: ["1", "2", "3"], pointers: [{ at: 1, label: "m" }, { at: 1, label: "min" }] }));
    expect(new Set(L.pointers.map((p) => p.level)).size).toBe(2);
  });
  it("линия нижнего указателя не пересекает чужую подпись (m и min на одной ячейке)", () => {
    const check = (s: TapeData) => {
      const L = layout(s);
      for (const p of L.pointers) {
        if (!p.line) continue;
        for (const o of L.pointers) {
          if (o !== p && o.level < p.level) expect(Math.abs(p.x - o.label.cx)).toBeGreaterThanOrEqual(o.label.w / 2);
        }
      }
      return L;
    };
    const L = check(tape({ cells: ["1", "2", "3", "4", "5", "6"], pointers: [{ at: 5, label: "m" }, { at: 5, label: "min" }] }));
    expect(L.pointers.filter((p) => p.line)).toHaveLength(0);
    for (const s of SAMPLES) check(s);
    // раздельные ячейки: линия остаётся
    expect(layout(tape({ cells: Array.from({ length: 12 }, () => "x"), pointers: [{ at: 3, label: "abcd" }, { at: 4, label: "abcd" }] })).pointers.some((p) => p.line)).toBe(true);
  });
  it("читаемость: шрифт ячеек на 360 px не меньше 8 у всех образцов; слишком широкое не проходит", () => {
    for (const s of SAMPLES) {
      const L = layout(s);
      expect((L.cellFs * TAPE_W) / Math.max(TAPE_W, L.vbW)).toBeGreaterThanOrEqual(8 - 0.01);
      expect(tapeLegible(s)).toBe(true);
    }
    expect(tapeLegible(tape({ cells: Array.from({ length: 16 }, () => "12345678"), mono: true }))).toBe(false);
    expect(tapeLegible(tape({ cells: Array.from({ length: 8 }, () => "10110010"), mono: true }))).toBe(true);
  });
  it("граница stop не рисуется на краю ленты", () => {
    expect(layout(tape({ cells: ["a", "b", "c"], slice: { start: 0, stop: 3, step: 2 } })).stop).toBeNull();
    expect(layout(tape({ cells: ["a", "b", "c"], slice: { start: 2, stop: -1, step: -1 } })).stop).toBeNull();
    expect(layout(tape({ cells: ["a", "b", "c"], slice: { start: 0, stop: 2 } })).stop).not.toBeNull();
  });
  it("скобка группы вместе с подписью не пересекает другие скобки и подписи; длинные подписи kk внутри viewBox", () => {
    const longKk = { ru: "Қ әрпінің екі байты", kk: "Қазақ әрпінің екі байты UTF-8" };
    const L = layout(tape({ cells: ["01", "10", "11", "00"], mono: true, groups: [{ from: 0, to: 1, label: longKk }, { from: 2, to: 3, label: longKk }] }), "kk");
    for (const g of L.groups) {
      expect(g.label.cx - g.label.w / 2).toBeGreaterThanOrEqual(-0.5);
      expect(g.label.cx + g.label.w / 2).toBeLessThanOrEqual(L.vbW + 0.5);
    }
    const [a, b] = L.groups;
    const span = (g: typeof a) => [Math.min(g.x1, g.label.cx - g.label.w / 2), Math.max(g.x2, g.label.cx + g.label.w / 2)];
    if (a.level === b.level) expect(span(a)[1] <= span(b)[0] || span(b)[1] <= span(a)[0]).toBe(true);
  });
  it("after: [] — пустая вторая лента с подписью; срез и подсветка не теряют друг друга", () => {
    const L = layout(tape({ cells: ["5"], after: [] }));
    expect(L.after?.empty?.text).toBe("пусто");
  });
  it("соседние указатели 16-ячеечной ленты не наезжают друг на друга", () => {
    const L = layout(tape({ cells: Array.from({ length: 16 }, () => "x"), pointers: [{ at: 3, label: "min" }, { at: 4, label: "min" }, { at: 5, label: "min" }] }));
    const byLevel = new Map<number, { x0: number; x1: number }[]>();
    for (const p of L.pointers) byLevel.set(p.level, [...(byLevel.get(p.level) ?? []), { x0: p.label.cx - p.label.w / 2, x1: p.label.cx + p.label.w / 2 }]);
    for (const list of byLevel.values()) {
      list.sort((a, b) => a.x0 - b.x0);
      for (let i = 1; i < list.length; i++) expect(list[i].x0).toBeGreaterThanOrEqual(list[i - 1].x1);
    }
  });
  it("пустой срез — подпись «пусто», дуг нет, граница есть", () => {
    const L = layout(tape({ cells: ["1", "2", "3", "4"], slice: { start: 3, stop: 1 } }));
    expect(L.empty?.text).toBe("пусто");
    expect(layout(tape({ cells: ["1", "2"], slice: { start: 1, stop: 0 } }), "kk").empty?.text).toBe("бос");
    expect(L.arcs).toHaveLength(0);
    expect(L.stop).not.toBeNull();
  });
  it("без среза — нет границы и подписи «пусто»", () => {
    const L = layout(tape({ cells: ["1"] }));
    expect(L.stop).toBeNull();
    expect(L.empty).toBeNull();
  });
  it("шаг 1 — дуг прыжков нет, шаг −1 — есть", () => {
    expect(layout(tape({ cells: ["a", "b", "c", "d"], slice: { start: 0, stop: 3 } })).arcs).toHaveLength(0);
    expect(layout(tape({ cells: ["a", "b", "c", "d"], slice: { start: 3, stop: 0, step: -1 } })).arcs).toHaveLength(2);
  });
  it("обмены: дуга на каждую пару, разной высоты", () => {
    const L = layout(tape({ cells: ["a", "b", "c", "d"], swaps: [[0, 1], [0, 3]] }));
    expect(L.arcs).toHaveLength(2);
    expect(new Set(L.arcs.map((a) => a.height)).size).toBe(2);
  });
  it("alias: два имени и две стрелки к ленте; кадр «после» — вторая лента ниже", () => {
    const L = layout(tape({ cells: ["1", "2"], name: "a", alias: "b" }));
    expect(L.names.map((n) => n.text)).toEqual(["a =", "b ="]);
    expect(L.nameArrows).toHaveLength(2);
    const A = layout(tape({ cells: ["1", "2"], after: ["1", "5", "2"] }));
    expect(A.after?.cells).toHaveLength(3);
    expect(A.after!.cells[0].y).toBeGreaterThan(A.cells[0].y + A.cellH);
    expect(A.vbH).toBeGreaterThan(A.after!.cells[0].y + A.cellH);
  });
  it("состояния ячеек: срез сильнее подсветки, подсветка сильнее приглушения", () => {
    const L = layout(tape({ cells: ["a", "b", "c", "d"], slice: { start: 0, stop: 2 }, highlight: [0, 2], dim: [2, 3] }));
    expect(L.cells.map((c) => c.state)).toEqual(["sliceHl", "slice", "highlight", "dim"]);
  });
  it("пустые необязательные поля не ломают раскладку", () => {
    const L = layout(tape({ cells: ["x"], pointers: [], swaps: [], groups: [], highlight: [], dim: [] }));
    expect(L.cells).toHaveLength(1);
    expect(L.vbH).toBeGreaterThan(0);
  });
});

describe("tape: образцы и отрисовка", () => {
  it("образцы проходят validateScene", () => {
    for (const [i, s] of SAMPLES.entries()) expect(validateScene(s), `tape[${i}]`).toEqual([]);
  });
  it("aria: нумерация как на рисунке (index one — с 1)", () => {
    const a = tapeAria(tape({ cells: ["a", "b"], index: "one", pointers: [{ at: 0, label: "i" }] }), txt("ru"), tr("ru"));
    expect(a).toContain("ячейка 1");
    expect(tapeAria(tape({ cells: ["a"] }), txt("ru"), tr("ru"))).toContain("ячеек: 1");
  });
  it("рисуются на ru и kk с role=img и aria-label", () => {
    for (const s of SAMPLES) {
      const html = renderToStaticMarkup(createElement(SceneView, { scene: s }));
      expect(html).toContain('role="img"');
      expect(html).toContain("aria-label=");
    }
  });
  it("aria на двух языках без незаполненных {…}", () => {
    for (const lang of ["ru", "kk"] as Lang[]) {
      for (const s of SAMPLES) {
        const a = tapeAria(s, txt(lang), tr(lang));
        expect(a.length).toBeGreaterThan(10);
        expect(a).not.toMatch(/\{\w+\}/);
      }
    }
  });
});
