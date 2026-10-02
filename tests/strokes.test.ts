import { describe, expect, it } from "vitest";
import {
  MAX_STROKE_POINTS,
  MAX_STROKES,
  PALETTE,
  PEN_COLORS,
  TOOL_SIZES,
  exportScale,
  hasInk,
  makeStroke,
  parseStrokes,
  roundHalf,
  sanitizeStrokes,
  serializeStrokes,
  simplifyPoints,
  strokesBounds,
  type Point,
  type Stroke,
} from "@/lib/strokes";

const pen = (points: Point[], over: Partial<Stroke> = {}): Stroke => ({ tool: "pen", color: "ink", size: 4, points, ...over });

describe("упрощение линии (Рамер — Дуглас — Пекер)", () => {
  it("прямая из многих точек сводится к двум концам", () => {
    const pts: Point[] = Array.from({ length: 50 }, (_, i) => [i, i * 2]);
    expect(simplifyPoints(pts, 0.6)).toEqual([
      [0, 0],
      [49, 98],
    ]);
  });

  it("излом, больший допуска, сохраняется; меньший — убирается", () => {
    expect(simplifyPoints([[0, 0], [5, 3], [10, 0]], 0.6)).toHaveLength(3);
    expect(simplifyPoints([[0, 0], [5, 0.4], [10, 0]], 0.6)).toHaveLength(2);
  });

  it("концы всегда сохраняются, короткие линии не меняются", () => {
    expect(simplifyPoints([[1, 1]])).toEqual([[1, 1]]);
    expect(simplifyPoints([[1, 1], [2, 2]])).toEqual([[1, 1], [2, 2]]);
    const out = simplifyPoints([[0, 0], [3, 8], [6, 1], [9, 9], [12, 0]], 0.6);
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([12, 0]);
  });

  it("замкнутая фигура (начало = конец) не схлопывается", () => {
    const circle: Point[] = Array.from({ length: 41 }, (_, i) => [
      100 + 40 * Math.cos((i / 40) * 2 * Math.PI),
      100 + 40 * Math.sin((i / 40) * 2 * Math.PI),
    ]);
    circle[40] = [...circle[0]];
    expect(simplifyPoints(circle, 0.6).length).toBeGreaterThan(8);
  });

  it("не меняет вход и не падает на очень длинном штрихе", () => {
    const pts: Point[] = Array.from({ length: 20000 }, (_, i) => [i, Math.sin(i / 50) * 30]);
    const copy = JSON.stringify(pts);
    const out = simplifyPoints(pts);
    expect(out.length).toBeLessThan(pts.length);
    expect(JSON.stringify(pts)).toBe(copy);
  });

  it("упрощённая линия отходит от исходных точек не больше допуска", () => {
    const pts: Point[] = Array.from({ length: 200 }, (_, i) => [i, Math.sin(i / 10) * 20]);
    const out = simplifyPoints(pts, 0.6);
    for (const p of pts) {
      let best = Infinity;
      for (let i = 0; i < out.length - 1; i++) {
        const [a, b] = [out[i], out[i + 1]];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
      }
      expect(best).toBeLessThanOrEqual(0.6 + 1e-9);
    }
  });
});

describe("makeStroke", () => {
  it("округляет до 0.5 и убирает повторы подряд", () => {
    expect(roundHalf(1.26)).toBe(1.5);
    expect(roundHalf(1.74)).toBe(1.5);
    expect(roundHalf(1.76)).toBe(2);
    const s = makeStroke("pen", "blue", 4, [[1.1, 1.1], [1.2, 0.9], [1.3, 1.2], [10.4, 10.6]]);
    expect(s.points).toEqual([[1, 1], [10.5, 10.5]]);
  });

  it("одна точка (тап) остаётся точкой", () => {
    expect(makeStroke("marker", "yellow", 16, [[5, 5], [5.1, 5.1]]).points).toEqual([[5, 5]]);
  });
});

