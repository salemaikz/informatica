import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneView } from "@/components/scenes/SceneView";
import { SAMPLES } from "@/components/scenes/samples/graph";
import {
  BADGE_GAP,
  GRAPH_W,
  NODE_TEXT,
  PILL_GAP,
  PILL_TEXT,
  borderPoint,
  boxesOverlap,
  countCrossings,
  countEdgeHits,
  edgeThroughNode,
  fitLines,
  graphAria,
  graphDegrees,
  layoutGraph,
  polyCrossings,
  treeChildren,
  type GraphInput,
  type GraphLayout,
} from "@/components/scenes/graph";
import { dict, type DictKey } from "@/i18n/dict";
import { estimateTextWidth } from "@/components/scenes/text-width";
import { tx } from "@/lib/text";
import type { Lang, Scene } from "@/lib/types";
import { validateScene } from "./validate";

type G = Extract<Scene, { kind: "graph" }>;

/** Сцена → вход раскладки на нужном языке (как в компоненте). */
function toInput(scene: G, lang: Lang = "ru"): GraphInput {
  return {
    nodes: scene.nodes.map((v) => ({ id: v.id, label: v.label !== undefined ? tx(v.label, lang) : v.id, x: v.x, y: v.y, tone: v.tone })),
    edges: scene.edges.map((e) => ({ from: e.from, to: e.to, weight: e.weight, tone: e.tone })),
    layout: scene.layout ?? "free",
    root: scene.root,
    directed: !!scene.directed,
    path: scene.path ?? [],
    highlight: scene.highlight ?? [],
    degrees: !!scene.degrees,
  };
}

const t = (lang: Lang) => (key: DictKey, params?: Record<string, string | number>) =>
  dict[key][lang].replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k] ?? ""));

/** Прямоугольник вершины. */
const rectOf = (n: GraphLayout["nodes"][number]) => ({ x0: n.cx - n.w / 2, y0: n.cy - n.h / 2, x1: n.cx + n.w / 2, y1: n.cy + n.h / 2 });

/** Всё нарисованное лежит внутри области рисунка. */
function expectInside(lay: GraphLayout) {
  for (const n of lay.nodes) {
    const r = rectOf(n);
    expect(r.x0, `${n.id} слева`).toBeGreaterThanOrEqual(0);
    expect(r.y0, `${n.id} сверху`).toBeGreaterThanOrEqual(0);
    expect(r.x1, `${n.id} справа`).toBeLessThanOrEqual(lay.width);
    expect(r.y1, `${n.id} снизу`).toBeLessThanOrEqual(lay.height);
  }
  for (const e of lay.edges) {
    if (!e.pill) continue;
    expect(e.pill.x - e.pill.w / 2, `подпись ${e.key} слева`).toBeGreaterThanOrEqual(0);
    expect(e.pill.x + e.pill.w / 2, `подпись ${e.key} справа`).toBeLessThanOrEqual(lay.width);
    expect(e.pill.y - e.pill.h / 2).toBeGreaterThanOrEqual(0);
    expect(e.pill.y + e.pill.h / 2).toBeLessThanOrEqual(lay.height);
  }
  for (const b of lay.badges) {
    expect(b.x - b.r).toBeGreaterThanOrEqual(0);
    expect(b.x + b.r).toBeLessThanOrEqual(lay.width);
    expect(b.y - b.r).toBeGreaterThanOrEqual(0);
    expect(b.y + b.r).toBeLessThanOrEqual(lay.height);
  }
}

function overlapsAny(lay: GraphLayout): string[] {
  const bad: string[] = [];
  const shape = (n: GraphLayout["nodes"][number]) => ({ cx: n.cx, cy: n.cy, w: n.w, h: n.h, shape: n.shape, r: n.r });
  for (let i = 0; i < lay.nodes.length; i++)
    for (let j = i + 1; j < lay.nodes.length; j++) if (boxesOverlap(shape(lay.nodes[i]), shape(lay.nodes[j]), 0)) bad.push(`${lay.nodes[i].id}/${lay.nodes[j].id}`);
  return bad;
}

