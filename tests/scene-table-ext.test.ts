import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TableScene as TableView } from "@/components/scenes/TableScene";
import { SceneView } from "@/components/scenes/SceneView";
import { SAMPLES as EXTENDED } from "@/components/scenes/samples/extended";
import {
  CELL_FONT,
  CELL_LINE,
  CELL_PAD_Y,
  END_INSET,
  FLAT_PEAK,
  JOIN_WIDE_FROM,
  arrowGeometry,
  arrowSlots,
  changeMap,
  joinLinkPath,
  JOIN_TONE,
  clipRect,
  cellName,
  tableExtDescription,
  joinTones,
  needsOverlay,
  rangeRect,
  rayExit,
  rectCenter,
  rowStateMap,
  sheetRowNumber,
  TEXT_TOP,
  toneMap,
  usesTableExt,
  type Rect,
  type TableScene,
} from "@/components/scenes/table";
import type { DictKey } from "@/i18n/dict";
import type { Scene } from "@/lib/types";
import oldMarkup from "./fixtures/old-table-markup.json";
import { validateScene } from "./validate";

const table = (extra: Partial<TableScene> = {}): TableScene => ({ kind: "table", columns: ["ID", "Name", "Score"], rows: [["1", "Ali", "90"], ["2", "Dana", "75"], ["3", "Erlan", "60"]], ...extra });
const html = (s: Scene) => renderToStaticMarkup(createElement(SceneView, { scene: s }));
const grid = (s: TableScene) => renderToStaticMarkup(createElement(TableView, { scene: s }));

const EXT = EXTENDED.filter((s): s is TableScene => s.kind === "table" && usesTableExt(s));

// Прямоугольники ячеек сетки: 3 столбца по 80 px, строки по 36 px (как после измерения DOM).
const cell = (r: number, c: number): Rect => ({ x: c * 80, y: r * 36, w: 80, h: 36 });
const rects = (rows: number, cols: number) => new Map(Array.from({ length: rows * cols }, (_, i) => [`${Math.floor(i / cols)}:${i % cols}`, cell(Math.floor(i / cols), i % cols)] as [string, Rect]));

describe("старые таблицы не изменились", () => {
  // Разметка пяти старых сцен снята до расширений (tests/fixtures/old-table-markup.json).
  const OLD: TableScene[] = [
    { kind: "table", columns: ["A", "B", "A ∧ B"], rows: [["0", "0", "0"], ["0", "1", "0"], ["1", "0", "0"], ["1", "1", "1"]], highlightRows: [3], mono: true },
    { kind: "table", columns: [{ ru: "Имя", kk: "Аты" }, "Score"], rows: [[{ ru: "Али", kk: "Әли" }, "90"], ["Dana", "75"]], highlightCols: [1], highlightCells: [[0, 0]] },
    { kind: "table", sheet: true, columns: ["A", "B", "C"], rows: [["2", "3", "=A1*B1"], ["4", "5", "=A2*B2"], ["6", "7", "=A3*B3"]], highlightRows: [1], highlightCells: [[1, 2]] },
    { kind: "table", sheet: true, rows: [["x", "y"], ["1", "2"]], highlightCols: [0] },
    { kind: "table", rows: [["a", "b"], ["c", "d"]], caption: "cap" },
  ];

  it("разметка совпадает с прежней побайтно", () => {
    expect(OLD).toHaveLength(oldMarkup.length);
    for (const [i, s] of OLD.entries()) expect(grid(s), `старая сцена ${i}`).toBe(oldMarkup[i]);
  });

  it("у старых сцен нет расширений: ни слоя, ни атрибутов измерения, ни значков", () => {
    for (const s of OLD) {
      expect(usesTableExt(s)).toBe(false);
      expect(needsOverlay(s)).toBe(false);
      const out = grid(s);
      expect(out).not.toContain("data-cell");
      expect(out).not.toContain("<svg");
      expect(out).not.toContain("sr-only");
    }
  });

  it("образцы из уроков (extended) проходят проверку параметров", () => {
    for (const [i, s] of EXT.entries()) expect(validateScene(s), `образец ${i}`).toEqual([]);
    expect(EXT.length).toBeGreaterThanOrEqual(6);
  });
});

