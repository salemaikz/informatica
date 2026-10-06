import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { SceneView } from "@/components/scenes/SceneView";
import { SAMPLES } from "@/components/scenes/samples/chart";
import {
  CHART_W,
  chartAria,
  chartLayout,
  fitText,
  formatNum,
  formatValue,
  funnelPercent,
  niceScale,
  sectorAngles,
  spreadLabels,
  type ChartInput,
} from "@/components/scenes/chart";
import { estimateTextWidth } from "@/components/scenes/text-width";
import { dict, type DictKey } from "@/i18n/dict";
import { fmt } from "@/lib/text";
import type { Lang, Scene, Text } from "@/lib/types";
import { validateScene } from "./validate";

const tr = (lang: Lang) => (key: DictKey, params?: Record<string, string | number>) => fmt(dict[key][lang], params);
const txt = (x: Text, lang: Lang) => (typeof x === "string" ? x : x[lang]);

function toInput(scene: Extract<Scene, { kind: "chart" }>, lang: Lang): ChartInput {
  const t = tr(lang);
  return {
    type: scene.type,
    labels: scene.labels.map((x) => txt(x, lang)),
    series: scene.series.map((s, i) => ({ name: s.name ? txt(s.name, lang) : undefined, values: s.values, tone: s.tone ?? (["primary", "gold", "success", "ai"] as const)[i % 4] })),
    values: !!scene.values,
    unit: scene.unit,
    threshold: scene.threshold && { value: scene.threshold.value, label: scene.threshold.label ? txt(scene.threshold.label, lang) : undefined },
    highlight: scene.highlight ?? [],
    funnel: !!scene.funnel,
    axes: scene.axes && { x: scene.axes.x ? txt(scene.axes.x, lang) : undefined, y: scene.axes.y ? txt(scene.axes.y, lang) : undefined },
    funnelFrom: t("scene.chart.funnelFrom"),
    funnelNote: t("scene.chart.funnelNote"),
  };
}

describe("шкала Y", () => {
  it("3–5 интервалов, шаг 1·2·5·10ᵏ, верхняя метка не меньше максимума", () => {
    for (const max of [0.3, 1, 1.5, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 37, 99, 100, 101, 250, 1234, 98000, 143000]) {
      const s = niceScale(max);
      const n = s.ticks.length - 1;
      expect(n, `max=${max}`).toBeGreaterThanOrEqual(3);
      expect(n, `max=${max}`).toBeLessThanOrEqual(5);
      expect(s.max, `max=${max}`).toBeGreaterThanOrEqual(max);
      expect(s.ticks[0]).toBe(0);
      const mant = s.step / Math.pow(10, Math.floor(Math.log10(s.step) + 1e-9));
      expect([1, 2, 5]).toContain(Math.round(mant * 1000) / 1000);
    }
  });
  it("нуль и мусор — шкала 0..1", () => {
    expect(niceScale(0).max).toBeGreaterThan(0);
    expect(niceScale(NaN).max).toBeGreaterThan(0);
  });
  it("примеры", () => {
    expect(niceScale(6).ticks).toEqual([0, 2, 4, 6]);
    expect(niceScale(10).ticks).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceScale(0.9).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });
});

describe("числа и текст", () => {
  it("formatNum / formatValue", () => {
    expect(formatNum(1250)).toBe("1250");
    expect(formatNum(125000)).toBe("125 000");
    expect(formatNum(2.5)).toBe("2,5");
    expect(formatValue(40, "%")).toBe("40%");
    expect(formatValue(40, "₸")).toBe("40 ₸");
    expect(formatValue(7)).toBe("7");
  });
  it("funnelPercent", () => {
    expect(funnelPercent(1000, 400)).toBe("40%");
    expect(funnelPercent(0, 5)).toBe("—");
    expect(funnelPercent(1, 20)).toBe(">999%");
  });
  it("fitText: всегда вмещает по ширине", () => {
    for (const text of ["Операциялық жүйелер", "Қолданбалар", "Ойындар және ойын-сауық", "Өте_ұзын_сөз_без_пробелдер_мұнда"]) {
      const f = fitText(text, 60, 11, 9, 2);
      for (const ln of f.lines) expect(estimateTextWidth(ln, f.font)).toBeLessThanOrEqual(60 + 0.01);
    }
  });
});