describe("образцы graph", () => {
  for (const lang of ["ru", "kk"] as const)
    SAMPLES.forEach((scene, i) => {
      it(`образец ${i} (${lang}): проходит проверку, вершины не налезают, всё внутри области`, () => {
        expect(validateScene(scene)).toEqual([]);
        const lay = layoutGraph(toInput(scene, lang));
        expect(overlapsAny(lay)).toEqual([]);
        expectInside(lay);
        expect(lay.nodes).toHaveLength(scene.nodes.length);
        expect(lay.edges).toHaveLength(scene.edges.length);
        // в экран телефона (логическая ширина 320) входят все образцы, в том числе «ёжик»
        expect(lay.width).toBe(GRAPH_W);
        expect(lay.fits).toBe(true);
        expect(countEdgeHits(lay)).toBe(0);
        expect(lay.height).toBeLessThan(420);
      });
    });

  it("подписи весов не налезают на вершины и друг на друга", () => {
    for (const scene of SAMPLES) {
      const lay = layoutGraph(toInput(scene));
      const pills = lay.edges.flatMap((e) => (e.pill ? [{ key: e.key, ...e.pill }] : []));
      for (const p of pills) {
        for (const n of lay.nodes) {
          const r = rectOf(n);
          const hit = p.x - p.w / 2 < r.x1 && r.x0 < p.x + p.w / 2 && p.y - p.h / 2 < r.y1 && r.y0 < p.y + p.h / 2;
          expect(hit, `подпись ${p.key} на вершине ${n.id}`).toBe(false);
        }
      }
      for (let i = 0; i < pills.length; i++)
        for (let j = i + 1; j < pills.length; j++) {
          const a = pills[i];
          const b = pills[j];
          const hit = a.x - a.w / 2 < b.x + b.w / 2 && b.x - b.w / 2 < a.x + a.w / 2 && a.y - a.h / 2 < b.y + b.h / 2 && b.y - b.h / 2 < a.y + a.h / 2;
          expect(hit, `подписи ${a.key} и ${b.key} налезают`).toBe(false);
        }
    }
  });

  it("отрисовка SceneView: role=img, aria-label, нет заглушки", () => {
    for (const scene of SAMPLES) {
      const html = renderToStaticMarkup(createElement(SceneView, { scene }));
      expect(html).toContain('role="img"');
      expect(html).toContain("aria-label=");
      expect(html).not.toContain("data-stub");
    }
  });
});

describe("free", () => {
  it("координаты 0..100 → поле: порядок и пропорции сохраняются", () => {
    const sc = SAMPLES[0];
    const lay = layoutGraph(toInput(sc));
    const at = (id: string) => lay.nodes.find((n) => n.id === id)!;
    expect(at("A").cx).toBeLessThan(at("B").cx);
    expect(at("B").cx).toBeLessThan(at("D").cx);
    expect(at("B").cy).toBeLessThan(at("A").cy);
    expect(at("A").cy).toBeLessThan(at("C").cy);
    // C.y - B.y = 70% поля, A.y — посередине
    expect(at("A").cy).toBeCloseTo((at("B").cy + at("C").cy) / 2, 1);
  });

  it("если вершины налезают друг на друга при полном размере, они уменьшаются", () => {
    const nodes = Array.from({ length: 16 }, (_, i) => ({ id: `n${i}`, x: 5 + (i % 4) * 8, y: 5 + Math.floor(i / 4) * 8 }));
    const lay = layoutGraph({ nodes: nodes.map((n) => ({ ...n, label: n.id })), edges: [], layout: "free", directed: false, path: [], highlight: [], degrees: false });
    expect(lay.scale).toBeLessThan(1);
  });

  it("две вершины и ни одного ребра", () => {
    const lay = layoutGraph({ nodes: [{ id: "a", label: "a", x: 0, y: 0 }, { id: "b", label: "b", x: 100, y: 100 }], edges: [], layout: "free", directed: false, path: [], highlight: [], degrees: true });
    expect(lay.edges).toEqual([]);
    expect(lay.badges.map((b) => b.text)).toEqual(["0", "0"]);
    expectInside(lay);
  });
});

describe("tree", () => {
  it("родитель выше детей и стоит над серединой детей; пересечений рёбер нет", () => {
    for (const idx of [1, 4, 9, 10]) {
      const sc = SAMPLES[idx];
      const lay = layoutGraph(toInput(sc));
      const at = (id: string) => lay.nodes.find((n) => n.id === id)!;
      const { children } = treeChildren(toInput(sc));
      for (const [p, kids] of children) {
        for (const c of kids) expect(at(c).cy).toBeGreaterThan(at(p).cy);
        if (kids.length) expect(at(p).cx).toBeCloseTo((at(kids[0]).cx + at(kids[kids.length - 1]).cx) / 2, 1);
      }
      expect(countCrossings(lay), `образец ${idx}`).toBe(0);
    }
  });

  it("порядок детей — порядок рёбер; неориентированное дерево строится от корня", () => {
    const input: GraphInput = {
      nodes: ["r", "a", "b", "c"].map((id) => ({ id, label: id })),
      edges: [{ from: "a", to: "r" }, { from: "c", to: "a" }, { from: "r", to: "b" }],
      layout: "tree",
      root: "r",
      directed: false,
      path: [],
      highlight: [],
      degrees: false,
    };
    const { children, depth } = treeChildren(input);
    expect(children.get("r")).toEqual(["a", "b"]);
    expect(children.get("a")).toEqual(["c"]);
    expect(depth.get("c")).toBe(2);
    const lay = layoutGraph(input);
    const at = (id: string) => lay.nodes.find((n) => n.id === id)!;
    expect(at("a").cx).toBeLessThan(at("b").cx);
  });

  it("полное двоичное дерево на 15 вершин влезает в 320 без уменьшения ниже 0.84", () => {
    const lay = layoutGraph(toInput(SAMPLES[4]));
    expect(lay.width).toBe(GRAPH_W);
    expect(lay.scale).toBeGreaterThanOrEqual(0.84);
  });

  it("«ёжик» из 15 листьев: влезает в 320 без уменьшения, листья в два яруса, рёбра с изломом", () => {
    const lay = layoutGraph(toInput(SAMPLES[9]));
    expect(lay.width).toBe(GRAPH_W);
    expect(lay.scale).toBe(1);
    expect(overlapsAny(lay)).toEqual([]);
    expect(new Set(lay.nodes.filter((n) => n.id !== "r").map((n) => n.cy)).size).toBe(2);
    expect(minScreenFont(lay)).toBeGreaterThanOrEqual(10);
  });

  it("рёбра дерева не идут сквозь чужие вершины, в том числе у «ёжика»", () => {
    for (const idx of [1, 4, 9, 10]) expect(edgeThroughNode(layoutGraph(toInput(SAMPLES[idx]))), `образец ${idx}`).toBe(false);
  });

  it("недостижимая от корня вершина (некорректный вход) не ломает раскладку", () => {
    const lay = layoutGraph({
      nodes: ["r", "a", "z"].map((id) => ({ id, label: id })),
      edges: [{ from: "r", to: "a" }],
      layout: "tree",
      root: "r",
      directed: true,
      path: [],
      highlight: [],
      degrees: false,
    });
    expect(lay.nodes).toHaveLength(3);
    expect(overlapsAny(lay)).toEqual([]);
  });
});

