import { describe, expect, it } from "vitest";
import { CHIP_SIZE, CIRCUIT_MIN_SCALE, CIRCUIT_WIDE, OUT_ID, WIRE_LANE_GAP, evalCircuit, isWideCircuit, layoutCircuit, terminalFont, valueChipBox, wireStats, type CircuitNode, type CircuitScene, type CircuitWire } from "@/components/scenes/circuit";
import { GATE_FORMULA, gateGlyph, gatesColumns, longestWord } from "@/components/scenes/gates";
import { SAMPLES as GATES_SAMPLES } from "@/components/scenes/samples/gates";
import { SAMPLES as SWITCHES_SAMPLES } from "@/components/scenes/samples/switches";
import { SAMPLES as EXTENDED } from "@/components/scenes/samples/extended";
import { SW_W, lampOn, layoutSwitches, switchNames, switchValues, type SwitchesScene } from "@/components/scenes/switches";
import { estimateTextWidth } from "@/components/scenes/text-width";
import { sceneLogicDict } from "@/i18n/parts/scene-logic";
import type { GateOp } from "@/lib/types";
import { validateScene } from "./validate";

const g = (id: string, op: GateOp, i: string[]) => ({ id, op, in: i });
const circuit = (inputs: string[], gates: CircuitScene["gates"], output: string, extra: Partial<CircuitScene> = {}): CircuitScene => ({ kind: "circuit", inputs, gates, output, ...extra });

const halfAdder = (): CircuitScene =>
  circuit(["A", "B"], [g("s", "xor", ["A", "B"]), g("c", "and", ["A", "B"])], "s", { outputs: [{ gate: "s", name: "S" }, { gate: "c", name: "C" }], values: { A: 1, B: 1 } });

describe("circuit: старые схемы не меняются (координаты прежние)", () => {
  // Золотые значения сняты со старой раскладки (до волны 3).
  const sc = circuit(["A", "B", "C"], [g("g1", "and", ["A", "B"]), g("g2", "not", ["C"]), g("g3", "or", ["g1", "g2"])], "g3");

  it("узлы и провода без outputs совпадают с прежними", () => {
    const lay = layoutCircuit(sc);
    expect(lay.width).toBe(268);
    expect(lay.height).toBe(198);
    expect(lay.nodes.map((n) => [n.id, n.x, n.y])).toEqual([
      ["A", 18, 26],
      ["B", 18, 92],
      ["C", 18, 158],
      ["g1", 94, 59],
      ["g2", 94, 158],
      ["g3", 170, 108.5],
      ["@out", 246, 108.5],
    ]);
    expect(lay.wires.map((w) => [w.from, w.to, w.port, w.points])).toEqual([
      ["A", "g1", 0, [[32, 26], [58, 26], [58, 48], [74, 48]]],
      ["B", "g1", 1, [[32, 92], [66, 92], [66, 70], [74, 70]]],
      ["C", "g2", 0, [[32, 158], [74, 158]]],
      ["g1", "g3", 0, [[114, 59], [134, 59], [134, 97.5], [150, 97.5]]],
      ["g2", "g3", 1, [[123, 158], [142, 158], [142, 119.5], [150, 119.5]]],
      ["g3", "@out", 0, [[190, 108.5], [232, 108.5]]],
    ]);
    expect(lay.junctions).toEqual([]);
    expect(lay.outputs).toEqual([{ id: OUT_ID, gate: "g3", name: "F" }]);
  });

  it("outputs из одного выхода F ведёт себя как прежде, но с подписью из outputs", () => {
    const lay = layoutCircuit({ ...sc, outputs: [{ gate: "g3", name: "Y" }] });
    expect(lay.nodes.find((n) => n.id === OUT_ID)?.label).toBe("Y");
    expect(lay.nodes.find((n) => n.id === OUT_ID)?.y).toBe(108.5);
  });
});