describe("секторы и подписи", () => {
  it("углы: сумма 2π, старт сверху, доли", () => {
    const s = sectorAngles([1, 1, 2]);
    expect(s[0].start).toBeCloseTo(-Math.PI / 2);
    expect(s[2].end - s[0].start).toBeCloseTo(Math.PI * 2);
    expect(s.map((x) => x.frac)).toEqual([0.25, 0.25, 0.5]);
  });
  it("spreadLabels: расстояния не меньше gap, внутри границ", () => {
    const out = spreadLabels([50, 51, 52, 53, 54], 14, 8, 200);
    const sorted = [...out].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(14 - 1e-9);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(8);
    const low = spreadLabels([199, 200, 201], 14, 8, 200);
    expect(Math.max(...low)).toBeLessThanOrEqual(200);
  });
});

const bar = (over: Partial<ChartInput> = {}): ChartInput => ({
  type: "bar",
  labels: ["A", "B", "C"],
  series: [{ values: [3, 5, 2], tone: "primary" }],
  values: true,
  highlight: [],
  funnel: false,
  funnelFrom: "от предыдущего",
  funnelNote: "% — доля",
  ...over,
});

describe("раскладка bar", () => {
  it("высота столбца пропорциональна значению, основания совпадают", () => {
    const lay = chartLayout(bar());
    if (lay.type !== "bar") throw new Error();
    const [a, b, c] = lay.bars;
    expect(b.h / a.h).toBeCloseTo(5 / 3, 5);
    expect(c.h / a.h).toBeCloseTo(2 / 3, 5);
    expect(a.y + a.h).toBeCloseTo(b.y + b.h);
    expect(lay.valuesHidden).toBe(false);
    expect(lay.valueLabels).toHaveLength(3);
  });
  it("нулевые значения — высота 0, без ошибок", () => {
    const lay = chartLayout(bar({ series: [{ values: [0, 0, 0], tone: "primary" }] }));
    if (lay.type !== "bar") throw new Error();
    expect(lay.bars.every((b) => b.h === 0)).toBe(true);
  });
  it("порог входит в шкалу", () => {
    const lay = chartLayout(bar({ threshold: { value: 90 } }));
    if (lay.type !== "bar") throw new Error();
    expect(lay.scale.max).toBeGreaterThanOrEqual(90);
    expect(lay.threshold?.y).toBeGreaterThanOrEqual(lay.plotTop);
  });
  it("highlight приглушает остальные", () => {
    const lay = chartLayout(bar({ highlight: [1] }));
    if (lay.type !== "bar") throw new Error();
    expect(lay.bars.map((b) => b.dim)).toEqual([true, false, true]);
  });
  it("воронка: проценты от предыдущего, у первого столбца подписи нет", () => {
    const lay = chartLayout(bar({ labels: ["a", "b", "c", "d"], series: [{ values: [1000, 400, 200, 50], tone: "primary" }], funnel: true }));
    if (lay.type !== "bar") throw new Error();
    expect(lay.funnelChips.map((c) => c.lines[0])).toEqual(["40%", "50%", "25%"]);
    expect(lay.funnelChips.every((c) => c.i > 0)).toBe(true);
  });
  it("воронка на узких столбцах: короткая подпись и пояснение внизу", () => {
    const labels = Array.from({ length: 12 }, (_, i) => String(i));
    const lay = chartLayout(bar({ labels, series: [{ values: labels.map((_, i) => 100 - i * 5), tone: "primary" }], funnel: true }));
    if (lay.type !== "bar") throw new Error();
    expect(lay.funnelChips[0].lines).toHaveLength(1);
    expect(lay.funnelNote).toBeDefined();
  });
  it("12 × 4: значения прячутся, всё в пределах холста", () => {
    const labels = Array.from({ length: 12 }, (_, i) => `Кат ${i}`);
    const series = (["primary", "gold", "success", "ai"] as const).map((tone, s) => ({ name: `С${s}`, values: labels.map((_, i) => i + s + 1), tone }));
    const lay = chartLayout(bar({ labels, series, values: true }));
    if (lay.type !== "bar") throw new Error();
    expect(lay.valuesHidden).toBe(true);
    for (const b of lay.bars) {
      expect(b.x).toBeGreaterThanOrEqual(lay.padL);
      expect(b.x + b.w).toBeLessThanOrEqual(CHART_W);
    }
    expect(lay.legend?.items).toHaveLength(4);
  });
  it("группы столбцов не пересекаются", () => {
    const lay = chartLayout(bar({ series: [{ name: "a", values: [1, 2, 3], tone: "primary" }, { name: "b", values: [3, 2, 1], tone: "gold" }] }));
    if (lay.type !== "bar") throw new Error();
    const sorted = [...lay.bars].sort((p, q) => p.x - q.x);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].x).toBeGreaterThanOrEqual(sorted[i - 1].x + sorted[i - 1].w - 1e-9);
  });
  it("подписи категорий: перенос в 2 строки, а при невозможности — наклон; в пределах слота", () => {
    const wrapped = chartLayout(bar({ labels: ["Игры и развлечения", "Браузеры", "Офис"] }));
    expect(wrapped.type === "bar" && wrapped.cats.rotate).toBe(false);
    const rotated = chartLayout(
      bar({ labels: Array.from({ length: 12 }, () => "Желтоқсан айындағы"), series: [{ values: Array(12).fill(1), tone: "primary" }] }),
    );
    expect(rotated.type === "bar" && rotated.cats.rotate).toBe(true);
    if (rotated.type === "bar") expect(rotated.h).toBeGreaterThan(rotated.plotTop + rotated.plotH + 20);
  });
  it("подписи осей добавляют место", () => {
    const a = chartLayout(bar());
    const b = chartLayout(bar({ axes: { x: "X", y: "Y" } }));
    expect(b.h).toBeGreaterThan(a.h);
  });
});

