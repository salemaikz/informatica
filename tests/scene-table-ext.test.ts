import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TableScene as TableView } from "@/components/scenes/TableScene";
import { SceneView } from "@/components/scenes/SceneView";
import { SAMPLES as EXTENDED } from "@/components/scenes/samples/extended";
import {
  JOIN_WIDE_FROM,
  arrowGeometry,
  changeMap,
  joinLinkPath,
  joinTones,
  needsOverlay,
  rangeRect,
  rayExit,
  rectCenter,
  rowStateMap,
  sheetRowNumber,
  toneMap,
  usesTableExt,
  type Rect,
  type TableScene,
} from "@/components/scenes/table";
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

  it("стрелка по строке: дуга над строкой, начало и конец — на верхних границах ячеек, наконечник в конце", () => {
    const a = arrowGeometry(cell(2, 0), cell(2, 2), bounds)!;
    expect(a).not.toBeNull();
    expect(a.ctrl[1]).toBeLessThan(cell(2, 0).y);
    expect(a.start[1]).toBeCloseTo(cell(2, 0).y, 0);
    expect(a.end[1]).toBeCloseTo(cell(2, 2).y, 0);
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
  it("каждая строка левой таблицы — свой тон по кругу; правая берёт тон первой связи", () => {
    const { left, right } = joinTones([[0, 0], [1, 1], [2, 0], [3, 2]]);
    expect(left.get(0)).toBe("primary");
    expect(left.get(1)).toBe("warning");
    expect(left.get(2)).toBe("success");
    expect(left.get(3)).toBe("primary");
    expect(right.get(0)).toBe("primary");
    expect(right.get(2)).toBe("primary");
    // «один ко многим»: слева одна строка, справа две — тон один
    const one = joinTones([[0, 0], [0, 1]]);
    expect(one.right.get(0)).toBe(one.right.get(1));
    expect(joinTones([]).left.size).toBe(0);
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
    expect(out).toContain("text-danger-strong");
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
    expect(out).toContain("bg-warning-soft");
    expect(out).toContain("bg-success-soft");
    // первое отрисованное состояние — друг под другом (ширина ещё не измерена)
    expect(out).toContain("flex-col");
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