describe("circuit: несколько выходов (полусумматор)", () => {
  it("значения: S = A xor B, C = A and B", () => {
    for (const [a, b, s, c] of [[0, 0, 0, 0], [0, 1, 1, 0], [1, 0, 1, 0], [1, 1, 0, 1]] as const) {
      const v = evalCircuit(halfAdder(), { A: a, B: b });
      expect([v.s, v.c]).toEqual([s, c]);
    }
  });

  it("два выходных узла с подписями S и C напротив своих вентилей, один столбец справа", () => {
    const lay = layoutCircuit(halfAdder());
    expect(lay.outputs.map((o) => o.name)).toEqual(["S", "C"]);
    expect(lay.outputs[0].id).toBe(OUT_ID);
    const [o1, o2] = lay.outputs.map((o) => lay.nodes.find((n) => n.id === o.id)!);
    const s = lay.nodes.find((n) => n.id === "s")!;
    const c = lay.nodes.find((n) => n.id === "c")!;
    expect(o1.y).toBe(s.y);
    expect(o2.y).toBe(c.y);
    expect(o1.x).toBe(o2.x);
    expect(o1.x).toBeGreaterThan(s.x);
    expect(Math.abs(o1.y - o2.y)).toBeGreaterThanOrEqual(o1.h);
    expect(lay.wires.filter((w) => w.to === o1.id || w.to === o2.id)).toHaveLength(2);
  });

  it("у полусумматора ровно одно пересечение (меньше нельзя: два входа — два вентиля) и нет касаний разных проводов", () => {
    const lay = layoutCircuit(halfAdder());
    const st = wireStats(lay.wires);
    expect(st.bad).toBe(0);
    expect(st.cross).toBe(1);
    expect(lay.crossings).toBe(1);
  });

  it("точки-узлы стоят на ответвлениях проводов одного источника и лежат на проводах", () => {
    const lay = layoutCircuit(halfAdder());
    expect(lay.junctions.length).toBeGreaterThanOrEqual(2);
    for (const [x, y] of lay.junctions) {
      const onWire = lay.wires.some((w) =>
        w.points.slice(0, -1).some((p, i) => {
          const q = w.points[i + 1];
          return x >= Math.min(p[0], q[0]) && x <= Math.max(p[0], q[0]) && y >= Math.min(p[1], q[1]) && y <= Math.max(p[1], q[1]);
        }),
      );
      expect(onWire).toBe(true);
    }
  });

  it("всё внутри рисунка, провода — горизонтали и вертикали, справа место под плашку значения", () => {
    for (const s of EXTENDED.filter((x): x is CircuitScene => x.kind === "circuit" && !!x.outputs)) {
      const lay = layoutCircuit(s, { labelLines: 2 });
      for (const n of lay.nodes) {
        expect(n.x - n.w / 2).toBeGreaterThanOrEqual(0);
        expect(n.x + n.w / 2 + 22).toBeLessThanOrEqual(lay.width);
        expect(n.y + n.h / 2).toBeLessThanOrEqual(lay.height);
      }
      for (const w of lay.wires) for (let i = 0; i + 1 < w.points.length; i++) expect(w.points[i][0] === w.points[i + 1][0] || w.points[i][1] === w.points[i + 1][1]).toBe(true);
      expect(wireStats(lay.wires).bad).toBe(0);
    }
  });

  it("два выхода одного вентиля не слипаются", () => {
    const sc = circuit(["A", "B"], [g("c", "and", ["A", "B"])], "c", { outputs: [{ gate: "c", name: "X" }, { gate: "c", name: "Y" }] });
    const lay = layoutCircuit(sc);
    const ys = lay.outputs.map((o) => lay.nodes.find((n) => n.id === o.id)!.y);
    expect(Math.abs(ys[0] - ys[1])).toBeGreaterThanOrEqual(28);
  });

  it("образцы extended с outputs проходят проверку", () => {
    for (const s of EXTENDED.filter((x) => x.kind === "circuit")) expect(validateScene(s)).toEqual([]);
  });
});

