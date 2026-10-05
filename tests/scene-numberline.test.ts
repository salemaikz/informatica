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
  labelRect,
  placePointLabels,
  type NlInput,
  type NlLayout,
  type Rect,
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
    expect(g.drops.every((d) => d.segs.length >= 1)).toBe(true);
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
  it("пустой ход: видны и start, и stop (оба выколоты), start подписан", () => {
    const L = layoutNumberline(input({ rows: [{ jumps: { start: 5, stop: 3, step: 1 } }] }));
    const j = L.rows[0].jumps!;
    expect(j.dots).toHaveLength(2);
    expect(j.dots.every((d) => d.open)).toBe(true);
    expect(j.arcs).toHaveLength(0);
    expect(L.ticks.find((t) => t.v === 5)?.label).toBe("5");
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
    expect(numberlineAria(inp, tr("ru"))).toContain("плюс бесконечности");
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

// ---------- Обязательные подписи, пунктиры, радиус ----------

const TICK_FONT = 11;
const labelled = (L: NlLayout) => new Map(L.ticks.filter((t) => t.label).map((t) => [t.v, t]));

/** Подписи делений на одном уровне не пересекаются. */
function expectTickLabelsApart(L: NlLayout) {
  const shown = L.ticks.filter((t) => t.label);
  for (const a of shown) {
    for (const b of shown) {
      if (a.v >= b.v || a.level !== b.level) continue;
      const gap = b.x - a.x - (estimateTextWidth(a.label!, TICK_FONT) + estimateTextWidth(b.label!, TICK_FONT)) / 2;
      expect(gap, `${a.label} и ${b.label}`).toBeGreaterThanOrEqual(2.9);
    }
  }
}

describe("обязательные подписи делений не теряются", () => {
  it("конец промежутка [9; 10) на оси −20..20 подписан", () => {
    const L = layoutNumberline({ min: -20, max: 20, rows: [{ label: "x", ranges: [{ from: 9, to: 10, fromIn: true }] }] });
    const m = labelled(L);
    for (const v of [-20, 9, 10, 20]) expect(m.has(v), String(v)).toBe(true);
    expectTickLabelsApart(L);
  });
  it("соседние концы [3; 4) на оси 0..40 с длинной подписью", () => {
    const L = layoutNumberline({ min: 0, max: 40, rows: [{ label: "қиылысуы (ортақ)", ranges: [{ from: 3, to: 4 }] }] });
    const m = labelled(L);
    for (const v of [0, 3, 4, 40]) expect(m.has(v), String(v)).toBe(true);
    expectTickLabelsApart(L);
  });
  it("range(0, 20) на 40 делениях: подписаны start и stop", () => {
    const L = layoutNumberline({ min: 0, max: 40, rows: [{ label: "range(0, 20)", jumps: { start: 0, stop: 20, step: 1 } }] });
    const m = labelled(L);
    for (const v of [0, 20, 40]) expect(m.has(v), String(v)).toBe(true);
    expectTickLabelsApart(L);
  });
  it("точки на каждом целом −20..20: все подписаны, на нескольких уровнях, высота растёт", () => {
    const pts = Array.from({ length: 41 }, (_, i) => ({ at: i - 20 }));
    const L = layoutNumberline({ min: -20, max: 20, rows: [{ points: pts }] });
    expect(labelled(L).size).toBe(41);
    expect(Math.max(...L.ticks.map((t) => t.level))).toBeGreaterThanOrEqual(1);
    expectTickLabelsApart(L);
    expect(L.h).toBeGreaterThan(layoutNumberline({ min: -20, max: 20, rows: [{ points: [{ at: 0 }] }] }).h);
  });
  it("явный список ticks подписан целиком", () => {
    const L = layoutNumberline({ min: 0, max: 40, ticks: [10, 11, 12, 30], rows: [{ points: [{ at: 1 }] }] });
    for (const v of [10, 11, 12, 30]) expect(labelled(L).has(v)).toBe(true);
    expectTickLabelsApart(L);
  });
  it('ticks "all": 0, min, max и концы подписаны, подписи не пересекаются', () => {
    const a = layoutNumberline({ min: 0, max: 15, ticks: "all", rows: [{ label: "range(0, 15)", jumps: { start: 0, stop: 15, step: 1 } }] });
    expect(labelled(a).has(15)).toBe(true);
    expect(labelled(a).has(0)).toBe(true);
    expectTickLabelsApart(a);
    const b = layoutNumberline({ min: -7, max: 8, ticks: "all", rows: [{ label: "x ≥ −7", ranges: [{ from: -7, to: null, fromIn: true }] }] });
    for (const v of [-7, 0, 8]) expect(labelled(b).has(v), String(v)).toBe(true);
    expectTickLabelsApart(b);
  });
});

describe("пунктиры не идут по подписям", () => {
  const rectsOf = (L: NlLayout) => {
    const rs: Rect[] = [];
    for (const row of L.rows) {
      if (row.label) rs.push(labelRect(row.label, estimateTextWidth));
      for (const p of row.points) if (p.label) rs.push(labelRect(p.label, estimateTextWidth));
    }
    return rs;
  };
  for (const lang of ["ru", "kk"] as const) {
    it(`образцы на ${lang}: ни один отрезок пунктира не пересекает прямоугольник подписи`, () => {
      for (const [i, s] of SAMPLES.entries()) {
        const pick = (t: unknown) => (typeof t === "string" || t === undefined ? (t as string | undefined) : (t as Record<Lang, string>)[lang]);
        const L = layoutNumberline({
          min: s.min,
          max: s.max,
          ticks: s.ticks,
          rows: s.rows.map((r) => ({ ...r, label: pick(r.label), points: r.points?.map((p) => ({ ...p, label: pick(p.label) })) })) as NlInput["rows"],
        });
        const rs = rectsOf(L);
        for (const row of L.rows)
          for (const g of row.ranges)
            for (const d of g.drops)
              for (const [ya, yb] of d.segs)
                for (const q of rs) {
                  const hit = d.x >= q.x1 && d.x <= q.x2 && ya < q.y2 && yb > q.y1;
                  expect(hit, `образец ${i}, x=${d.x}`).toBe(false);
                }
      }
    });
  }
  it("образец 5 (kk): пунктиры всё же рисуются (не вырезаны целиком)", () => {
    const s = SAMPLES[5];
    const L = layoutNumberline({
      min: s.min,
      max: s.max,
      rows: s.rows.map((r) => ({ ...r, label: typeof r.label === "object" ? r.label.kk : r.label, points: undefined })),
    });
    const total = L.rows.flatMap((r) => r.ranges.flatMap((g) => g.drops.flatMap((d) => d.segs))).length;
    expect(total).toBeGreaterThan(0);
  });
});

describe("радиус кружков зависит от деления", () => {
  const worst: NlInput[] = [
    { min: 0, max: 40, rows: [{ label: "range(0, 20)", jumps: { start: 0, stop: 20, step: 1 } }] },
    { min: -20, max: 20, rows: [{ points: Array.from({ length: 41 }, (_, i) => ({ at: i - 20 })) }] },
    { min: 0, max: 20, ticks: "all", rows: [{ label: "range(0, 20): каждое число", jumps: { start: 0, stop: 20, step: 1 } }] },
  ];
  it("соседние кружки не налезают друг на друга", () => {
    for (const inp of worst) {
      const L = layoutNumberline(inp);
      const unit = L.xOf(1) - L.xOf(0);
      expect(2 * (L.r + L.sw / 2), JSON.stringify(inp.rows[0].jumps ?? "points")).toBeLessThanOrEqual(unit + 0.01);
    }
  });
  it("на крупной шкале радиус не больше 5.5, на густой — меньше", () => {
    expect(layoutNumberline({ min: 0, max: 4, rows: [{ points: [{ at: 1 }] }] }).r).toBe(5.5);
    expect(layoutNumberline(worst[0]).r).toBeLessThan(3);
  });
  it("дуги короче 10 px без наконечников, длинные — с ними", () => {
    const dense = layoutNumberline(worst[0]).rows[0].jumps!;
    expect(dense.arcs.every((a) => a.head === "")).toBe(true);
    const sparse = layoutNumberline(input({ rows: [{ jumps: { start: 0, stop: 9, step: 3 } }] })).rows[0].jumps!;
    expect(sparse.arcs.every((a) => a.head !== "")).toBe(true);
  });
});

describe("образцы: оба языка, подписи", () => {
  it("на ru и kk обязательные значения подписаны, подписи делений не пересекаются, внутри экрана", () => {
    for (const lang of ["ru", "kk"] as const) {
      for (const s of SAMPLES) {
        const pick = (t: unknown) => (typeof t === "string" || t === undefined ? (t as string | undefined) : (t as Record<Lang, string>)[lang]);
        const L = layoutNumberline({
          min: s.min,
          max: s.max,
          ticks: s.ticks,
          rows: s.rows.map((r) => ({ ...r, label: pick(r.label), points: r.points?.map((p) => ({ ...p, label: pick(p.label) })) })) as NlInput["rows"],
        });
        const m = labelled(L);
        if (Array.isArray(s.ticks)) {
          // явный список — подписи ровно по выбору автора
          for (const v of s.ticks) expect(m.has(v)).toBe(true);
          expectTickLabelsApart(L);
          continue;
        }
        expect(m.has(s.min) && m.has(s.max)).toBe(true);
        for (const r of s.rows) {
          for (const g of r.ranges ?? []) {
            if (g.from !== null) expect(m.has(g.from)).toBe(true);
            if (g.to !== null) expect(m.has(g.to)).toBe(true);
          }
          for (const p of r.points ?? []) expect(m.has(p.at)).toBe(true);
          if (r.jumps) {
            expect(m.has(r.jumps.start)).toBe(true);
            expect(m.has(r.jumps.stop)).toBe(true);
          }
        }
        expectTickLabelsApart(L);
        for (const t of L.ticks) {
          if (!t.label) continue;
          const w = estimateTextWidth(t.label, TICK_FONT);
          expect(t.x - w / 2).toBeGreaterThanOrEqual(0);
          expect(t.x + w / 2).toBeLessThanOrEqual(NL_W);
        }
      }
    }
  });
  it("validate ограничивает длину подписей", () => {
    const long = "a".repeat(41);
    expect(validateScene({ kind: "numberline", min: 0, max: 5, rows: [{ label: long, ranges: [{ from: 1, to: 2 }] }] } as Scene).length).toBeGreaterThan(0);
    expect(validateScene({ kind: "numberline", min: 0, max: 5, rows: [{ points: [{ at: 1, label: "b".repeat(21) }] }] } as Scene).length).toBeGreaterThan(0);
  });
  it("грамматика описания: ru — родительный падеж, kk — без «мен» после слова", () => {
    const inp: NlInput = { min: 0, max: 10, rows: [{ ranges: [{ from: null, to: 7, toIn: true }] }] };
    expect(numberlineAria(inp, tr("ru"))).toContain("от минус бесконечности до 7");
    expect(numberlineAria(inp, tr("kk"))).not.toMatch(/шексіздік мен/);
  });
});
