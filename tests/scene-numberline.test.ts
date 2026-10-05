import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneView } from "@/components/scenes/SceneView";
import { SAMPLES } from "@/components/scenes/samples/numberline";
import {
  NL_W,
  arcPath,
  fmtNum,
  jumpValues,
  layoutNumberline,
  numberlineAria,
  placePointLabels,
  type NlInput,
} from "@/components/scenes/numberline";
import { estimateTextWidth } from "@/components/scenes/text-width";
import { dict, type DictKey } from "@/i18n/dict";
import { fmt } from "@/lib/text";
import type { Lang, Scene } from "@/lib/types";
import { validateScene } from "./validate";

const tr = (lang: Lang) => (key: DictKey, params?: Record<string, string | number>) => fmt(dict[key][lang], params);

const input = (over: Partial<NlInput> = {}): NlInput => ({ min: 0, max: 10, rows: [{ ranges: [{ from: 2, to: 5 }] }], ...over });

describe("прыжки как range", () => {
  it("положительный и отрицательный шаг, stop не берётся", () => {
    expect(jumpValues(2, 9, 3)).toEqual([2, 5, 8]);
    expect(jumpValues(9, 2, -3)).toEqual([9, 6, 3]);
    expect(jumpValues(0, 20, 1)).toHaveLength(20);
  });
  it("пустой ход и шаг 0", () => {
    expect(jumpValues(5, 5, 1)).toEqual([]);
    expect(jumpValues(5, 2, 1)).toEqual([]);
    expect(jumpValues(1, 5, 0)).toEqual([]);
  });
});

describe("раскладка оси", () => {
  it("шкала линейна, края внутри экрана", () => {
    const L = layoutNumberline(input());
    expect(L.xOf(0)).toBeCloseTo(L.x0);
    expect(L.xOf(10)).toBeCloseTo(L.x1);
    expect(L.xOf(5)).toBeCloseTo((L.x0 + L.x1) / 2);
    expect(L.x0 - 12).toBeGreaterThanOrEqual(0);
    expect(L.x1 + 12).toBeLessThanOrEqual(NL_W);
  });
  it("короткая подпись — слева, длинная — над строкой, ось не сужается", () => {
    const left = layoutNumberline(input({ rows: [{ label: "x > 3", ranges: [{ from: 3, to: null }] }] }));
    expect(left.leftLabels).toBe(true);
    expect(left.rows[0].label?.anchor).toBe("start");
    expect(left.rows[0].label!.y).toBeCloseTo(left.rows[0].y + 4.5);
    const above = layoutNumberline(input({ rows: [{ label: "очень длинная подпись строки оси", ranges: [{ from: 3, to: null }] }] }));
    expect(above.leftLabels).toBe(false);
    expect(above.rows[0].label!.y).toBeLessThan(above.rows[0].y);
    expect(above.x0).toBeLessThan(left.x0);
  });
  it("длинная подпись над строкой уменьшает шрифт и не выходит за экран", () => {
    const text = "қиылысуы (ортақ бөлігі) және тағы бір ұзын жолақ мәтін";
    const L = layoutNumberline(input({ rows: [{ label: text, ranges: [{ from: 3, to: 4 }] }] }));
    const lb = L.rows[0].label!;
    expect(lb.font).toBeLessThan(13);
    expect(estimateTextWidth(text, lb.font)).toBeLessThanOrEqual(NL_W - 16 + 1);
  });
  it("строки идут сверху вниз и над осью", () => {
    const L = layoutNumberline(input({ rows: [{ ranges: [{ from: 1, to: 2 }] }, { ranges: [{ from: 2, to: 3 }] }, { points: [{ at: 4 }] }] }));
    expect(L.rows[0].y).toBeLessThan(L.rows[1].y);
    expect(L.rows[1].y).toBeLessThan(L.rows[2].y);
    expect(L.rows[2].y).toBeLessThan(L.axisY);
    expect(L.h).toBeGreaterThan(L.axisY);
  });
});

