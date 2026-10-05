import type { Scene } from "@/lib/types";

/** Образцы расширений старых сцен (binary, decimal, table, circuit, hardware). Дополняют исполнители расширений. */
export const SAMPLES: Scene[] = [
  { kind: "binary", bits: "11010111", groups: 4 },
  { kind: "binary", bits: "11000000101010000000000100001010", groups: 8, and: "11111111111111111111111100000000" },
  { kind: "binary", bits: "1111111111", gap: [3, 7] },
  { kind: "binary", bits: "101101", shift: "left" },
  { kind: "decimal", number: "7E3", base: 16 },
  { kind: "decimal", number: "4721", peel: 2 },
  {
    kind: "table",
    sheet: true,
    rows: [["2", "3", "=A1*B1"], ["4", "5", "=A2*B2"]],
    formula: { cell: "C2", text: "=A2*B2" },
    arrows: [{ from: [1, 0], to: [1, 2] }, { from: [1, 1], to: [1, 2] }],
    range: { from: [0, 0], to: [1, 1] },
  },
  {
    kind: "table",
    columns: ["ID", "Name", "Score"],
    rows: [["1", "Ali", "90"], ["2", "Dana", "75"], ["3", "Erlan", "60"]],
    rowStates: [{ row: 2, state: "struck" }],
    changes: [{ cell: [1, 2], from: "70" }],
    join: { columns: ["ID", "City"], rows: [["1", "Almaty"], ["2", "Astana"]], links: [[0, 0], [1, 1]] },
  },
  {
    kind: "circuit",
    inputs: ["A", "B"],
    gates: [{ id: "s", op: "xor", in: ["A", "B"] }, { id: "c", op: "and", in: ["A", "B"] }],
    output: "s",
    outputs: [{ gate: "s", name: "S" }, { gate: "c", name: "C" }],
    values: { A: 1, B: 1 },
  },
  { kind: "hardware", items: ["switch", "hub", "modem", "access-point", "nic", "cable-utp", "cable-fiber", "printer-dot", "printer-inkjet"] },
  { kind: "hardware", items: ["printer-laser", "plotter", "pen-tablet", "sensor", "vr-headset", "robot-vacuum", "drone", "manipulator"] },
  // ---- S6: расширения table (добавлено в конец массива) ----
  // Состояния строк: приглушена (не прошла WHERE), удалена, добавлена, отклонена (нарушает первичный ключ).
  {
    kind: "table",
    columns: ["ID", { ru: "Имя", kk: "Аты" }, { ru: "Балл", kk: "Балл" }],
    rows: [["1", { ru: "Али", kk: "Әли" }, "90"], ["2", "Dana", "75"], ["3", "Erlan", "60"], ["4", { ru: "Мария", kk: "Мәрия" }, "88"], ["3", "Aigul", "70"]],
    rowStates: [{ row: 1, state: "dim" }, { row: 2, state: "struck" }, { row: 3, state: "new" }, { row: 4, state: "rejected" }],
    caption: { ru: "Приглушена, удалена, добавлена и отклонена (повтор ключа 3)", kk: "Ескерілмейтін, жойылған, қосылған және қабылданбаған жол (3 кілтінің қайталануы)" },
  },
  // UPDATE: «было → стало» и тона (условие — primary, результат — success).
  {
    kind: "table",
    columns: ["ID", "Name", "City", "Score"],
    rows: [["1", "Ali", "Almaty", "90"], ["2", "Dana", "Astana", "80"], ["3", "Erlan", "Astana", "60"]],
    tones: [{ tone: "primary", cells: [[1, 2], [2, 2]] }, { tone: "success", cells: [[1, 3], [2, 3]] }],
    changes: [{ cell: [1, 3], from: "75" }, { cell: [2, 3], from: "55" }],
  },
  // Электронная таблица: строка формул, свои номера строк после фильтра, диапазон, стрелки-ссылки.
  {
    kind: "table",
    sheet: true,
    mono: true,
    rows: [["2", "3", "=A2*B2"], ["4", "5", "=A5*B5"], ["6", "7", "=A7*B7"]],
    rowNumbers: [2, 5, 7],
    formula: { cell: "C5", text: "=A5*B5" },
    highlightCells: [[1, 2]],
    arrows: [{ from: [1, 0], to: [1, 2] }, { from: [1, 1], to: [1, 2] }],
    range: { from: [0, 0], to: [2, 1] },
  },
  // Копирование формулы вниз: вертикальные стрелки.
  {
    kind: "table",
    sheet: true,
    mono: true,
    rows: [["10", "=A1*2"], ["20", "=A2*2"], ["30", "=A3*2"], ["40", "=A4*2"]],
    formula: { cell: "B2", text: "=A2*2" },
    arrows: [{ from: [0, 1], to: [1, 1], tone: "success" }, { from: [1, 1], to: [2, 1], tone: "success" }, { from: [2, 1], to: [3, 1], tone: "success" }],
    changes: [{ cell: [3, 1], from: "=A1*2" }],
  },
  // JOIN: таблицы друг под другом (телефон) или рядом с линиями (широкий экран); совпавшие ключи — одним тоном.
  {
    kind: "table",
    columns: ["ID", { ru: "Имя", kk: "Аты" }, "ClassID"],
    rows: [["1", "Ali", "10"], ["2", "Dana", "11"], ["3", "Erlan", "10"], ["4", "Aigul", "12"]],
    join: { columns: ["ClassID", { ru: "Класс", kk: "Сынып" }], rows: [["10", "10A"], ["11", "10B"], ["12", "11A"]], links: [[0, 0], [1, 1], [2, 0], [3, 2]] },
    highlightCols: [2],
  },
  // Худший случай: 8 столбцов × 16 строк, диапазон и стрелка через всю таблицу.
  {
    kind: "table",
    sheet: true,
    mono: true,
    rows: Array.from({ length: 16 }, (_, r) => Array.from({ length: 8 }, (_, c) => (c === 7 ? `=SUM(A${r + 1}:G${r + 1})` : String((r + 1) * (c + 1))))),
    range: { from: [2, 1], to: [5, 3] },
    arrows: [{ from: [0, 0], to: [15, 7], tone: "warning" }],
    formula: { cell: "H1", text: "=SUM(A1:G1)" },
  },
];
