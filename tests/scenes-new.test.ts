import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyGate,
  CIRCUIT_GEO,
  circuitColumns,
  evalCircuit,
  gateLabelLines,
  gateLabelBaseline,
  gateLabelRect,
  layoutCircuit,
  inPort,
  outPort,
  OUT_ID,
  OUT_LABEL,
  type CircuitScene,
} from "@/components/scenes/circuit";
import {
  arrowHead,
  countCrossings,
  flowCellWidth,
  flowFit,
  flowGrid,
  flowRequiredCell,
  FLOW_FONTS,
  labelWords,
  layoutFlow,
  MAX_LABEL_LINES,
  minLabelWidth,
  placeEdgeLabel,
  wrapLabel,
  type FlowScene,
} from "@/components/scenes/flow";
import { estimateTextWidth } from "@/components/scenes/text-width";
import { LESSONS } from "@/content/course";
import { GENERATED_ENT } from "@/content/ent/generated";
import { GENERATED_BANKS } from "@/lib/bank/generated";
import type { Lang } from "@/lib/types";
import { TOKEN_CLASS, tokenizeLine, type CodeLang, type Token } from "@/components/scenes/highlight";
import { ICONS } from "@/components/scenes/icons";
import { binaryColumns, colLetter, tableData, type TableScene } from "@/components/scenes/table";
import { buildWebDoc, webFrameHeight } from "@/components/scenes/web";
import { scenesDict } from "@/i18n/parts/scenes";
import { validateScene } from "./validate";

const gate = (id: string, op: CircuitScene["gates"][number]["op"], ins: string[]) => ({ id, op, in: ins });
const circuit = (inputs: string[], gates: CircuitScene["gates"], output: string, values?: CircuitScene["values"]): CircuitScene => ({
  kind: "circuit",
  inputs,
  gates,
  output,
  values,
});

describe("evalCircuit", () => {
  const truth = (op: CircuitScene["gates"][number]["op"], a: 0 | 1, b: 0 | 1) =>
    evalCircuit(circuit(["A", "B"], [gate("g", op, ["A", "B"])], "g"), { A: a, B: b }).g;

  it("двухвходовые вентили — полные таблицы истинности", () => {
    const rows: [0 | 1, 0 | 1][] = [[0, 0], [0, 1], [1, 0], [1, 1]];
    expect(rows.map(([a, b]) => truth("and", a, b))).toEqual([0, 0, 0, 1]);
    expect(rows.map(([a, b]) => truth("or", a, b))).toEqual([0, 1, 1, 1]);
    expect(rows.map(([a, b]) => truth("xor", a, b))).toEqual([0, 1, 1, 0]);
    expect(rows.map(([a, b]) => truth("nand", a, b))).toEqual([1, 1, 1, 0]);
    expect(rows.map(([a, b]) => truth("nor", a, b))).toEqual([1, 0, 0, 0]);
  });

  it("НЕ", () => {
    const sc = circuit(["A"], [gate("n", "not", ["A"])], "n");
    expect(evalCircuit(sc, { A: 0 }).n).toBe(1);
    expect(evalCircuit(sc, { A: 1 }).n).toBe(0);
    expect(applyGate("not", 1)).toBe(0);
  });

  it("вложенность: F = (A И B) ИЛИ НЕ C, значения есть на всех проводах", () => {
    const sc = circuit(
      ["A", "B", "C"],
      [gate("g1", "and", ["A", "B"]), gate("g2", "not", ["C"]), gate("g3", "or", ["g1", "g2"])],
      "g3",
    );
    const r = evalCircuit(sc, { A: 1, B: 0, C: 1 });
    expect(r).toEqual({ A: 1, B: 0, C: 1, g1: 0, g2: 0, g3: 0 });
    expect(evalCircuit(sc, { A: 1, B: 1, C: 1 }).g3).toBe(1);
    expect(evalCircuit(sc, { A: 0, B: 0, C: 0 }).g3).toBe(1);
  });

  it("недостающие входы считаются нулями", () => {
    const sc = circuit(["A", "B"], [gate("g", "or", ["A", "B"])], "g");
    expect(evalCircuit(sc, { A: 1 })).toEqual({ A: 1, B: 0, g: 1 });
    expect(evalCircuit(sc)).toEqual({ A: 0, B: 0, g: 0 });
  });
});