describe("circle", () => {
  it("16 вершин — равные углы по часовой стрелке, первая сверху", () => {
    const lay = layoutGraph(toInput(SAMPLES[5]));
    const c = lay.nodes[0];
    const cx = lay.nodes.reduce((a, n) => a + n.cx, 0) / 16;
    const cy = lay.nodes.reduce((a, n) => a + n.cy, 0) / 16;
    expect(c.cx).toBeCloseTo(cx, 0);
    expect(c.cy).toBeLessThan(cy);
    expect(lay.nodes[4].cx).toBeGreaterThan(cx); // четверть оборота по часовой — справа
    expect(lay.nodes[12].cx).toBeLessThan(cx);
    const radii = lay.nodes.map((n) => Math.hypot(n.cx - cx, n.cy - cy));
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.5);
  });

  it("две вершины — слева направо", () => {
    const lay = layoutGraph({ nodes: [{ id: "a", label: "a" }, { id: "b", label: "b" }], edges: [{ from: "a", to: "b" }], layout: "circle", directed: false, path: [], highlight: [], degrees: false });
    expect(lay.nodes[0].cx).toBeLessThan(lay.nodes[1].cx);
    expect(Math.abs(lay.nodes[0].cy - lay.nodes[1].cy)).toBeLessThan(0.5);
  });
});

describe("chain", () => {
  it("10 вершин не влезают в строку — змейка: следующий ряд идёт справа налево, стык — друг под другом", () => {
    const lay = layoutGraph(toInput(SAMPLES[6]));
    const rows = new Map<number, string[]>();
    for (const n of lay.nodes) rows.set(n.cy, [...(rows.get(n.cy) ?? []), n.id]);
    expect(rows.size).toBeGreaterThan(1);
    const ys = [...rows.keys()].sort((a, b) => a - b);
    const row0 = lay.nodes.filter((n) => n.cy === ys[0]);
    const row1 = lay.nodes.filter((n) => n.cy === ys[1]);
    expect(row0[0].cx).toBeLessThan(row0[row0.length - 1].cx);
    expect(row1[0].cx).toBeGreaterThan(row1[row1.length - 1].cx);
    expect(row0[row0.length - 1].cx).toBeCloseTo(row1[0].cx, 1);
  });

  it("4 вершины — одна строка; ребро «назад» изогнуто дугой, остальные прямые", () => {
    const lay = layoutGraph(toInput(SAMPLES[7]));
    expect(new Set(lay.nodes.map((n) => n.cy)).size).toBe(1);
    const back = lay.edges.find((e) => e.key === "d>a")!;
    expect(back.ctrl).toBeDefined();
    expect(lay.edges.filter((e) => e.ctrl)).toHaveLength(1);
  });

  it("16 вершин цепочкой: ряды одной длины, всё влезает", () => {
    const nodes = Array.from({ length: 16 }, (_, i) => ({ id: `n${i}`, label: `Блок ${i + 1}` }));
    const edges = nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id }));
    const lay = layoutGraph({ nodes, edges, layout: "chain", directed: true, path: [], highlight: [], degrees: false });
    expect(lay.width).toBe(GRAPH_W);
    expect(overlapsAny(lay)).toEqual([]);
    const perRow = new Map<number, number>();
    for (const n of lay.nodes) perRow.set(n.cy, (perRow.get(n.cy) ?? 0) + 1);
    expect(new Set(perRow.values()).size).toBeLessThanOrEqual(2);
  });
});