describe("карты состояний, «было» и тонов", () => {
  it("rowStateMap, changeMap, toneMap читают поля сцены; позднее перекрывает раннее", () => {
    const s = table({
      rowStates: [{ row: 0, state: "struck" }, { row: 2, state: "new" }],
      changes: [{ cell: [1, 2], from: "70" }],
      tones: [{ tone: "primary", cells: [[0, 0], [0, 1]] }, { tone: "success", cells: [[0, 1]] }],
    });
    expect(rowStateMap(s).get(0)).toBe("struck");
    expect(rowStateMap(s).get(1)).toBeUndefined();
    expect(changeMap(s).get("1:2")).toBe("70");
    expect(toneMap(s).get("0:0")).toBe("primary");
    expect(toneMap(s).get("0:1")).toBe("success");
    expect(rowStateMap(table()).size).toBe(0);
  });

  it("sheetRowNumber: свои номера или порядок", () => {
    expect(sheetRowNumber(table({ sheet: true, rowNumbers: [2, 5, 7] }), 1)).toBe(5);
    expect(sheetRowNumber(table({ sheet: true }), 1)).toBe(2);
  });

  it("usesTableExt и needsOverlay", () => {
    expect(usesTableExt(table())).toBe(false);
    expect(usesTableExt(table({ rowStates: [{ row: 0, state: "dim" }] }))).toBe(true);
    expect(usesTableExt(table({ formula: { cell: "A1", text: "=1" }, sheet: true }))).toBe(true);
    expect(usesTableExt(table({ rowNumbers: [1, 2, 3], sheet: true }))).toBe(true);
    expect(needsOverlay(table({ range: { from: [0, 0], to: [1, 1] } }))).toBe(true);
    expect(needsOverlay(table({ arrows: [{ from: [0, 0], to: [1, 1] }] }))).toBe(true);
    expect(needsOverlay(table({ arrows: [] }))).toBe(false);
    expect(needsOverlay(table({ tones: [{ tone: "gold", cells: [[0, 0]] }] }))).toBe(false);
  });
});

describe("геометрия слоя: рамка диапазона", () => {
  it("rangeRect охватывает обе ячейки включительно, в любом порядке углов", () => {
    const r = rects(4, 3);
    expect(rangeRect(r, { from: [0, 0], to: [1, 1] })).toEqual({ x: 0, y: 0, w: 160, h: 72 });
    expect(rangeRect(r, { from: [1, 1], to: [1, 1] })).toEqual(cell(1, 1));
    expect(rangeRect(r, { from: [1, 0], to: [3, 2] })).toEqual({ x: 0, y: 36, w: 240, h: 108 });
  });

  it("нет измерения — нет рамки", () => {
    expect(rangeRect(new Map(), { from: [0, 0], to: [1, 1] })).toBeNull();
    expect(rangeRect(rects(1, 1), { from: [0, 0], to: [5, 5] })).toBeNull();
  });
});

