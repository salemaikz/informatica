import { describe, expect, it } from "vitest";
import {
  BITS_BY_TIER,
  MAX_RETRIES,
  MODE_CONFIG,
  PRIMARY_TASKS,
  ROUND_SECONDS,
  RoundEngine,
  bitsOf,
  breakdown,
  checkGoal,
  evaluate,
  goalExample,
  goalIsUnique,
  isPerfect,
  onWeights,
  pickMode,
  pointsFor,
  popcount,
  possibleGoals,
  readOptions,
  superscript,
  taskPoints,
  taskTimeMs,
  tierForCorrect,
  valueOfBits,
  whyParts,
  type Goal,
  type Mode,
  type Task,
  type Tier,
} from "@/games/bit-flip/logic";
import { S } from "@/games/bit-flip/strings";
import type { GameMode } from "@/games/types";
import { seeded } from "@/lib/text";

const GAME_MODES: GameMode[] = ["calm", "normal", "blitz"];
const KINDS: Mode[] = ["build", "read", "property"];
const TIERS: Tier[] = [0, 1, 2];

const m = () => 0.3;

describe("bit-flip: базовые функции", () => {
  it("биты и значение взаимно обратны", () => {
    for (let n = 0; n < 256; n++) expect(valueOfBits(bitsOf(n, 8))).toBe(n);
    expect(bitsOf(5, 4)).toEqual([0, 1, 0, 1]);
    expect(popcount(255)).toBe(8);
    expect(popcount(0)).toBe(0);
  });
  it("разложение на веса", () => {
    expect(breakdown(77)).toBe("64 + 8 + 4 + 1 = 77");
    expect(breakdown(1)).toBe("1 = 1");
    expect(superscript(10)).toBe("¹⁰");
  });
  it("уровни по числу верных", () => {
    expect([0, 2, 3, 5, 6, 9].map(tierForCorrect)).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

describe("bit-flip: очки", () => {
  it("10 + остаток секунд (вверх) + 5 за идеальность", () => {
    expect(taskPoints(12.2, false)).toBe(23);
    expect(taskPoints(0.1, true)).toBe(16);
    expect(taskPoints(0, false)).toBe(10);
    expect(taskPoints(-1, false)).toBe(10);
  });
  it("идеально: число переключений равно числу единиц (BUILD и цели b, c, d)", () => {
    const build = { mode: "build", answer: 13 } as Task;
    expect(isPerfect(build, 3)).toBe(true);
    expect(isPerfect(build, 4)).toBe(false);
    const pow = { mode: "property", answer: 8, goal: { kind: "pow", k: 3 } } as Task;
    expect(isPerfect(pow, 1)).toBe(true);
    const even = { mode: "property", answer: 6, goal: { kind: "evenOnes", k: 2 } } as Task;
    expect(isPerfect(even, 2)).toBe(false);
    expect(isPerfect({ mode: "read", answer: 5 } as Task, 0)).toBe(false);
  });
});

describe("bit-flip: цели PROPERTY", () => {
  it("пример всегда проходит проверку, при любом B", () => {
    for (const B of [4, 6, 8]) {
      for (let s = 1; s < 30; s++) {
        for (const g of possibleGoals(B, seeded(s))) {
          const ex = goalExample(g);
          expect(ex).toBeGreaterThan(0);
          expect(ex).toBeLessThanOrEqual(2 ** B - 1);
          expect(checkGoal(g, ex).ok).toBe(true);
        }
      }
    }
  });
  it("у целей b, c, d ответ единственный, а пример — наименьший у чётных", () => {
    for (const B of [4, 6, 8]) {
      for (const g of possibleGoals(B, seeded(3))) {
        const okVals: number[] = [];
        for (let v = 0; v < 2 ** B; v++) if (checkGoal(g, v).ok) okVals.push(v);
        expect(okVals.length).toBeGreaterThan(0);
        expect(Math.min(...okVals)).toBe(goalExample(g));
        if (goalIsUnique(g)) expect(okVals).toHaveLength(1);
      }
    }
  });
  it("причины ошибок", () => {
    const even: Goal = { kind: "evenOnes", k: 2 };
    expect(checkGoal(even, 7).reason?.key).toBe("reasonOdd");
    expect(checkGoal(even, 8).reason).toEqual({ key: "reasonOnes", params: { have: 1, need: 2 } });
    expect(checkGoal({ kind: "smallest", n: 4 }, 3).reason?.key).toBe("reasonDigits");
    expect(checkGoal({ kind: "smallest", n: 4 }, 9).reason).toEqual({ key: "reasonNotSmallest", params: { ex: "1000" } });
    expect(checkGoal({ kind: "oddGreater", m: 9 }, 8).reason?.key).toBe("reasonEven");
    expect(checkGoal({ kind: "oddGreater", m: 9 }, 7).reason?.key).toBe("reasonNotGreater");
    expect(checkGoal({ kind: "pow", k: 3 }, 9).reason).toEqual({ key: "reasonNotEqual", params: { v: 9, n: 8 } });
    expect(checkGoal({ kind: "powMinus", k: 3 }, 0).ok).toBe(false);
  });
  it("все ключи причин есть в строках", () => {
    for (const k of ["reasonOdd", "reasonEven", "reasonOnes", "reasonDigits", "reasonNotSmallest", "reasonNotGreater", "reasonNotEqual"]) {
      expect(S).toHaveProperty(k);
    }
  });
  it("evaluate для BUILD/READ сравнивает с целью", () => {
    expect(evaluate({ mode: "build", answer: 9 } as Task, 9).ok).toBe(true);
    expect(evaluate({ mode: "read", answer: 9 } as Task, 8).ok).toBe(false);
  });
});

describe("bit-flip: варианты READ", () => {
  it("три разных варианта в 1..2^B−1, верный среди них", () => {
    for (const B of [4, 6, 8]) {
      for (let n = 1; n < 2 ** B; n++) {
        const opts = readOptions(n, B, seeded(n * 7 + B));
        expect(opts).toHaveLength(3);
        expect(new Set(opts).size).toBe(3);
        expect(opts).toContain(n);
        for (const o of opts) {
          expect(o).toBeGreaterThan(0);
          expect(o).toBeLessThanOrEqual(2 ** B - 1);
        }
      }
    }
  });
});

describe("bit-flip: выбор режима", () => {
  it("не три раза подряд один режим", () => {
    const rand = seeded(5);
    const hist: Mode[] = [];
    for (let i = 0; i < 500; i++) hist.push(pickMode(m, hist, rand));
    for (let i = 2; i < hist.length; i++) expect(hist[i] === hist[i - 1] && hist[i] === hist[i - 2]).toBe(false);
  });
  it("слабо освоенный навык выбирается чаще", () => {
    const rand = seeded(9);
    const counts = { build: 0, read: 0, property: 0 };
    for (let i = 0; i < 3000; i++) counts[pickMode((s) => (s === "ns.props" ? 0 : 1), [], rand)]++;
    expect(counts.property).toBeGreaterThan(counts.build);
  });
});

describe("bit-flip: раунд", () => {
  function play(seed: number, wrongEvery: number, gameMode: GameMode = "blitz") {
    const e = new RoundEngine(seed, gameMode);
    const tasks: Task[] = [];
    let t = e.next(m);
    let i = 0;
    while (t) {
      tasks.push(t);
      e.resolve(t, wrongEvery === 0 ? true : i % wrongEvery !== 0);
      i++;
      t = e.next(m);
    }
    return { e, tasks };
  }

  it("первые два задания — BUILD нулевого уровня; цели валидны; без повторов (во всех темпах)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const gm = GAME_MODES[seed % 3];
      const { tasks } = play(seed, seed % 4, gm);
      expect(tasks[0].mode).toBe("build");
      expect(tasks[1].mode).toBe("build");
      expect(tasks[0].tier).toBe(0);
      expect(tasks[1].tier).toBe(0);
      const primary = tasks.filter((t) => !t.isRetry);
      expect(primary).toHaveLength(PRIMARY_TASKS);
      const seen = new Set<string>();
      for (const t of primary) {
        expect(t.bits).toBe(BITS_BY_TIER[t.tier]);
        expect(t.answer).toBeGreaterThan(0);
        expect(t.answer).toBeLessThanOrEqual(2 ** t.bits - 1);
        const key = t.mode === "property" ? JSON.stringify(t.goal) : `n${t.answer}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
        if (t.mode === "property") expect(checkGoal(t.goal!, t.answer).ok).toBe(true);
        if (t.mode === "read") expect(bitsOf(t.answer, t.bits).some((b) => b === 1)).toBe(true);
        if (t.tier === 0 && t.mode !== "property") expect(t.answer).toBeLessThanOrEqual(15);
        if (t.tier === 1 && t.mode !== "property") expect(t.answer).toBeGreaterThanOrEqual(16);
        if (t.tier === 2 && t.mode !== "property") expect(t.answer).toBeGreaterThanOrEqual(64);
      }
    }
  });
  it("все верные: уровни растут 0,0,0,1,1,1,2…, без повторов задач", () => {
    const { tasks, e } = play(11, 0);
    expect(tasks).toHaveLength(PRIMARY_TASKS);
    expect(tasks.map((t) => t.tier)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 2]);
    expect(e.retriesUsed).toBe(0);
  });
  it("ошибки возвращаются один раз, не более трёх, в конце", () => {
    const e = new RoundEngine(4);
    const out: Task[] = [];
    let t = e.next(m);
    while (t) {
      out.push(t);
      e.resolve(t, false);
      t = e.next(m);
    }
    expect(out).toHaveLength(PRIMARY_TASKS + MAX_RETRIES);
    expect(out.slice(PRIMARY_TASKS).every((x) => x.isRetry)).toBe(true);
    expect(out.slice(0, PRIMARY_TASKS).every((x) => !x.isRetry)).toBe(true);
    expect(e.total).toBe(PRIMARY_TASKS + MAX_RETRIES);
  });
  it("лимиты времени по режиму и уровню: блиц — как раньше", () => {
    const e = new RoundEngine(2);
    const t = e.next(m)!;
    expect(taskTimeMs(t, "blitz")).toBe(20_000);
  });
  it("в любом темпе уровни растут с лёгкого: старт с 4 бит, уровень не убывает при верных ответах", () => {
    for (const gm of GAME_MODES) {
      const { tasks } = play(11, 0, gm);
      expect(tasks).toHaveLength(MODE_CONFIG[gm].primaryTasks);
      expect(tasks.map((t) => t.tier)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 2]);
      expect(tasks[0].bits).toBe(4);
      expect(tasks[1].bits).toBe(4);
    }
  });
  it("спокойный темп: ровно 10 заданий, ошибки не возвращаются", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { tasks, e } = play(seed, 1, "calm");
      expect(tasks).toHaveLength(10);
      expect(e.retriesUsed).toBe(0);
      expect(e.total).toBe(10);
    }
  });
  it("обычный темп: 10 основных + до трёх повторов ошибок", () => {
    const e = new RoundEngine(4, "normal");
    const out: Task[] = [];
    let t = e.next(m);
    while (t) {
      out.push(t);
      e.resolve(t, false);
      t = e.next(m);
    }
    expect(out).toHaveLength(PRIMARY_TASKS + MAX_RETRIES);
    expect(out.slice(PRIMARY_TASKS).every((x) => x.isRetry)).toBe(true);
  });
});

describe("bit-flip: темпы (MODE_CONFIG)", () => {
  it("спокойный: ни таймеров, ни часов раунда, ни авто-перехода после ошибки, без слепых заданий и паузы", () => {
    const c = MODE_CONFIG.calm;
    expect(c.taskSeconds).toBeNull();
    expect(c.roundSeconds).toBeNull();
    expect(c.wrongAdvanceMs).toBeNull();
    expect(c.blind).toBe(false);
    expect(c.pausable).toBe(false);
    expect(c.runningSum).toBe(true);
    expect(c.timeBonus).toBe("none");
    for (const kind of KINDS) for (const tier of TIERS) expect(taskTimeMs({ mode: kind, tier }, "calm")).toBeNull();
  });
  it("блиц — сегодняшние константы", () => {
    const c = MODE_CONFIG.blitz;
    expect(c.roundSeconds).toBe(ROUND_SECONDS);
    expect(ROUND_SECONDS).toBe(90);
    expect(c.taskSeconds).toEqual({
      build: { 0: 20, 1: 16, 2: 12 },
      property: { 0: 20, 1: 16, 2: 12 },
      read: { 0: 10, 1: 8, 2: 6 },
    });
    expect(c.wrongAdvanceMs).toBe(2500);
    expect(c.correctAdvanceMs).toBe(900);
    expect(c.pausable).toBe(false);
  });
  it("обычный: нет общих часов, пауза есть, время на задание — по числу бит", () => {
    const c = MODE_CONFIG.normal;
    expect(c.roundSeconds).toBeNull();
    expect(c.pausable).toBe(true);
    expect(c.wrongAdvanceMs).toBeGreaterThanOrEqual(2000);
    expect(taskTimeMs({ mode: "build", tier: 0 }, "normal")).toBe(25_000);
    expect(taskTimeMs({ mode: "build", tier: 1 }, "normal")).toBe(35_000);
    expect(taskTimeMs({ mode: "build", tier: 2 }, "normal")).toBe(45_000);
    expect(taskTimeMs({ mode: "property", tier: 0 }, "normal")).toBe(35_000);
  });
  it("обычный: времени больше, чем в блице, у каждого вида и уровня", () => {
    for (const kind of KINDS) {
      for (const tier of TIERS) {
        const n = taskTimeMs({ mode: kind, tier }, "normal")!;
        const b = taskTimeMs({ mode: kind, tier }, "blitz")!;
        expect(n).toBeGreaterThanOrEqual(b * 1.25);
      }
    }
  });
  it("обычный: чем сложнее (больше бит), тем больше времени; условие читать дольше", () => {
    for (const kind of KINDS) {
      const [a, b, c] = TIERS.map((tier) => taskTimeMs({ mode: kind, tier }, "normal")!);
      expect(b).toBeGreaterThan(a);
      expect(c).toBeGreaterThan(b);
    }
    for (const tier of TIERS) {
      expect(taskTimeMs({ mode: "property", tier }, "normal")!).toBeGreaterThan(taskTimeMs({ mode: "build", tier }, "normal")!);
    }
  });
  it("число основных заданий во всех темпах — 10", () => {
    for (const gm of GAME_MODES) expect(MODE_CONFIG[gm].primaryTasks).toBe(PRIMARY_TASKS);
    expect(PRIMARY_TASKS).toBe(10);
  });
  it("после ошибки спокойный и обычный показывают правильную комбинацию на переключателях", () => {
    expect(MODE_CONFIG.calm.revealOnSwitches).toBe(true);
    expect(MODE_CONFIG.normal.revealOnSwitches).toBe(true);
    expect(MODE_CONFIG.blitz.revealOnSwitches).toBe(false);
  });
});

describe("bit-flip: очки по темпам", () => {
  it("блиц — как раньше: секунды как есть", () => {
    expect(pointsFor("blitz", 12.2, 20, false)).toBe(taskPoints(12.2, false));
    expect(pointsFor("blitz", 0.1, 20, true)).toBe(16);
  });
  it("обычный: бонус за время — шкала до 20 от бюджета задания", () => {
    expect(pointsFor("normal", 25, 25, false)).toBe(30);
    expect(pointsFor("normal", 12.5, 25, false)).toBe(20);
    expect(pointsFor("normal", 45, 45, true)).toBe(35);
    expect(pointsFor("normal", 0, 35, false)).toBe(10);
    expect(pointsFor("normal", -3, 35, false)).toBe(10);
    expect(pointsFor("normal", 99, 35, false)).toBe(30);
  });
  it("спокойный: 10 за верный ответ, +5 за идеальность, времени нет", () => {
    expect(pointsFor("calm", 0, null, false)).toBe(10);
    expect(pointsFor("calm", 0, null, true)).toBe(15);
  });
});

describe("bit-flip: разбор ответа", () => {
  it("веса включённых битов", () => {
    expect(onWeights([1, 1, 0, 1])).toEqual([8, 4, 1]);
    expect(onWeights([0, 0, 0, 0])).toEqual([]);
    expect(onWeights(bitsOf(173, 8))).toEqual([128, 32, 8, 4, 1]);
  });
  it("BUILD: «13 = 8 + 4 + 1 → 1101₂»", () => {
    expect(whyParts({ mode: "build", answer: 13, bits: 4 })).toEqual({ lead: "13 = 8 + 4 + 1 →", answer: "1101₂" });
  });
  it("READ: «1101₂ = 8 + 4 + 1 = 13»", () => {
    expect(whyParts({ mode: "read", answer: 13, bits: 4 })).toEqual({ lead: "1101₂ = 8 + 4 + 1 =", answer: "13" });
  });
  it("степень двойки — без лишнего «8 = 8»", () => {
    expect(whyParts({ mode: "property", answer: 8, bits: 4 })).toEqual({ lead: "8 →", answer: "1000₂" });
    expect(whyParts({ mode: "read", answer: 8, bits: 4 })).toEqual({ lead: "1000₂ =", answer: "8" });
  });
  it("разбор сходится с ответом для всех чисел при любом числе бит", () => {
    for (const B of [4, 6, 8]) {
      for (let n = 1; n < 2 ** B; n++) {
        const w = whyParts({ mode: "build", answer: n, bits: B });
        expect(w.answer).toBe(`${bitsOf(n, B).join("")}₂`);
        const terms = onWeights(bitsOf(n, B));
        expect(terms.reduce((a, b) => a + b, 0)).toBe(n);
      }
    }
  });
  it("строка-подсказка примера есть в строках", () => {
    expect(S).toHaveProperty("exampleLead");
  });
});
