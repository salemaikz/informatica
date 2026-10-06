import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneView } from "@/components/scenes/SceneView";
import { SCENE_SAMPLES } from "@/components/scenes/samples";
import { SAMPLES as EXTENDED } from "@/components/scenes/samples/extended";
import { SAMPLES as BOX } from "@/components/scenes/samples/box";
import { SAMPLES as WEB } from "@/components/scenes/samples/web";
import { SAMPLES as GATES } from "@/components/scenes/samples/gates";
import { CIRCUIT_MIN_SCALE, ROW_SPREADS, layoutCircuit, type CircuitScene, type CircuitWire } from "@/components/scenes/circuit";
import { RULER_MAX_W, boxRuler, rulerRows } from "@/components/scenes/box";
import { TAIL_KEEP, TAIL_MAX, splitTail } from "@/components/scenes/message";
import { CELL_GAP, NUM_W, WEIGHT_GAP, binaryUnits, expFont, layoutRows, shiftBits, shiftResultChunks, weightMode, weightShift, weightTier, weightWidth } from "@/components/scenes/numbers";
import { FADE_PX, fadeMask, fadeWidths, scrollEdges } from "@/components/scenes/scroll-hint";
import { arrowGeometry, arrowSlots, arrowTargets, type Rect, type TableScene } from "@/components/scenes/table";
import { dict } from "@/i18n/dict";
import { translate } from "@/i18n/useT";
import type { Scene } from "@/lib/types";

// Пакет «рисунки волны 3 (2)», визуальное ревью v18: регрессионные тесты на раскладку (длинные двоичные числа, схема-сумматор,
// стрелки и прокрутка таблицы, линейка box, номера признаков, подложка окна web, центровка вентилей, токены ink-*).

const html = (scene: Scene) => renderToStaticMarkup(createElement(SceneView, { scene }));
const IP = "11000000101010000000000100001010";