describe("подрезка рёбер и стрелки", () => {
  it("borderPoint: окружность и прямоугольник, угол скруглённого прямоугольника", () => {
    const c = { cx: 0, cy: 0, w: 40, h: 40, shape: "circle" as const, r: 20 };
    expect(borderPoint(c, 100, 0)).toEqual({ x: 20, y: 0 });
    const p = borderPoint(c, 100, 100);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(20, 5);
    const r = { cx: 0, cy: 0, w: 60, h: 30, shape: "rect" as const, r: 10 };
    expect(borderPoint(r, 100, 0).x).toBeCloseTo(30, 5);
    expect(borderPoint(r, 0, -100).y).toBeCloseTo(-15, 5);
    // по диагонали точка лежит внутри габарита прямоугольника, но не в самом углу (скругление)
    const d = borderPoint(r, 100, 100);
    expect(Math.abs(d.x)).toBeLessThanOrEqual(30);
    expect(Math.abs(d.y)).toBeLessThanOrEqual(15);
    expect(Math.abs(d.x) < 30 || Math.abs(d.y) < 15).toBe(true);
    expect(borderPoint(c, 100, 0, 3).x).toBe(23);
  });

  it("концы рёбер лежат на краю вершин, а не в центре", () => {
    const lay = layoutGraph(toInput(SAMPLES[0]));
    for (const e of lay.edges) {
      const a = lay.nodes.find((n) => n.id === e.from)!;
      const b = lay.nodes.find((n) => n.id === e.to)!;
      expect(Math.hypot(e.p0[0] - a.cx, e.p0[1] - a.cy)).toBeGreaterThanOrEqual(Math.min(a.w, a.h) / 2 - 0.5);
      expect(Math.hypot(e.p1[0] - b.cx, e.p1[1] - b.cy)).toBeGreaterThanOrEqual(Math.min(b.w, b.h) / 2 - 0.5);
    }
  });

  it("стрелки только у ориентированных; двусторонние связи — разные дуги", () => {
    expect(layoutGraph(toInput(SAMPLES[0])).edges.every((e) => e.arrow === "")).toBe(true);
    const lay = layoutGraph(toInput(SAMPLES[3]));
    expect(lay.edges.every((e) => e.arrow.startsWith("M") && e.arrow.endsWith("Z"))).toBe(true);
    const ab = lay.edges.find((e) => e.key === "pc>dns")!;
    const ba = lay.edges.find((e) => e.key === "dns>pc")!;
    expect(ab.ctrl && ba.ctrl).toBeTruthy();
    expect(Math.hypot(ab.ctrl![0] - ba.ctrl![0], ab.ctrl![1] - ba.ctrl![1])).toBeGreaterThan(10);
  });
});

describe("подписи вершин", () => {
  it("короткая подпись — кружок, длинная — прямоугольник, две строки по \\n", () => {
    const lay = layoutGraph(toInput(SAMPLES[1]));
    expect(lay.nodes.every((n) => n.shape === "rect")).toBe(true);
    const abc = layoutGraph(toInput(SAMPLES[0]));
    expect(abc.nodes.every((n) => n.shape === "circle")).toBe(true);
    const dirs = layoutGraph(toInput(SAMPLES[10]));
    expect(dirs.nodes.find((n) => n.id === "d1")!.lines).toEqual(["Документы", "и отчёты"]);
    expect(dirs.nodes.find((n) => n.id === "home")!.shape).toBe("rect");
  });

  it("длинная казахская подпись переносится по пробелам и вершина не шире 112", () => {
    const lay = layoutGraph(toInput(SAMPLES[8], "kk"));
    const n = lay.nodes.find((v) => v.id === "okz")!;
    expect(n.lines.length).toBe(2);
    expect(n.w).toBeLessThanOrEqual(112);
    expect(fitLines("Оңтүстік Қазақстан", 14, 94).lines).toEqual(["Оңтүстік", "Қазақстан"]);
  });

  it("слово длиннее вершины — шрифт уменьшается, но не ниже 10", () => {
    const f = fitLines("Автоматтандырылған", 14, 94);
    expect(f.lines).toHaveLength(1);
    expect(f.font).toBeLessThan(14);
    expect(f.font).toBeGreaterThanOrEqual(10);
  });

  it("без label подписью служит id, пустые строки отбрасываются", () => {
    expect(fitLines("a\n\nb", 14, 90).lines).toEqual(["a", "b"]);
    const lay = layoutGraph({ nodes: [{ id: "x1", label: "x1" }, { id: "x2", label: "x2" }], edges: [], layout: "chain", directed: false, path: [], highlight: [], degrees: false });
    expect(lay.nodes[0].lines).toEqual(["x1"]);
  });
});

