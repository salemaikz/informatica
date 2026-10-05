import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneView } from "@/components/scenes/SceneView";
import { SAMPLES } from "@/components/scenes/samples/wave";
import {
  WAVE_GEO,
  hasGrid,
  levelCount,
  levelValue,
  levelsFormula,
  quantizeIndex,
  quantizeValue,
  sampleX,
  waveLayout,
  waveValue,
  wavePanels,
} from "@/components/scenes/wave";
import { sceneSignalDict } from "@/i18n/parts/scene-signal";
import { validateScene } from "./validate";

describe("wave: звук", () => {
  it("волна — сумма двух синусов, всегда в [-1, 1] и детерминирована", () => {
    for (let k = 0; k <= 1000; k++) {
      const v = waveValue(k / 1000);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(waveValue(0.37)).toBe(waveValue(0.37));
  });

  it("уровни: 2^bits, подпись «2³ = 8»", () => {
    expect(levelCount(3)).toBe(8);
    expect(levelsFormula(3)).toBe("2³ = 8");
    expect(levelsFormula(4)).toBe("2⁴ = 16");
  });

  it("округление к уровню: края сетки — ±1, середина ближе к соседнему уровню", () => {
    expect(quantizeIndex(-1, 3)).toBe(0);
    expect(quantizeIndex(1, 3)).toBe(7);
    expect(quantizeIndex(5, 3)).toBe(7); // вне диапазона — в край
    expect(levelValue(0, 2)).toBe(-1);
    expect(levelValue(3, 2)).toBe(1);
    expect(quantizeValue(0.2, undefined)).toBe(0.2);
    // 1 бит: два уровня, ноль уходит в один из них
    expect([-1, 1]).toContain(quantizeValue(0.01, 1));
  });

  it("ошибка округления не больше половины шага сетки", () => {
    for (const bits of [1, 2, 3, 4, 8]) {
      const half = 1 / (levelCount(bits) - 1);
      for (let k = 0; k <= 200; k++) {
        const v = waveValue(k / 200);
        expect(Math.abs(quantizeValue(v, bits) - v)).toBeLessThanOrEqual(half + 1e-9);
      }
    }
  });

  it("отсчёты — середины равных долей", () => {
    expect(sampleX(0, 4)).toBe(0.125);
    expect(sampleX(3, 4)).toBe(0.875);
  });

  it("раскладка: число отсчётов, сетка только до 4 бит", () => {
    const l3 = waveLayout({ samples: 12, bits: 3, digital: true });
    expect(l3.samples).toHaveLength(12);
    expect(l3.grid).toHaveLength(8);
    expect(l3.levels).toBe(8);
    expect(waveLayout({ samples: 12, bits: 4 }).grid).toHaveLength(16);
    expect(waveLayout({ samples: 12, bits: 5 }).grid).toHaveLength(0);
    expect(waveLayout({ samples: 12 }).grid).toHaveLength(0);
    expect(hasGrid(4)).toBe(true);
    expect(hasGrid(5)).toBe(false);
    expect(hasGrid(undefined)).toBe(false);
  });

  it("ступеньки: по сегменту на отсчёт, высота — ровно на линии сетки", () => {
    const lay = waveLayout({ samples: 12, bits: 3, digital: true });
    expect(lay.stepPath.startsWith("M")).toBe(true);
    expect((lay.stepPath.match(/H/g) ?? []).length).toBe(12);
    for (const s of lay.samples) expect(lay.grid).toContain(s.yq);
  });

  it("краевые случаи: 0 отсчётов, 1 отсчёт, 40 отсчётов", () => {
    expect(waveLayout({ samples: 0, bits: 3, digital: true }).samples).toHaveLength(0);
    expect(waveLayout({ samples: 0, bits: 3, digital: true }).stepPath).toBe("");
    expect(waveLayout({ samples: 1, digital: true }).stepPath).toBe(""); // digital требует ≥ 2 (validate)
    const many = waveLayout({ samples: 40, bits: 8, digital: true });
    expect(many.samples).toHaveLength(40);
    // отсчёты не сливаются: шаг ≥ 6 px на панели 320
    const xs = many.samples.map((s) => s.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(6);
  });

  it("все точки лежат внутри панели", () => {
    for (const sc of SAMPLES) {
      for (const p of wavePanels(sc)) {
        const lay = waveLayout(p);
        for (const s of lay.samples) {
          expect(s.x).toBeGreaterThan(0);
          expect(s.x).toBeLessThan(WAVE_GEO.w);
          expect(s.y).toBeGreaterThanOrEqual(0);
          expect(s.yq).toBeLessThanOrEqual(WAVE_GEO.h);
        }
      }
    }
  });

  it("compare — вторая панель; digital и пропущенная глубина наследуются", () => {
    const panels = wavePanels({ kind: "wave", samples: 16, bits: 4, digital: true, compare: { samples: 6, bits: 2 } });
    expect(panels).toHaveLength(2);
    expect(panels[1]).toMatchObject({ samples: 6, bits: 2, digital: true });
    expect(wavePanels({ kind: "wave", samples: 9, bits: 3, compare: { samples: 4 } })[1].bits).toBe(3);
    expect(wavePanels({ kind: "wave", samples: 9 })).toHaveLength(1);
  });

  it("образцы проходят validateScene и рисуются без ошибок (ru)", () => {
    for (const sc of SAMPLES) {
      expect(validateScene(sc)).toEqual([]);
      const html = renderToStaticMarkup(createElement(SceneView, { scene: sc }));
      expect(html).toContain("<svg");
      expect(html).toContain('role="img"');
    }
  });

  it("строки: ru и kk заполнены, плейсхолдеры совпадают", () => {
    for (const [key, v] of Object.entries(sceneSignalDict)) {
      expect(v.ru.trim().length, key).toBeGreaterThan(0);
      expect(v.kk.trim().length, key).toBeGreaterThan(0);
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(ph(v.kk), key).toBe(ph(v.ru));
    }
  });
});