describe("gates: значки, формулы, колонки", () => {
  const ops: GateOp[] = ["and", "or", "not", "xor", "nand", "nor"];

  it("у каждого вентиля есть формула; у НЕ один вход, у остальных два", () => {
    for (const op of ops) {
      expect(GATE_FORMULA[op]).toBeTruthy();
      expect(gateGlyph(op).inputs).toHaveLength(op === "not" ? 1 : 2);
    }
  });

  it("значок целиком внутри viewBox, кружок инверсии — только у НЕ, И-НЕ, ИЛИ-НЕ, выход справа за ним", () => {
    for (const op of ops) {
      const gl = gateGlyph(op);
      expect(gl.box.x + gl.box.w).toBeLessThanOrEqual(gl.w);
      expect(gl.box.y).toBeGreaterThanOrEqual(0);
      expect(gl.box.y + gl.box.h).toBeLessThanOrEqual(gl.h);
      expect(gl.out[0]).toBe(gl.w);
      expect(!!gl.bubble).toBe(["not", "nand", "nor"].includes(op));
      if (gl.bubble) expect(gl.bubble[0] + 4.5).toBeLessThan(gl.out[0]);
      for (const [x, y] of gl.inputs) {
        expect(x).toBe(0);
        expect(y).toBeGreaterThan(gl.box.y);
        expect(y).toBeLessThan(gl.box.y + gl.box.h);
      }
    }
  });

  it("колонки: 1–3 вентиля в ряд, 4 — две, 5–6 — три (для коротких названий)", () => {
    const short = ["И", "ИЛИ", "НЕ", "XOR", "ИЛИ-НЕ", "И-НЕ"];
    expect([1, 2, 3, 4, 5, 6].map((n) => gatesColumns(n, short.slice(0, n)))).toEqual([1, 2, 3, 2, 3, 3]);
  });

  it("казахские названия 6 вентилей на 360 px: самое длинное слово влезает в карточку", () => {
    const kk = ["ЖӘНЕ", "НЕМЕСЕ", "ЕМЕС", "Қатаң НЕМЕСЕ", "ЖӘНЕ-ЕМЕС", "НЕМЕСЕ-ЕМЕС"];
    const cols = gatesColumns(6, kk);
    const card = (328 - 8 * (cols - 1)) / cols - 14;
    expect(estimateTextWidth(longestWord("НЕМЕСЕ-ЕМЕС"), 13)).toBeLessThanOrEqual(card);
    expect(longestWord("Қатаң НЕМЕСЕ")).toBe("НЕМЕСЕ");
  });

  it("очень длинное слово уменьшает число колонок, но не ниже одной", () => {
    expect(gatesColumns(6, ["Ааааааааааааааааааааааааааа"])).toBeLessThan(3);
    expect(gatesColumns(6, ["Ааааааааааааааааааааааааааааааааааааааааааааааааааааа"])).toBe(1);
  });

  it("строки названий и aria есть на двух языках", () => {
    for (const op of ops) {
      const e = sceneLogicDict[`scene.gates.${op}` as keyof typeof sceneLogicDict];
      expect(e.ru).toBeTruthy();
      expect(e.kk).toBeTruthy();
    }
    expect(sceneLogicDict["scene.gates.xor"].kk).toBe("Қатаң НЕМЕСЕ");
  });

  it("образцы gates проходят проверку", () => {
    for (const s of GATES_SAMPLES) expect(validateScene(s)).toEqual([]);
  });
});

