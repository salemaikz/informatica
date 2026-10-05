import type { Scene } from "@/lib/types";

/** Образцы сцены tape: срезы, указатели, обмен, группы байтов, кадр «после», худшие случаи по ширине. */
export const SAMPLES: Extract<Scene, { kind: "tape" }>[] = [
  { kind: "tape", cells: ["P", "y", "t", "h", "o", "n"], index: "both", name: "s", slice: { start: 1, stop: 5, step: 2 } },
  { kind: "tape", cells: ["3", "8", "1", "9", "4"], name: "a", pointers: [{ at: 1, label: "i" }], swaps: [[1, 2]] },
  // срез с отрицательным шагом, граница stop = −1 («до начала»)
  { kind: "tape", cells: ["a", "b", "c", "d", "e", "f"], index: "both", name: "s", slice: { start: 5, stop: -1, step: -2 }, caption: { ru: "s[::-2]", kk: "s[::-2]" } },
  // пустой срез
  { kind: "tape", cells: ["1", "2", "3", "4"], name: "a", slice: { start: 3, stop: 1 }, caption: { ru: "a[3:1] — пусто", kk: "a[3:1] — бос" } },
  // два имени на один список
  { kind: "tape", cells: ["1", "2", "3"], name: "a", alias: "b", index: "py", highlight: [2], caption: { ru: "b = a — один список, два имени", kk: "b = a — бір тізім, екі ат" } },
  // байты символов UTF-8: группы, моно-шрифт, kk-подписи
  {
    kind: "tape",
    cells: ["01001011", "11010010", "10011010", "01100001"],
    index: "none",
    mono: true,
    groups: [
      { from: 0, to: 0, label: { ru: "K · 1 байт", kk: "K · 1 байт" } },
      { from: 1, to: 2, label: { ru: "Қ · 2 байта", kk: "Қ · 2 байт" } },
      { from: 3, to: 3, label: { ru: "a · 1 байт", kk: "a · 1 байт" } },
    ],
  },
  // двоичный поиск: указатели, отброшенная половина, подсвеченная ячейка
  {
    kind: "tape",
    cells: ["2", "5", "8", "12", "16", "23", "38", "56"],
    index: "py",
    name: "a",
    dim: [0, 1, 2, 3],
    highlight: [5],
    pointers: [
      { at: 4, label: "l", tone: "primary" },
      { at: 5, label: "m", tone: "warning" },
      { at: 5, label: "min", tone: "gold" },
      { at: 7, label: "r", tone: "primary" },
    ],
  },
  // insert: кадр «после»
  { kind: "tape", cells: ["7", "3", "9", "1"], name: "a", index: "py", after: ["7", "5", "3", "9", "1"], pointers: [{ at: 1, label: "i", tone: "success" }] },
  // худший случай: 16 ячеек, оба индекса, имя, срез с шагом, обмены, указатели
  {
    kind: "tape",
    cells: ["П", "р", "и", "в", "е", "т", " ", "м", "и", "р", "!", "1", "2", "3", "4", "5"],
    index: "both",
    name: "text",
    slice: { start: 0, stop: 16, step: 3 },
    swaps: [[1, 14], [2, 3]],
    pointers: [
      { at: 0, label: "i" },
      { at: 1, label: "j" },
      { at: 2, label: "min", tone: "gold" },
    ],
  },
  // 16 ячеек, ячейки по 3 символа
  { kind: "tape", cells: ["120", "7", "15", "99", "3", "42", "8", "61", "5", "77", "30", "14", "88", "2", "50", "9"], index: "one", name: "A", highlight: [0, 15] },
];