describe("раскладка line", () => {
  it("точки на высоте значения, ломаные по числу серий, пересечение видно", () => {
    const lay = chartLayout({
      type: "line",
      labels: ["1", "2", "3"],
      series: [
        { name: "a", values: [1, 5, 9], tone: "primary" },
        { name: "b", values: [9, 5, 1], tone: "ai" },
      ],
      values: true,
      highlight: [],
      funnel: false,
      funnelFrom: "",
      funnelNote: "",
    });
    if (lay.type !== "line") throw new Error();
    expect(lay.lines).toHaveLength(2);
    const mid = lay.points.filter((p) => p.i === 1);
    expect(mid[0].y).toBeCloseTo(mid[1].y);
    expect(lay.points.find((p) => p.s === 0 && p.i === 0)!.y).toBeGreaterThan(lay.points.find((p) => p.s === 0 && p.i === 2)!.y);
  });
  it("подписи значений не накладываются друг на друга", () => {
    const labels = Array.from({ length: 12 }, (_, i) => String(i));
    const lay = chartLayout({
      type: "line",
      labels,
      series: [
        { name: "a", values: labels.map((_, i) => 10 + i), tone: "primary" },
        { name: "b", values: labels.map((_, i) => 10 + i), tone: "gold" },
      ],
      values: true,
      highlight: [],
      funnel: false,
      funnelFrom: "",
      funnelNote: "",
    });
    if (lay.type !== "line") throw new Error();
    const boxes = lay.valueLabels.map((v) => ({ x1: v.x - estimateTextWidth(v.text, v.font) / 2, x2: v.x + estimateTextWidth(v.text, v.font) / 2, y1: v.y - v.font, y2: v.y }));
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        expect(a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1).toBe(false);
      }
    for (const v of lay.valueLabels) expect(v.x - estimateTextWidth(v.text, v.font) / 2).toBeGreaterThanOrEqual(0);
  });
});