describe("геометрия слоя: стрелки", () => {
  const bounds = { w: 240, h: 144 };

  it("rayExit: выход луча из центра на границу ячейки", () => {
    const c = cell(1, 1);
    expect(rayExit(c, [c.x + c.w / 2, 0])).toEqual([c.x + c.w / 2, c.y]);
    expect(rayExit(c, [1000, c.y + c.h / 2])).toEqual([c.x + c.w, c.y + c.h / 2]);
    const diag = rayExit(c, [c.x + c.w / 2 + 40, c.y + c.h / 2 + 40]);
    expect(diag[1]).toBe(c.y + c.h);
    expect(rayExit(c, rectCenter(c))).toEqual(rectCenter(c));
  });

  it("стрелка по строке: дуга над строкой, начало и острие — внутри своих ячеек у верхнего края, наконечник в конце", () => {
    const a = arrowGeometry(cell(2, 0), cell(2, 2), bounds)!;
    expect(a).not.toBeNull();
    expect(a.ctrl[1]).toBeLessThan(cell(2, 0).y);
    // не на границе строк: острие целиком в целевой ячейке, а не между C1 и C2
    expect(a.start[1]).toBeGreaterThan(cell(2, 0).y + 2);
    expect(a.end[1]).toBeGreaterThan(cell(2, 2).y + 2);
    expect(a.end[1]).toBeLessThan(cell(2, 2).y + cell(2, 2).h / 2);
    expect(a.head[0]).toEqual(a.end);
    expect(a.d.startsWith("M")).toBe(true);
    expect(a.d).toContain("Q");
    // наконечник — маленький треугольник у острия
    for (const p of a.head.slice(1)) expect(Math.hypot(p[0] - a.end[0], p[1] - a.end[1])).toBeLessThan(12);
  });

  it("стрелка в первой строке: сверху места нет — дуга уходит вниз и остаётся в таблице", () => {
    const a = arrowGeometry(cell(0, 0), cell(0, 2), bounds)!;
    expect(a.ctrl[1]).toBeGreaterThan(cell(0, 0).y + cell(0, 0).h / 2);
    for (const p of [a.start, a.end, a.ctrl]) {
      expect(p[0]).toBeGreaterThanOrEqual(0);
      expect(p[0]).toBeLessThanOrEqual(bounds.w);
      expect(p[1]).toBeGreaterThanOrEqual(0);
      expect(p[1]).toBeLessThanOrEqual(bounds.h);
    }
  });

  it("вертикальная стрелка (копирование вниз): дуга выгибается вправо", () => {
    const a = arrowGeometry(cell(0, 1), cell(2, 1), bounds)!;
    expect(a.ctrl[0]).toBeGreaterThan(rectCenter(cell(0, 1))[0]);
    expect(a.start[0]).toBeGreaterThanOrEqual(cell(0, 1).x);
    expect(a.end[0]).toBeLessThanOrEqual(cell(2, 1).x + cell(2, 1).w);
  });

  it("соседние ячейки: стрелка короткая, но есть; та же ячейка — стрелки нет", () => {
    const a = arrowGeometry(cell(1, 0), cell(1, 1), bounds)!;
    expect(a).not.toBeNull();
    expect(Math.hypot(a.end[0] - a.start[0], a.end[1] - a.start[1])).toBeGreaterThan(20);
    expect(arrowGeometry(cell(1, 1), cell(1, 1), bounds)).toBeNull();
  });

  it("стрелка по строке плоская: дуга не выше отступа между строками, цифры соседней строки не задеты", () => {
    for (const [from, to] of [[cell(2, 0), cell(2, 2)], [cell(2, 2), cell(2, 0)], [cell(1, 0), cell(1, 1)]]) {
      const a = arrowGeometry(from, to, bounds)!;
      const apex = (a.start[1] + a.end[1]) / 4 + a.ctrl[1] / 2; // вершина квадратичной кривой при t = 0,5
      expect(Math.abs(apex - from.y)).toBeLessThanOrEqual(8);
    }
    // в первой строке — под строкой, и внутри таблицы
    const top = arrowGeometry(cell(0, 0), cell(0, 2), bounds)!;
    expect(top.ctrl[1]).toBeGreaterThan(cell(0, 0).y + cell(0, 0).h);
  });

  it("вертикальные соседи (копирование формулы вниз): стрелка видна — не точка; наконечник направлен вниз", () => {
    const a = arrowGeometry(cell(0, 1), cell(1, 1), bounds)!;
    expect(Math.hypot(a.end[0] - a.start[0], a.end[1] - a.start[1])).toBeGreaterThan(12);
    expect(a.end[1]).toBeGreaterThan(a.start[1]);
    // начало в нижней части верхней ячейки, конец — в верхней части нижней
    expect(a.start[1]).toBeGreaterThan(cell(0, 1).y + cell(0, 1).h / 2);
    expect(a.end[1]).toBeLessThan(cell(1, 1).y + cell(1, 1).h / 2);
    for (const p of [a.start, a.end, a.ctrl, ...a.head]) {
      expect(p[0]).toBeGreaterThanOrEqual(0);
      expect(p[0]).toBeLessThanOrEqual(bounds.w);
    }
    // в последнем столбце выгиб не уходит за край таблицы
    const last = arrowGeometry(cell(0, 2), cell(1, 2), bounds)!;
    expect(last.ctrl[0]).toBeLessThanOrEqual(bounds.w - 2 + 1e-6);
  });

  it("вертикальные соседи, копирование вверх: зеркально вниз — короткая стрелка у общей границы, наконечник вверх, не тянется через текст", () => {
    const from: Rect = { x: 0, y: 32, w: 100, h: 32 };
    const to: Rect = { x: 0, y: 0, w: 100, h: 32 };
    const a = arrowGeometry(from, to, { w: 300, h: 64 })!;
    expect(a).not.toBeNull();
    // начало — в верхней части нижней ячейки (у границы), конец — в нижней части верхней
    expect(a.start[1]).toBeGreaterThan(from.y);
    expect(a.start[1]).toBeLessThan(from.y + from.h / 2);
    expect(a.end[1]).toBeGreaterThan(to.y + to.h / 2);
    expect(a.end[1]).toBeLessThan(to.y + to.h);
    // стрелка идёт вверх и короче высоты ячейки (раньше — 1,24 высоты)
    expect(a.end[1]).toBeLessThan(a.start[1]);
    expect(a.start[1] - a.end[1]).toBeLessThan(from.h);
    expect(a.start[1] - a.end[1]).toBeGreaterThan(12);
    // наконечник: остриё выше основания
    expect(a.head[0][1]).toBeLessThan(a.head[1][1]);
    expect(a.head[0][1]).toBeLessThan(a.head[2][1]);
    // зеркало «вниз»: при перестановке ячеек отрезок тот же, только направление обратное
    const down = arrowGeometry(to, from, { w: 300, h: 64 })!;
    expect(down.start[1]).toBeCloseTo(a.end[1], 1);
    expect(down.end[1]).toBeCloseTo(a.start[1], 1);
    expect(down.end[1]).toBeGreaterThan(down.start[1]);
  });

  it("таблица в одну строку: соседи по строке — стрелка внутри строки вдоль нижнего края, а не вертикальная вверх", () => {
    const bounds = { w: 300, h: 32 };
    const row = (c: number): Rect => ({ x: c * 100, y: 0, w: 100, h: 32 });
    for (const [i, j] of [[0, 1], [1, 2], [1, 0], [2, 1]]) {
      const a = arrowGeometry(row(i), row(j), bounds)!;
      expect(a, `${i}→${j}`).not.toBeNull();
      const dir = Math.sign(j - i);
      // идёт в сторону целевой ячейки, заметной длины, начало и конец — в своих ячейках
      expect(Math.sign(a.end[0] - a.start[0])).toBe(dir);
      expect(Math.abs(a.end[0] - a.start[0])).toBeGreaterThan(40);
      expect(a.start[0]).toBeGreaterThanOrEqual(row(i).x);
      expect(a.start[0]).toBeLessThanOrEqual(row(i).x + row(i).w);
      expect(a.end[0]).toBeGreaterThanOrEqual(row(j).x);
      expect(a.end[0]).toBeLessThanOrEqual(row(j).x + row(j).w);
      // по вертикали — в нижней половине строки (ниже цифр), вся дуга внутри таблицы
      expect(a.start[1]).toBeGreaterThan(bounds.h / 2);
      expect(Math.abs(a.end[1] - a.start[1])).toBeLessThan(1);
      for (const p of [a.start, a.end, a.ctrl, ...a.head]) {
        expect(p[0]).toBeGreaterThanOrEqual(0);
        expect(p[0]).toBeLessThanOrEqual(bounds.w);
        expect(p[1]).toBeGreaterThanOrEqual(0);
        expect(p[1]).toBeLessThanOrEqual(bounds.h);
      }
      // наконечник в конце, по ходу стрелки: основание ближе к началу, чем остриё
      expect(a.head[0]).toEqual(a.end);
      expect(Math.sign(a.head[0][0] - a.head[1][0])).toBe(dir);
      expect(a.d).not.toContain("NaN");
    }
  });

  it("узкие ячейки в одну строку: стрелка либо видна и направлена в сторону цели, либо её нет — но не вырожденная и не вертикальная", () => {
    const bounds = { w: 200, h: 32 };
    const row = (c: number): Rect => ({ x: c * 40, y: 0, w: 40, h: 32 });
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++) {
        if (i === j) continue;
        const a = arrowGeometry(row(i), row(j), bounds);
        if (!a) continue;
        expect(Math.hypot(a.end[0] - a.start[0], a.end[1] - a.start[1]), `${i}→${j}`).toBeGreaterThan(12);
        expect(Math.sign(a.end[0] - a.start[0])).toBe(Math.sign(j - i));
      }
  });

  it("стрелки не вырождены ни в одной из сеток: длина больше 12 px и направление совпадает с направлением к цели", () => {
    for (const [rows, cols, cw, ch] of [[4, 3, 80, 36], [2, 3, 100, 32], [6, 4, 80, 36]] as const) {
      const all: Rect[] = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) all.push({ x: c * cw, y: r * ch, w: cw, h: ch });
      for (const from of all)
        for (const to of all) {
          if (from === to) continue;
          const g = arrowGeometry(from, to, { w: cols * cw, h: rows * ch })!;
          const len = Math.hypot(g.end[0] - g.start[0], g.end[1] - g.start[1]);
          expect(len, `${from.x},${from.y} → ${to.x},${to.y}`).toBeGreaterThan(12);
          // стрелка между строками идёт в сторону цели по вертикали: вниз — вниз, вверх — вверх
          if (to.y !== from.y && to.x === from.x) expect(Math.sign(g.end[1] - g.start[1])).toBe(Math.sign(to.y - from.y));
        }
    }
  });

  it("все числа конечны для любых пар ячеек сетки 4×3 (включая диагонали и обратное направление)", () => {
    const all = [...rects(4, 3).values()];
    for (const from of all)
      for (const to of all) {
        const g = arrowGeometry(from, to, { w: 240, h: 144 });
        if (from === to) {
          expect(g).toBeNull();
          continue;
        }
        expect(g).not.toBeNull();
        for (const v of [...g!.start, ...g!.end, ...g!.ctrl, ...g!.head.flat()]) expect(Number.isFinite(v)).toBe(true);
        expect(g!.d).not.toContain("NaN");
      }
  });
});