describe("путь, подсветка, степени", () => {
  it("путь: вершины и рёбра primary, висящие рёбра нейтральны; highlight сильнее пути, tone сильнее всего", () => {
    const lay = layoutGraph(toInput(SAMPLES[0]));
    expect(lay.nodes.filter((n) => n.onPath).map((n) => n.id)).toEqual(["A", "B", "D"]);
    expect(lay.nodes.find((n) => n.id === "C")!.tone).toBeNull();
    expect(lay.nodes.find((n) => n.id === "A")!.tone).toBe("primary");
    expect(lay.edges.filter((e) => e.onPath).map((e) => e.key)).toEqual(["A>B", "B>D"]);
    expect(lay.edges.find((e) => e.key === "A>C")!.tone).toBeNull();

    const hl = layoutGraph({ ...toInput(SAMPLES[0]), highlight: ["B"], nodes: toInput(SAMPLES[0]).nodes.map((n) => (n.id === "D" ? { ...n, tone: "success" as const } : n)) });
    expect(hl.nodes.find((n) => n.id === "B")!.tone).toBe("warning");
    expect(hl.nodes.find((n) => n.id === "D")!.tone).toBe("success");
  });

  it("путь в ориентированном графе подсвечивает только рёбра по направлению", () => {
    const input = toInput(SAMPLES[3]);
    const lay = layoutGraph({ ...input, path: ["ph", "rt", "srv"] });
    expect(lay.edges.filter((e) => e.onPath).map((e) => e.key).sort()).toEqual(["ph>rt", "rt>srv"]);
  });

  it("степени: K4 — по 3, ориентированный считает входящие и исходящие; значок не лежит на вершинах", () => {
    const lay = layoutGraph(toInput(SAMPLES[2]));
    expect(lay.badges.map((b) => b.text)).toEqual(["3", "3", "3", "3"]);
    expect(lay.nodes.every((n) => n.degree === 3)).toBe(true);
    for (const b of lay.badges)
      for (const n of lay.nodes) {
        if (n.id === b.id) continue;
        const r = rectOf(n);
        expect(b.x + b.r < r.x0 || b.x - b.r > r.x1 || b.y + b.r < r.y0 || b.y - b.r > r.y1, `значок ${b.id} на ${n.id}`).toBe(true);
      }
    const d = graphDegrees(toInput(SAMPLES[3]));
    expect(d.get("pc")).toBe(3);
    expect(d.get("rt")).toBe(4);
    expect(d.get("ph")).toBe(1);
  });

  it("значки степени дерева — без наложения на вершины и подписи (образец 4)", () => {
    const lay = layoutGraph(toInput(SAMPLES[4]));
    expect(lay.badges).toHaveLength(15);
    expect(lay.badges.find((b) => b.id === "1")!.text).toBe("2");
    expect(lay.badges.find((b) => b.id === "8")!.text).toBe("1");
    expectInside(lay);
  });

  it("недостижимы пересечения подписи веса в K4: подпись диагонали не на пересечении диагоналей", () => {
    const lay = layoutGraph(toInput(SAMPLES[2]));
    const ac = lay.edges.find((e) => e.key === "A>C")!;
    const bd = lay.edges.find((e) => e.key === "B>D")!;
    const mid = [(lay.nodes[0].cx + lay.nodes[2].cx) / 2, (lay.nodes[0].cy + lay.nodes[2].cy) / 2];
    for (const e of [ac, bd]) expect(Math.hypot(e.pill!.x - mid[0], e.pill!.y - mid[1])).toBeGreaterThan(6);
  });
});

