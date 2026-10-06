import type { Scene } from "@/lib/types";

type G = Extract<Scene, { kind: "graph" }>;

/** Цепочка из n вершин с подписью-шаблоном и рёбрами по порядку. */
const chain = (n: number, label: (i: number) => G["nodes"][number]["label"]): Pick<G, "nodes" | "edges"> => ({
  nodes: Array.from({ length: n }, (_, i) => ({ id: `b${i + 1}`, label: label(i) })),
  edges: Array.from({ length: n - 1 }, (_, i) => ({ from: `b${i + 1}`, to: `b${i + 2}` })),
});

/** Образцы сцены graph: free с весами и путём, дерево рекурсии, K4 со степенями, двусторонние рёбра, полное двоичное дерево, круг на 16, цепочка змейкой, длинные kk-подписи, «ёжик». */
export const SAMPLES: G[] = [
  // 0. Дороги между городами, кратчайший путь (free, веса, путь)
  {
    kind: "graph",
    nodes: [{ id: "A", x: 10, y: 50 }, { id: "B", x: 40, y: 15 }, { id: "C", x: 40, y: 85 }, { id: "D", x: 80, y: 50 }],
    edges: [{ from: "A", to: "B", weight: "4" }, { from: "A", to: "C", weight: "2" }, { from: "B", to: "D", weight: "5" }, { from: "C", to: "D", weight: "8" }],
    path: ["A", "B", "D"],
    caption: { ru: "Кратчайший путь из A в D: 4 + 5 = 9", kk: "Ең қысқа жол A → D: 4 + 5 = 9" },
  },
  // 1. Дерево вызовов рекурсии (tree, directed, подписи длиннее 3 символов)
  {
    kind: "graph",
    layout: "tree",
    root: "f3",
    directed: true,
    nodes: [{ id: "f3", label: "F(3)" }, { id: "f2", label: "F(2)" }, { id: "f1", label: "F(1)" }, { id: "f1b", label: "F(1)" }, { id: "f0", label: "F(0)" }],
    edges: [{ from: "f3", to: "f2" }, { from: "f3", to: "f1" }, { from: "f2", to: "f1b" }, { from: "f2", to: "f0" }],
  },
  // 2. Полный граф K4: диагонали пересекаются в серединах — подписи весов уходят с пересечения; степени
  {
    kind: "graph",
    degrees: true,
    nodes: [{ id: "A", x: 15, y: 15 }, { id: "B", x: 85, y: 15 }, { id: "C", x: 85, y: 85 }, { id: "D", x: 15, y: 85 }],
    edges: [
      { from: "A", to: "B", weight: "3" },
      { from: "B", to: "C", weight: "6" },
      { from: "C", to: "D", weight: "2" },
      { from: "D", to: "A", weight: "7" },
      { from: "A", to: "C", weight: "10" },
      { from: "B", to: "D", weight: "4" },
    ],
  },
  // 3. Ориентированный: двусторонняя связь (изогнутые дуги), подсвеченные вершины, цвет вершин и рёбер; подписи {ru, kk}
  {
    kind: "graph",
    directed: true,
    nodes: [
      { id: "pc", label: { ru: "Компьютер", kk: "Компьютер" }, x: 10, y: 45 },
      { id: "dns", label: "DNS", x: 50, y: 6, tone: "primary" },
      { id: "srv", label: { ru: "Сервер", kk: "Сервер" }, x: 92, y: 40 },
      { id: "rt", label: { ru: "Роутер", kk: "Роутер" }, x: 55, y: 62 },
      { id: "ph", label: { ru: "Телефон", kk: "Телефон" }, x: 14, y: 94 },
    ],
    edges: [
      { from: "pc", to: "dns" },
      { from: "dns", to: "pc", tone: "primary" },
      { from: "pc", to: "rt" },
      { from: "rt", to: "srv" },
      { from: "srv", to: "rt" },
      { from: "ph", to: "rt" },
    ],
    highlight: ["pc"],
  },
  // 4. Полное двоичное дерево на 15 вершин (худший tree без «ёжика»), степени
  {
    kind: "graph",
    layout: "tree",
    root: "1",
    degrees: true,
    nodes: Array.from({ length: 15 }, (_, i) => ({ id: String(i + 1), label: String(i + 1) })),
    edges: Array.from({ length: 14 }, (_, i) => ({ from: String(Math.floor((i + 2) / 2)), to: String(i + 2) })),
    path: ["1", "3", "6", "12"],
  },
  // 5. Круг из 16 вершин: кольцо с хордами (максимум вершин), короткие подписи
  {
    kind: "graph",
    layout: "circle",
    nodes: Array.from({ length: 16 }, (_, i) => ({ id: `v${i + 1}`, label: String(i + 1) })),
    edges: [
      ...Array.from({ length: 16 }, (_, i) => ({ from: `v${i + 1}`, to: `v${((i + 1) % 16) + 1}` })),
      { from: "v1", to: "v9" },
      { from: "v4", to: "v12" },
    ],
    highlight: ["v1", "v9"],
  },
  // 6. Цепочка блоков змейкой: 10 вершин, ориентированные стрелки; подпись из двух строк
  {
    kind: "graph",
    layout: "chain",
    directed: true,
    ...chain(10, (i) => ({ ru: `Блок ${i + 1}`, kk: `Блок ${i + 1}` })),
    highlight: ["b10"],
  },
  // 7. Короткая цепочка в одну строку с весами и дугой «назад» (не соседние вершины)
  {
    kind: "graph",
    layout: "chain",
    directed: true,
    nodes: [{ id: "a", label: "0" }, { id: "b", label: "1" }, { id: "c", label: "2" }, { id: "d", label: "3" }],
    edges: [{ from: "a", to: "b", weight: "5" }, { from: "b", to: "c", weight: "7" }, { from: "c", to: "d", weight: "1" }, { from: "d", to: "a", weight: "9" }],
    path: ["a", "b", "c"],
  },
  // 8. Длинные казахские подписи: перенос по пробелам, веса из 4 цифр
  {
    kind: "graph",
    nodes: [
      { id: "ast", label: { ru: "Астана", kk: "Астана" }, x: 45, y: 6 },
      { id: "kar", label: { ru: "Караганда", kk: "Қарағанды" }, x: 80, y: 36 },
      { id: "akt", label: { ru: "Актобе", kk: "Ақтөбе" }, x: 8, y: 46 },
      { id: "okz", label: { ru: "Юж. Казахстан", kk: "Оңтүстік Қазақстан" }, x: 76, y: 92 },
      { id: "alm", label: { ru: "Алматы", kk: "Алматы" }, x: 14, y: 90 },
    ],
    edges: [
      { from: "ast", to: "kar", weight: "220" },
      { from: "ast", to: "akt", weight: "1200" },
      { from: "kar", to: "alm", weight: "1000" },
      { from: "kar", to: "okz", weight: "1250" },
      { from: "alm", to: "okz", weight: "700" },
    ],
    path: ["ast", "kar", "alm"],
    caption: { ru: "Расстояния между городами, км", kk: "Қалалар арасындағы қашықтық, км" },
  },
  // 9. «Ёжик»: корень и 15 листьев — худший случай ширины дерева (листья в два яруса, рёбра с изломом)
  {
    kind: "graph",
    layout: "tree",
    root: "r",
    nodes: [{ id: "r", label: "root" }, ...Array.from({ length: 15 }, (_, i) => ({ id: `l${i + 1}`, label: String(i + 1) }))],
    edges: Array.from({ length: 15 }, (_, i) => ({ from: "r", to: `l${i + 1}` })),
  },
  // 10. Дерево каталогов (tree, длинные подписи, две строки, highlight)
  {
    kind: "graph",
    layout: "tree",
    root: "home",
    directed: true,
    nodes: [
      { id: "home", label: "/home", tone: "primary" },
      { id: "u1", label: { ru: "анна", kk: "әлия" } },
      { id: "u2", label: { ru: "борис", kk: "бауыржан" } },
      { id: "d1", label: { ru: "Документы\nи отчёты", kk: "Құжаттар\nмен есептер" } },
      { id: "d2", label: { ru: "Музыка", kk: "Музыка" } },
      { id: "d3", label: { ru: "Загрузки", kk: "Жүктеулер" } },
    ],
    edges: [{ from: "home", to: "u1" }, { from: "home", to: "u2" }, { from: "u1", to: "d1" }, { from: "u1", to: "d2" }, { from: "u2", to: "d3" }],
    highlight: ["d1"],
  },
];
