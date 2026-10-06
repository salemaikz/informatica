import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneView } from "@/components/scenes/SceneView";
import { SAMPLES } from "@/components/scenes/samples/tape";
import { TAPE_ARC_GAP, TAPE_GROUP_ROW, TAPE_INDEX_FS, TAPE_LABEL_DESC, TAPE_LABEL_FS, TAPE_LEGIBLE_FONT, TAPE_SWAP_SHIFT, TAPE_W, arcPoint, arcSegments, assignLevels, clampCenter, indexLabel, sliceIndices, stopBoundary, tapeAria, tapeLayout, tapeLegible, textWidth, withBridges, type TapeArc, type TapeData } from "@/components/scenes/tape";
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
    // нижние индексы «−16…−1» на узких ячейках — через одну (шрифт не мельчает), соседние подписи не слипаются: зазор ≥ 4 px
    expect(L.indexStrideBottom).toBe(2);
    expect(L.indexBottom).toHaveLength(8);
    expect(L.indexFs).toBeGreaterThanOrEqual(11);
    expect(estimateTextWidth("\u221216", L.indexFs)).toBeLessThanOrEqual(L.indexStrideBottom * L.cellW - 4);
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
  it("указатели на одной ячейке: помещаются рядом — в ряд на нулевом уровне, иначе — на разных уровнях", () => {
    // ячейка 44 px: «m» и «min» рядом, стрелка над каждой подписью
    const wide = layout(tape({ cells: ["1", "2", "3"], pointers: [{ at: 1, label: "m" }, { at: 1, label: "min" }] }));
    expect(wide.pointers.map((p) => p.level)).toEqual([0, 0]);
    expect(wide.pointers[0].x).toBeLessThan(wide.pointers[1].x);
    // ячейка ≈ 18 px (16 ячеек): рядом не помещаются — разные уровни
    const narrow = layout(tape({ cells: Array.from({ length: 16 }, () => "x"), pointers: [{ at: 3, label: "m" }, { at: 3, label: "min" }] }));
    expect(new Set(narrow.pointers.map((p) => p.level)).size).toBe(2);
  });
  it("стрелки указателей одного вида: у каждой остриё над своей ячейкой, стебель не проходит сквозь подпись ближнего уровня", () => {
    const check = (s: TapeData, name: string) => {
      const L = layout(s);
      for (const p of L.pointers) {
        expect(p.arrow, `${name}: «${p.label.text}» без стрелки`).toBe(true);
        // остриё — над своей ячейкой (не дальше её края)
        const cell = L.cells[p.at];
        expect(p.x, `${name}: «${p.label.text}»`).toBeGreaterThan(cell.x);
        expect(p.x).toBeLessThan(cell.x + L.cellW);
        // низ стебля — над подписью своего уровня; уровень 0 тоже со стеблем (одного вида со всеми)
        expect(p.yEnd).toBeLessThan(p.label.y - 5);
        expect(p.yEnd).toBeGreaterThan(p.yTop + 4);
        for (const o of L.pointers) {
          if (o !== p && o.level < p.level) expect(Math.abs(p.x - o.label.cx), `${name}: стебель «${p.label.text}» сквозь «${o.label.text}»`).toBeGreaterThanOrEqual(o.label.w / 2 + 1.5);
        }
      }
      return L;
    };
    // m и min на одной узкой ячейке: стебель нижней сдвинут за край верхней подписи, но остриё осталось над той же ячейкой
    const L = check(tape({ cells: Array.from({ length: 16 }, () => "x"), pointers: [{ at: 5, label: "m" }, { at: 5, label: "min" }] }), "узкие");
    const [m, min] = L.pointers;
    expect(min.level).toBe(1);
    expect(min.x).not.toBe(m.x);
    // m и min на широкой ячейке (6 ячеек по 44 px) — рядом, без длинного стебля
    const W = check(tape({ cells: ["1", "2", "3", "4", "5", "6"], pointers: [{ at: 5, label: "m" }, { at: 5, label: "min" }] }), "широкие");
    expect(W.pointers.every((p) => p.level === 0)).toBe(true);
    for (const s of SAMPLES) check(s, "образец");
    // раздельные ячейки: стрелка у каждого над центром своей ячейки
    const sep = layout(tape({ cells: Array.from({ length: 12 }, () => "x"), pointers: [{ at: 3, label: "abcd" }, { at: 4, label: "abcd" }] }));
    for (const p of sep.pointers) expect(p.x).toBeCloseTo(sep.cells[p.at].x + sep.cellW / 2, 5);
  });
  it("указатели в одном ряду не налезают друг на друга; образцы «m, min» и «i, j, min» — в один ряд (без длинного стебля)", () => {
    for (const s of SAMPLES) {
      const L = layout(s);
      for (const a of L.pointers)
        for (const b of L.pointers) {
          if (a === b || a.level !== b.level) continue;
          const gap = Math.abs(a.label.cx - b.label.cx) - (a.label.w + b.label.w) / 2;
          expect(gap).toBeGreaterThanOrEqual(0);
        }
    }
    // 8-ячеечный двоичный поиск: «l», «m», «min», «r» — все на нулевом уровне
    const bs = SAMPLES.find((x) => x.pointers?.some((p) => p.label === "min") && x.pointers.some((p) => p.label === "m"))!;
    expect(layout(bs).pointers.map((p) => p.level)).toEqual([0, 0, 0, 0]);
    // 16 ячеек, образец «i, j, min»: тоже в один ряд (бывший «длинный стебель» min)
    const worst = SAMPLES.find((x) => x.swaps && x.slice && x.pointers)!;
    expect(layout(worst).pointers.map((p) => p.level)).toEqual([0, 0, 0]);
  });
  it("читаемость: шрифт ячеек на 360 px не меньше TAPE_LEGIBLE_FONT (≈ 10 px на экране) у всех образцов; слишком широкое не проходит", () => {
    for (const s of SAMPLES) {
      const L = layout(s);
      expect((L.cellFs * TAPE_W) / Math.max(TAPE_W, L.vbW)).toBeGreaterThanOrEqual(TAPE_LEGIBLE_FONT - 0.01);
      expect(tapeLegible(s)).toBe(true);
    }
    expect(tapeLegible(tape({ cells: Array.from({ length: 16 }, () => "12345678"), mono: true }))).toBe(false);
    expect(tapeLegible(tape({ cells: Array.from({ length: 8 }, () => "10110010"), mono: true }))).toBe(true);
    // по три знака в 360 px (с именем «A =») читаемым кеглем помещаются 10–11 ячеек (предел), по два — 16, по одному — тоже 16
    const row = (n: number, text: string) => tape({ cells: Array.from({ length: n }, () => text), name: "A" });
    expect(tapeLegible(row(16, "120"))).toBe(false);
    expect(tapeLegible(row(12, "120"))).toBe(false);
    expect(tapeLegible(row(10, "120"))).toBe(true);
    expect(tapeLegible(row(16, "99"))).toBe(true);
    expect(tapeLegible(row(16, "x"))).toBe(true);
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

// ---------- Ревью v18: границы, байты, скобки, индексы, цвета ----------

describe("tape: ревью v18", () => {
  const html = (s: TapeData) => renderToStaticMarkup(createElement(SceneView, { scene: s }));

  it("пунктир границы «не включая» начинается ниже подписи (с «хвостами» букв), а не режет её — во всех образцах, ru и kk", () => {
    let seen = 0;
    for (const lang of ["ru", "kk"] as Lang[])
      for (const s of SAMPLES) {
        const L = layout(s, lang);
        if (!L.stop) continue;
        seen++;
        // низ подписи: базовая линия (центр + 0.35 em) плюс хвосты букв; пунктир с круглым колпачком (радиус 1) стартует ниже
        const labelBottom = L.stop.label.y + TAPE_LABEL_FS * 0.35 + TAPE_LABEL_DESC;
        expect(L.stop.y1 - 1, `${lang}: «${L.stop.label.text}»`).toBeGreaterThanOrEqual(labelBottom + 1);
        // и подпись, и пунктир — внутри рисунка, а над индексами оставлено место
        expect(L.stop.y1).toBeLessThan(L.stop.y2);
        expect(L.stop.label.y - TAPE_LABEL_FS).toBeGreaterThanOrEqual(0);
      }
    expect(seen).toBeGreaterThanOrEqual(4);
  });

  it("байты UTF-8: биты в ячейках не мельче читаемого кегля (ячейки расширены), строка влезает в 360 px", () => {
    const s = SAMPLES.find((x) => x.mono && x.cells[0].length === 8)!;
    const L = layout(s);
    expect(L.cellFs).toBeGreaterThanOrEqual(TAPE_LEGIBLE_FONT);
    expect(L.vbW).toBe(TAPE_W);
    expect(L.cellW).toBeGreaterThan(44);
    expect(L.textLines).toBe(1);
    // 8 битов в одну строку помещаются в ячейку с запасом по 2 px
    expect(textWidth("01001011", L.cellFs, true)).toBeLessThanOrEqual(L.cellW - 4);
    for (const c of L.cells) expect(c.lines).toEqual([c.text]);
  });

  it("8 байт подряд: биты переносятся на две строки по 4, шрифт не мельче читаемого, высота ячейки растёт", () => {
    const L = layout(tape({ cells: Array.from({ length: 8 }, () => "10110010"), mono: true, index: "none" }));
    expect(L.textLines).toBe(2);
    expect(L.cellFs).toBeGreaterThanOrEqual(TAPE_LEGIBLE_FONT);
    expect(L.vbW).toBe(TAPE_W);
    for (const c of L.cells) {
      expect(c.lines).toEqual(["1011", "0010"]);
      for (const ln of c.lines) expect(textWidth(ln, L.cellFs, true)).toBeLessThanOrEqual(L.cellW - 4);
    }
    expect(L.cellH).toBeGreaterThanOrEqual(2 * L.lineH + 10);
    expect(tapeLegible(tape({ cells: Array.from({ length: 8 }, () => "10110010"), mono: true }))).toBe(true);
  });

  it("односимвольные и короткие ячейки не расширяются зря", () => {
    const L = layout(tape({ cells: Array.from({ length: 16 }, () => "x") }));
    expect(L.textLines).toBe(1);
    expect(L.cellW).toBeLessThan(30);
    const six = layout(tape({ cells: ["a", "b", "c", "d", "e", "f"] }));
    expect(six.cellW).toBe(44);
  });

  it("скобки групп разных ярусов: ножки верхней не касаются подписи нижней (по x и по y зазор ≥ 2 px)", () => {
    const mono = SAMPLES.find((x) => x.groups && x.groups.length >= 3)!;
    const many = tape({
      cells: ["01", "10", "11", "00", "01", "10"],
      mono: true,
      groups: [
        { from: 0, to: 0, label: { ru: "К · 1 байт", kk: "К · 1 байт" } },
        { from: 1, to: 3, label: { ru: "Қ · 3 байта", kk: "Қ · 3 байт" } },
        { from: 4, to: 5, label: { ru: "ab · 2 байта", kk: "ab · 2 байт" } },
      ],
    });
    for (const lang of ["ru", "kk"] as Lang[])
      for (const s of [mono, many]) {
        const L = layout(s, lang);
        for (const upper of L.groups) {
          for (const lower of L.groups) {
            if (upper.level <= lower.level) continue;
            // ножки верхней скобки: x1 и x2, от линии вниз на 5 px (+1 толщина); подпись нижней — прямоугольник текста
            const legsBottom = upper.y + 5 + 1;
            const labelTop = lower.label.y - TAPE_LABEL_FS * 0.55;
            const labelBox = { x1: lower.label.cx - lower.label.w / 2, x2: lower.label.cx + lower.label.w / 2 };
            for (const lx of [upper.x1, upper.x2]) {
              const overX = lx > labelBox.x1 - 1 && lx < labelBox.x2 + 1;
              if (overX) expect(labelTop - legsBottom, `${lang}: ножка x=${lx} над «${lower.label.text}»`).toBeGreaterThanOrEqual(2);
            }
          }
        }
        // ярусы разнесены на TAPE_GROUP_ROW
        const levels = [...new Set(L.groups.map((g) => g.level))].sort();
        if (levels.length > 1) {
          const ys = levels.map((lv) => L.groups.find((g) => g.level === lv)!.y);
          expect(ys[0] - ys[1]).toBeCloseTo(TAPE_GROUP_ROW, 5);
        }
      }
  });

  it("индексы: кегль не мельче TAPE_INDEX_FS; на узких ячейках — через один, зазор между подписями ≥ 4 px", () => {
    for (const s of SAMPLES) {
      const L = layout(s);
      if (!L.indexTop.length && !L.indexBottom.length) continue;
      expect(L.indexFs).toBeGreaterThanOrEqual(TAPE_INDEX_FS);
      for (const row of [L.indexTop, L.indexBottom]) {
        for (let i = 1; i < row.length; i++) {
          const a = row[i - 1];
          const b = row[i];
          const gap = b.x - a.x - (estimateTextWidth(a.text, L.indexFs) + estimateTextWidth(b.text, L.indexFs)) / 2;
          expect(gap, `«${a.text}» и «${b.text}»`).toBeGreaterThanOrEqual(4 - 0.01);
        }
      }
    }
    // широкие ячейки — подписаны все
    const L = layout(tape({ cells: ["a", "b", "c", "d", "e", "f"], index: "both" }));
    expect(L.indexStrideTop).toBe(1);
    expect(L.indexStrideBottom).toBe(1);
    expect(L.indexBottom).toHaveLength(6);
  });

  it("цвета: текст на -soft-заливке — ink-*; подписи указателей — не жёлтые буквы (gold смешан с цветом текста), tone success/warning/primary — ink", () => {
    const out = html(tape({ cells: ["a", "b", "c"], slice: { start: 0, stop: 2 }, highlight: [2], pointers: [{ at: 0, label: "l", tone: "primary" }, { at: 1, label: "m", tone: "warning" }, { at: 2, label: "min", tone: "gold" }] }));
    expect(out).toContain('fill="var(--ink-primary)"');
    expect(out).toContain('fill="var(--ink-warning)"');
    expect(out).not.toContain('fill="var(--primary-strong)"');
    expect(out).not.toContain('fill="var(--warning-strong)"');
    // золото как текст — смесь с цветом текста; сам --gold остаётся для стрелки-указателя
    expect(out).toContain("color-mix(in srgb, var(--gold) 55%, var(--text))");
    expect(out).not.toMatch(/<text[^>]*fill="var\(--gold\)"/);
  });

  it("образец двоичного поиска: «m» и «min» на одной ячейке — разных тонов, и «min» не золотой", () => {
    const bs = SAMPLES.find((x) => x.pointers?.some((p) => p.label === "min") && x.pointers.some((p) => p.label === "m"))!;
    const tones = bs.pointers!.filter((p) => p.at === 5).map((p) => p.tone);
    expect(new Set(tones).size).toBe(tones.length);
    expect(tones).not.toContain("gold");
  });
});

// ---------- Доделка ревью v18: кегль в узких ячейках, мосты над дугами, стрелки указателей ----------

describe("tape: кегль в узких ячейках (16 в ряд)", () => {
  it("16 ячеек с одиночными знаками: кегль не мельче читаемого (12), а не cellW × 0.52 = 9; текст помещается в ячейку", () => {
    const worst = SAMPLES.find((x) => x.swaps && x.slice && x.cells.length === 16)!;
    const L = layout(worst);
    expect(L.cellW).toBeLessThanOrEqual(19);
    expect(L.cellFs).toBeGreaterThanOrEqual(TAPE_LEGIBLE_FONT);
    expect(L.vbW).toBe(TAPE_W);
    for (const c of L.cells) expect(textWidth(c.text, L.cellFs, false)).toBeLessThanOrEqual(L.cellW - 4);
  });
  it("16 ячеек с числами до двух знаков: кегль 12, «99» целиком в ячейке; «120» (три знака) — в ленте из 10 ячеек, тоже ≥ 12", () => {
    const two = SAMPLES.find((x) => x.cells.length === 16 && x.cells.some((c) => c.length === 2))!;
    const L = layout(two);
    expect(L.cellFs).toBeGreaterThanOrEqual(TAPE_LEGIBLE_FONT);
    for (const c of L.cells) expect(textWidth(c.text, L.cellFs, false)).toBeLessThanOrEqual(L.cellW - 4);
    const three = SAMPLES.find((x) => x.cells.some((c) => c.length === 3))!;
    const L3 = layout(three);
    expect(L3.cellFs).toBeGreaterThanOrEqual(TAPE_LEGIBLE_FONT);
    for (const c of L3.cells) expect(textWidth(c.text, L3.cellFs, false)).toBeLessThanOrEqual(L3.cellW - 4);
  });
  it("кегль ячейки не мельче читаемого у всех образцов, у широких ячеек — по-прежнему не крупнее 18", () => {
    for (const s of SAMPLES) {
      const L = layout(s);
      expect(L.cellFs).toBeGreaterThanOrEqual(TAPE_LEGIBLE_FONT);
      expect(L.cellFs).toBeLessThanOrEqual(18);
    }
  });
});

describe("tape: дуги шага и дуги обмена не сплетаются", () => {
  const worst = SAMPLES.find((x) => x.swaps && x.slice && x.cells.length === 16)!;
  const nearest = (a: TapeArc, t: number, b: TapeArc) => {
    const [px, py] = arcPoint(a, t);
    let best = Infinity;
    for (let i = 0; i <= 600; i++) {
      const [qx, qy] = arcPoint(b, i / 600);
      best = Math.min(best, Math.hypot(px - qx, py - qy));
    }
    return best;
  };
  const above = (b: TapeArc, a: TapeArc) => (b.kind === "swap" && a.kind === "jump") || (b.kind === a.kind && b.height > a.height);

  it("arcPoint: концы на нижней линии, вершина на заданной высоте; arcSegments без разрывов — один путь, с разрывом — два и они обходят вырез", () => {
    const a = { xa: 10, xb: 110, y: 50, height: 20 };
    expect(arcPoint(a, 0)).toEqual([10, 50]);
    expect(arcPoint(a, 1)).toEqual([110, 50]);
    expect(arcPoint(a, 0.5)).toEqual([60, 30]);
    expect(arcSegments({ ...a, cuts: [] })).toHaveLength(1);
    const parts = arcSegments({ ...a, cuts: [[0.4, 0.5]] });
    expect(parts).toHaveLength(2);
    const nums = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const first = nums(parts[0]);
    const second = nums(parts[1]);
    // первый кусок кончается в точке t = 0.4, второй начинается в точке t = 0.5
    const e = arcPoint(a, 0.4);
    const b = arcPoint(a, 0.5);
    expect(first[first.length - 2]).toBeCloseTo(e[0], 1);
    expect(first[first.length - 1]).toBeCloseTo(e[1], 1);
    expect(second[0]).toBeCloseTo(b[0], 1);
    expect(second[1]).toBeCloseTo(b[1], 1);
  });

  it("дуга обмена выше дуг шага на ярус (не меньше 4 px над самой высокой дугой шага)", () => {
    const L = layout(worst);
    const jumpMax = Math.max(...L.arcs.filter((a) => a.kind === "jump").map((a) => a.height));
    for (const a of L.arcs.filter((x) => x.kind === "swap")) expect(a.height).toBeGreaterThanOrEqual(jumpMax + 4);
  });

  it("конец обмена на ячейке дуги шага сдвинут: острия стрелок не слипаются (≥ ширины острия 7 px)", () => {
    const L = layout(worst);
    const jumpX = L.arcs.filter((a) => a.kind === "jump").flatMap((a) => [a.xa, a.xb]);
    for (const sw of L.arcs.filter((a) => a.kind === "swap"))
      for (const x of [sw.xa, sw.xb]) for (const jx of jumpX) expect(Math.abs(x - jx), `swap ${sw.key}: x=${x}`).toBeGreaterThanOrEqual(7 - 1e-6);
    // сдвиг — по свободной стороне и не больше TAPE_SWAP_SHIFT, остриё остаётся над своей ячейкой
    const s23 = L.arcs.find((a) => a.key.startsWith("s2-3"))!;
    expect(Math.abs(s23.xb - (L.cells[3].x + L.cellW / 2))).toBeCloseTo(TAPE_SWAP_SHIFT, 5);
    expect(Math.abs(s23.xb - (L.cells[3].x + L.cellW / 2))).toBeLessThanOrEqual(L.cellW / 2);
    // обмен на ячейке без дуги шага — по центру
    expect(s23.xa).toBeCloseTo(L.cells[2].x + L.cellW / 2, 5);
    // без среза с шагом — никакого сдвига
    const plain = layout(tape({ cells: ["a", "b", "c", "d"], swaps: [[0, 3]] }));
    expect(plain.arcs[0].xa).toBeCloseTo(plain.cells[0].x + plain.cellW / 2, 5);
    expect(plain.arcs[0].xb).toBeCloseTo(plain.cells[3].x + plain.cellW / 2, 5);
  });

  it("мосты: в каждом месте, где верхняя дуга касается нижней (не у самых ячеек), у нижней есть разрыв; лишних разрывов нет", () => {
    const L = layout(worst);
    let cutsTotal = 0;
    for (const a of L.arcs) {
      // разрывы упорядочены, не пересекаются, внутри (0, 1)
      let prev = 0;
      for (const [c0, c1] of a.cuts) {
        expect(c0).toBeGreaterThanOrEqual(prev);
        expect(c1).toBeGreaterThan(c0);
        expect(c1).toBeLessThanOrEqual(1);
        prev = c1;
        cutsTotal++;
        // у разрыва есть причина: в его пределах дуга касается более высокой
        let touched = false;
        for (let i = 0; i <= 60 && !touched; i++) {
          const t = c0 + ((c1 - c0) * i) / 60;
          touched = L.arcs.some((b) => b !== a && above(b, a) && nearest(a, t, b) <= 1);
        }
        expect(touched, `разрыв ${a.key} [${c0.toFixed(2)}, ${c1.toFixed(2)}] без пересечения`).toBe(true);
      }
      // обратное: каждая точка касания (расстояние ≤ 1 px, выше 3 px над ячейками) лежит внутри разрыва
      for (let i = 0; i <= 400; i++) {
        const t = i / 400;
        if (a.y - arcPoint(a, t)[1] < 3) continue;
        if (!L.arcs.some((b) => b !== a && above(b, a) && nearest(a, t, b) <= 1)) continue;
        expect(a.cuts.some(([c0, c1]) => t >= c0 - 1e-9 && t <= c1 + 1e-9), `${a.key}: касание на t=${t.toFixed(3)} без разрыва`).toBe(true);
      }
    }
    expect(cutsTotal).toBeGreaterThanOrEqual(4);
    // разрыв шире штриха верхней дуги (2 px) с запасом: не меньше 2·TAPE_ARC_GAP при перпендикулярном пересечении
    const jump03 = L.arcs.find((a) => a.key === "j0-3")!;
    expect(jump03.cuts.length).toBeGreaterThanOrEqual(2);
    const k = jump03.height / 0.75;
    const width = (c: [number, number]) => {
      const t = (c[0] + c[1]) / 2;
      return (c[1] - c[0]) * Math.hypot((jump03.xb - jump03.xa) * (6 * t - 6 * t * t), 3 * k * (1 - 2 * t));
    };
    for (const c of jump03.cuts) expect(width(c)).toBeGreaterThanOrEqual(2 * (TAPE_ARC_GAP - 1) + 1);
  });

  it("без пересечений разрывов нет: только обмены (вложенные), только шаг, один обмен над шагом вне его пролёта", () => {
    for (const s of SAMPLES.filter((x) => !(x.swaps && x.slice))) for (const a of layout(s).arcs) expect(a.cuts, `${a.key}`).toEqual([]);
    const nested = layout(tape({ cells: ["a", "b", "c", "d", "e", "f"], swaps: [[0, 5], [2, 3]] }));
    for (const a of nested.arcs) expect(a.cuts).toEqual([]);
    // перекрывающиеся обмены (0↔2 и 1↔3) пересекаются, и у нижней дуги разрыв
    const crossing = layout(tape({ cells: ["a", "b", "c", "d", "e", "f"], swaps: [[0, 2], [1, 3]] }));
    expect(crossing.arcs.some((a) => a.cuts.length > 0)).toBe(true);
  });

  it("withBridges: порядок и ключи сохраняются, исходные поля не теряются", () => {
    const arcs = [
      { key: "a", xa: 0, xb: 100, y: 40, height: 12, kind: "jump" as const },
      { key: "b", xa: 50, xb: 150, y: 40, height: 30, kind: "swap" as const },
    ];
    const out = withBridges(arcs);
    expect(out.map((o) => o.key)).toEqual(["a", "b"]);
    expect(out[0].cuts.length).toBeGreaterThan(0);
    expect(out[1].cuts).toEqual([]);
  });

  it("в разметке: куски дуг без обводки-закруглений на разрыве, острия отдельно; стрелка у каждого указателя — остриё и стебель", () => {
    const html = renderToStaticMarkup(createElement(SceneView, { scene: worst }));
    const L = layout(worst);
    const pieces = L.arcs.reduce((n, a) => n + arcSegments(a).length, 0);
    const heads = L.arcs.reduce((n, a) => n + (a.kind === "swap" ? 2 : 1), 0);
    expect((html.match(/<path d="M [^"]*C [^"]*"/g) ?? []).length).toBe(pieces);
    expect((html.match(/<path d="M [-\d.]+ [-\d.]+ L [-\d.]+ [-\d.]+ L [-\d.]+ [-\d.]+" stroke-linecap="round"/g) ?? []).length).toBe(heads);
    expect(html).toContain('stroke="var(--ink-warning)"');
    expect(html).not.toContain("warning-strong");
    // стебель — у каждого указателя (в том числе нулевого уровня), остриё — треугольник
    const stems = html.match(/<line x1="0" x2="0"/g) ?? [];
    expect(stems).toHaveLength(L.pointers.filter((p) => p.arrow).length);
    expect((html.match(/d="M -4\.5 6 L 0 0 L 4\.5 6 Z"/g) ?? []).length).toBe(L.pointers.length);
    expect(html).not.toContain('opacity="0.6"');
  });
});