describe("геометрия слоя: дуга остаётся внутри таблицы", () => {
  it("для всех пар ячеек сетки 6×4 вся дуга (по точкам кривой) лежит внутри размеров таблицы", () => {
    const b = { w: 320, h: 216 };
    const all = [...rects(6, 4).values()].map((r, i) => ({ ...r, x: (i % 4) * 80, y: Math.floor(i / 4) * 36 }));
    for (const from of all)
      for (const to of all) {
        if (from === to) continue;
        const g = arrowGeometry(from, to, b)!;
        for (let i = 0; i <= 8; i++) {
          const t = i / 8;
          const x = (1 - t) ** 2 * g.start[0] + 2 * (1 - t) * t * g.ctrl[0] + t * t * g.end[0];
          const y = (1 - t) ** 2 * g.start[1] + 2 * (1 - t) * t * g.ctrl[1] + t * t * g.end[1];
          expect(x, `${from.x},${from.y} → ${to.x},${to.y}`).toBeGreaterThanOrEqual(-0.5);
          expect(x).toBeLessThanOrEqual(b.w + 0.5);
          expect(y).toBeGreaterThanOrEqual(-0.5);
          expect(y).toBeLessThanOrEqual(b.h + 0.5);
        }
      }
  });
});

describe("JOIN: тоны и линии", () => {
  it("все совпавшие строки (обеих таблиц) — один тон primary; строки без пары — без тона; success/warning не берутся", () => {
    // «многие к одному»: Erlan и Ali — в одном классе (строка 0 справа), пары разных строк не получают разных цветов
    const { left, right } = joinTones([[0, 0], [1, 1], [2, 0], [3, 2]]);
    expect([...left.keys()].sort()).toEqual([0, 1, 2, 3]);
    expect([...right.keys()].sort()).toEqual([0, 1, 2]);
    for (const tone of [...left.values(), ...right.values()]) expect(tone).toBe(JOIN_TONE);
    expect(JOIN_TONE).toBe("primary");
    // строка без пары — без тона
    const part = joinTones([[1, 0]]);
    expect(part.left.has(0)).toBe(false);
    expect(part.right.has(1)).toBe(false);
    expect(joinTones([]).left.size).toBe(0);
  });

  it("clipRect обрезает прямоугольник по видимой области прокручиваемого блока", () => {
    expect(clipRect({ x: 0, y: 0, w: 300, h: 30 }, { x: 0, y: 0, w: 200, h: 100 })).toEqual({ x: 0, y: 0, w: 200, h: 30 });
    expect(clipRect({ x: -50, y: 10, w: 100, h: 30 }, { x: 0, y: 0, w: 200, h: 100 })).toEqual({ x: 0, y: 10, w: 50, h: 30 });
    // целиком за краем — нулевая ширина, не отрицательная
    expect(clipRect({ x: 400, y: 0, w: 50, h: 30 }, { x: 0, y: 0, w: 200, h: 100 }).w).toBe(0);
  });

  it("joinLinkPath: прямая при одной высоте, S-кривая при разной; концы — края строк", () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 30 };
    const b: Rect = { x: 160, y: 0, w: 100, h: 30 };
    expect(joinLinkPath(a, b).d).toBe("M100 15 L160 15");
    const c: Rect = { x: 160, y: 60, w: 100, h: 30 };
    const p = joinLinkPath(a, c);
    expect(p.from).toEqual([100, 15]);
    expect(p.to).toEqual([160, 75]);
    expect(p.d).toContain("C");
  });

  it("порог «широкого» вида — в пределах max-w-xl (576 px)", () => {
    expect(JOIN_WIDE_FROM).toBeLessThanOrEqual(576);
    expect(JOIN_WIDE_FROM).toBeGreaterThan(420);
  });
});