describe("layoutCircuit", () => {
  const sc = circuit(
    ["A", "B", "C"],
    [gate("g1", "and", ["A", "B"]), gate("g2", "not", ["C"]), gate("g3", "or", ["g1", "g2"])],
    "g3",
  );

  it("столбец вентиля = 1 + максимум столбцов его входов", () => {
    expect(circuitColumns(sc)).toEqual({ A: 0, B: 0, C: 0, g1: 1, g2: 1, g3: 2 });
  });

  it("узлы: входы слева, выход F правее последнего вентиля, провода соединяют всё", () => {
    const lay = layoutCircuit(sc);
    const node = (id: string) => lay.nodes.find((n) => n.id === id)!;
    expect(node("A").x).toBeLessThan(node("g1").x);
    expect(node("g1").x).toBeLessThan(node("g3").x);
    expect(node(OUT_ID).x).toBeGreaterThan(node("g3").x);
    expect(node(OUT_ID).y).toBe(node("g3").y);
    // 2 + 1 + 2 входа вентилей + провод к F
    expect(lay.wires).toHaveLength(6);
    for (const n of lay.nodes) {
      expect(n.x).toBeGreaterThan(0);
      expect(n.x + n.w / 2).toBeLessThanOrEqual(lay.width);
      expect(n.y + n.h / 2).toBeLessThanOrEqual(lay.height);
    }
  });

  it("вентили одного столбца не накладываются по вертикали", () => {
    const lay = layoutCircuit(sc);
    const g1 = lay.nodes.find((n) => n.id === "g1")!;
    const g2 = lay.nodes.find((n) => n.id === "g2")!;
    expect(Math.abs(g1.y - g2.y)).toBeGreaterThanOrEqual(g1.h);
  });

  it("вентиль с id «F» не затирается узлом выхода (у выхода внутренний id, подпись F)", () => {
    const f = circuit(["A", "B"], [gate("F", "and", ["A", "B"])], "F");
    const lay = layoutCircuit(f);
    const gateF = lay.nodes.find((n) => n.id === "F")!;
    const out = lay.nodes.find((n) => n.id === OUT_ID)!;
    expect(gateF.kind).toBe("gate");
    expect(out.kind).toBe("output");
    expect(out.label).toBe(OUT_LABEL);
    expect(lay.wires.filter((w) => w.to === "F")).toHaveLength(2);
    expect(lay.wires.filter((w) => w.from === "F" && w.to === OUT_ID)).toHaveLength(1);
  });

  it("под подписью нижнего вентиля хватает места (подпись не обрезается краем viewBox)", () => {
    const one = circuit(["A"], [gate("n", "not", ["A"])], "n");
    for (const lines of [1, 2]) {
      const lay = layoutCircuit(one, { labelLines: lines });
      const n = lay.nodes.find((x) => x.id === "n")!;
      // Базовая линия последней строки подписи + выносные элементы (~4 px) — внутри высоты.
      const lastBaseline = n.y + n.h / 2 + 15 + (lines - 1) * CIRCUIT_GEO.labelLine;
      expect(lastBaseline + 4).toBeLessThanOrEqual(lay.height);
    }
  });

  it("двухстрочные подписи: ряды раздвигаются, вентили одного столбца не наезжают подписью на соседа", () => {
    const lay = layoutCircuit(sc, { labelLines: 2 });
    const g1 = lay.nodes.find((n) => n.id === "g1")!;
    const g2 = lay.nodes.find((n) => n.id === "g2")!;
    // Вторая строка подписи верхнего вентиля (базовая линия) выше верхнего края нижнего вентиля.
    const labelBottom = Math.min(g1.y, g2.y) + g1.h / 2 + 15 + CIRCUIT_GEO.labelLine;
    expect(labelBottom).toBeLessThan(Math.max(g1.y, g2.y) - g2.h / 2);
  });

  it("у двухвходового вентиля изломы проводов на разных вертикалях", () => {
    const lay = layoutCircuit(sc);
    const bends = lay.wires.filter((w) => w.to === "g1" && w.points.length > 2).map((w) => w.points[1][0]);
    expect(new Set(bends).size).toBe(bends.length);
  });

  it("провода — ломаные из горизонталей и вертикалей, от выхода источника до клеммы приёмника", () => {
    const lay = layoutCircuit(sc);
    for (const w of lay.wires) {
      for (let i = 0; i + 1 < w.points.length; i++) {
        const [a, b] = [w.points[i], w.points[i + 1]];
        expect(a[0] === b[0] || a[1] === b[1]).toBe(true);
      }
      const from = lay.nodes.find((n) => n.id === w.from)!;
      const to = lay.nodes.find((n) => n.id === w.to)!;
      expect(w.points[0]).toEqual(outPort(from));
      const count = to.kind === "gate" ? sc.gates.find((g) => g.id === to.id)!.in.length : 1;
      expect(w.points[w.points.length - 1]).toEqual(inPort(to, w.port, count));
    }
  });
});