describe("промежутки", () => {
  it("конец входит — закрашен, не входит — выколот", () => {
    const g = layoutNumberline(input({ rows: [{ ranges: [{ from: 2, to: 6, toIn: true }] }] })).rows[0].ranges[0];
    expect(g.dots.map((d) => d.open)).toEqual([true, false]);
    expect(g.drops).toHaveLength(2);
  });
  it("луч — со стрелкой до края, без точки на бесконечности", () => {
    const L = layoutNumberline(input({ rows: [{ ranges: [{ from: 3, to: null }] }, { ranges: [{ from: null, to: 3, toIn: true }] }] }));
    const right = L.rows[0].ranges[0];
    expect(right.heads).toHaveLength(1);
    expect(right.dots).toHaveLength(1);
    expect(right.x2).toBeGreaterThan(L.x1);
    expect(right.x2).toBeLessThanOrEqual(NL_W);
    const left = L.rows[1].ranges[0];
    expect(left.x1).toBeLessThan(L.x0);
    expect(left.x1).toBeGreaterThanOrEqual(0);
  });
  it("вся ось: две стрелки", () => {
    const g = layoutNumberline(input({ rows: [{ ranges: [{ from: null, to: null }] }] })).rows[0].ranges[0];
    expect(g.heads).toHaveLength(2);
    expect(g.dots).toHaveLength(0);
  });
});

describe("деления", () => {
  it("по умолчанию — min, max, концы, точки", () => {
    const L = layoutNumberline(input());
    const labelled = L.ticks.filter((t) => t.label).map((t) => t.v);
    expect(labelled).toEqual(expect.arrayContaining([0, 2, 5, 10]));
    expect(labelled).not.toContain(7);
  });
  it("все 21 деление на 360 px: подписи не наезжают друг на друга", () => {
    const L = layoutNumberline(input({ min: 0, max: 20, ticks: "all" }));
    const shown = L.ticks.filter((t) => t.label);
    expect(shown.length).toBeGreaterThan(5);
    for (let i = 1; i < shown.length; i++) {
      const gap = shown[i].x - shown[i - 1].x - (estimateTextWidth(shown[i].label!, 11) + estimateTextWidth(shown[i - 1].label!, 11)) / 2;
      expect(gap).toBeGreaterThanOrEqual(3.9);
    }
    expect(L.ticks.map((t) => t.label).filter(Boolean)).toContain("20");
  });
  it("отрицательные подписи — с настоящим минусом, ширина 41 деление", () => {
    expect(fmtNum(-3)).toBe("−3");
    const L = layoutNumberline(input({ min: -20, max: 20 }));
    expect(L.ticks).toHaveLength(41);
    expect(L.ticks.find((t) => t.v === -20)?.label).toBe("−20");
  });
});

describe("точки и подписи", () => {
  it("близкие подписи уходят на второй уровень, края не выходят за экран", () => {
    const est = estimateTextWidth;
    const pl = placePointLabels(
      [
        { x: 180, text: "минимум" },
        { x: 190, text: "середина" },
        { x: 4, text: "левый край" },
        { x: 358, text: "правый край" },
      ],
      est,
    );
    expect(pl[0].level).toBe(0);
    expect(pl[1].level).toBe(1);
    expect(pl[2].level).toBe(0);
    expect(pl[3].level).toBe(0);
    for (const p of pl) {
      expect(p.x - p.w / 2).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w / 2).toBeLessThanOrEqual(NL_W);
    }
  });
  it("второй уровень подписей поднимает строку ниже", () => {
    const one = layoutNumberline(input({ rows: [{ points: [{ at: 5, label: "a" }] }] }));
    const two = layoutNumberline(input({ rows: [{ points: [{ at: 5, label: "минимум" }, { at: 6, label: "середина" }] }] }));
    expect(two.rows[0].y).toBeGreaterThan(one.rows[0].y);
    expect(two.rows[0].points[1].label!.y).toBeLessThan(two.rows[0].points[0].label!.y);
  });
  it("выколотая точка", () => {
    expect(layoutNumberline(input({ rows: [{ points: [{ at: 4, open: true }, { at: 5 }] }] })).rows[0].points.map((p) => p.open)).toEqual([true, false]);
  });
});