describe("TableScene: отрисовка расширений", () => {
  it("struck: зачёркнутая строка danger; dim: приглушена; new: success-soft; подпись для скринридера", () => {
    const out = grid(table({ rowStates: [{ row: 0, state: "struck" }, { row: 1, state: "dim" }, { row: 2, state: "new" }] }));
    expect(out).toContain("line-through");
    expect(out).toContain("text-ink-danger");
    expect(out).toContain("opacity-50");
    expect(out).toContain("bg-success-soft");
    expect(out).toContain("удалённая строка");
    expect(out).toContain("строка не учитывается");
    expect(out).toContain("новая строка");
    // строка без состояния остаётся прежней: нет подписи
    expect(grid(table({ rowStates: [{ row: 0, state: "dim" }] })).match(/sr-only/g)).toHaveLength(1);
  });

  it("rejected: красная рамка (inset-тени), значок X в последней ячейке, место под него у всех строк", () => {
    const out = grid(table({ rowStates: [{ row: 1, state: "rejected" }] }));
    expect(out).toContain("lucide-x");
    expect(out).toContain("var(--danger)");
    expect(out).toContain("строка отклонена");
    expect(out.match(/pr-9/g)).toHaveLength(3);
    expect(out.match(/lucide-x/g)).toHaveLength(1);
    // у одностолбцовой таблицы рамка замкнута со всех сторон
    const one = grid({ kind: "table", rows: [["a"], ["b"]], rowStates: [{ row: 0, state: "rejected" }] });
    expect(one).toContain("inset_2px_0_0_0_var(--danger),inset_-2px_0_0_0_var(--danger)");
  });

  it("changes: новое значение жирным и мелко зачёркнутое старое", () => {
    const out = grid(table({ changes: [{ cell: [1, 2], from: "70" }] }));
    expect(out).toContain('<span class="font-extrabold">75</span>');
    expect(out).toMatch(/line-through[^>]*><span class="sr-only">было <\/span>70/);
  });

  it("tones: заливка своим тоном; поздняя группа перекрывает; тон перекрывает подсветку", () => {
    const out = grid(table({ highlightCells: [[0, 0]], tones: [{ tone: "success", cells: [[0, 0]] }, { tone: "gold", cells: [[1, 1]] }, { tone: "ai", cells: [[2, 2]] }, { tone: "muted", cells: [[2, 0]] }] }));
    expect(out).toContain("bg-success-soft");
    expect(out).toContain("bg-gold-soft");
    expect(out).toContain("bg-ai-soft");
    expect(out).toContain("bg-surface-2");
    // ячейка [0,0] — не primary-soft: тон перекрыл подсветку
    const first = out.match(/<td[^>]*data-?[^>]*>|<td class="[^"]*">/)?.[0] ?? "";
    expect(first).toContain("bg-success-soft");
    expect(first).not.toContain("bg-primary-soft");
  });

  it("formula: строка формул над таблицей с полем имени, fx и текстом; только sheet", () => {
    const out = grid(table({ sheet: true, formula: { cell: "C2", text: "=A2*B2" } }));
    const bar = out.indexOf("Строка формул");
    expect(bar).toBeGreaterThan(-1);
    expect(bar).toBeLessThan(out.indexOf("<table"));
    expect(out).toContain(">C2<");
    expect(out).toContain(">=A2*B2<");
    expect(out).toContain(">fx<");
  });

  it("rowNumbers: свои номера строк у края (после фильтра 2, 5, 7)", () => {
    const out = grid({ kind: "table", sheet: true, rows: [["a"], ["b"], ["c"]], rowNumbers: [2, 5, 7] });
    expect([...out.matchAll(/<th scope="row"[^>]*>(\d+)<\/th>/g)].map((m) => m[1])).toEqual(["2", "5", "7"]);
  });

  it("range и arrows: ячейки помечены для измерения (слой рисуется после измерения в браузере)", () => {
    const out = grid(table({ range: { from: [0, 0], to: [1, 1] }, arrows: [{ from: [0, 0], to: [2, 2] }] }));
    expect(out).toContain('data-cell="0:0"');
    expect(out).toContain('data-cell="2:2"');
    expect(out).toContain('class="relative"');
    // без слоя атрибутов нет
    expect(grid(table({ tones: [{ tone: "gold", cells: [[0, 0]] }] }))).not.toContain("data-cell");
  });

  it("join: вторая таблица, строки помечены L/R, совпавшие строки подсвечены общим тоном", () => {
    const out = grid(table({ join: { columns: ["ID", "Title"], rows: [["10", "10A"], ["11", "10B"]], links: [[0, 0], [1, 1], [2, 0]] } }));
    expect(out.match(/<table/g)).toHaveLength(2);
    expect(out).toContain('data-join-row="L:0"');
    expect(out).toContain('data-join-row="R:1"');
    expect(out).toContain("bg-primary-soft");
    expect(out).not.toContain("bg-warning-soft");
    expect(out).not.toContain("bg-success-soft");
    // первое отрисованное состояние — друг под другом (ширина ещё не измерена)
    expect(out).toContain("flex-col");
  });

  it("JOIN: тон строки не затирает подсветку столбца — выделенный столбец в совпавших строках жирный", () => {
    const out = grid(table({ highlightCols: [1], join: { rows: [["10"]], links: [[0, 0]] } }));
    expect(out).toContain("font-extrabold text-ink-primary");
  });

  it("расширения: дерево одно и то же на любом шаге (обёртка рисуется всегда), старая разметка без расширений не меняется", () => {
    // состояния строк без стрелок и со стрелками — одна и та же обёртка (иначе таблица перемонтируется)
    const a = grid(table({ rowStates: [{ row: 0, state: "dim" }] }));
    const b = grid(table({ rowStates: [{ row: 0, state: "dim" }], arrows: [{ from: [0, 0], to: [1, 1] }] }));
    for (const out of [a, b]) expect(out).toContain('class="relative"');
    expect(grid(table({}))).not.toContain('class="relative"');
  });

  it("стрелки выше липкой колонки номеров строк (z-20): слой — z-[15]", () => {
    const out = grid({ kind: "table", sheet: true, rows: [["a", "b"], ["c", "d"]], arrows: [{ from: [0, 0], to: [1, 1] }] });
    expect(out).toContain("sticky left-0 z-20");
    expect(out).not.toContain("z-30");
  });

  it("для скринридера: диапазон, стрелки и совпавшие строки названы текстом (ru и kk)", async () => {
    const { dict } = await import("@/i18n/dict");
    const { fmt } = await import("@/lib/text");
    const tr = (lang: "ru" | "kk") => (key: DictKey, params?: Record<string, string | number>) => fmt(dict[key][lang], params);
    const sc = table({ sheet: true, rowNumbers: [2, 5, 7], range: { from: [0, 0], to: [2, 1] }, arrows: [{ from: [1, 0], to: [1, 2] }], join: { rows: [["x"], ["y"]], links: [[0, 0], [2, 1]] } });
    expect(cellName(sc, [1, 2])).toBe("C5");
    expect(tableExtDescription(sc, tr("ru"))).toEqual(["Выделен диапазон A2:B7", "Стрелка: A5 → C5", "Совпадают строки: 1–1, 3–2"]);
    expect(tableExtDescription(sc, tr("kk"))).toEqual(["A2:B7 ауқымы бөлектелген", "Көрсеткі: A5 → C5", "Сәйкес жолдар: 1–1, 3–2"]);
    expect(tableExtDescription(table({}), tr("ru"))).toEqual([]);
    const out = grid(sc);
    expect(out).toContain("sr-only");
    expect(out).toContain("Выделен диапазон A2:B7");
  });

  it("образцы: все рисуются без ошибок, hex-цветов, эмодзи и NaN", () => {
    for (const [i, s] of EXT.entries()) {
      const out = html(s);
      expect(out, `образец ${i}`).not.toContain("NaN");
      expect(out).not.toContain("undefined");
      expect(out).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(out).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("образец с 8 столбцами и 16 строками: прокрутка внутри сцены, а не страницы", () => {
    const big = EXT.find((s) => s.rows.length === 16)!;
    expect(big).toBeDefined();
    const out = grid(big);
    expect(out).toContain("overflow-x-auto");
    expect(out.match(/<tr/g)!.length).toBe(17);
  });

  it("казахский: подписи состояний и «было» на языке ученика (словарь)", async () => {
    const { dict } = await import("@/i18n/dict");
    for (const k of ["scene.table.struck", "scene.table.dim", "scene.table.rejected", "scene.table.new", "scene.table.was", "scene.table.formulaBar"] as const) {
      expect(dict[k].kk.trim()).not.toBe("");
      expect(dict[k].kk).not.toBe(dict[k].ru);
    }
  });
});

describe("ревью v18b: острие стрелки по строке — внутри целевой ячейки, а не на границе строк", () => {
  /** Сетка строк × столбцов; ячейка w × h. */
  const gridOf = (rows: number, cols: number, w: number, h: number) => ({
    cell: (r: number, c: number): Rect => ({ x: c * w, y: r * h, w, h }),
    bounds: { w: cols * w, h: rows * h },
  });
  const shapes: [number, number, number, number][] = [[4, 5, 80, 36], [3, 4, 100, 35], [6, 8, 64, 35], [2, 3, 90, 32]];

  it("и острие, и весь наконечник лежат в целевой ячейке по вертикали: не ближе 8 px к её границе строк", () => {
    let checked = 0;
    for (const [rows, cols, w, h] of shapes) {
      const { cell: c, bounds } = gridOf(rows, cols, w, h);
      for (let r = 0; r < rows; r++)
        for (let a = 0; a < cols; a++)
          for (let b = 0; b < cols; b++) {
            if (a === b) continue;
            const g = arrowGeometry(c(r, a), c(r, b), bounds);
            const to = c(r, b);
            // только плоские дуги по строке (у однострочных и узких ячеек работают другие виды стрелок)
            if (!g || Math.abs(g.start[1] - g.end[1]) > 1) continue;
            if (g.end[1] < to.y + 3 || g.end[1] > to.y + to.h - 3) continue;
            checked++;
            const depth = Math.min(g.end[1] - to.y, to.y + to.h - g.end[1]);
            expect(depth, `${rows}×${cols} ${r}:${a}→${r}:${b}: острие`).toBeGreaterThanOrEqual(8);
            for (const p of g.head) {
              expect(p[1], `наконечник сверху ${r}:${a}→${r}:${b}`).toBeGreaterThanOrEqual(to.y);
              expect(p[1], `наконечник снизу ${r}:${a}→${r}:${b}`).toBeLessThanOrEqual(to.y + to.h);
            }
            expect(g.end[0]).toBeGreaterThanOrEqual(to.x + 6);
            expect(g.end[0]).toBeLessThanOrEqual(to.x + to.w - 6);
          }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("вершина дуги стоит не на линии между строками: от неё не менее 3 px и не дальше, чем нижний отступ соседней строки (цифры не задеты)", () => {
    expect(END_INSET - FLAT_PEAK).toBeLessThanOrEqual(-3);
    for (const [rows, cols, w, h] of shapes) {
      const { cell: c, bounds } = gridOf(rows, cols, w, h);
      for (let r = 1; r < rows - 1; r++) {
        const g = arrowGeometry(c(r, 0), c(r, 2), bounds)!;
        const apex = (g.start[1] + g.end[1]) / 4 + g.ctrl[1] / 2;
        const border = c(r, 0).y;
        expect(Math.abs(apex - border)).toBeGreaterThanOrEqual(3);
        expect(Math.abs(apex - border)).toBeLessThanOrEqual(8);
        // обратное направление и дуга под строкой в первой строке — то же
        const back = arrowGeometry(c(r, 2), c(r, 0), bounds)!;
        expect(Math.abs((back.start[1] + back.end[1]) / 4 + back.ctrl[1] / 2 - border)).toBeGreaterThanOrEqual(3);
      }
      const first = arrowGeometry(c(0, 0), c(0, 2), bounds)!;
      const apex0 = (first.start[1] + first.end[1]) / 4 + first.ctrl[1] / 2;
      expect(Math.abs(apex0 - (c(0, 0).y + h))).toBeGreaterThanOrEqual(3);
    }
  });

  it("образец «=A2*B2» (две стрелки в C2 из A2 и B2): оба острия внутри C2, разведены по ширине ячейки, наконечники не пересекаются", () => {
    const sc = EXTENDED.find((x): x is TableScene => x.kind === "table" && !!x.sheet && x.arrows?.length === 2)!;
    expect(sc).toBeDefined();
    const slots = arrowSlots(sc);
    expect(slots.map((q) => q.slots)).toEqual([2, 2]);
    const { cell: c, bounds } = gridOf(2, 3, 100, 36);
    const [a1, a2] = sc.arrows!.map((a, i) => arrowGeometry(c(a.from[0], a.from[1]), c(a.to[0], a.to[1]), bounds, slots[i])!);
    const to = c(1, 2);
    for (const g of [a1, a2]) {
      expect(g.end[1] - to.y).toBeGreaterThanOrEqual(8);
      expect(g.end[0]).toBeGreaterThan(to.x);
      expect(g.end[0]).toBeLessThan(to.x + to.w);
    }
    expect(Math.abs(a1.end[0] - a2.end[0])).toBeGreaterThanOrEqual(10);
  });
});

describe("ревью v18b (перепроверка): острие стрелки не садится на цифры целевой ячейки", () => {
  /** Верх цифр и заглавных от края ячейки: блок текста + разрыв до высоты прописных (≈ 0,1 кегля), оценка ревью ≈ 11,8 px. */
  const CAP_TOP = TEXT_TOP + 0.1 * CELL_FONT;
  const CELL_H = 2 * CELL_PAD_Y + CELL_LINE;
  const shapes: [number, number, number][] = [[4, 5, 80], [3, 4, 100], [6, 8, 64], [2, 3, 90], [5, 8, 46], [4, 3, 120]];
  const gridOf = (rows: number, cols: number, w: number) => ({
    cell: (r: number, c: number): Rect => ({ x: c * w, y: r * CELL_H, w, h: CELL_H }),
    bounds: { w: cols * w, h: rows * CELL_H },
  });

  it("метрики ячейки в константах совпадают с разметкой (py-2, text-sm, leading-snug): блок текста начинается на TEXT_TOP ≈ 10,6 px", () => {
    expect(CELL_PAD_Y).toBe(8); // py-2
    expect(CELL_FONT).toBe(14); // text-sm
    expect(CELL_LINE).toBeCloseTo(14 * 1.375, 5); // leading-snug
    expect(TEXT_TOP).toBeCloseTo(10.625, 3);
    const markup = grid({ kind: "table", sheet: true, columns: ["12", "34"], rows: [["56", "78"]], arrows: [{ from: [0, 0], to: [0, 1] }] });
    expect(markup).toContain("py-2");
    expect(markup).toContain("text-sm");
    expect(markup).toContain("leading-snug");
  });

  it("острие стоит не ближе 2 px к блоку текста (было ≈ 0,6 px при END_INSET = 10) и не ближе 3 px к верху цифр — по верху и по низу ячейки", () => {
    expect(TEXT_TOP - END_INSET).toBeGreaterThanOrEqual(2);
    expect(CAP_TOP - END_INSET).toBeGreaterThanOrEqual(3);
    let up = 0;
    let down = 0;
    for (const [rows, cols, w] of shapes) {
      const { cell: c, bounds } = gridOf(rows, cols, w);
      for (let r = 0; r < rows; r++)
        for (let a = 0; a < cols; a++)
          for (let b = 0; b < cols; b++) {
            if (a === b) continue;
            const g = arrowGeometry(c(r, a), c(r, b), bounds);
            const to = c(r, b);
            if (!g || Math.abs(g.start[1] - g.end[1]) > 1) continue; // только плоские дуги по строке
            const fromTop = g.end[1] - to.y;
            const fromBottom = to.y + to.h - g.end[1];
            if (Math.min(fromTop, fromBottom) > 12) continue;
            if (fromTop < fromBottom) up++;
            else down++;
            const gap = Math.min(fromTop, fromBottom);
            // расстояние от острия до блока текста: TEXT_TOP − gap (оба края симметричны: отступы py-2 одинаковы)
            expect(TEXT_TOP - gap, `${rows}×${cols}/${w} ${r}:${a}→${r}:${b}: острие и блок текста`).toBeGreaterThanOrEqual(2);
            expect(CAP_TOP - gap, `${rows}×${cols}/${w} ${r}:${a}→${r}:${b}: острие и верх цифр`).toBeGreaterThanOrEqual(3);
          }
    }
    expect(up).toBeGreaterThan(50);
    expect(down).toBeGreaterThan(5);
  });

  it("наконечник целиком в ячейке даже при реальной высоте (35,25 px) и самом неудобном угле подхода: не пересекает границу строк", () => {
    let checked = 0;
    for (const [rows, cols, w] of shapes) {
      const { cell: c, bounds } = gridOf(rows, cols, w);
      for (let r = 0; r < rows; r++)
        for (let a = 0; a < cols; a++)
          for (let b = 0; b < cols; b++) {
            if (a === b) continue;
            const g = arrowGeometry(c(r, a), c(r, b), bounds);
            if (!g || Math.abs(g.start[1] - g.end[1]) > 1) continue;
            const to = c(r, b);
            if (g.end[1] < to.y + 3 || g.end[1] > to.y + to.h - 3) continue;
            checked++;
            for (const p of g.head) {
              expect(p[1], `${rows}×${cols}/${w} ${r}:${a}→${r}:${b} сверху`).toBeGreaterThanOrEqual(to.y);
              expect(p[1], `${rows}×${cols}/${w} ${r}:${a}→${r}:${b} снизу`).toBeLessThanOrEqual(to.y + to.h);
            }
          }
    }
    expect(checked).toBeGreaterThan(100);
  });
});