describe("flow", () => {
  const nodes: FlowScene["nodes"] = [
    { id: "s", shape: "start", label: "Начало", x: 1, y: 0 },
    { id: "a", shape: "action", label: "n = 5", x: 1, y: 1 },
    { id: "c", shape: "if", label: "n > 0?", x: 1, y: 2 },
    { id: "b", shape: "action", label: "n = n - 1", x: 2, y: 3 },
    { id: "e", shape: "end", label: "Конец", x: 1, y: 4 },
  ];
  const edges: FlowScene["edges"] = [
    { from: "s", to: "a" },
    { from: "a", to: "c" },
    { from: "c", to: "b", label: "да" },
    { from: "b", to: "c" },
    { from: "c", to: "e", label: "нет" },
  ];
  const scene: FlowScene = { kind: "flow", nodes, edges, active: "c" };

  it("сетка компактна: ширина по факту использованных столбцов", () => {
    expect(flowGrid(nodes)).toEqual({ minX: 1, cols: 2, rows: 5 });
    expect(flowGrid([{ id: "a", shape: "box", label: "a", x: 0, y: 0 }, { id: "b", shape: "box", label: "b", x: 2, y: 0 }])).toEqual({ minX: 0, cols: 3, rows: 1 });
    expect(flowCellWidth(336, 5)).toBeLessThan(flowCellWidth(336, 3));
    expect(flowCellWidth(2000, 1)).toBe(150);
    expect(flowCellWidth(100, 5)).toBe(44);
  });

  it("блоки лежат на сетке без наложений", () => {
    const lay = layoutFlow(scene, 336);
    expect(lay.boxes).toHaveLength(5);
    const keys = new Set(lay.boxes.map((b) => `${b.cx}:${b.cy}`));
    expect(keys.size).toBe(5);
    for (const b of lay.boxes) {
      expect(b.cx - b.w / 2).toBeGreaterThanOrEqual(0);
      expect(b.cx + b.w / 2).toBeLessThanOrEqual(lay.width);
      expect(b.cy + b.h / 2).toBeLessThanOrEqual(lay.height);
    }
    const s = lay.boxes.find((b) => b.id === "s")!;
    const a = lay.boxes.find((b) => b.id === "a")!;
    expect(a.cy).toBeGreaterThan(s.cy);
  });

  it("стрелки ортогональны, начинаются у края блока и не задевают чужих блоков", () => {
    const lay = layoutFlow(scene, 336);
    expect(lay.edges).toHaveLength(edges.length);
    for (const e of lay.edges) {
      expect(e.points.length).toBeGreaterThanOrEqual(2);
      for (let i = 0; i + 1 < e.points.length; i++) {
        const [p, q] = [e.points[i], e.points[i + 1]];
        expect(p[0] === q[0] || p[1] === q[1]).toBe(true);
      }
      expect(e.crossings).toBe(0);
      expect(countCrossings(e.points, lay.boxes, [e.from, e.to])).toBe(0);
    }
  });

  it("стрелка вниз в соседний блок — прямая вертикаль; «назад» (цикл) идёт обходом, а не напрямую", () => {
    const lay = layoutFlow(scene, 336);
    const down = lay.edges.find((e) => e.from === "s" && e.to === "a")!;
    expect(down.points).toHaveLength(2);
    expect(down.points[0][0]).toBe(down.points[1][0]);
    const back = lay.edges.find((e) => e.from === "b" && e.to === "c")!;
    expect(back.points.length).toBeGreaterThanOrEqual(3);
  });

  it("стрелка между блоками через чужой блок в том же столбце обходится сбоку", () => {
    const lay = layoutFlow(
      {
        kind: "flow",
        nodes: [
          { id: "a", shape: "box", label: "a", x: 0, y: 0 },
          { id: "m", shape: "box", label: "m", x: 0, y: 1 },
          { id: "b", shape: "box", label: "b", x: 0, y: 2 },
        ],
        edges: [{ from: "a", to: "b" }],
      },
      336,
    );
    expect(lay.edges[0].crossings).toBe(0);
    expect(lay.edges[0].points.length).toBeGreaterThan(2);
  });

  it("наконечник стрелки смотрит по направлению последнего отрезка", () => {
    const [tip, l1, l2] = arrowHead([[0, 0], [0, 20]]);
    expect(tip).toEqual([0, 20]);
    expect(l1[1]).toBeLessThan(20);
    expect(l2[1]).toBeLessThan(20);
    const [tipL] = arrowHead([[50, 5], [10, 5]]);
    expect(tipL).toEqual([10, 5]);
  });
});

describe("layoutCircuit: подписи вентилей не пересекаются проводами", () => {
  // F = (A ∧ B) ∨ (¬B ∧ C): провод от C проходит под вентилем НЕ
  const sc = circuit(
    ["A", "B", "C"],
    [gate("g1", "and", ["A", "B"]), gate("g2", "not", ["B"]), gate("g3", "and", ["g2", "C"]), gate("g4", "or", ["g1", "g3"])],
    "g4",
  );
  const labels = { and: ["И"], or: ["ИЛИ"], not: ["НЕ"] };

  it("без подписей в опциях раскладка прежняя (все подписи снизу)", () => {
    expect(layoutCircuit(sc).nodes.some((n) => n.labelAbove)).toBe(false);
  });

  it("подпись НЕ, под которой идёт провод, переносится над рамкой; итоговые подписи ни с чем не пересекаются", () => {
    const lay = layoutCircuit(sc, { labelLines: 1, labels });
    const not = lay.nodes.find((n) => n.id === "g2")!;
    expect(not.labelAbove).toBe(true);
    // базовая линия подписи над рамкой — выше верха рамки
    expect(gateLabelBaseline(not, 1)).toBeLessThan(not.y - not.h / 2);
    const lines = (op: string) => labels[op as keyof typeof labels];
    for (const n of lay.nodes.filter((x) => x.kind === "gate")) {
      const r = gateLabelRect(n, lines(n.op!), !!n.labelAbove);
      expect(r.y0).toBeGreaterThanOrEqual(0);
      for (const w of lay.wires) {
        for (let i = 0; i + 1 < w.points.length; i++) {
          const [a, b] = [w.points[i], w.points[i + 1]];
          const hit = Math.max(a[0], b[0]) > r.x0 && Math.min(a[0], b[0]) < r.x1 && Math.max(a[1], b[1]) > r.y0 && Math.min(a[1], b[1]) < r.y1;
          expect(hit, `${n.id} × ${w.from}>${w.to}`).toBe(false);
        }
      }
    }
  });

  it("свободная схема: подписи остаются под рамкой", () => {
    const one = circuit(["A", "B"], [gate("g1", "and", ["A", "B"])], "g1");
    expect(layoutCircuit(one, { labelLines: 1, labels }).nodes.some((n) => n.labelAbove)).toBe(false);
  });
});