describe("прыжки на оси", () => {
  it("range(2, 9, 3): 3 числа закрашены, stop выколот, 2 дуги (8 + 3 не попадает в stop)", () => {
    const j = layoutNumberline(input({ rows: [{ jumps: { start: 2, stop: 9, step: 3 } }] })).rows[0].jumps!;
    expect(j.values).toEqual([2, 5, 8]);
    expect(j.dots.map((d) => d.open)).toEqual([false, false, false, true]);
    expect(j.arcs.map((a) => a.dashed)).toEqual([false, false]);
  });
  it("range(2, 8, 3): последняя дуга пунктиром доходит до выколотого stop", () => {
    const j = layoutNumberline(input({ rows: [{ jumps: { start: 2, stop: 8, step: 3 } }] })).rows[0].jumps!;
    expect(j.values).toEqual([2, 5]);
    expect(j.arcs.map((a) => a.dashed)).toEqual([false, true]);
  });
  it("отрицательный шаг — дуги идут влево", () => {
    const L = layoutNumberline(input({ rows: [{ jumps: { start: 9, stop: 2, step: -3 } }] }));
    const j = L.rows[0].jumps!;
    expect(j.values).toEqual([9, 6, 3]);
    const xs = j.dots.slice(0, 3).map((d) => d.x);
    expect(xs[0]).toBeGreaterThan(xs[1]);
    expect(j.arcs[0].d.startsWith(`M ${Math.round(xs[0] * 100) / 100}`)).toBe(true);
  });
  it("20 прыжков подряд: стока дуг, все внутри экрана", () => {
    const L = layoutNumberline(input({ max: 20, ticks: "all", rows: [{ jumps: { start: 0, stop: 20, step: 1 } }] }));
    expect(L.rows[0].jumps!.dots).toHaveLength(21);
    expect(L.rows[0].jumps!.arcs).toHaveLength(20);
    expect(L.rows[0].y).toBeGreaterThan(0);
  });
  it("пустой ход: только выколотый stop", () => {
    const j = layoutNumberline(input({ rows: [{ jumps: { start: 5, stop: 3, step: 1 } }] })).rows[0].jumps!;
    expect(j.dots).toHaveLength(1);
    expect(j.dots[0].open).toBe(true);
    expect(j.arcs).toHaveLength(0);
  });
  it("дуга: высота ограничена, наконечник на конце", () => {
    expect(arcPath(0, 400, 50).height).toBe(20);
    expect(arcPath(0, 5, 50).height).toBe(7);
    expect(arcPath(10, 40, 50).head.startsWith("40,50")).toBe(true);
  });
});

describe("описание для диктора", () => {
  const scene = SAMPLES[0];
  const inp: NlInput = {
    min: scene.min,
    max: scene.max,
    rows: [
      { label: "x > 3", ranges: [{ from: 3, to: null }] },
      { points: [{ at: -2, open: true, label: "A" }], jumps: { start: 2, stop: 9, step: 3 } },
    ],
  };
  it("ru и kk: без пустых подстановок", () => {
    for (const lang of ["ru", "kk"] as Lang[]) {
      const s = numberlineAria(inp, tr(lang));
      expect(s).not.toMatch(/\{\w+\}/);
      expect(s).toContain("x > 3");
      expect(s).toContain("2, 5, 8");
      expect(s).toContain("−2");
    }
    expect(numberlineAria(inp, tr("ru"))).toContain("плюс бесконечность");
    expect(numberlineAria(inp, tr("kk"))).toContain("шексіздік");
    expect(numberlineAria(inp, tr("ru"))).toContain("Строка 2");
  });
});

describe("образцы и отрисовка", () => {
  it("все образцы проходят проверку и рисуются с role=img на обоих языках", () => {
    for (const [i, s] of SAMPLES.entries()) {
      expect(validateScene(s as Scene), `образец ${i}`).toEqual([]);
      const html = renderToStaticMarkup(createElement(SceneView, { scene: s }));
      expect(html).toContain('role="img"');
      expect(html).toContain("aria-label=");
    }
  });
  it("в образцах нет выхода за экран: все элементы внутри 0..360", () => {
    for (const s of SAMPLES) {
      const L = layoutNumberline({
        min: s.min,
        max: s.max,
        ticks: s.ticks,
        rows: s.rows.map((r) => ({
          ...r,
          label: typeof r.label === "string" ? r.label : r.label?.kk,
          points: r.points?.map((p) => ({ ...p, label: typeof p.label === "string" ? p.label : p.label?.kk })),
        })),
      });
      for (const row of L.rows) {
        for (const g of row.ranges) {
          expect(g.x1).toBeGreaterThanOrEqual(0);
          expect(g.x2).toBeLessThanOrEqual(NL_W);
        }
        for (const p of row.points) {
          if (!p.label) continue;
          const w = estimateTextWidth(p.label.text, p.label.font);
          expect(p.label.x - w / 2).toBeGreaterThanOrEqual(0);
          expect(p.label.x + w / 2).toBeLessThanOrEqual(NL_W);
        }
        if (row.label && L.leftLabels) expect(estimateTextWidth(row.label.text, row.label.font) + 8).toBeLessThan(L.x0 - 12);
      }
    }
  });
});