describe("санитизация штрихов", () => {
  it("мусор → пустой список", () => {
    for (const bad of [null, undefined, 5, "x", {}, [1, 2], [null], [{}], [{ tool: "pen" }], [{ tool: "laser", points: [[1, 1]] }]]) {
      expect(sanitizeStrokes(bad)).toEqual([]);
    }
  });

  it("корректный штрих проходит, координаты округляются", () => {
    const out = sanitizeStrokes([{ tool: "pen", color: "red", size: 7, points: [[1.2, 2.8], [3, 4]] }]);
    expect(out).toEqual([{ tool: "pen", color: "red", size: 7, points: [[1, 3], [3, 4]] }]);
  });

  it("плохие точки отбрасываются, штрих без точек — целиком", () => {
    const out = sanitizeStrokes([
      { tool: "pen", color: "ink", size: 4, points: [[1, 1], ["a", 2], [NaN, 1], [Infinity, 0], [1], null, [1e9, 1], [2, 2]] },
      { tool: "pen", color: "ink", size: 4, points: [[NaN, NaN]] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].points).toEqual([[1, 1], [2, 2]]);
  });

  it("цвет и размер приводятся к допустимым", () => {
    const [a, b, c, d] = sanitizeStrokes([
      { tool: "pen", color: "purple", size: 4, points: [[0, 0]] },
      { tool: "pen", color: "yellow", size: 4, points: [[0, 0]] },
      { tool: "marker", color: "red", size: "big", points: [[0, 0]] },
      { tool: "eraser", color: "blue", size: 1000, points: [[0, 0]] },
    ]);
    expect(a.color).toBe("ink");
    expect(b.color).toBe("ink");
    expect(c.color).toBe("yellow");
    expect(c.size).toBe(TOOL_SIZES.marker[0]);
    expect(d.color).toBe("ink");
    expect(d.size).toBeLessThanOrEqual(80);
  });

  it("лимиты: число штрихов и точек в штрихе", () => {
    const many = Array.from({ length: MAX_STROKES + 50 }, () => pen([[1, 1]]));
    expect(sanitizeStrokes(many)).toHaveLength(MAX_STROKES);
    const long = pen(Array.from({ length: MAX_STROKE_POINTS + 100 }, (_, i) => [i % 500, 1] as Point));
    expect(sanitizeStrokes([long])[0].points).toHaveLength(MAX_STROKE_POINTS);
  });

  it("не возвращает ссылки на вход", () => {
    const input = [pen([[1, 1], [2, 2]])];
    const out = sanitizeStrokes(input);
    out[0].points.push([9, 9]);
    expect(input[0].points).toHaveLength(2);
  });
});

describe("сериализация", () => {
  it("туда и обратно без потерь", () => {
    const list: Stroke[] = [
      pen([[1, 1], [10, 10.5]], { color: "green", size: 7 }),
      { tool: "marker", color: "yellow", size: 28, points: [[0, 0], [50, 0]] },
      { tool: "eraser", color: "ink", size: 24, points: [[5, 5]] },
    ];
    expect(parseStrokes(serializeStrokes(list))).toEqual(list);
  });

  it("битый JSON → пустой список", () => {
    expect(parseStrokes("{oops")).toEqual([]);
    expect(parseStrokes("42")).toEqual([]);
    expect(parseStrokes("")).toEqual([]);
  });

  it("JSON получается компактным: упрощение сильно сокращает длинную прямую", () => {
    const raw: Point[] = Array.from({ length: 300 }, (_, i) => [i, 10]);
    expect(serializeStrokes([makeStroke("pen", "ink", 4, raw)]).length).toBeLessThan(120);
  });
});

describe("границы и содержимое", () => {
  it("рамка учитывает толщину линии, ластик не считается", () => {
    const b = strokesBounds([pen([[10, 10], [30, 20]], { size: 4 }), { tool: "eraser", color: "ink", size: 64, points: [[500, 500]] }]);
    expect(b).toEqual({ x: 8, y: 8, w: 24, h: 14 });
    expect(strokesBounds([pen([[10, 10], [30, 20]], { size: 4 })], 16)).toEqual({ x: -8, y: -8, w: 56, h: 46 });
  });

  it("пусто (или только ластик) → null и hasInk=false", () => {
    const eraser: Stroke = { tool: "eraser", color: "ink", size: 24, points: [[1, 1]] };
    expect(strokesBounds([])).toBeNull();
    expect(strokesBounds([eraser])).toBeNull();
    expect(hasInk([eraser])).toBe(false);
    expect(hasInk(undefined)).toBe(false);
    expect(hasInk([pen([[1, 1]])])).toBe(true);
  });

  it("масштаб экспорта ограничивает ширину 1600 px", () => {
    expect(exportScale(400, 2, 1600)).toBe(2);
    expect(exportScale(1600, 2, 1600)).toBe(1);
    expect(Math.ceil(3200 * exportScale(3200, 2, 1600))).toBe(1600);
  });
});

describe("палитра", () => {
  it("для каждого цвета есть значение в обеих темах, у ручки нет жёлтого", () => {
    for (const theme of ["light", "dark"] as const) {
      for (const c of [...PEN_COLORS, "yellow"] as const) expect(PALETTE[theme][c]).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(PEN_COLORS).not.toContain("yellow");
  });

  it("чернила контрастны фону темы, размеры инструментов — как в ТЗ", () => {
    expect(PALETTE.light.ink).toBe("#1b2333");
    expect(PALETTE.dark.ink).toBe("#e8ecf4");
    expect(TOOL_SIZES.pen).toEqual([2, 4, 7, 12]);
    expect(TOOL_SIZES.eraser).toEqual([12, 24, 40, 64]);
    expect(TOOL_SIZES.marker).toEqual([16, 28]);
  });
});