describe("flow: подписи не рвутся, кегль и ширина подбираются по тексту", () => {
  const node = (id: string, shape: FlowScene["nodes"][number]["shape"], label: FlowScene["nodes"][number]["label"], x: number, y: number) => ({ id, shape, label, x, y });

  it("estimateTextWidth: растёт с кеглем и длиной, узкие знаки уже широких", () => {
    expect(estimateTextWidth("", 13)).toBe(0);
    expect(estimateTextWidth("iiiii", 13)).toBeLessThan(estimateTextWidth("WWWWW", 13));
    expect(estimateTextWidth("l.l", 13)).toBeLessThan(estimateTextWidth("abc", 13));
    expect(estimateTextWidth("Магистраль", 13)).toBeGreaterThan(estimateTextWidth("Магистраль", 11));
    expect(estimateTextWidth("ab cd", 13)).toBeCloseTo(estimateTextWidth("ab", 13) + estimateTextWidth(" ", 13) + estimateTextWidth("cd", 13), 6);
    // казахские буквы есть в таблице (не «неизвестный символ»)
    expect(estimateTextWidth("ә", 100)).toBeLessThan(estimateTextWidth("Ә", 100));
  });

  it("estimateTextWidth: близко к замеру Nunito 700 в Chromium (13 px) — не меньше замера −2% и не больше +6%", () => {
    // Замер: canvas/span в Chromium на woff2 из @fontsource-variable/nunito.
    const real: [string, number][] = [
      ["Магистраль", 75.06],
      ["маршрутизатор", 99.81],
      ["Students", 54.45],
      ["192.168.1.10", 79.88],
      ["Тапсырыстар", 84.44],
      ["Wi-Fi", 35.22],
      ["WWW", 43.42],
      ["ЖЖЖЖ", 52.73],
      ["Шешіп, жауап беремін", 144.11],
      ["n = n - 1", 50.55],
    ];
    for (const [text, px] of real) {
      const est = estimateTextWidth(text, 13);
      expect(est / px, text).toBeGreaterThan(0.98);
      expect(est / px, text).toBeLessThan(1.06);
    }
  });

  it("wrapLabel: перенос только между словами; слово шире колонки — overflow", () => {
    expect(labelWords("  Ввод   данных ")).toEqual(["Ввод", "данных"]);
    const one = wrapLabel("Ввод данных", 13, 1000);
    expect(one.lines).toBe(1);
    expect(one.overflow).toBe(false);
    const narrow = wrapLabel("Ввод данных", 13, estimateTextWidth("данных", 13) + 1);
    expect(narrow.lines).toBe(2);
    expect(narrow.overflow).toBe(false);
    const tooNarrow = wrapLabel("Магистраль", 13, 40);
    expect(tooNarrow.overflow).toBe(true);
    expect(tooNarrow.longest).toBeCloseTo(estimateTextWidth("Магистраль", 13), 6);
  });

  it("minLabelWidth: не меньше самого длинного слова и укладывает подпись в 3 строки", () => {
    const text = "Сайт: сертификат + открытый ключ";
    const w = minLabelWidth(text, 13);
    expect(w).toBeGreaterThanOrEqual(Math.floor(wrapLabel(text, 13, Infinity).longest));
    const r = wrapLabel(text, 13, w);
    expect(r.overflow).toBe(false);
    expect(r.lines).toBeLessThanOrEqual(MAX_LABEL_LINES);
    // на 2 px уже — не помещается (ширина минимальна)
    const narrower = wrapLabel(text, 13, w - 2);
    expect(narrower.overflow || narrower.lines > MAX_LABEL_LINES).toBe(true);
    expect(minLabelWidth("Начало", 13)).toBe(Math.ceil(estimateTextWidth("Начало", 13)));
  });

  const long: FlowScene = {
    kind: "flow",
    nodes: [node("a", "box", "Магистраль данных", 0, 0), node("b", "box", "Процессор", 1, 0), node("c", "box", "Память", 2, 0)],
    edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }],
  };

  it("flowFit: короткие подписи — 13 px; длинное слово в 3 столбцах на 326 px — меньший кегль; влезть невозможно — fits=false", () => {
    const short: FlowScene["nodes"] = [node("a", "box", "Один", 0, 0), node("b", "box", "Два", 1, 0), node("c", "box", "Три", 2, 0)];
    expect(flowFit(short, 326).fontPx).toBe(13);
    expect(flowFit(short, 326).fits).toBe(true);
    const f = flowFit(long.nodes, 326);
    expect(f.fits).toBe(true);
    expect(f.fontPx).toBeLessThan(13);
    expect(FLOW_FONTS).toContain(f.fontPx);
    // потребность растёт с кеглем; на 11 px — наименьшая
    expect(flowRequiredCell(long.nodes, 13)).toBeGreaterThan(flowRequiredCell(long.nodes, 11));
    const impossible = flowFit([node("a", "box", "Маршрутизатор", 0, 0), node("b", "box", "Коммутатор", 1, 0), node("c", "box", "Компьютер", 2, 0)], 326);
    expect(impossible.fits).toBe(false);
    expect(impossible.fontPx).toBe(11);
  });

  it("layoutFlow: подписи без разрыва слов, схема не шире экрана; на широком экране кегль 13 и ячейка ≤ 150", () => {
    const lay = layoutFlow(long, 326);
    expect(lay.fontPx).toBeLessThan(13);
    expect(lay.scrolls).toBe(false);
    expect(lay.clipped).toBe(false);
    expect(lay.width).toBeLessThanOrEqual(326);
    for (const b of lay.boxes) {
      expect(b.textW).toBeLessThanOrEqual(b.w);
      expect(b.lines).toBeLessThanOrEqual(MAX_LABEL_LINES);
    }
    const wide = layoutFlow(long, 800);
    expect(wide.fontPx).toBe(13);
    expect(wide.cellW).toBe(150);
    expect(wide.boxes.every((b) => b.lines <= 2)).toBe(true);
  });

  it("layoutFlow: слово, которое нигде не влезает — схема шире экрана (прокрутка) на 11 px, а не обрезка", () => {
    const hard: FlowScene = {
      kind: "flow",
      nodes: [node("a", "device", "Маршрутизатор", 0, 0), node("b", "device", "Коммутатор", 1, 0), node("c", "device", "Компьютер", 2, 0)],
      edges: [],
    };
    const lay = layoutFlow(hard, 326);
    expect(lay.fontPx).toBe(11);
    expect(lay.scrolls).toBe(true);
    expect(lay.clipped).toBe(false);
    expect(lay.width).toBeGreaterThan(326);
  });

  it("layoutFlow: блок с 3 строками выше типового, иконка устройства учтена в высоте", () => {
    const three: FlowScene = { kind: "flow", nodes: [node("a", "action", "Сайт: сертификат + открытый ключ", 0, 0)], edges: [] };
    const lay = layoutFlow(three, 150);
    const b = lay.boxes[0];
    expect(b.lines).toBe(3);
    expect(b.h).toBeGreaterThan(48);
    const one = layoutFlow({ kind: "flow", nodes: [node("a", "action", "Ввод", 0, 0)], edges: [] }, 336).boxes[0];
    expect(one.h).toBe(48);
    const dev = layoutFlow(
      { kind: "flow", nodes: [{ id: "d", shape: "device", label: "Сайт: сертификат + открытый ключ", icon: "server", x: 0, y: 0 }], edges: [] },
      150,
    ).boxes[0];
    expect(dev.h).toBeGreaterThan(b.h);
  });

  it("layoutFlow: простая блок-схема не меняется — кегль 13, ячейка как раньше, высоты по форме", () => {
    const simple: FlowScene = {
      kind: "flow",
      nodes: [
        node("s", "start", "Начало", 1, 0),
        node("a", "action", "n = 5", 1, 1),
        node("c", "if", "n > 0?", 1, 2),
        node("b", "action", "n = n - 1", 2, 3),
        node("e", "end", "Конец", 1, 4),
      ],
      edges: [{ from: "s", to: "a" }, { from: "a", to: "c" }, { from: "c", to: "b", label: "да" }, { from: "b", to: "c" }, { from: "c", to: "e", label: "нет" }],
    };
    for (const w of [326, 336, 390]) {
      const lay = layoutFlow(simple, w);
      expect(lay.fontPx).toBe(13);
      expect(lay.cellW).toBe(flowCellWidth(w, 2));
      expect(lay.boxes.map((b) => b.h)).toEqual([40, 48, 76, 48, 40]);
      expect(lay.boxes.every((b) => b.lines === 1)).toBe(true);
    }
  });

  it("ромб: текст во вписанном прямоугольнике (чем больше строк, тем уже колонка), число строк подбирается", () => {
    const sc = (label: string): FlowScene => ({ kind: "flow", nodes: [node("q", "if", label, 0, 0)], edges: [] });
    const a = layoutFlow(sc("n > 0?"), 150).boxes[0];
    expect(a.lines).toBe(1);
    const b = layoutFlow(sc("Есть ещё элементы в списке?"), 150).boxes[0];
    expect(b.lines).toBeGreaterThan(1);
    expect(b.textW).toBeLessThan(a.textW);
    expect(b.textW).toBeLessThan(b.w * 0.6);
  });

  it("язык влияет на раскладку: казахская подпись длиннее — другой кегль/строки", () => {
    const sc: FlowScene = { kind: "flow", nodes: [node("a", "box", { ru: "Идёт дождь", kk: "Жаңбыр жауып тұр" }, 0, 0), node("b", "box", "x", 1, 0), node("c", "box", "y", 2, 0)], edges: [] };
    const ru = layoutFlow(sc, 326, "ru");
    const kk = layoutFlow(sc, 326, "kk");
    expect(kk.boxes[0].lines).toBeGreaterThanOrEqual(ru.boxes[0].lines);
  });

  it("placeEdgeLabel: у начала; в тесном просвете — по центру; у правого края вертикали — слева от линии; не за край сцены", () => {
    expect(placeEdgeLabel([10, 50], [100, 50], 20, 300)).toEqual({ at: [16, 43], anchor: "start" });
    expect(placeEdgeLabel([100, 50], [10, 50], 20, 300)).toEqual({ at: [94, 43], anchor: "end" });
    // просвет 40 px, подпись 36: от начала вылезла бы на блок — по центру просвета
    expect(placeEdgeLabel([0, 50], [40, 50], 36, 300)).toEqual({ at: [20, 43], anchor: "middle" });
    expect(placeEdgeLabel([100, 10], [100, 60], 50, 300)).toEqual({ at: [106, 26], anchor: "start" });
    expect(placeEdgeLabel([280, 10], [280, 60], 50, 300)).toEqual({ at: [274, 26], anchor: "end" });
    // горизонталь у самого края: прижимаем внутрь
    const edge = placeEdgeLabel([290, 50], [330, 50], 60, 300);
    expect(edge.at[0] + 60).toBeLessThanOrEqual(298);
  });

  it("двусторонняя связь a↔b идёт по одному маршруту в обе стороны (без обхода вокруг схемы)", () => {
    const star: FlowScene = {
      kind: "flow",
      nodes: [node("core", "box", "Центр", 1, 0), node("l", "box", "Левый", 0, 1), node("m", "box", "Средний", 1, 1), node("r", "box", "Правый", 2, 1)],
      edges: [
        { from: "l", to: "core" },
        { from: "core", to: "l" },
        { from: "r", to: "core" },
        { from: "core", to: "r" },
      ],
    };
    const lay = layoutFlow(star, 326);
    for (const [a, b] of [["l", "core"], ["r", "core"]]) {
      const fwd = lay.edges.find((e) => e.from === a && e.to === b)!;
      const back = lay.edges.find((e) => e.from === b && e.to === a)!;
      expect(fwd.crossings).toBe(0);
      expect(fwd.points).toEqual([...back.points].reverse());
      expect(fwd.points.length).toBeLessThanOrEqual(3);
    }
  });
});