describe("раскладка pie", () => {
  it("секторы, подписи не наезжают друг на друга и не выходят за холст", () => {
    for (const vals of [[1, 1, 1], [90, 3, 3, 2, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [5, 0, 5]]) {
      const lay = chartLayout({
        type: "pie",
        labels: vals.map((_, i) => `Категория ${i}`),
        series: [{ values: vals, tone: "primary" }],
        values: true,
        unit: "₸",
        highlight: [0],
        funnel: false,
        funnelFrom: "",
        funnelNote: "",
      });
      if (lay.type !== "pie") throw new Error();
      for (const side of ["start", "end"] as const) {
        const ys = lay.sectors.filter((s) => s.label?.anchor === side).map((s) => s.label!.y).sort((a, b) => a - b);
        for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(lay.labelFont + 3 - 1e-6);
      }
      for (const s of lay.sectors) {
        if (!s.label) continue;
        const w = estimateTextWidth(s.label.text, lay.labelFont);
        const x0 = s.label.anchor === "start" ? s.label.x : s.label.x - w;
        expect(x0).toBeGreaterThanOrEqual(0);
        expect(x0 + w).toBeLessThanOrEqual(CHART_W);
        expect(s.label.y).toBeGreaterThan(0);
        expect(s.label.y).toBeLessThan(lay.h);
      }
      expect(lay.legend.items).toHaveLength(vals.length);
    }
  });
  it("один ненулевой сектор — полный круг; нулевой не рисуется", () => {
    const lay = chartLayout({ type: "pie", labels: ["a", "b"], series: [{ values: [4, 0], tone: "primary" }], values: false, highlight: [], funnel: false, funnelFrom: "", funnelNote: "" });
    if (lay.type !== "pie") throw new Error();
    expect(lay.full).toBe(true);
    expect(lay.sectors[1].label).toBeUndefined();
    expect(lay.sectors[0].label?.text).toBe("100%");
  });
  it("без values — проценты, выделенный сектор сдвинут, остальные приглушены", () => {
    const lay = chartLayout({ type: "pie", labels: ["a", "b", "c", "d"], series: [{ values: [1, 1, 1, 1], tone: "primary" }], values: false, highlight: [2], funnel: false, funnelFrom: "", funnelNote: "" });
    if (lay.type !== "pie") throw new Error();
    expect(lay.sectors.map((s) => s.label?.text)).toEqual(["25%", "25%", "25%", "25%"]);
    expect(Math.hypot(lay.sectors[2].dx, lay.sectors[2].dy)).toBeGreaterThan(0);
    expect(lay.sectors.map((s) => s.dim)).toEqual([true, true, false, true]);
  });
});

const base = { highlight: [] as number[], funnel: false, funnelFrom: "", funnelNote: "" };

describe("исправления ревью S3", () => {
  const rectDist = (cx: number, cy: number, x1: number, x2: number, y1: number, y2: number) =>
    Math.hypot(Math.max(x1 - cx, 0, cx - x2), Math.max(y1 - cy, 0, cy - y2));
  it("pie: подписи вне круга и рядом со своими выносками", () => {
    const sets: number[][] = [[72, 15, 6, 4, 2, 1], [90, 3, 3, 2, 1, 1], [78, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]];
    for (const vals of sets)
      for (const withValues of [false, true])
        for (const hl of [[], [0], [1]]) {
          const lay = chartLayout({ type: "pie", labels: vals.map((_, i) => `К${i}`), series: [{ values: vals, tone: "primary" }], values: withValues, unit: withValues ? "₸" : undefined, ...base, highlight: hl });
          if (lay.type !== "pie") throw new Error();
          for (const s of lay.sectors) {
            if (!s.label || !s.leader) continue;
            const w = estimateTextWidth(s.label.text, lay.labelFont);
            const x1 = s.label.anchor === "start" ? s.label.x : s.label.x - w;
            const h = lay.labelFont * 0.5;
            const d = rectDist(lay.cx, lay.cy, x1, x1 + w, s.label.y - h, s.label.y + h);
            expect(d, `${vals} ${s.i}`).toBeGreaterThanOrEqual(lay.r + 7 - 1e-6);
            const end = s.leader.pts[s.leader.pts.length - 1];
            const near = Math.hypot(Math.max(x1 - end[0], 0, end[0] - (x1 + w)), Math.max(s.label.y - h - end[1], 0, end[1] - (s.label.y + h)));
            expect(near, `${vals} ${s.i}`).toBeLessThanOrEqual(4);
          }
        }
  });
  it("порог на верхней метке шкалы не обрезается сверху", () => {
    const lay = chartLayout({ type: "bar", labels: ["a", "b", "c"], series: [{ values: [60, 80, 90], tone: "primary" }], values: false, threshold: { value: 100, label: "Мақсат: 100" }, ...base });
    if (lay.type !== "bar" || !lay.threshold) throw new Error();
    expect(lay.threshold.ty - lay.threshold.font).toBeGreaterThanOrEqual(0);
  });
  it("наклонные подписи категорий не выходят за левый край", () => {
    for (const labels of [
      ["Ақмола облысы", "Алматы облысы", "Атырау облысы", "Шығыс Қазақстан облысы", "Жамбыл облысы", "Батыс Қазақстан"],
      ["Бағдарламалау", "Ақпараттандыру", "Компьютерлендіру", "Бағдарламалау 2", "Ақпараттандыру 2", "Компьютерлендіру 2", "Деректер", "Желілер"],
    ]) {
      const lay = chartLayout({ type: "bar", labels, series: [{ values: labels.map((_, i) => i + 1), tone: "primary" }], values: true, ...base });
      if (lay.type !== "bar") throw new Error();
      expect(lay.cats.rotate).toBe(true);
      expect(lay.cats.minLeft).toBeGreaterThanOrEqual(2 - 1e-6);
    }
  });
  it("подпись порога не пересекается с подписями значений", () => {
    for (const [vals, thr] of [[[3, 5, 2, 6], 6.3], [[100, 120, 130, 145], 140], [[60, 80, 90], 100]] as [number[], number][]) {
      const lay = chartLayout({ type: "bar", labels: vals.map((_, i) => `м${i}`), series: [{ values: vals, tone: "primary" }], values: true, unit: "₸", threshold: { value: thr, label: "Мақсат" }, ...base });
      if (lay.type !== "bar" || !lay.threshold) throw new Error();
      const t = lay.threshold;
      const w = estimateTextWidth(t.text, t.font);
      const a = { x1: t.anchor === "end" ? t.x - w : t.x, x2: t.anchor === "end" ? t.x : t.x + w, y1: t.ty - t.font, y2: t.ty + 2 };
      expect(a.y1).toBeGreaterThanOrEqual(0);
      for (const v of lay.valueLabels) {
        const hw = estimateTextWidth(v.text, v.font) / 2;
        const b = { x1: v.x - hw, x2: v.x + hw, y1: v.y - v.font, y2: v.y + 2 };
        expect(a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1, `${vals} ${v.text}`).toBe(false);
      }
    }
  });
  it("подпись порога не ложится на столбцы, если рядом есть свободное место (образец «план/факт»)", () => {
    const scene = SAMPLES[2];
    for (const lang of ["ru", "kk"] as const) {
      const lay = chartLayout(toInput(scene, lang));
      if (lay.type !== "bar" || !lay.threshold) throw new Error();
      const t = lay.threshold;
      const w = estimateTextWidth(t.text, t.font);
      const a = { x1: t.anchor === "end" ? t.x - w : t.x, x2: t.anchor === "end" ? t.x : t.x + w, y1: t.ty - t.font, y2: t.ty + 2 };
      for (const b of lay.bars) expect(a.x1 < b.x + b.w && a.x2 > b.x && a.y1 < b.y + b.h && a.y2 > b.y, `${lang} столбец ${b.key}`).toBe(false);
    }
  });
  it("воронка: строки подписи стоят от нуля (x и y у m.text — сдвиг, свой x у tspan дал бы двойное смещение)", () => {
    const html = renderToStaticMarkup(createElement(SceneView, { scene: SAMPLES[3] }));
    const tspans = html.match(/<tspan[^>]*>/g) ?? [];
    const chips = tspans.filter((t) => t.includes('fill="var(--primary-strong)"'));
    expect(chips.length).toBe(3);
    for (const c of chips) expect(c).toContain('x="0"');
  });
  it("двухстрочная подпись воронки помещается в слот своим кеглем", () => {
    const lay = chartLayout({ type: "bar", labels: ["a", "b", "c", "d"], series: [{ values: [3, 2, 2, 1], tone: "primary" }], values: false, ...base, funnel: true, funnelFrom: "от предыдущего", funnelNote: "n" });
    if (lay.type !== "bar") throw new Error();
    for (const c of lay.funnelChips) for (const ln of c.lines) expect(estimateTextWidth(ln, c.font)).toBeLessThanOrEqual(lay.slot - 2 + 1e-6);
  });
  it("aria круга без values называет проценты", () => {
    const input: ChartInput = { type: "pie", labels: ["a", "b", "c"], series: [{ values: [8, 8, 8], tone: "primary" }], values: false, ...base };
    expect(chartAria(input, tr("ru"))).toContain("8 (33%)");
  });
});

describe("образцы: ru и kk", () => {
  for (const lang of ["ru", "kk"] as const) {
    SAMPLES.forEach((scene, n) => {
      it(`${lang} · образец ${n}: проверка параметров, раскладка в пределах холста, aria, разметка`, () => {
        expect(validateScene(scene)).toEqual([]);
        const input = toInput(scene, lang);
        const lay = chartLayout(input);
        expect(lay.h).toBeGreaterThan(0);
        if (lay.type !== "pie") {
          for (const b of lay.type === "bar" ? lay.bars : []) {
            expect(b.x).toBeGreaterThanOrEqual(0);
            expect(b.x + b.w).toBeLessThanOrEqual(CHART_W);
            expect(b.y).toBeGreaterThanOrEqual(lay.plotTop - 1e-6);
          }
          for (const p of lay.type === "line" ? lay.points : []) expect(p.x).toBeLessThanOrEqual(CHART_W);
          for (const c of lay.cats.labels) if (!lay.cats.rotate) for (const ln of c.lines) expect(estimateTextWidth(ln, lay.cats.font)).toBeLessThanOrEqual(lay.slot);
          if (lay.legend) for (const it of lay.legend.items) expect(it.x).toBeGreaterThanOrEqual(0);
        }
        const aria = chartAria(input, tr(lang));
        expect(aria.length).toBeGreaterThan(10);
        expect(aria).not.toContain("{");
        const html = renderToStaticMarkup(createElement(SceneView, { scene }));
        expect(html).toContain("<svg");
        expect(html).toContain('role="img"');
      });
    });
  }
});
