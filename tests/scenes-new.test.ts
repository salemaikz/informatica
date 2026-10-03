import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyGate,
  CIRCUIT_GEO,
  circuitColumns,
  evalCircuit,
  gateLabelLines,
  layoutCircuit,
  inPort,
  outPort,
  OUT_ID,
  OUT_LABEL,
  type CircuitScene,
} from "@/components/scenes/circuit";
import { arrowHead, countCrossings, flowCellWidth, flowGrid, layoutFlow, type FlowScene } from "@/components/scenes/flow";
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
    expect(TOKEN_CLASS.keyword).toBe("text-primary");
    expect(TOKEN_CLASS.string).toBe("text-success");
    expect(TOKEN_CLASS.number).toBe("text-warning-strong");
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