describe("switches: лампа и раскладка", () => {
  it("and: горит только при всех замкнутых", () => {
    expect(lampOn("and", [1, 1])).toBe(true);
    expect(lampOn("and", [1, 0])).toBe(false);
    expect(lampOn("and", [1, 1, 0])).toBe(false);
    expect(lampOn("and", [1, 1, 1])).toBe(true);
  });
  it("or: горит при хотя бы одном замкнутом", () => {
    expect(lampOn("or", [0, 0, 0])).toBe(false);
    expect(lampOn("or", [0, 1, 0])).toBe(true);
  });
  it("not: нажатие кнопки обрывает цепь", () => {
    expect(lampOn("not", [0])).toBe(true);
    expect(lampOn("not", [1])).toBe(false);
  });
  it("xor: горит при разных положениях", () => {
    expect([[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => lampOn("xor", [a as 0 | 1, b as 0 | 1]))).toEqual([false, true, true, false]);
  });


  it("значения и имена по умолчанию: нули и A, B, C", () => {
    expect(switchValues(sw("and"))).toEqual([0, 0]);
    expect(switchValues(sw("not"))).toEqual([0]);
    expect(switchValues(sw("or", undefined, ["P", "Q", "R"]))).toEqual([0, 0, 0]);
    expect(switchNames(sw("or"), 3)).toEqual(["A", "B", "C"]);
  });

  it("раскладка: всё внутри рисунка на 360 px во всех режимах и числах ключей", () => {
    const cases: SwitchesScene[] = [sw("and", [1, 1]), sw("and", [0, 1, 0]), sw("or", [0, 1]), sw("or", [1, 0, 1]), sw("not", [1]), sw("not", [0]), sw("xor", [0, 1]), sw("xor", [1, 1])];
    for (const sc of cases) {
      const lay = layoutSwitches(sc);
      expect(lay.width).toBe(SW_W);
      const pts = [...lay.wires.flatMap((w) => w.points), ...lay.parts.flatMap((p) => [p.pivot, p.lever, ...p.contacts, p.label]), lay.lamp, lay.battery];
      for (const [x, y] of pts) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(lay.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(lay.height);
      }
      // Подпись лампы целиком в рисунке.
      const half = estimateTextWidth("лампа: 0", 13) / 2;
      expect(lay.lampLabel[0] + half).toBeLessThanOrEqual(lay.width);
      expect(lay.lampLabel[1] - 13).toBeGreaterThanOrEqual(0);
    }
  });

  it("подписи ключей не наезжают друг на друга (соседние по горизонтали и вертикали)", () => {
    const cases: SwitchesScene[] = [sw("and", [1, 1, 1], ["AAA", "BBB", "CCC"]), sw("or", [1, 1, 1], ["AAA", "BBB", "CCC"]), sw("xor", [0, 1], ["AAA", "BBB"])];
    for (const sc of cases) {
      const lay = layoutSwitches(sc);
      const boxes = lay.parts.map((p) => {
        const w = estimateTextWidth(`${p.name} = ${p.value}`, 14) + 2;
        return { x0: p.label[0] - w / 2, x1: p.label[0] + w / 2, y0: p.label[1] - 14, y1: p.label[1] + 3 };
      });
      boxes.forEach((a, i) => boxes.forEach((b, j) => j > i && expect(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0).toBe(true)));
    }
  });

  it("рычажок: замкнут — на контакте, разомкнут — поднят; у НЕ нажатие отводит перемычку", () => {
    const closed = layoutSwitches(sw("and", [1, 1])).parts[0];
    const open = layoutSwitches(sw("and", [0, 1])).parts[0];
    expect(closed.lever[1]).toBe(closed.contacts[0][1]);
    expect(closed.lever[0]).toBe(closed.contacts[0][0]);
    expect(open.lever[1]).toBeLessThan(open.pivot[1]);
    expect(layoutSwitches(sw("not", [1])).parts[0].closed).toBe(false);
    expect(layoutSwitches(sw("not", [0])).parts[0].closed).toBe(true);
  });

  it("коридорная схема: по проводу идёт ток только при разных положениях, и только по одному из двух проводов", () => {
    const live = (a: 0 | 1, b: 0 | 1) => layoutSwitches(sw("xor", [a, b])).wires.filter((w) => w.points.length === 2 && w.points[0][0] === 110 && w.live).length;
    expect([live(0, 0), live(1, 1), live(0, 1), live(1, 0)]).toEqual([0, 0, 1, 1]);
    // Рычажки у xor смотрят на контакты, которые соединены проводом, когда лампа горит.
    const lay = layoutSwitches(sw("xor", [0, 1]));
    expect(lay.parts[0].lever[1]).toBeLessThan(lay.mid);
    expect(lay.parts[1].lever[1]).toBeGreaterThan(lay.mid);
  });

  it("параллельные ветки: ток только по замкнутым; у k веток k точек присоединения шин", () => {
    const lay = layoutSwitches(sw("or", [1, 0, 1]));
    expect(lay.on).toBe(true);
    expect(lay.parts.map((p) => p.closed)).toEqual([true, false, true]);
    expect(lay.junctions).toHaveLength(2);
    const dark = layoutSwitches(sw("or", [0, 0]));
    expect(dark.on).toBe(false);
    expect(dark.wires.every((w) => !w.live)).toBe(true);
  });

  it("образцы switches проходят проверку", () => {
    for (const s of SWITCHES_SAMPLES) expect(validateScene(s)).toEqual([]);
  });

  it("строки switches на двух языках", () => {
    for (const k of ["scene.switches.lamp", "scene.switches.lampOn", "scene.switches.lampOff", "scene.circuit.ariaOutputs", "scene.gates.aria"] as const) {
      expect(sceneLogicDict[k].ru).toBeTruthy();
      expect(sceneLogicDict[k].kk).toBeTruthy();
    }
  });
});

const sw = (mode: SwitchesScene["mode"], values?: (0 | 1)[], names?: string[]): SwitchesScene => ({ kind: "switches", mode, values, names });

describe("исправления ревью S9", () => {
  const g = (id: string, op: GateOp, i: string[]) => ({ id, op, in: i });
  const synth: CircuitScene[] = [
    { kind: "circuit", inputs: ["A", "B"], gates: [g("x", "xor", ["A", "B"]), g("n", "not", ["x"])], output: "n", outputs: [{ gate: "n", name: "F" }, { gate: "x", name: "X" }] },
    { kind: "circuit", inputs: ["A", "B"], gates: [g("x", "xor", ["A", "B"]), g("n", "not", ["x"])], output: "x", outputs: [{ gate: "x", name: "X" }, { gate: "n", name: "F" }] },
    {
      kind: "circuit",
      inputs: ["A", "B", "Ci"],
      gates: [g("x1", "xor", ["A", "B"]), g("s", "xor", ["x1", "Ci"]), g("a1", "and", ["A", "B"]), g("a2", "and", ["x1", "Ci"]), g("c", "or", ["a1", "a2"])],
      output: "s",
      outputs: [{ gate: "s", name: "S" }, { gate: "c", name: "Co" }],
    },
  ];

  it("ни один провод не проходит сквозь рамку чужого вентиля и не сливается с другим", () => {
    for (const sc of [...synth, ...EXTENDED.filter((s): s is CircuitScene => s.kind === "circuit" && !!s.outputs)]) {
      const lay = layoutCircuit(sc);
      expect(wireStats(lay.wires).bad).toBe(0);
      for (const w of lay.wires) {
        for (const n of lay.nodes) {
          if (n.kind !== "gate" || n.id === w.from || n.id === w.to) continue;
          for (let i = 0; i + 1 < w.points.length; i++) {
            const [a, b] = [w.points[i], w.points[i + 1]];
            const hit = Math.max(a[0], b[0]) > n.x - n.w / 2 && Math.min(a[0], b[0]) < n.x + n.w / 2 && Math.max(a[1], b[1]) > n.y - n.h / 2 && Math.min(a[1], b[1]) < n.y + n.h / 2;
            expect(hit, `${w.from}->${w.to} через ${n.id}`).toBe(false);
          }
        }
      }
      expect(lay.height).toBeGreaterThanOrEqual(Math.max(...lay.wires.flatMap((w) => w.points.map((p) => p[1]))));
    }
  });

  it("подпись ключа в параллельной схеме не задевает рычажок соседней ветки", () => {
    for (const vals of [[0, 0, 0], [0, 0], [1, 0, 1]] as (0 | 1)[][]) {
      const lay = layoutSwitches(sw("or", vals, ["Car", "Bus", "Cin"].slice(0, vals.length)));
      for (const p of lay.parts) {
        const w = estimateTextWidth(`${p.name} = ${p.value}`, 14) + 2;
        const r = { x0: p.label[0] - w / 2, x1: p.label[0] + w / 2, y0: p.label[1] - 12, y1: p.label[1] + 3 };
        for (const q of lay.parts) {
          if (q === p) continue;
          // отрезок рычажка с запасом на толщину (2 px), проверка по ограничивающему прямоугольнику
          const bx0 = Math.min(q.pivot[0], q.lever[0]) - 2;
          const bx1 = Math.max(q.pivot[0], q.lever[0]) + 2;
          const by0 = Math.min(q.pivot[1], q.lever[1]) - 2;
          const by1 = Math.max(q.pivot[1], q.lever[1]) + 2;
          expect(r.x1 <= bx0 || bx1 <= r.x0 || r.y1 <= by0 || by1 <= r.y0).toBe(true);
        }
      }
    }
  });

  it("значок вентиля: единый размер viewBox у всех вентилей", () => {
    const ops: GateOp[] = ["and", "or", "not", "nand", "nor", "xor"];
    expect(new Set(ops.map((o) => gateGlyph(o).w)).size).toBe(1);
    expect(new Set(ops.map((o) => gateGlyph(o).h)).size).toBe(1);
  });

  it("шина параллельной схемы: тупиковый кусок до разомкнутой ветки не под током", () => {
    const lay = layoutSwitches(sw("or", [0, 1]));
    const bus = lay.wires.filter((w) => w.points[0][0] === w.points[1][0] && w.points[0][1] !== w.points[1][1]);
    expect(bus.some((w) => w.live)).toBe(true);
    expect(bus.some((w) => !w.live)).toBe(true);
  });
});

describe("circuit: ревью v18b — сумматор (вертикали разведены, плашки не у проводов, «Ci» крупнее)", () => {
  const multis = EXTENDED.filter((x): x is CircuitScene => x.kind === "circuit" && !!x.outputs);
  const adder = multis.find((x) => x.inputs.includes("Ci"))!;
  /** Вертикальные отрезки проводов: x, диапазон по y, источник. */
  const verticals = (wires: CircuitWire[]) =>
    wires.flatMap((w) => w.points.slice(0, -1).flatMap((p, i) => (p[0] === w.points[i + 1][0] && p[1] !== w.points[i + 1][1] ? [{ x: p[0], y0: Math.min(p[1], w.points[i + 1][1]), y1: Math.max(p[1], w.points[i + 1][1]), from: w.from }] : [])));
  /** Расстояние от точки до прямоугольника. */
  const distToRect = (px: number, py: number, r: { x0: number; x1: number; y0: number; y1: number }) => Math.hypot(Math.max(r.x0 - px, 0, px - r.x1), Math.max(r.y0 - py, 0, py - r.y1));
  /** Расстояние от прямоугольника до отрезка (по горизонтали или вертикали). */
  const segToRect = (a: [number, number], b: [number, number], r: { x0: number; x1: number; y0: number; y1: number }) => {
    let best = Infinity;
    for (let t = 0; t <= 1; t += 0.02) best = Math.min(best, distToRect(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, r));
    return best;
  };

  it("только схемы с outputs и четырьмя вентилями и больше раздвинуты: остальные раскладываются как раньше", () => {
    expect(isWideCircuit(adder)).toBe(true);
    for (const s of multis.filter((x) => x !== adder)) expect(isWideCircuit(s)).toBe(false);
    expect(isWideCircuit({ ...adder, outputs: undefined })).toBe(false);
    const wide = layoutCircuit(adder);
    const narrow = layoutCircuit({ ...adder, gates: adder.gates.slice(0, 3), outputs: [{ gate: "s", name: "S" }] });
    // шаг столбцов 80 (был 76), рамка уже, выход ближе; остальные схемы — как раньше
    const node = (lay: ReturnType<typeof layoutCircuit>, id: string) => lay.nodes.find((n) => n.id === id)!;
    expect(node(wide, "s").x - node(wide, "x1").x).toBe(CIRCUIT_WIDE.pitch);
    expect(node(wide, "s").w).toBe(CIRCUIT_WIDE.gateW);
    expect(wide.wide).toBe(true);
    expect(node(narrow, "s").x - node(narrow, "x1").x).toBe(76);
    expect(node(narrow, "s").w).toBe(40);
    expect(narrow.wide).toBe(false);
    // сумматор по-прежнему помещается на телефоне без прокрутки: ширина × CIRCUIT_MIN_SCALE ≤ 304
    expect(Math.round(wide.width * CIRCUIT_MIN_SCALE)).toBeLessThanOrEqual(304);
  });

  it("вертикали проводов разных источников, идущие рядом (общая полоса по y), стоят не ближе WIRE_LANE_GAP друг от друга", () => {
    for (const s of [adder]) {
      const lay = layoutCircuit(s, { labelLines: 2 });
      const v = verticals(lay.wires);
      for (let i = 0; i < v.length; i++)
        for (let j = i + 1; j < v.length; j++) {
          if (v[i].from === v[j].from) continue;
          const overlap = Math.min(v[i].y1, v[j].y1) - Math.max(v[i].y0, v[j].y0);
          if (overlap <= 0) continue;
          expect(Math.abs(v[i].x - v[j].x), `x=${v[i].x} (${v[i].from}) и x=${v[j].x} (${v[j].from})`).toBeGreaterThanOrEqual(WIRE_LANE_GAP - 1e-6);
        }
    }
  });

  it("провода одного источника в один столбец идут по одной вертикали (общий ствол), а не двумя параллельными", () => {
    const lay = layoutCircuit(adder, { labelLines: 2 });
    for (const src of ["x1", "Ci", "A", "B"]) {
      const byCol = new Map<number, Set<number>>();
      for (const w of lay.wires.filter((q) => q.from === src && q.points.length === 4)) {
        const to = lay.nodes.find((n) => n.id === w.to)!;
        byCol.set(to.col, (byCol.get(to.col) ?? new Set<number>()).add(w.points[1][0]));
      }
      if (src === "x1" || src === "Ci") for (const set of byCol.values()) expect(set.size, `источник ${src}`).toBe(1);
    }
  });

  it("плашка 0/1 не ближе 5 px к проводам других источников и не ближе 3 px к своим, внутри рисунка", () => {
    for (const s of multis) {
      const lay = layoutCircuit(s, { labelLines: 2 });
      const feeds = new Set(lay.outputs.map((o) => o.gate));
      for (const n of lay.nodes as CircuitNode[]) {
        if (n.kind === "output" || feeds.has(n.id)) continue;
        const c = valueChipBox(lay.wires, n, lay.wide);
        const r = { x0: c.cx - CHIP_SIZE / 2, x1: c.cx + CHIP_SIZE / 2, y0: c.top, y1: c.top + CHIP_SIZE };
        expect(r.x1).toBeLessThanOrEqual(lay.width);
        expect(r.y0).toBeGreaterThanOrEqual(0);
        for (const w of lay.wires)
          for (let i = 0; i + 1 < w.points.length; i++) {
            const d = segToRect(w.points[i], w.points[i + 1], r);
            expect(d, `плашка «${n.id}» и провод ${w.from}>${w.to}`).toBeGreaterThanOrEqual(w.from === n.id ? 2.9 : 4.9);
          }
      }
    }
  });

  it("«Ci», «Co», «A» в кружках схем с несколькими выходами не мельче 11 px на экране (с учётом сжатия до CIRCUIT_MIN_SCALE); у старых схем прежние 15 / 11", () => {
    for (const label of ["Ci", "Co", "Cn", "A", "B", "S", "F", "X"]) expect(terminalFont(label, true) * CIRCUIT_MIN_SCALE, label).toBeGreaterThanOrEqual(11);
    expect(terminalFont("Ci", true)).toBeGreaterThanOrEqual(15);
    for (const label of ["Sum", "Car"]) expect(terminalFont(label, true) * CIRCUIT_MIN_SCALE, label).toBeGreaterThanOrEqual(9);
    expect(terminalFont("Ci", false)).toBe(15);
    expect(terminalFont("Sum", false)).toBe(11);
    // подпись помещается в кружок
    for (const label of ["Ci", "Co", "Cn"]) expect(estimateTextWidth(label, terminalFont(label, true))).toBeLessThanOrEqual(22.4);
  });
});