describe("binary: результат сдвига не рвётся посреди числа", () => {
  it("32 разряда по 8: куски по байтам и отдельный приписанный ноль; склейка даёт результат сдвига", () => {
    const parts = shiftResultChunks(IP, "left", 8);
    expect(parts).toEqual(["11000000", "10101000", "00000001", "00001010", "0"]);
    expect(parts.join("")).toBe(shiftBits(IP, "left"));
  });

  it("группы считаются справа налево, как плитки: неполная левая группа короче", () => {
    expect(shiftResultChunks("1101011", "left", 4)).toEqual(["110", "1011", "0"]);
    expect(shiftResultChunks("11010111", "right", 3)).toEqual(["1", "101", "011"]);
    expect(shiftResultChunks("11010111", "right", 4).join("")).toBe(shiftBits("11010111", "right"));
  });

  it("короткие числа — одним куском («1011010»), длинные без групп — по 8 справа", () => {
    expect(shiftResultChunks("101101", "left")).toEqual(["1011010"]);
    expect(shiftResultChunks("101101", "right")).toEqual(["10110"]);
    // 17 разрядов в одну строку помещаются (≈ 185 px), группировать нечего
    expect(shiftResultChunks("1010110011110000", "left")).toEqual(["10101100111100000"]);
    expect(shiftResultChunks("10101100111100001", "left")).toEqual(["1", "01011001", "11100001", "0"]);
    expect(shiftResultChunks("1", "right")).toEqual(["0"]);
  });

  it("в рисунке: break-all нет, каждый кусок — отдельный неразрывный блок, подпись и число по центру", () => {
    const out = html({ kind: "binary", bits: IP, groups: 8, shift: "left" });
    expect(out).not.toContain("break-all");
    const num = out.slice(out.indexOf("data-shift-result"));
    const spans = [...num.slice(0, num.indexOf("</p>") > 0 ? num.length : num.length).matchAll(/<span class="whitespace-nowrap">([^<]*(?:<!-- -->)?[^<]*)<\/span>/g)].map((m) => m[1].replace(/<!-- -->/g, ""));
    expect(spans.slice(0, 5)).toEqual(["11000000", "10101000", "00000001", "00001010", "0₂"]);
    expect(out).toContain("text-balance");
    // длинное число: подпись над числом по центру, а не слева в одной строке
    expect(out).toMatch(/class="[^"]*flex-col items-center"><span>получится:<\/span>/);
  });

  it("короткое число остаётся в одной строке с подписью", () => {
    const out = html({ kind: "binary", bits: "101101", shift: "left" });
    expect(out).toContain("flex-wrap");
    expect(out).not.toMatch(/flex-col items-center"><span>получится:/);
  });

  it("подпись сдвига: число связано с предлогом неразрывным пробелом (U+00A0)", () => {
    for (const lang of ["ru", "kk"] as const) {
      const left = translate(lang, "scene.binary.shiftLeft");
      const right = translate(lang, "scene.binary.shiftRight");
      if (lang === "ru") {
        expect(left).toContain("на 2");
        expect(left).toContain("приписан 0");
        expect(right).toContain("на 2");
      }
      // ни «на 2», ни «приписан 0» с обычным пробелом не остаётся
      expect(left).not.toMatch(/на 2|приписан 0/);
      expect(right).not.toMatch(/на 2/);
    }
    expect(dict["scene.binary.shiftLeft"].kk).toContain("2-ге");
  });
});

describe("binary: подписи весов", () => {
  const exps32 = Array.from({ length: 32 }, (_, i) => 31 - i);
  const exps16 = Array.from({ length: 16 }, (_, i) => 15 - i);

  it("подписи одного яруса не касаются: зазор не меньше WEIGHT_GAP при любой ширине плитки (в двух ярусах места вдвое больше)", () => {
    for (const tileW of [12, 14, 16, 17, 20, 22, 26, 30, 37, 40]) {
      for (const exps of [exps32, exps16, exps32.slice(0, 8), [9, 8, 7, 2, 1, 0], [3, 2, 1, 0]]) {
        const wm = weightMode(exps, tileW);
        const widest = Math.max(...exps.map((e) => weightWidth(e, wm.mode, wm.font)));
        expect((tileW + CELL_GAP) * wm.tiers - widest, `плитка ${tileW}, ${exps.length} разрядов`).toBeGreaterThanOrEqual(WEIGHT_GAP - 1e-6);
      }
    }
  });

  it("кегль подписей не мельче 10 (число) и показатель не мельче 10 (степень) на любой плитке образцов: плотная строка — два яруса", () => {
    for (const tileW of [12, 14, 16, 17, 20, 22, 26, 30, 37, 40]) {
      for (const exps of [exps32, exps16, exps32.slice(0, 12), [9, 8, 7, 2, 1, 0]]) {
        const wm = weightMode(exps, tileW);
        if (wm.mode === "value") expect(wm.font, `плитка ${tileW}`).toBeGreaterThanOrEqual(10);
        else expect(expFont(wm.font), `плитка ${tileW}`).toBeGreaterThanOrEqual(10);
        expect(wm.font).toBeGreaterThanOrEqual(10);
      }
    }
    // обычная плитка (22 px, группы по 3): степень в один ярус
    const lay = layoutRows(binaryUnits(IP, { groups: 3 }), { weights: true, brackets: true });
    expect(weightMode(exps32, lay.tileW)).toMatchObject({ mode: "pow", tiers: 1 });
    // плотная строка (16 плиток по 16–17 px): два яруса, а не кегль 7–9
    for (const groups of [4, 8] as const) {
      const dense = layoutRows(binaryUnits(IP, { groups }), { weights: true, brackets: true });
      expect(dense.tileW).toBeLessThanOrEqual(17);
      const wm = weightMode(exps32, dense.tileW);
      expect(wm).toMatchObject({ mode: "pow", tiers: 2 });
      expect(wm.font).toBeGreaterThanOrEqual(13);
    }
    // 16 разрядов: число вместо степени, в два яруса и не мельче 10
    const sixteen = weightMode(exps16, layoutRows(binaryUnits("1".repeat(16), { groups: 4 }), { weights: true }).tileW);
    expect(sixteen).toMatchObject({ mode: "value", tiers: 2 });
    expect(sixteen.font).toBeGreaterThanOrEqual(10);
  });

  it("два яруса: чётные степени вверху, нечётные внизу; высота блока растёт на ярус, скобки уезжают ниже", () => {
    expect([weightTier(30, 2), weightTier(31, 2), weightTier(31, 1), weightTier(0, 2)]).toEqual([0, 1, 0, 0]);
    const units = binaryUnits(IP, { groups: 4 });
    const one = layoutRows(units, { weights: true, brackets: true });
    const two = layoutRows(units, { weights: true, weightTiers: 2, brackets: true });
    expect(two.bracketDy - one.bracketDy).toBe(two.weightH);
    expect(two.height - one.height).toBe(two.weightH * two.rows.length);
    // подписи соседних плиток (разных ярусов) по вертикали разнесены на ярус; одного яруса — через плитку
    const row = two.rows[0].cells;
    for (let i = 1; i < row.length; i++) expect(weightTier(row[i].exp!, 2)).not.toBe(weightTier(row[i - 1].exp!, 2));
  });

  it("подпись крайней плитки не выходит за края рисунка (weightShift)", () => {
    expect(weightShift(11, 30)).toBe(4);
    expect(weightShift(NUM_W - 11, 30)).toBe(-4);
    expect(weightShift(100, 30)).toBe(0);
    for (const s of EXTENDED) {
      if (s.kind !== "binary" || !s.weights) continue;
      const units = binaryUnits(s.bits, { groups: s.groups, gap: s.gap, shift: s.shift });
      const flat = layoutRows(units, { weights: true, brackets: !!s.groups, maxTiles: s.shift && !s.groups ? 17 : undefined });
      const exps = units.flatMap((u) => u.cells.flatMap((c) => (c.kind === "digit" && !c.pad && c.exp !== undefined ? [c.exp] : [])));
      const wm = weightMode(exps, flat.tileW);
      for (const row of flat.rows)
        for (const c of row.cells) {
          if (c.kind !== "digit" || c.pad || c.exp === undefined) continue;
          const w = weightWidth(c.exp, wm.mode, wm.font);
          const center = c.x + flat.tileW / 2 + weightShift(c.x + flat.tileW / 2, w);
          expect(center - w / 2).toBeGreaterThanOrEqual(-1e-6);
          expect(center + w / 2).toBeLessThanOrEqual(NUM_W + 1e-6);
        }
    }
  });

  it("в рисунке: показатель — tspan с кеглем не мельче 10, юникод-степеней «2³¹» в подписях нет; в плотной строке нижний ярус связан чёрточкой", () => {
    const out = html({ kind: "binary", bits: "1".repeat(32), groups: 3, weights: true });
    expect(out).toContain("<tspan");
    expect(out).not.toMatch(/2[⁰¹²³⁴⁵⁶⁷⁸⁹]/);
    expect(out).toContain("fill-ink-primary");
    const sizes = [...out.matchAll(/<tspan font-size="(\d+)"/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    for (const sz of sizes) expect(sz).toBeGreaterThanOrEqual(10);
    // группы по 3 — один ярус, чёрточек нет
    expect(out).not.toContain('stroke-width="1" class="stroke-border"');
    const dense = html({ kind: "binary", bits: IP, groups: 4, weights: true });
    for (const m of dense.matchAll(/<tspan font-size="(\d+)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(10);
    // 16 нижних подписей (нечётные степени) — по чёрточке у каждой
    expect((dense.match(/<line x1="[\d.]+" x2="[\d.]+" y1="[\d.]+" y2="[\d.]+" stroke-width="1" class="stroke-border">/g) ?? []).length).toBe(16);
  });

  it("все образцы binary/decimal укладываются в ширину рисунка (плитки внутри NUM_W)", () => {
    for (const s of EXTENDED) {
      if (s.kind !== "binary") continue;
      const lay = layoutRows(binaryUnits(s.bits, { groups: s.groups, gap: s.gap, shift: s.shift }), { weights: !!s.weights, brackets: !!s.groups, maxTiles: s.shift && !s.groups ? 17 : undefined });
      for (const row of lay.rows) for (const c of row.cells) expect(c.x + lay.tileW).toBeLessThanOrEqual(NUM_W + 0.001);
    }
  });
});

describe("circuit: сумматор читается", () => {
  const circuits = EXTENDED.filter((s): s is CircuitScene => s.kind === "circuit");
  const adder = circuits[circuits.length - 1];
  const LABELS = {
    ru: { xor: ["XOR"], and: ["И"], or: ["ИЛИ"], not: ["НЕ"], nand: ["И-НЕ"], nor: ["ИЛИ-НЕ"] },
    kk: { xor: ["XOR"], and: ["ЖӘНЕ"], or: ["НЕМЕСЕ"], not: ["ЕМЕС"], nand: ["ЖӘНЕ-", "ЕМЕС"], nor: ["НЕМЕСЕ-", "ЕМЕС"] },
  };

  it("последний образец — полный сумматор с тремя входами и пятью вентилями", () => {
    expect(adder.inputs).toHaveLength(3);
    expect(adder.gates).toHaveLength(5);
    expect(adder.outputs).toHaveLength(2);
  });

  it("все подписи вентилей стоят под рамками и ничего не пересекают (ru и kk), ряды раздвинуты при необходимости", () => {
    for (const lang of ["ru", "kk"] as const)
      for (const sc of circuits) {
        const lay = layoutCircuit(sc, { labelLines: 1, labels: LABELS[lang] });
        expect(lay.nodes.filter((n) => n.labelAbove).map((n) => n.id), `${lang}: подписи над рамкой`).toEqual([]);
        expect(lay.labelConflicts, `${lang}: пересечения подписей`).toBe(0);
      }
    const lay = layoutCircuit(adder, { labelLines: 1, labels: LABELS.ru });
    expect(lay.rowSpread).toBeGreaterThan(0);
    expect(ROW_SPREADS as readonly number[]).toContain(lay.rowSpread);
  });

  it("у схем без выходов раскладка не меняется: подпись по-прежнему может уйти наверх, ряды не раздвигаются", () => {
    const old: CircuitScene = {
      kind: "circuit",
      inputs: ["A", "B", "C"],
      gates: [{ id: "g1", op: "and", in: ["A", "B"] }, { id: "g2", op: "not", in: ["B"] }, { id: "g3", op: "and", in: ["g2", "C"] }, { id: "g4", op: "or", in: ["g1", "g3"] }],
      output: "g4",
    };
    const lay = layoutCircuit(old, { labelLines: 1, labels: LABELS.ru });
    expect(lay.rowSpread).toBe(0);
    expect(lay.nodes.find((n) => n.id === "g2")?.labelAbove).toBe(true);
  });

  it("параллельные вертикали проводов разных источников отстоят не меньше чем на 8 px", () => {
    for (const sc of circuits) {
      const lay = layoutCircuit(sc, { labelLines: 1, labels: LABELS.ru });
      const vert = (w: CircuitWire) => w.points.slice(0, -1).flatMap((p, i) => (p[0] === w.points[i + 1][0] ? [{ x: p[0], y0: Math.min(p[1], w.points[i + 1][1]), y1: Math.max(p[1], w.points[i + 1][1]) }] : []));
      for (let i = 0; i < lay.wires.length; i++)
        for (let j = i + 1; j < lay.wires.length; j++) {
          if (lay.wires[i].from === lay.wires[j].from) continue;
          for (const a of vert(lay.wires[i]))
            for (const b of vert(lay.wires[j])) {
              if (a.y1 <= b.y0 || b.y1 <= a.y0) continue;
              if (a.x !== b.x) expect(Math.abs(a.x - b.x), `${lay.wires[i].from}>${lay.wires[i].to} × ${lay.wires[j].from}>${lay.wires[j].to}`).toBeGreaterThanOrEqual(8);
            }
        }
    }
  });

  it("в рисунке: схема не сжимается мельче CIRCUIT_MIN_SCALE (подписи ≥ 11 px), узкий блок прокручивается", () => {
    expect(CIRCUIT_MIN_SCALE * 13).toBeGreaterThanOrEqual(10.9);
    const lay = layoutCircuit(adder, { labelLines: 1, labels: LABELS.ru });
    const out = html(adder);
    const min = Number(out.match(/min-width:(\d+)px/)?.[1]);
    expect(min).toBe(Math.round(lay.width * CIRCUIT_MIN_SCALE));
    // на телефоне 360 px (рисунок в блоке 304 px) сумматор помещается без прокрутки
    expect(min).toBeLessThanOrEqual(304);
    expect(out).toContain("overflow-x-auto");
  });

  it("схемы без outputs (уроки, банк, ЕНТ) рисуются как раньше: по ширине блока, без min-width и без прокрутки", () => {
    // шесть вентилей, раскладка шире блока 304 px (как в уроке «Законы логики»): раньше сжималась до ≈ 0,72, не прокручивалась
    const six: CircuitScene = {
      kind: "circuit",
      inputs: ["A", "B", "C"],
      gates: [
        { id: "g1", op: "not", in: ["A"] },
        { id: "g2", op: "and", in: ["g1", "B"] },
        { id: "g3", op: "or", in: ["g2", "C"] },
        { id: "g4", op: "not", in: ["g3"] },
        { id: "g5", op: "and", in: ["g4", "A"] },
        { id: "g6", op: "or", in: ["g5", "B"] },
      ],
      output: "g6",
    };
    expect(layoutCircuit(six, { labelLines: 1, labels: LABELS.ru }).width).toBeGreaterThan(304 / CIRCUIT_MIN_SCALE);
    const out = html(six);
    expect(out).not.toContain("min-width");
    expect(out).not.toContain("overflow-x-auto");
    expect(out).not.toContain("data-circuit-scroll");
    expect(out).toMatch(/<svg[^>]*class="mx-auto block h-auto w-full"/);
    // а сумматор (outputs) — в блоке с подсказкой прокрутки
    expect(html(adder)).toContain("data-circuit-scroll");
  });

  it("плашки значений: зелёный текст — токен ink (читается в тёмной теме на success-soft)", () => {
    expect(html(adder)).toContain("fill-ink-success");
    expect(html(adder)).not.toContain("fill-success-strong");
  });
});

describe("scroll-hint: подсказка прокрутки", () => {
  it("scrollEdges: нечего прокручивать — нет краёв; в начале — справа; посередине — с обеих сторон; в конце — слева", () => {
    expect(scrollEdges({ scrollLeft: 0, clientWidth: 300, scrollWidth: 300 })).toEqual({ left: false, right: false });
    expect(scrollEdges({ scrollLeft: 0, clientWidth: 300, scrollWidth: 301.5 })).toEqual({ left: false, right: false });
    expect(scrollEdges({ scrollLeft: 0, clientWidth: 300, scrollWidth: 500 })).toEqual({ left: false, right: true });
    expect(scrollEdges({ scrollLeft: 100, clientWidth: 300, scrollWidth: 500 })).toEqual({ left: true, right: true });
    expect(scrollEdges({ scrollLeft: 200, clientWidth: 300, scrollWidth: 500 })).toEqual({ left: true, right: false });
  });

  it("fadeMask: null без скрытого содержимого; гаснет только тот край, за которым есть продолжение; без hex-цветов", () => {
    expect(fadeMask({ left: false, right: false })).toBeNull();
    const right = fadeMask({ left: false, right: true })!;
    expect(right).toContain(`calc(100% - ${FADE_PX}px)`);
    expect(right).not.toContain("transparent 0");
    const left = fadeMask({ left: true, right: false })!;
    expect(left).toContain("transparent 0");
    expect(left).not.toContain("calc(100%");
    expect(fadeMask({ left: true, right: true })).toContain("calc(100%");
    for (const m of [right, left]) expect(m).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it("fadeWidths: затухание не шире реально скрытого остатка (скрыто 6 px — гаснут 6 px, а не 36)", () => {
    expect(fadeWidths({ scrollLeft: 0, clientWidth: 300, scrollWidth: 300 })).toEqual({ left: 0, right: 0 });
    expect(fadeWidths({ scrollLeft: 0, clientWidth: 300, scrollWidth: 301.5 })).toEqual({ left: 0, right: 0 });
    expect(fadeWidths({ scrollLeft: 0, clientWidth: 300, scrollWidth: 306 })).toEqual({ left: 0, right: 6 });
    expect(fadeWidths({ scrollLeft: 6, clientWidth: 300, scrollWidth: 306 })).toEqual({ left: 6, right: 0 });
    // много скрытого — полная ширина, у конца прокрутки сужается плавно
    expect(fadeWidths({ scrollLeft: 0, clientWidth: 300, scrollWidth: 500 })).toEqual({ left: 0, right: FADE_PX });
    expect(fadeWidths({ scrollLeft: 100, clientWidth: 300, scrollWidth: 500 })).toEqual({ left: FADE_PX, right: FADE_PX });
    expect(fadeWidths({ scrollLeft: 190, clientWidth: 300, scrollWidth: 500 })).toEqual({ left: FADE_PX, right: 10 });
    // согласовано с scrollEdges: край гаснет ровно тогда, когда подсказка показана
    for (const m of [{ scrollLeft: 0, clientWidth: 300, scrollWidth: 306 }, { scrollLeft: 3, clientWidth: 300, scrollWidth: 306 }, { scrollLeft: 100, clientWidth: 300, scrollWidth: 500 }]) {
      const e = scrollEdges(m);
      const w = fadeWidths(m);
      expect(w.left > 0).toBe(e.left);
      expect(w.right > 0).toBe(e.right);
    }
  });

  it("fadeMask с ширинами: градиент берёт реальный остаток, а не FADE_PX; без ширин — как раньше", () => {
    const right = fadeMask({ left: false, right: true }, { left: 0, right: 6 })!;
    expect(right).toContain("calc(100% - 6px)");
    expect(right).not.toContain(`${FADE_PX}px`);
    const both = fadeMask({ left: true, right: true }, { left: 12, right: 4 })!;
    expect(both).toContain("black 12px");
    expect(both).toContain("calc(100% - 4px)");
    expect(fadeMask({ left: false, right: true })).toContain(`calc(100% - ${FADE_PX}px)`);
    expect(fadeMask({ left: false, right: false }, { left: 0, right: 0 })).toBeNull();
  });
});

describe("table: стрелки указывают в ячейку", () => {
  // Таблица как на телефоне: номера строк 40 px, столбцы по 44 px, последний — 120 px; строки по 36 px под шапкой 28 px.
  const widths = [44, 44, 44, 44, 44, 44, 44, 120];
  const xs = widths.map((_, c) => 40 + widths.slice(0, c).reduce((a, b) => a + b, 0));
  const cell = (r: number, c: number): Rect => ({ x: xs[c], y: 28 + r * 36, w: widths[c], h: 36 });
  const bounds = { w: 40 + widths.reduce((a, b) => a + b, 0), h: 28 + 16 * 36 };
  const inside = (p: [number, number], r: Rect) => p[0] > r.x && p[0] < r.x + r.w && p[1] > r.y && p[1] < r.y + r.h;

  it("стрелка по строке: острие внутри целевой ячейки, а не на границе строк", () => {
    for (const [from, to] of [[cell(1, 0), cell(1, 2)], [cell(1, 1), cell(1, 2)], [cell(5, 3), cell(5, 7)], [cell(5, 7), cell(5, 3)]]) {
      const g = arrowGeometry(from, to, bounds)!;
      expect(inside(g.end, to), `острие ${g.end}`).toBe(true);
      expect(inside(g.start, from), `начало ${g.start}`).toBe(true);
      // и достаточно глубоко, чтобы не читаться как «граница» (не ближе 3 px к верхнему краю)
      expect(g.end[1] - to.y).toBeGreaterThanOrEqual(3);
    }
  });

  it("несколько стрелок в одну ячейку разведены: слот 0 — у самого дальнего источника и левее остальных", () => {
    const sc: TableScene = { kind: "table", sheet: true, rows: [["2", "3", "=A1*B1"]], arrows: [{ from: [0, 1], to: [0, 2] }, { from: [0, 0], to: [0, 2] }] };
    const slots = arrowSlots(sc);
    expect(slots).toEqual([{ slot: 1, slots: 2 }, { slot: 0, slots: 2 }]);
    const to = cell(1, 2);
    const far = arrowGeometry(cell(1, 0), to, bounds, slots[1])!;
    const near = arrowGeometry(cell(1, 1), to, bounds, slots[0])!;
    expect(far.end[0]).toBeLessThan(near.end[0]);
    expect(near.end[0] - far.end[0]).toBeGreaterThanOrEqual(12);
    expect(inside(far.end, to) && inside(near.end, to)).toBe(true);
  });

  it("arrowTargets: цель — ячейка, куда указывает стрелка, с тоном стрелки (по умолчанию primary)", () => {
    const sc: TableScene = { kind: "table", rows: [["a", "b"], ["c", "d"]], arrows: [{ from: [0, 0], to: [1, 1] }, { from: [0, 1], to: [1, 0], tone: "success" }] };
    expect([...arrowTargets(sc)]).toEqual([["1:1", "primary"], ["1:0", "success"]]);
  });

  it("диагональная стрелка идёт по линиям сетки и не задевает цифры ни одной ячейки (A1 → H16 в таблице 8×16)", () => {
    const from = cell(0, 0);
    const to = cell(15, 7);
    const g = arrowGeometry(from, to, bounds)!;
    // ломаная: начало на границе под первой строкой, поворот на левой границе целевого столбца, вход в середину целевой ячейки
    expect(g.start[1]).toBeCloseTo(from.y + from.h, 0);
    expect(g.ctrl[0]).toBeCloseTo(to.x, 0);
    expect(g.ctrl[1]).toBeCloseTo(from.y + from.h, 0);
    expect(g.end[1]).toBeCloseTo(to.y + to.h / 2, 0);
    expect(inside(g.end, to)).toBe(true);
    // три отрезка ломаной (горизонталь, вертикаль, вход в ячейку) не пересекают «поля с текстом» (ячейка без отступов 12 × 8 px)
    const segs: [[number, number], [number, number]][] = [[g.start, g.ctrl], [g.ctrl, [g.ctrl[0], g.end[1]]], [[g.ctrl[0], g.end[1]], g.end]];
    for (let r = 0; r < 16; r++)
      for (let c = 0; c < 8; c++) {
        const k = cell(r, c);
        const box = { x0: k.x + 12, x1: k.x + k.w - 12, y0: k.y + 8, y1: k.y + k.h - 8 };
        for (const [a, b] of segs) {
          const hit = Math.max(a[0], b[0]) > box.x0 && Math.min(a[0], b[0]) < box.x1 && Math.max(a[1], b[1]) > box.y0 && Math.min(a[1], b[1]) < box.y1;
          expect(hit, `ячейка ${r},${c}`).toBe(false);
        }
      }
    expect(g.d).not.toContain("NaN");
    expect(g.head[0]).toEqual(g.end);
  });

  it("диагональ в любую сторону: конечные числа, острие внутри цели, путь внутри таблицы", () => {
    const cells = [cell(2, 1), cell(6, 5), cell(0, 7), cell(12, 0)];
    for (const a of cells)
      for (const b of cells) {
        if (a === b) continue;
        const g = arrowGeometry(a, b, bounds)!;
        expect(g).not.toBeNull();
        expect(inside(g.end, b), `${a.x},${a.y} → ${b.x},${b.y}`).toBe(true);
        for (const v of [...g.start, ...g.end, ...g.ctrl, ...g.head.flat()]) expect(Number.isFinite(v)).toBe(true);
        for (const p of [g.start, g.ctrl, g.end]) {
          expect(p[0]).toBeGreaterThanOrEqual(0);
          expect(p[0]).toBeLessThanOrEqual(bounds.w);
          expect(p[1]).toBeGreaterThanOrEqual(0);
          expect(p[1]).toBeLessThanOrEqual(bounds.h);
        }
      }
  });

  it("в разметке: целевая ячейка обведена тоном стрелки, исходные — нет; явная подсветка не дублируется", () => {
    const sheet = EXTENDED.find((s): s is TableScene => s.kind === "table" && !!s.formula && s.formula.cell === "C2")!;
    const out = html(sheet);
    // цель — C2 (строка 1, столбец 2): ring-primary и заливка primary-soft
    expect(out).toContain("relative z-10 ring-2 ring-inset ring-primary");
    const copy = EXTENDED.find((s): s is TableScene => s.kind === "table" && !!s.formula && s.formula.cell === "B2")!;
    const green = html(copy).match(/ring-success/g) ?? [];
    expect(green).toHaveLength(3); // B2, B3, B4 — цели трёх зелёных стрелок
    // C5 выделена явно (highlightCells) и одновременно цель стрелок — рамка одна
    const c5 = EXTENDED.find((s): s is TableScene => s.kind === "table" && !!s.formula && s.formula.cell === "C5")!;
    expect((html(c5).match(/ring-2 ring-inset/g) ?? []).length).toBe(1);
  });

  it("широкая таблица: рамка снаружи, прокрутка внутри (подсказка прокрутки), у старых таблиц — прежняя разметка", () => {
    const wide = EXTENDED[EXTENDED.length - 5] as TableScene;
    expect(wide.rows[0].length).toBe(8);
    const out = html(wide);
    expect(out).toMatch(/<div class="relative mx-auto w-full max-w-xl"><div class="overflow-hidden rounded-2xl border border-border bg-surface"><div class="overflow-x-auto">/);
    const old = html({ kind: "table", columns: ["a", "b"], rows: [["1", "2"]] });
    expect(old).not.toContain("overflow-hidden");
    expect(old).toContain("overflow-x-auto");
  });
});

describe("box: линейка не рвётся неряшливо", () => {
  const widthOf = (row: { head?: string; terms: { term: { text: string }; plus: boolean }[]; total?: string }) =>
    (row.head ? row.head.length * 7.8 : 0) + row.terms.reduce((a, { term, plus }) => a + term.text.length * 7.8 + 12 + (plus ? 11.8 : 0) + 4, 0) + (row.total ? `= ${row.total}`.length * 7.8 : 0);

  it("«200 + … + 200 + 200 + … = 3200 px»: две ровные строки, «+» в начале второй, итог в конце последней", () => {
    const line = boxRuler({ kind: "box", width: 2000, padding: 200, border: 200, margin: 200, total: true })[0];
    const rows = rulerRows(line);
    expect(rows).toHaveLength(2);
    expect(rows[0].terms.map((t) => t.term.text)).toEqual(["200", "200", "200", "2000"]);
    expect(rows[1].terms.map((t) => t.term.text)).toEqual(["200", "200", "200"]);
    // вторая строка начинается со знака «+», а не первая со слагаемого без него
    expect(rows[1].terms[0].plus).toBe(true);
    expect(rows[0].terms[0].plus).toBe(false);
    expect(rows[0].total).toBeUndefined();
    expect(rows[1].total).toBe("3200 px");
    for (const r of rows) expect(widthOf(r)).toBeLessThanOrEqual(RULER_MAX_W + 8);
  });

  it("«width 250 = …»: при переносе заголовок отдельной строкой, слагаемые ниже, без одинокого «10»", () => {
    const line = boxRuler({ kind: "box", width: 250, padding: 25, border: 10, margin: 15, borderBox: true, total: true })[0];
    const rows = rulerRows(line, 250);
    expect(rows[0]).toEqual({ head: "width 250 =", terms: [] });
    expect(rows.slice(1).flatMap((r) => r.terms.map((t) => t.term.text))).toEqual(["10", "25", "180", "25", "10"]);
    // если вся сумма влезает — одна строка вместе с заголовком
    const one = rulerRows(line, 400);
    expect(one).toHaveLength(1);
    expect(one[0].head).toBe("width 250 =");
  });

  it("для каждого образца: слагаемые и итог сохранены по порядку, в строке не меньше двух слагаемых (кроме одной строки)", () => {
    for (const s of BOX) {
      if (!s.total) continue;
      for (const line of boxRuler(s)) {
        const rows = rulerRows(line);
        expect(rows.flatMap((r) => r.terms.map((t) => t.term.text))).toEqual(line.terms.map((t) => t.text));
        expect(rows[rows.length - 1].total).toBe(line.total);
        const bodies = rows.filter((r) => r.terms.length > 0);
        if (bodies.length > 1) for (const r of bodies) expect(r.terms.length).toBeGreaterThanOrEqual(2);
        for (const r of bodies.slice(1)) expect(r.terms[0].plus).toBe(true);
      }
    }
  });

  it("в рисунке: второй блок схлопывания подписан («блок 2» / «2-блок»), не голой цифрой", () => {
    const collapse = BOX.find((s) => s.collapse)!;
    expect(html(collapse)).toContain(dict["scene.box.block2"].ru);
    expect(dict["scene.box.block2"].kk).toBe("2-блок");
    expect(html(collapse)).not.toMatch(/aria-hidden="true">2<\/div>/);
  });
});

describe("message: номер признака не отрывается от фразы", () => {
  it("splitTail: последнее слово отдельно; одно слово — целиком", () => {
    expect(splitTail("Құпия сөзді жауап хатта жіберіңіз")).toEqual({ head: "Құпия сөзді жауап хатта ", tail: "жіберіңіз" });
    expect(splitTail("kaspi-bonus.top")).toEqual({ head: "", tail: "kaspi-bonus.top" });
    expect(splitTail("Срочно")).toEqual({ head: "", tail: "Срочно" });
  });

  it("splitTail: длинный токен (адрес) не склеивается целиком — неразрывен только хвост, остальное переносится", () => {
    const url = "http://kaspi-bonus.top/verify-account";
    expect(url.length).toBeGreaterThan(TAIL_MAX);
    const one = splitTail(url);
    expect(one.tail).toBe(url.slice(-TAIL_KEEP));
    expect(one.head + one.tail).toBe(url);
    const sentence = splitTail(`Перейдите по ссылке ${url}`);
    expect(sentence.head).toBe(`Перейдите по ссылке ${url.slice(0, -TAIL_KEEP)}`);
    expect(sentence.tail).toBe(url.slice(-TAIL_KEEP));
    // слово ровно TAIL_MAX знаков ещё держится целиком, TAIL_MAX + 1 — уже нет
    expect(splitTail("a".repeat(TAIL_MAX)).tail).toHaveLength(TAIL_MAX);
    expect(splitTail("a".repeat(TAIL_MAX + 1)).tail).toHaveLength(TAIL_KEEP);
    // склейка всегда даёт исходный текст (в том числе с казахскими буквами)
    for (const t of ["Құпия сөзді жауап хатта жіберіңіз", "ә", "", "a b", url]) {
      const { head, tail } = splitTail(t);
      expect(head + tail).toBe(t);
    }
  });

  it("в рисунке: признак с длинным адресом — неразрывен только хвост с номером, адрес переносится [overflow-wrap:anywhere]", () => {
    const sms: Scene = {
      kind: "message",
      channel: "sms",
      from: "Kaspi",
      text: { ru: "Бонус: http://kaspi-bonus.top/verify-account", kk: "Бонус: http://kaspi-bonus.top/verify-account" },
      marks: [{ text: "http://kaspi-bonus.top/verify-account", note: { ru: "Подозрительный адрес", kk: "Күдікті мекенжай" } }],
    } as Scene;
    const out = html(sms);
    const nowrap = [...out.matchAll(/<span class="whitespace-nowrap"><mark[^>]*>([^<]*)<\/mark>/g)].map((m) => m[1]);
    expect(nowrap).toEqual(["http://kaspi-bonus.top/verify-account".slice(-TAIL_KEEP)]);
    expect(out).toContain("[overflow-wrap:anywhere]");
  });

  it("в рисунке: номер стоит в одном неразрывном блоке с последним словом признака", () => {
    const email = WEB.find((s) => s.kind === "message" && s.channel === "email")!;
    const out = html(email);
    // «…пароль» + номер: слово и бейдж в whitespace-nowrap
    expect(out).toMatch(/<span class="whitespace-nowrap"><mark[^>]*>пароль<\/mark><span aria-hidden="true"[^>]*>1<\/span><\/span>/);
  });

  it("у признака без пояснения номера нет (чат «Айдар»), у признаков с пояснением — есть и в тексте, и в списке", () => {
    const chat = WEB.find((s) => s.kind === "message" && s.channel === "chat" && s.from === "Айдар")!;
    const chatOut = html(chat);
    expect(chatOut).toContain("<mark");
    expect(chatOut).not.toContain("rounded-full border border-warning");
    const sms = WEB.find((s) => s.kind === "message" && s.channel === "sms")!;
    expect((html(sms).match(/rounded-full border border-warning/g) ?? []).length).toBe(4); // два в тексте и два в списке
  });
});

describe("web: окно страницы не бывает пустым", () => {
  const pages = WEB.filter((s) => s.kind === "web" && s.page);

  it("srcDoc с содержимым страницы на месте, iframe в sandbox без скриптов; под ним — подложка", () => {
    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const s of pages) {
      if (s.kind !== "web") continue;
      const out = html(s);
      expect(out).toContain("srcDoc=");
      expect(out).toMatch(/sandbox=""/);
      expect(out).toContain("&lt;h");
      expect(out).toContain("data-web-placeholder");
      // подложка раньше iframe в разметке (лежит под ним), iframe прозрачный — страница сама белая
      expect(out.indexOf("data-web-placeholder")).toBeLessThan(out.indexOf("<iframe"));
      expect(out).toMatch(/<iframe[^>]*bg-transparent/);
    }
  });
});

describe("gates: неполный последний ряд по центру, названия вентилей не рвутся в подписи", () => {
  it("карточки в flex-wrap с центровкой и шириной по числу колонок, а не в grid", () => {
    const three = GATES.find((s) => s.ops.length === 3 && s.caption)!;
    const out = html(three);
    expect(out).toContain("flex flex-wrap justify-center");
    expect(out).not.toContain("grid-template-columns");
    expect(out).toMatch(/width:calc\(\(100% - \d+px\) \/ \d\)/);
  });

  it("подпись образца: после дефиса в «И-НЕ», «ИЛИ-НЕ», «ЖӘНЕ-ЕМЕС», «НЕМЕСЕ-ЕМЕС» — word joiner (U+2060), как у «Wi-Fi»", () => {
    const s = GATES.find((x) => x.caption)!;
    const cap = s.caption as { ru: string; kk: string };
    expect(cap.ru).toContain("И-⁠НЕ");
    expect(cap.ru).toContain("ИЛИ-⁠НЕ");
    expect(cap.kk).toContain("ЖӘНЕ-⁠ЕМЕС");
    expect(cap.kk).toContain("НЕМЕСЕ-⁠ЕМЕС");
    expect(cap.ru.replace(/⁠/g, "")).toBe("Две инверсии: И-НЕ и ИЛИ-НЕ");
    expect(cap.kk.replace(/⁠/g, "")).toBe("Екі инверсия: ЖӘНЕ-ЕМЕС және НЕМЕСЕ-ЕМЕС");
  });
});

describe("ink-токены: текст на -soft-заливке и подписи цвета смысла — читаемы в тёмной теме", () => {
  const GROUPS = ["extended", "box", "gates", "switches", "wave", "web"];
  const BAD = /\b(?:text|fill)-(?:primary|success|danger|warning|ai|heart)-strong\b/;

  it("в рисунках групп extended, box, gates, switches, wave, web нет text-*-strong и fill-*-strong (вместо них text-ink-*, fill-ink-*)", () => {
    for (const g of SCENE_SAMPLES.filter((x) => GROUPS.includes(x.group)))
      g.scenes.forEach((scene, i) => {
        const out = html(scene);
        const m = out.match(BAD);
        expect(m, `${g.group}[${i}] (${scene.kind}): ${m?.[0]}`).toBeNull();
      });
  });

  it("в образцах используются ink-токены (проверка, что замена дошла до разметки)", () => {
    const all = SCENE_SAMPLES.filter((x) => GROUPS.includes(x.group))
      .flatMap((g) => g.scenes)
      .map(html)
      .join("\n");
    for (const cls of ["text-ink-primary", "text-ink-success", "text-ink-warning", "text-ink-danger", "fill-ink-primary", "fill-ink-success"]) expect(all, cls).toContain(cls);
  });
});
