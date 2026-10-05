import type { Scene } from "@/lib/types";

/** Образцы сцены graph. Дополняет исполнитель сцены. */
export const SAMPLES: Extract<Scene, { kind: "graph" }>[] = [
  {
    kind: "graph",
    nodes: [{ id: "A", x: 10, y: 50 }, { id: "B", x: 40, y: 15 }, { id: "C", x: 40, y: 85 }, { id: "D", x: 80, y: 50 }],
    edges: [{ from: "A", to: "B", weight: "4" }, { from: "A", to: "C", weight: "2" }, { from: "B", to: "D", weight: "5" }, { from: "C", to: "D", weight: "8" }],
    path: ["A", "B", "D"],
  },
  {
    kind: "graph",
    layout: "tree",
    root: "f3",
    directed: true,
    nodes: [{ id: "f3", label: "F(3)" }, { id: "f2", label: "F(2)" }, { id: "f1", label: "F(1)" }, { id: "f1b", label: "F(1)" }, { id: "f0", label: "F(0)" }],
    edges: [{ from: "f3", to: "f2" }, { from: "f3", to: "f1" }, { from: "f2", to: "f1b" }, { from: "f2", to: "f0" }],
  },
];
