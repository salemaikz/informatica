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
    columns: ["A", "B", "C"],
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
  {
    // Полусумматор без значений, трёхбуквенные имена выходов.
    kind: "circuit",
    inputs: ["A", "B"],
    gates: [{ id: "s", op: "xor", in: ["A", "B"] }, { id: "c", op: "and", in: ["A", "B"] }],
    output: "s",
    outputs: [{ gate: "s", name: "Sum" }, { gate: "c", name: "Car" }],
  },
  {
    // Выходы из разных столбцов: S от xor, перенос с инверсией (И-НЕ по смыслу) — вентиль НЕ во втором столбце.
    kind: "circuit",
    inputs: ["A", "B"],
    gates: [{ id: "x", op: "xor", in: ["A", "B"] }, { id: "c", op: "and", in: ["A", "B"] }, { id: "n", op: "not", in: ["c"] }],
    output: "x",
    outputs: [{ gate: "x", name: "S" }, { gate: "n", name: "Cn" }],
    values: { A: 1, B: 1 },
  },
  { kind: "hardware", items: ["switch", "hub", "modem", "access-point", "nic", "cable-utp", "cable-fiber", "printer-dot", "printer-inkjet"] },
  { kind: "hardware", items: ["printer-laser", "plotter", "pen-tablet", "sensor", "vr-headset", "robot-vacuum", "drone", "manipulator"] },
];