// Охранный тест: на телефоне (контейнер ≈ 326 px при экране 390) ни одна схема урока не прокручивается и не обрезает подписи — ни на русском, ни на казахском.
describe("flow: все схемы курса помещаются на телефоне", () => {
  const found: { where: string; scene: FlowScene }[] = [];
  const walk = (v: unknown, where: string, depth = 0): void => {
    if (depth > 14 || v === null || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${where}[${i}]`, depth + 1));
    const o = v as Record<string, unknown>;
    if (o.kind === "flow" && Array.isArray(o.nodes)) found.push({ where, scene: o as unknown as FlowScene });
    for (const [k, x] of Object.entries(o)) walk(x, `${where}.${k}`, depth + 1);
  };
  for (const [id, lesson] of Object.entries(LESSONS)) walk(lesson.steps, `lesson:${id}`);
  for (const b of GENERATED_BANKS) walk(b, `bank:${b.skill}`);
  for (const it of GENERATED_ENT) walk(it, `ent:${it.id}`);

  it("схемы найдены", () => {
    expect(found.length).toBeGreaterThan(100);
  });

  it("на 326 px: без горизонтальной прокрутки и без обрезки подписей (ru и kk)", () => {
    const bad: string[] = [];
    for (const { where, scene } of found) {
      for (const lang of ["ru", "kk"] as Lang[]) {
        const lay = layoutFlow(scene, 326, lang);
        if (lay.scrolls || lay.clipped) bad.push(`${where} [${lang}] f${lay.fontPx} width=${lay.width}${lay.clipped ? " clipped" : ""}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("стрелки схем курса не задевают чужие блоки", () => {
    const bad: string[] = [];
    for (const { where, scene } of found) {
      const lay = layoutFlow(scene, 326, "ru");
      for (const e of lay.edges) if (e.crossings > 0) bad.push(`${where}: ${e.from}>${e.to}`);
    }
    expect(bad).toEqual([]);
  });
});

describe("подсветка синтаксиса", () => {
  const join = (tokens: Token[]) => tokens.map((t) => t.text).join("");
  const types = (line: string, lang: CodeLang) => tokenizeLine(line, lang).filter((t) => t.type !== "plain").map((t) => [t.text, t.type]);

  it("python: ключевые слова, числа, строки, комментарии", () => {
    expect(types('for i in range(10):  # цикл', "python")).toEqual([
      ["for", "keyword"],
      ["in", "keyword"],
      ["range", "keyword"],
      ["10", "number"],
      ["# цикл", "comment"],
    ]);
    expect(types('print("Привет, #мир", 3.14)', "python")).toEqual([
      ["print", "keyword"],
      ['"Привет, #мир"', "string"],
      ["3.14", "number"],
    ]);
    expect(types("x = True and not y", "python").map((t) => t[0])).toEqual(["True", "and", "not"]);
  });

  it("python: имена с ключевым словом внутри — не ключевые; f-строки и незакрытые строки", () => {
    expect(types("index = print_value + format", "python")).toEqual([]);
    expect(types('s = f"a{x}"', "python")).toEqual([['f"a{x}"', "string"]]);
    expect(types("s = 'abc", "python")).toEqual([["'abc", "string"]]);
    expect(types(String.raw`s = "a\"b" + 1`, "python")).toEqual([[String.raw`"a\"b"`, "string"], ["1", "number"]]);
  });

  it("sql: регистр ключевых слов не важен", () => {
    expect(types("select name FROM students where age >= 16 ORDER by name", "sql").map((t) => t[0])).toEqual([
      "select",
      "FROM",
      "where",
      "16",
      "ORDER",
      "by",
    ]);
    expect(types("SELECT * FROM t WHERE city = 'Астана' -- город", "sql")).toEqual([
      ["SELECT", "keyword"],
      ["FROM", "keyword"],
      ["WHERE", "keyword"],
      ["'Астана'", "string"],
      ["-- город", "comment"],
    ]);
    expect(types("COUNT(*) AS n, AVG(x)", "sql").map((t) => t[0])).toEqual(["COUNT", "AS", "AVG"]);
  });

  it("html: теги — keyword, значения атрибутов — string", () => {
    expect(types('<a href="x.html" class=\'b\'>Текст</a>', "html")).toEqual([
      ["<a", "keyword"],
      ['"x.html"', "string"],
      ["'b'", "string"],
      [">", "keyword"],
      ["</a>", "keyword"], // соседние токены одного типа склеиваются
    ]);
    expect(types("<!-- заметка -->", "html")).toEqual([["<!-- заметка -->", "comment"]]);
    expect(types("a < b", "html")).toEqual([]);
  });

  it("css: свойства — keyword, значения — числа и цвета", () => {
    expect(types("  color: #1a91d6; margin: 0 12px;", "css")).toEqual([
      ["color", "keyword"],
      ["#1a91d6", "number"],
      ["margin", "keyword"],
      ["0", "number"],
      ["12px", "number"],
    ]);
    expect(types("p { font-size: 16px }", "css").map((t) => t[0])).toEqual(["font-size", "16px"]);
    expect(types("a:hover {", "css")).toEqual([]);
  });

  it("text и пустая строка", () => {
    expect(tokenizeLine("if x:", "text")).toEqual([{ text: "if x:", type: "plain" }]);
    expect(tokenizeLine("", "python")).toEqual([]);
  });

  it("токены без потерь: склейка текстов равна исходной строке (отступы сохраняются)", () => {
    const samples: [string, CodeLang][] = [
      ["    if x == 1:  # да", "python"],
      ["        print('a\\'b', \"c\")", "python"],
      ["SELECT  a ,b FROM  t  WHERE x='it''s'", "sql"],
      ['  <div class="a">  hi  </div>', "html"],
      ["  .box  { color : red ; }", "css"],
    ];
    for (const [line, lang] of samples) expect(join(tokenizeLine(line, lang))).toBe(line);
  });

  it("цвета токенов — токены темы", () => {
    expect(TOKEN_CLASS.keyword).toBe("text-ink-primary");
    expect(TOKEN_CLASS.string).toBe("text-ink-success");
    expect(TOKEN_CLASS.number).toBe("text-ink-warning");
    expect(TOKEN_CLASS.comment).toBe("text-muted");
  });
});

describe("таблица", () => {
  it("буквы столбцов", () => {
    expect([0, 1, 2, 25, 26, 27, 51, 52].map(colLetter)).toEqual(["A", "B", "C", "Z", "AA", "AB", "AZ", "BA"]);
  });

  it("sheet: columns не используются как шапка — это первая строка данных", () => {
    const base: TableScene = { kind: "table", rows: [["3", "4"]], columns: ["1", "2"], sheet: true };
    expect(tableData(base)).toEqual({ head: null, rows: [["1", "2"], ["3", "4"]] });
    expect(tableData({ ...base, columns: undefined })).toEqual({ head: null, rows: [["3", "4"]] });
    expect(tableData({ ...base, sheet: false })).toEqual({ head: ["1", "2"], rows: [["3", "4"]] });
  });

  it("двоичные столбцы — только если все ячейки столбца 0 или 1", () => {
    expect(binaryColumns([["0", "1", "x"], ["1", "1", "0"], ["0", "10", "1"]])).toEqual([true, false, false]);
    expect(binaryColumns([])).toEqual([]);
  });
});

describe("web", () => {
  it("документ: базовый стиль, затем css сцены, запрет внешнего и скриптов", () => {
    const doc = buildWebDoc("<h1>Привет</h1>", "h1{color:red}");
    expect(doc).toContain("font-family: system-ui, sans-serif");
    expect(doc.indexOf("margin:12px")).toBeLessThan(doc.indexOf("h1{color:red}"));
    expect(doc).toContain("<h1>Привет</h1>");
    expect(doc).toContain("Content-Security-Policy");
    expect(doc).toContain("default-src 'none'");
    expect(doc).not.toContain("<script");
  });

  it("закрывающий </style> в css не вырывается из блока стилей", () => {
    const doc = buildWebDoc("<p>x</p>", "p{}</style><b>hack</b>");
    expect(doc.match(/<\/style/gi)).toHaveLength(1);
    // Вложенная комбинация: после наивного вырезания «</style» снова получилось бы «</style>».
    const nested = buildWebDoc("<p>x</p>", "p{}</</stylestyle><b>hack</b>");
    expect(nested.match(/<\/style/gi)).toHaveLength(1);
    const upper = buildWebDoc("<p>x</p>", "p{}</STYLE><b>hack</b>");
    expect(upper.match(/<\/style/gi)).toHaveLength(1);
  });

  it("высота окна — от 140 до 260 px", () => {
    expect(webFrameHeight("<p>x</p>")).toBe(140);
    expect(webFrameHeight(Array(30).fill("<p>x</p>").join("\n"))).toBe(260);
    const mid = webFrameHeight("<p>1</p>\n<p>2</p>\n<p>3</p>\n<p>4</p>");
    expect(mid).toBeGreaterThanOrEqual(140);
    expect(mid).toBeLessThanOrEqual(260);
  });
});

describe("иконки и словарь", () => {
  it("для каждого имени из IconName есть иконка lucide", () => {
    const src = readFileSync("src/lib/types.ts", "utf8");
    const block = /export type IconName =([\s\S]*?);/.exec(src)![1];
    const names = [...block.matchAll(/"([\w-]+)"/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(50);
    expect(Object.keys(ICONS).sort()).toEqual([...names].sort());
    for (const n of names) expect(ICONS[n as keyof typeof ICONS], n).toBeTruthy();
  });

  it("строки сцен двуязычные, подписи вентилей по-казахски", () => {
    for (const [key, v] of Object.entries(scenesDict)) {
      expect(v.ru.trim(), key).not.toBe("");
      expect(v.kk.trim(), key).not.toBe("");
    }
    expect(scenesDict["scene.op.and"].kk).toBe("ЖӘНЕ");
    expect(scenesDict["scene.op.or"].kk).toBe("НЕМЕСЕ");
    expect(scenesDict["scene.op.not"].kk).toBe("ЕМЕС");
    expect(scenesDict["scene.op.nand"].kk).toBe("ЖӘНЕ-ЕМЕС");
    expect(scenesDict["scene.op.nor"].kk).toBe("НЕМЕСЕ-ЕМЕС");
  });

  it("validateScene принимает собранные в тестах сцены", () => {
    expect(validateScene(circuit(["A", "B"], [gate("g", "and", ["A", "B"])], "g", { A: 1, B: 0 }))).toEqual([]);
    expect(validateScene({ kind: "web", html: "<p>x</p>", css: "p{color:red}" })).toEqual([]);
  });
});

describe("подписи вентилей", () => {
  it("длинные подписи с дефисом — в две строки после дефиса, короткие — как есть", () => {
    expect(gateLabelLines("НЕМЕСЕ-ЕМЕС")).toEqual(["НЕМЕСЕ-", "ЕМЕС"]);
    expect(gateLabelLines("ЖӘНЕ-ЕМЕС")).toEqual(["ЖӘНЕ-", "ЕМЕС"]);
    expect(gateLabelLines("ИЛИ-НЕ")).toEqual(["ИЛИ-НЕ"]);
    expect(gateLabelLines("НЕМЕСЕ")).toEqual(["НЕМЕСЕ"]);
    expect(gateLabelLines("XOR")).toEqual(["XOR"]);
  });

  it("каждая строка подписи из словаря не длиннее 7 символов (не наезжает на соседний столбец)", () => {
    for (const op of ["and", "or", "not", "nand", "nor", "xor"] as const) {
      const entry = scenesDict[`scene.op.${op}`];
      for (const text of [entry.ru, entry.kk]) {
        for (const line of gateLabelLines(text)) expect(line.length).toBeLessThanOrEqual(7);
      }
    }
  });
});
