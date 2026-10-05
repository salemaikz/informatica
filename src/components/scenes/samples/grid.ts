import type { Scene } from "@/lib/types";

/** Образцы сцены grid. */
export const SAMPLES: Extract<Scene, { kind: "grid" }>[] = [
  {
    kind: "grid",
    rows: 4,
    cols: 4,
    axes: { row: "i", col: "j" },
    values: [["1", "2", "3", "4"], ["5", "6", "7", "8"], ["9", "10", "11", "12"], ["13", "14", "15", "16"]],
    marks: [{ tone: "primary", region: "diag" }, { tone: "warning", region: "upper" }],
  },
  { kind: "grid", rows: 3, cols: 3, axes: { from: 1 }, merges: [{ r: 0, c: 0, cs: 2 }, { r: 1, c: 2, rs: 2 }], hatch: true },
  // худший случай: 10 × 10 с осями, побочной диагональю и подсвеченной строкой и столбцом
  {
    kind: "grid",
    rows: 10,
    cols: 10,
    axes: { row: "i", col: "j", from: 0 },
    values: Array.from({ length: 10 }, (_, r) => Array.from({ length: 10 }, (_, c) => String(r * 10 + c))),
    marks: [
      { tone: "muted", rows: [2] },
      { tone: "success", cols: [7] },
      { tone: "ai", region: "anti" },
      { tone: "gold", cells: [[0, 0], [9, 9]] },
    ],
  },
  // обход змейкой с номерами
  {
    kind: "grid",
    rows: 3,
    cols: 4,
    axes: { row: "i", col: "j", from: 1 },
    path: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [1, 2], [1, 1], [1, 0], [2, 0], [2, 1], [2, 2], [2, 3]],
    numbered: true,
    marks: [{ tone: "success", cells: [[0, 0]] }, { tone: "gold", cells: [[2, 3]] }],
  },
  // зал: пустые клетки и места под диагональю, 4-символьные значения
  {
    kind: "grid",
    rows: 5,
    cols: 5,
    values: [["", "", "", "", ""], ["1024", "", "", "", ""], ["", "-12", "", "3.5", ""], ["", "", "", "", "0"], ["x", "", "", "", ""]],
    marks: [{ tone: "muted", region: "lower" }, { tone: "primary", region: "diag" }],
  },
  // HTML-таблица: colspan и rowspan вместе, с подсветкой внутри объединения
  {
    kind: "grid",
    rows: 4,
    cols: 5,
    values: [["A1", "", "", "", "Σ"], ["a", "b", "c", "", "d"], ["e", "f", "g", "", ""], ["h", "i", "j", "k", "l"]],
    merges: [{ r: 0, c: 0, cs: 4 }, { r: 0, c: 4, rs: 2 }, { r: 1, c: 3, rs: 2, cs: 1 }],
    marks: [{ tone: "warning", cells: [[0, 1]] }],
    hatch: true,
  },
  // без осей, одна строка, путь из одной клетки
  { kind: "grid", rows: 1, cols: 7, values: [["*", "*", "*", "*", "*", "", ""]], path: [[0, 0]], marks: [{ tone: "gold", cols: [4, 5] }] },
  // лесенка звёздочек
  {
    kind: "grid",
    rows: 6,
    cols: 6,
    axes: { row: "n", col: "k", from: 1 },
    values: Array.from({ length: 6 }, (_, r) => Array.from({ length: 6 }, (_, c) => (c <= r ? "*" : ""))),
    marks: [{ tone: "primary", region: "lower" }, { tone: "success", region: "diag" }],
  },
  // обход матрицы со значениями: линия пути и номера поверх чисел
  {
    kind: "grid",
    rows: 4,
    cols: 4,
    axes: { row: "i", col: "j" },
    values: Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => String(r * 4 + c + 1))),
    path: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]],
    numbered: true,
  },
  // 10 × 10: путь возвращается в клетку, номера «1,31,33» и значения
  {
    kind: "grid",
    rows: 10,
    cols: 10,
    axes: { col: "j" },
    values: Array.from({ length: 10 }, (_, r) => Array.from({ length: 10 }, (_, c) => String(r * 10 + c))),
    path: [[0, 0], [0, 1], [0, 0], [1, 0]],
    numbered: true,
  },
  // подпись и объединение без штриховки
  {
    kind: "grid",
    rows: 2,
    cols: 3,
    values: [["A1", "", "B1"], ["A2", "B2", "C2"]],
    merges: [{ r: 0, c: 0, cs: 2 }],
    caption: { ru: "Объединённая ячейка", kk: "Біріктірілген ұяшық" },
  },
];
