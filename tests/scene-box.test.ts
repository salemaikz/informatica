import { describe, expect, it } from "vitest";
import { SAMPLES } from "@/components/scenes/samples/box";
import { BLOCK2_H, BOX_MAX_W, CONTENT_H, CONTENT_W, LAYER_STROKE, bandThickness, boxGeometry, boxRuler, contentWidth, formatSides, layerDim, rulerText, sides4 } from "@/components/scenes/box";

const maxSide = { kind: "box" as const, width: 2000, padding: 200, border: 200, margin: 200, total: true };

describe("box: стороны", () => {
  it("одно число и четыре", () => {
    expect(sides4(5)).toEqual([5, 5, 5, 5]);
    expect(sides4([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
    expect(sides4(undefined)).toEqual([0, 0, 0, 0]);
    expect(formatSides(20)).toBe("20");
    expect(formatSides([10, 20, 10, 20])).toBe("10 20 10 20");
  });
  it("ширина content при border-box = width − padding − border", () => {
    expect(contentWidth({ kind: "box", width: 200, padding: 20, border: 5, borderBox: true })).toBe(150);
    expect(contentWidth({ kind: "box", width: 200, padding: 20, border: 5 })).toBe(200);
  });
});

describe("box: толщины", () => {
  it("ноль — полосы нет; больше значение — не тоньше", () => {
    expect(bandThickness("margin", 0, true)).toBe(0);
    let prev = 0;
    for (const v of [1, 5, 10, 20, 50, 100, 200]) {
      const th = bandThickness("padding", v, true);
      expect(th).toBeGreaterThanOrEqual(prev);
      prev = th;
    }
  });
  it("полоса вмещает число: боковая — по ширине, верх/низ — по высоте строки", () => {
    expect(bandThickness("border", 200, true)).toBeGreaterThanOrEqual(24);
    expect(bandThickness("margin", 1, false)).toBeGreaterThanOrEqual(19);
  });
  it("худший случай (все стороны 200, три цифры, с рамками слоёв) не шире сцены на 360 px (304)", () => {
    const g = boxGeometry(maxSide);
    expect(g.outerW).toBeLessThanOrEqual(BOX_MAX_W);
    expect(g.outerW).toBeGreaterThan(g.contentW);
  });
  it("все образцы не шире 304 px", () => {
    for (const s of SAMPLES) expect(boxGeometry(s).outerW).toBeLessThanOrEqual(BOX_MAX_W);
  });
  it("ширина = content + полосы + рамки видимых слоёв; полосы слева и справа симметричны", () => {
    const s = { kind: "box" as const, width: 200, padding: 20, border: 5, margin: 10 };
    const g = boxGeometry(s);
    const bands = [g.margin, g.border, g.padding].reduce((a, b) => a + b[1] + b[3], 0);
    const strokes = 2 * (LAYER_STROKE.margin + LAYER_STROKE.border + LAYER_STROKE.padding);
    expect(g.outerW).toBe(CONTENT_W + bands + strokes);
    expect(g.outerH).toBe(CONTENT_H + [g.margin, g.border, g.padding].reduce((a, b) => a + b[0] + b[2], 0) + strokes);
    for (const b of [g.margin, g.border, g.padding]) expect(b[1]).toBe(b[3]);
  });
  it("невидимый слой рамок не добавляет", () => {
    const g = boxGeometry({ kind: "box", width: 200, padding: 20 });
    expect(g.outerW).toBe(CONTENT_W + g.padding[1] + g.padding[3] + 2 * LAYER_STROKE.padding);
  });
  it("слой без сторон не виден, подписей у нулевых сторон нет", () => {
    const g = boxGeometry({ kind: "box", width: 240, border: 4, margin: [0, 24, 0, 24] });
    expect(g.visible).toEqual({ margin: true, border: true, padding: false, content: true });
    expect(g.labelled.margin).toEqual([false, true, false, true]);
    expect(g.margin[0]).toBe(0);
  });
  it("подпись content: «200 × auto» и с высотой; длинная сжимается", () => {
    expect(boxGeometry({ kind: "box", width: 200 }).contentLabel).toBe("200 × auto");
    expect(boxGeometry({ kind: "box", width: 160, height: 80 }).contentLabel).toBe("160 × 80");
    expect(boxGeometry({ kind: "box", width: 2000, height: 123456789012 }).contentFont).toBeLessThan(12);
  });
});

describe("box: линейка", () => {
  it("content-box: сумма всех слоёв", () => {
    const r = boxRuler({ kind: "box", width: 200, padding: 20, border: 5, margin: 10, total: true });
    expect(rulerText(r)).toBe("10 + 5 + 20 + 200 + 20 + 5 + 10 = 270 px");
  });
  it("нулевые стороны не пишем", () => {
    const r = boxRuler({ kind: "box", width: 160, padding: 12, total: true });
    expect(rulerText(r)).toBe("12 + 160 + 12 = 184 px");
  });
  it("border-box: width = border + padding + content + …, затем margin", () => {
    const r = boxRuler({ kind: "box", width: 250, padding: 25, border: 10, margin: 15, borderBox: true, total: true });
    expect(r).toHaveLength(2);
    expect(rulerText(r)).toBe("width 250 = 10 + 25 + 180 + 25 + 10; 15 + 250 + 15 = 280 px");
  });
  it("border-box без margin по бокам — одна строка", () => {
    const r = boxRuler({ kind: "box", width: 200, padding: [10, 20, 10, 20], border: 0, margin: [30, 0, 30, 0], borderBox: true, total: true });
    expect(r).toHaveLength(1);
    expect(rulerText(r)).toBe("width 200 = 20 + 160 + 20");
  });
  it("слагаемые линейки дают итог", () => {
    for (const s of SAMPLES.filter((x) => !x.borderBox)) {
      const line = boxRuler(s)[0];
      const total = line.terms.reduce((a, t) => a + Number(t.text), 0);
      expect(`${total} px`).toBe(line.total);
    }
  });
});

describe("box: схлопывание margin", () => {
  it("зазор — больший из двух, подпись max(a, b)", () => {
    const g = boxGeometry({ kind: "box", width: 200, padding: 10, margin: [0, 0, 10, 0], collapse: { top: 20 } });
    expect(g.collapse?.max).toBe(20);
    expect(g.collapse?.label).toBe("max(10, 20) = 20 px");
  });
  it("нижний margin больше — он и побеждает; у нижнего margin первого блока подписи нет", () => {
    const g = boxGeometry({ kind: "box", width: 180, margin: [0, 10, 40, 10], collapse: { top: 15 } });
    expect(g.collapse?.label).toBe("max(40, 15) = 40 px");
    expect(g.labelled.margin[2]).toBe(false);
    expect(g.labelled.margin[1]).toBe(true);
  });
  it("зазор вмещает подпись; блок 2 не уходит выше блока 1 (полоса margin заходит, но не выше его рамки)", () => {
    for (const s of SAMPLES.filter((x) => x.collapse)) {
      const c = boxGeometry(s).collapse!;
      expect(c.gapH).toBeGreaterThanOrEqual(24);
      expect(c.gapH).toBeGreaterThanOrEqual(c.dA);
      expect(c.gapH).toBeGreaterThanOrEqual(c.dB);
      // верх второго блока на экране = нижняя граница рамки первого + gapH
      expect(c.block2Top + c.dB + c.dA + c.mStroke).toBe(c.gapH);
      // подпись — посередине зазора между нижней рамкой border-слоя первого блока и верхом второго
      const g = boxGeometry(s);
      expect(c.labelTop).toBe(g.outerH - c.dA - c.mStroke + c.gapH / 2);
      expect(g.totalH).toBe(g.outerH + c.block2Top + c.dB + BLOCK2_H);
    }
    expect(BLOCK2_H).toBeGreaterThan(0);
  });
  it("без margin совсем: зазор — минимум, подпись max(0, 25)", () => {
    const g = boxGeometry({ kind: "box", width: 180, padding: 10, collapse: { top: 25 } });
    expect(g.collapse?.label).toBe("max(0, 25) = 25 px");
    expect(g.collapse?.dA).toBe(0);
  });
});

describe("box: подсветка", () => {
  it("без highlight никто не приглушён; с ним — все, кроме выбранного", () => {
    expect(layerDim("margin", undefined)).toBe(false);
    expect(layerDim("padding", "padding")).toBe(false);
    expect(layerDim("margin", "padding")).toBe(true);
    expect(layerDim("content", "padding")).toBe(true);
  });
});