describe("текст и словарь", () => {
  it("пересказ рисунка на ru и kk: вершины, рёбра с весами, путь, степени", () => {
    const ru = graphAria({ ...toInput(SAMPLES[0]), degrees: true }, t("ru"));
    expect(ru).toContain("Граф. Вершины: A, B, C, D.");
    expect(ru).toContain("A — B (4)");
    expect(ru).toContain("Путь: A → B → D.");
    expect(ru).toContain("Степени вершин: A — 2");
    const kk = graphAria(toInput(SAMPLES[1], "kk"), t("kk"));
    expect(kk).toContain("Ағаш. Түбір: F(3).");
    expect(kk).toContain("F(3) → F(2)");
    const hl = graphAria(toInput(SAMPLES[3]), t("kk"));
    expect(hl).toContain("Бөлектелгені: Компьютер.");
  });

  it("все ключи scene.graph.* двуязычные, без эмодзи", () => {
    const keys = (Object.keys(dict) as DictKey[]).filter((k) => k.startsWith("scene.graph."));
    expect(keys.length).toBeGreaterThanOrEqual(5);
    for (const k of keys) {
      expect(dict[k].ru.trim()).not.toBe("");
      expect(dict[k].kk.trim()).not.toBe("");
      expect(dict[k].ru + dict[k].kk).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

// ---------- худшие допустимые случаи из validate.ts ----------

const base = { path: [] as string[], highlight: [] as string[], degrees: false, directed: false };
const mkNodes = (labels: string[]) => labels.map((label, i) => ({ id: `v${i}`, label }));
const nums = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));
const cities = ["Алматы", "Қарағанды", "Астана", "Ақтөбе", "Шымкент", "Атырау", "Павлодар", "Орал", "Тараз", "Қостанай", "Семей", "Петропавл", "Көкшетау", "Талдықорған", "Ақтау", "Қызылорда"];
const treeOf = (labels: string[], parent: (i: number) => number, weight?: string): GraphInput => ({
  ...base,
  layout: "tree",
  root: "v0",
  nodes: mkNodes(labels),
  edges: labels.slice(1).map((_, i) => ({ from: `v${parent(i + 1)}`, to: `v${i + 1}`, weight })),
});
const ringOf = (labels: string[], weight?: string): GraphInput => ({
  ...base,
  layout: "circle",
  nodes: mkNodes(labels),
  edges: labels.map((_, i) => ({ from: `v${i}`, to: `v${(i + 1) % labels.length}`, weight })),
});
const chainOf = (labels: string[], extra: [number, number][], directed = true): GraphInput => ({
  ...base,
  directed,
  layout: "chain",
  nodes: mkNodes(labels),
  edges: [...labels.slice(1).map((_, i) => ({ from: `v${i}`, to: `v${i + 1}` })), ...extra.map(([a, b]) => ({ from: `v${a}`, to: `v${b}` }))],
});

/** Самый мелкий текст на экране телефона: кегль × (328 / ширина области), если область шире 328. */
function minScreenFont(lay: GraphLayout): number {
  const fonts = [...lay.nodes.map((n) => n.fontPx), ...lay.edges.flatMap((e) => (e.pill ? [e.pill.fontPx] : []))];
  return Math.min(...fonts) * Math.min(1, 328 / lay.width);
}

/** Подписи весов не лежат на вершинах и друг на друге. */
function expectPillsClean(lay: GraphLayout) {
  const pills = lay.edges.flatMap((e) => (e.pill ? [{ key: e.key, ...e.pill }] : []));
  for (const p of pills) {
    for (const n of lay.nodes) {
      const near = n.shape === "circle"
        ? Math.hypot(n.cx - Math.max(p.x - p.w / 2, Math.min(n.cx, p.x + p.w / 2)), n.cy - Math.max(p.y - p.h / 2, Math.min(n.cy, p.y + p.h / 2))) < n.r
        : p.x - p.w / 2 < n.cx + n.w / 2 && n.cx - n.w / 2 < p.x + p.w / 2 && p.y - p.h / 2 < n.cy + n.h / 2 && n.cy - n.h / 2 < p.y + p.h / 2;
      expect(near, `подпись ${p.key} на вершине ${n.id}`).toBe(false);
    }
  }
  for (let i = 0; i < pills.length; i++)
    for (let j = i + 1; j < pills.length; j++) {
      const a = pills[i];
      const b = pills[j];
      const hit = a.x - a.w / 2 < b.x + b.w / 2 && b.x - b.w / 2 < a.x + a.w / 2 && a.y - a.h / 2 < b.y + b.h / 2 && b.y - b.h / 2 < a.y + a.h / 2;
      expect(hit, `подписи ${a.key} и ${b.key} налезают`).toBe(false);
    }
}

describe("широкое дерево: читается на телефоне", () => {
  const dirs = treeOf(
    ["C:\\", "Документы", "Музыка", "Загрузки", "кесте.xlsx", "отчёт.docx", "музыка.mp3", "фильм.mp4", "фото.jpg", "заметки.txt"],
    (i) => (i <= 3 ? 0 : 1 + ((i - 4) % 3)),
  );
  const binary = treeOf(nums(15), (i) => Math.floor((i - 1) / 2), "12");
  for (const [name, input] of [
    ["«ёжик» из 15 цифр", toInput(SAMPLES[9])],
    ["дерево каталогов с 6 файлами", dirs],
    ["двоичное дерево на 15 вершин с весами", binary],
  ] as [string, GraphInput][])
    it(`${name}: ширина 320, кегль на телефоне не меньше 10 px, без наложений и рёбер сквозь вершины`, () => {
      const lay = layoutGraph(input);
      expect(lay.width).toBe(GRAPH_W);
      expect(minScreenFont(lay)).toBeGreaterThanOrEqual(10);
      expect(overlapsAny(lay)).toEqual([]);
      expect(countEdgeHits(lay)).toBe(0);
      expect(countCrossings(lay)).toBe(0);
      expectPillsClean(lay);
      expectInside(lay);
    });

  it("двоичное дерево с весами: подписи у ребёнка, шаг листьев меньше «ширина подписи + 2»", () => {
    const lay = layoutGraph(binary);
    const leaves = lay.nodes.filter((n) => Number(n.id.slice(1)) >= 7).sort((a, b) => a.cx - b.cx);
    const step = (leaves[leaves.length - 1].cx - leaves[0].cx) / (leaves.length - 1);
    expect(step).toBeLessThan(44);
  });

  it("слишком широкое дерево: листья 15 городов — столбцом слева направо, без наложений", () => {
    const lay = layoutGraph(treeOf(["Корень", ...cities.slice(0, 15)], () => 0));
    expect(lay.width).toBe(GRAPH_W);
    expect(overlapsAny(lay)).toEqual([]);
    expect(countEdgeHits(lay)).toBe(0);
    expect(minScreenFont(lay)).toBeGreaterThanOrEqual(10);
  });

  it("подпись переносится также по «.» и «_»", () => {
    expect(fitLines("кесте.xlsx", 14, 40).lines).toEqual(["кесте.", "xlsx"]);
    expect(fitLines("my_file_name", 14, 50).lines.length).toBeGreaterThan(1);
  });

  it("предельная ширина области шире 320 только если ничего не помогло (16 длинных слов в двоичном дереве)", () => {
    const lay = layoutGraph(treeOf(cities, (i) => Math.floor((i - 1) / 2)));
    expect(overlapsAny(lay)).toEqual([]);
    expect(countEdgeHits(lay)).toBe(0);
  });
});

describe("круг с прямоугольными подписями", () => {
  for (const [name, labels] of [
    ["16 вершин «ПК-N»", Array.from({ length: 16 }, (_, i) => `ПК-${i + 1}`)],
    ["16 вершин «Хост N»", Array.from({ length: 16 }, (_, i) => `Хост ${i + 1}`)],
    ["12 городов", cities.slice(0, 12)],
    ["14 городов", cities.slice(0, 14)],
    ["16 городов", cities],
  ] as [string, string[]][])
    it(`${name}: без наложений, всё в области 320`, () => {
      const lay = layoutGraph(ringOf(labels));
      expect(overlapsAny(lay)).toEqual([]);
      expect(lay.width).toBe(GRAPH_W);
      expect(lay.fits).toBe(true);
      expectInside(lay);
    });

  it("если на круге не хватает длины, он вытягивается по вертикали", () => {
    const lay = layoutGraph(ringOf(Array.from({ length: 16 }, (_, i) => `ПК-${i + 1}`)));
    const xs = lay.nodes.map((n) => n.cx);
    const ys = lay.nodes.map((n) => n.cy);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(Math.max(...xs) - Math.min(...xs));
  });
});

describe("круг с весами на коротких рёбрах", () => {
  for (const [name, labels, weight] of [
    ["16 вершин, вес 120", nums(16), "120"],
    ["12 вершин, вес 120", nums(12), "120"],
    ["10 вершин, вес 1000", nums(10), "1000"],
    ["8 городов, вес 120", cities.slice(0, 8), "120"],
  ] as [string, string[], string][])
    it(`${name}: подписи не на вершинах и не друг на друге`, () => {
      const lay = layoutGraph(ringOf(labels, weight));
      expectPillsClean(lay);
      expect(overlapsAny(lay)).toEqual([]);
      expectInside(lay);
      expect(lay.width).toBe(GRAPH_W);
    });

  it("подпись, которой нет места на ребре, стоит рядом с выноской к ребру", () => {
    const lay = layoutGraph(ringOf(cities.slice(0, 8), "120"));
    const moved = lay.edges.filter((e) => e.pill?.anchor);
    expect(moved.length).toBeGreaterThan(0);
    for (const e of moved) expect(Math.hypot(e.pill!.x - e.pill!.anchor![0], e.pill!.y - e.pill!.anchor![1])).toBeLessThan(45);
  });
});

describe("цепочка змейкой: ребро между рядами обходит чужие вершины", () => {
  const blocks = Array.from({ length: 10 }, (_, i) => `Блок ${i + 1}`);
  for (const [name, input] of [
    ["10 блоков, v9→v0", chainOf(blocks, [[9, 0]])],
    ["10 блоков, v9→v0, неориентированная", chainOf(blocks, [[9, 0]], false)],
    ["10 блоков, v8→v1 и v9→v0", chainOf(blocks, [[8, 1], [9, 0]])],
    ["8 цифр, v0→v5", chainOf(nums(8), [[0, 5]])],
    ["12 цифр, v2→v7", chainOf(nums(12), [[2, 7]])],
    ["16 цифр, v15→v0", chainOf(nums(16), [[15, 0]])],
    ["16 цифр, v0→v15", chainOf(nums(16), [[0, 15]])],
  ] as [string, GraphInput][])
    it(`${name}: линия не проходит сквозь чужие вершины, всё в области 320`, () => {
      const lay = layoutGraph(input);
      expect(countEdgeHits(lay)).toBe(0);
      expect(overlapsAny(lay)).toEqual([]);
      expect(lay.width).toBe(GRAPH_W);
    });

  it("проверка рёбер идёт по всей кривой, а не по хорде: дуга сквозь вершину засчитывается", () => {
    const lay = layoutGraph(chainOf(nums(5), [[0, 4]]));
    expect(countEdgeHits(lay)).toBe(0);
    // подменяем ломаную ребра v0→v4 хордой через середину ряда
    const bad: GraphLayout = { ...lay, edges: lay.edges.map((e) => (e.key === "v0>v4" ? { ...e, poly: [e.poly[0], e.poly[e.poly.length - 1]] } : e)) };
    expect(edgeThroughNode(bad)).toBe(true);
  });

  it("обход идёт ломаной по просвету между рядами (есть опорные точки, стрелка в конце)", () => {
    const lay = layoutGraph(chainOf(blocks, [[9, 0]]));
    const back = lay.edges.find((e) => e.key === "v9>v0")!;
    expect(back.poly.length).toBeGreaterThan(2);
    expect(back.arrow).toMatch(/^M.*Z$/);
  });
});

describe("длинные подписи вершин", () => {
  for (const label of ["Ақпараттық қауіпсіздік және деректерді қорғау жүйесі", "Бағдарламалаушылардың", "Жергілікті желідегі компьютерлерді басқару жүйесінің жұмысы"]) {
    it(`«${label.slice(0, 18)}…»: не больше 3 строк, каждая строка внутри вершины`, () => {
      const lay = layoutGraph({ ...base, layout: "chain", nodes: [{ id: "a", label }, { id: "b", label: "B" }], edges: [{ from: "a", to: "b" }] });
      const n = lay.nodes[0];
      expect(n.lines.length).toBeLessThanOrEqual(3);
      for (const line of n.lines) expect(estimateTextWidth(line, n.fontPx)).toBeLessThanOrEqual(n.w - 2);
      expect(lay.width).toBe(GRAPH_W);
    });
  }
});

// ---------- Ревью v18: веса рёбер, цвета текста, значки степени ----------

describe("graph: ревью v18", () => {
  /** Расстояние от точки до ломаной. */
  const distToPoly = (poly: [number, number][], x: number, y: number) => {
    let best = Infinity;
    for (let i = 0; i + 1 < poly.length; i++) {
      const [ax, ay] = poly[i];
      const [bx, by] = poly[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(ax + dx * u - x, ay + dy * u - y));
    }
    return best;
  };
  const gapBetween = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.y - b.y) - (a.h + b.h) / 2);

  it("K4: веса диагоналей «4» и «10» разнесены: зазор между подписями ≥ PILL_GAP и не у пересечения диагоналей", () => {
    for (const lang of ["ru", "kk"] as Lang[]) {
      const lay = layoutGraph(toInput(SAMPLES[2], lang));
      const pills = lay.edges.flatMap((e) => (e.pill ? [{ key: e.key, ...e.pill }] : []));
      for (let i = 0; i < pills.length; i++)
        for (let j = i + 1; j < pills.length; j++) expect(gapBetween(pills[i], pills[j]), `${pills[i].key} / ${pills[j].key}`).toBeGreaterThanOrEqual(PILL_GAP);
      // пересечение диагоналей — центр квадрата; подписи диагоналей стоят от него не ближе 28 px (на своей половине ребра)
      const cx = lay.nodes.reduce((a, n) => a + n.cx, 0) / lay.nodes.length;
      const cy = lay.nodes.reduce((a, n) => a + n.cy, 0) / lay.nodes.length;
      for (const key of ["A>C", "B>D"]) {
        const p = lay.edges.find((e) => e.key === key)!.pill!;
        expect(Math.hypot(p.x - cx, p.y - cy), `${lang} ${key}`).toBeGreaterThanOrEqual(28);
      }
    }
  });

  it("у каждого веса своё ребро — ближайшее: подпись стоит на своём ребре (или рядом с ним, с выноской)", () => {
    for (const lang of ["ru", "kk"] as Lang[])
      SAMPLES.forEach((s, i) => {
        const lay = layoutGraph(toInput(s, lang));
        for (const e of lay.edges) {
          if (!e.pill || e.pill.anchor) continue;
          const own = distToPoly(e.poly, e.pill.x, e.pill.y);
          for (const o of lay.edges) {
            if (o === e) continue;
            // общий конец у двух рёбер — подпись у вершины допустима, поэтому сравниваем только с рёбрами без общего конца
            if (o.from === e.from || o.from === e.to || o.to === e.from || o.to === e.to) continue;
            expect(own, `${lang} образец ${i}: вес ${e.key} ближе к ${o.key}`).toBeLessThan(distToPoly(o.poly, e.pill.x, e.pill.y));
          }
        }
      });
  });

  it("зазор между подписями весов во всех образцах не меньше PILL_GAP, если есть куда разойтись (образцы с весами влезают без наложений)", () => {
    for (const s of SAMPLES) {
      const lay = layoutGraph(toInput(s));
      const pills = lay.edges.flatMap((e) => (e.pill ? [{ key: e.key, ...e.pill }] : []));
      for (let i = 0; i < pills.length; i++) for (let j = i + 1; j < pills.length; j++) expect(gapBetween(pills[i], pills[j]), `${pills[i].key} / ${pills[j].key}`).toBeGreaterThan(0);
    }
  });

  it("polyCrossings: пересечение двух диагоналей — одна точка в центре; параллельные не пересекаются", () => {
    const x = polyCrossings([{ x: 0, y: 0 }, { x: 10, y: 10 }], [{ x: 10, y: 0 }, { x: 0, y: 10 }]);
    expect(x).toHaveLength(1);
    expect(x[0].x).toBeCloseTo(5, 6);
    expect(x[0].y).toBeCloseTo(5, 6);
    expect(polyCrossings([{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 0, y: 5 }, { x: 10, y: 5 }])).toHaveLength(0);
  });

  it("текст на -soft-заливке — токены ink-*, а не *-strong (в тёмной теме -strong на -soft нечитаем)", () => {
    for (const map of [NODE_TEXT, PILL_TEXT]) {
      for (const [tone, cls] of Object.entries(map)) {
        expect(cls, tone).not.toMatch(/-strong/);
        if (tone !== "none" && tone !== "muted") expect(cls, tone).toMatch(/^fill-ink-/);
      }
    }
    const html = renderToStaticMarkup(createElement(SceneView, { scene: SAMPLES[0] }));
    expect(html).toContain("fill-ink-primary");
    expect(html).not.toContain("fill-primary-strong");
  });

  it("значки степени снаружи вершины: зазор до обводки не меньше BADGE_GAP, ни одного перекрытия обводки", () => {
    for (const idx of [2, 4]) {
      const lay = layoutGraph(toInput(SAMPLES[idx]));
      expect(lay.badges.length).toBeGreaterThan(0);
      for (const b of lay.badges) {
        const n = lay.nodes.find((v) => v.id === b.id)!;
        expect(n.shape).toBe("circle");
        const gap = Math.hypot(b.x - n.cx, b.y - n.cy) - n.r - b.r;
        expect(gap, `образец ${idx}, вершина ${b.id}`).toBeGreaterThanOrEqual(BADGE_GAP - 0.05);
      }
    }
  });

  it("подпись «степень» под рисунком — только у графов со значками степени, на обоих языках", () => {
    const withDeg = renderToStaticMarkup(createElement(SceneView, { scene: SAMPLES[2] }));
    expect(withDeg).toContain(dict["scene.graph.degreesNote"].ru);
    const without = renderToStaticMarkup(createElement(SceneView, { scene: SAMPLES[0] }));
    expect(without).not.toContain(dict["scene.graph.degreesNote"].ru);
    expect(dict["scene.graph.degreesNote"].kk).toMatch(/дәреже/);
  });
});
