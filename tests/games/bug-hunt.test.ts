import { describe, expect, it } from "vitest";
import { toBinary } from "@/lib/check";
import { seeded } from "@/lib/text";
import type { L } from "@/lib/types";
import {
  FIX_BONUS,
  SKILL_OF,
  START_TIER,
  TEMPLATES,
  findPoints,
  generatePuzzle,
  ladderRange,
  multiplier,
  pickTemplate,
  propsRange,
  puzzleTimeMs,
  sup,
  templateWeight,
  updateTier,
  wantNoFault,
  isCorrectFind,
  type Puzzle,
  type TemplateId,
  type Tier,
} from "@/games/bug-hunt/logic";
import { S } from "@/games/bug-hunt/strings";

const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const unsup = (s: string) =>
  s
    .split("")
    .map((c) => SUPS.indexOf(c))
    .join("");

/** Независимая проверка истинности строки i по ru-тексту. */
function truth(p: Puzzle, line: string, i: number): boolean {
  if (p.template === "ladder") {
    const n = Number(p.header.ru.match(/\d+/)![0]);
    let v = n;
    const rows: number[] = [];
    while (v > 0) {
      rows.push(v);
      v = Math.floor(v / 2);
    }
    if (i < rows.length) {
      const m = line.match(/^(\d+) : 2 = (\d+), ост\. (\d+)$/);
      if (!m) return false;
      return Number(m[1]) === rows[i] && Number(m[2]) === Math.floor(rows[i] / 2) && Number(m[3]) === rows[i] % 2;
    }
    return line === `Ответ: ${n.toString(2)}₂`;
  }
  if (p.template === "weights") {
    const bin = p.header.ru.match(/([01]+)₂/)![1];
    const len = bin.length;
    const n = parseInt(bin, 2);
    if (i < len) {
      const k = len - 1 - i;
      const m = line.match(/^([01]) · 2([⁰¹²³⁴⁵⁶⁷⁸⁹]+) = (\d+)$/u);
      if (!m) return false;
      return m[1] === bin[i] && Number(unsup(m[2])) === k && Number(m[3]) === Number(bin[i]) * 2 ** k;
    }
    const terms = bin
      .split("")
      .map((d, j) => (d === "1" ? 2 ** (len - 1 - j) : 0))
      .filter(Boolean);
    return line === `Итого: ${terms.join(" + ")} = ${n}`;
  }
  if (p.template === "props") {
    const n = Number(p.header.ru.match(/\d+/)![0]);
    const bin = n.toString(2);
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(\d+) = ([01]+)₂$/))) return Number(m[1]) === n && m[2] === bin;
    if ((m = line.match(/^(\d+) — (чётное|нечётное): последний бит ([01])$/)))
      return (
        Number(m[1]) === n &&
        Number(m[3]) === n % 2 &&
        (m[2] === "чётное") === (n % 2 === 0)
      );
    if ((m = line.match(/^Разрядов в записи: (\d+)$/))) return Number(m[1]) === bin.length;
    if ((m = line.match(/^Единиц в записи: (\d+)$/))) return Number(m[1]) === bin.split("1").length - 1;
    if ((m = line.match(/^2([⁰¹²³⁴⁵⁶⁷⁸⁹]+) = ([01]+)₂$/u))) return m[2] === "1" + "0".repeat(Number(unsup(m[1])));
    if ((m = line.match(/^2([⁰¹²³⁴⁵⁶⁷⁸⁹]+) − 1 = ([01]+)₂$/u))) return m[2] === "1".repeat(Number(unsup(m[1])));
    throw new Error("unknown props line: " + line);
  }
  let m: RegExpMatchArray | null;
  if ((m = line.match(/^Цифры системы с основанием (\d+): 0…(\d+)$/))) return Number(m[2]) === Number(m[1]) - 1;
  if ((m = line.match(/^В системе с основанием (\d+) разных цифр: (\d+)$/))) return m[1] === m[2];
  if ((m = line.match(/^Запись (\d+) может быть двоичным числом$/))) return /^[01]+$/.test(m[1]);
  if ((m = line.match(/^Запись (\d+) не может быть двоичным числом$/))) return !/^[01]+$/.test(m[1]);
  if ((m = line.match(/^Наибольшая цифра восьмеричной системы: (\d+)$/))) return m[1] === "7";
  throw new Error("unknown base line: " + line);
}

const tiers: Tier[] = [0, 1, 2];

describe("puzzle correctness (independent checker)", () => {
  for (const template of TEMPLATES) {
    for (const tier of tiers) {
      it(`${template} tier ${tier}: no-fault puzzles are fully true`, () => {
        const rand = seeded(100 + tier);
        for (let s = 0; s < 150; s++) {
          const p = generatePuzzle(rand, tier, template, false);
          expect(p.fault).toBeNull();
          expect(p.template).toBe(template);
          p.lines.forEach((l, i) => expect(truth(p, l.ru, i), `${l.ru}`).toBe(true));
        }
      });

      it(`${template} tier ${tier}: exactly one false line and the fix is true`, () => {
        const rand = seeded(500 + tier);
        for (let s = 0; s < 300; s++) {
          const p = generatePuzzle(rand, tier, template, true);
          expect(p.fault, "fault expected").not.toBeNull();
          const f = p.fault!;
          p.lines.forEach((l, i) => expect(truth(p, l.ru, i), `${i}: ${l.ru}`).toBe(i !== f.line));
          expect(f.fixOptions.length).toBeGreaterThanOrEqual(2);
          expect(f.fixOptions.length).toBeLessThanOrEqual(3);
          expect(new Set(f.fixOptions.map((o) => o.ru + "|" + o.kk)).size).toBe(f.fixOptions.length);
          f.fixOptions.forEach((o, j) => expect(truth(p, o.ru, f.line), o.ru).toBe(j === f.fixCorrect));
          expect(f.explain.ru.length).toBeGreaterThan(0);
          expect(f.explain.kk.length).toBeGreaterThan(0);
        }
      });
    }
  }

  it("lines are unique, 3..8 per puzzle, no unresolved placeholders, both languages", () => {
    const rand = seeded(7);
    for (let s = 0; s < 800; s++) {
      const t = TEMPLATES[s % 4];
      const p = generatePuzzle(rand, (s % 3) as Tier, t, s % 5 !== 0);
      expect(p.lines.length).toBeGreaterThanOrEqual(3);
      expect(p.lines.length).toBeLessThanOrEqual(8);
      expect(new Set(p.lines.map((l) => l.ru)).size, JSON.stringify(p)).toBe(p.lines.length);
      expect(p.skill).toBe(SKILL_OF[t]);
      const all: L[] = [p.header, ...p.lines, ...(p.fault ? [p.fault.explain, ...p.fault.fixOptions] : [])];
      for (const l of all) {
        expect(l.ru).not.toMatch(/[{}]|undefined|NaN/);
        expect(l.kk).not.toMatch(/[{}]|undefined|NaN/);
        expect(l.ru.length).toBeGreaterThan(0);
        expect(l.kk.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("tier ranges", () => {
  it("ladder uses the spec ranges and line counts", () => {
    for (const tier of tiers) {
      const [lo, hi] = ladderRange(tier);
      const rand = seeded(3 + tier);
      for (let s = 0; s < 100; s++) {
        const p = generatePuzzle(rand, tier, "ladder", false);
        const n = Number(p.header.ru.match(/\d+/)![0]);
        expect(n).toBeGreaterThanOrEqual(lo);
        expect(n).toBeLessThanOrEqual(hi);
        expect(p.lines.length).toBe(toBinary(n).length + 1);
        expect(p.lines.length).toBeLessThanOrEqual(8);
      }
    }
  });

  it("weights lengths follow the tier", () => {
    const want: Record<number, number[]> = { 0: [4], 1: [5, 6], 2: [7] };
    for (const tier of tiers) {
      const rand = seeded(11 + tier);
      for (let s = 0; s < 100; s++) {
        const p = generatePuzzle(rand, tier, "weights", false);
        const bin = p.header.ru.match(/([01]+)₂/)![1];
        expect(want[tier]).toContain(bin.length);
        expect(bin[0]).toBe("1");
      }
    }
  });

  it("props numbers are in range and have 4 lines", () => {
    for (const tier of tiers) {
      const [lo, hi] = propsRange(tier);
      const rand = seeded(21 + tier);
      for (let s = 0; s < 100; s++) {
        const p = generatePuzzle(rand, tier, "props", false);
        const n = Number(p.header.ru.match(/\d+/)![0]);
        expect(n).toBeGreaterThanOrEqual(lo);
        expect(n).toBeLessThanOrEqual(hi);
        expect(p.lines.length).toBe(4);
      }
    }
  });

  it("base has 4 distinct claims", () => {
    const rand = seeded(5);
    for (let s = 0; s < 100; s++) {
      expect(generatePuzzle(rand, 0, "base", false).lines.length).toBe(4);
    }
  });

  it("mutation types are all reachable", () => {
    const seen: Record<string, Set<string>> = {};
    const rand = seeded(99);
    for (let s = 0; s < 2000; s++) {
      const t = TEMPLATES[s % 4];
      const p = generatePuzzle(rand, 2, t, true);
      (seen[t] ??= new Set()).add(p.fault!.type);
    }
    expect([...seen.ladder].sort()).toEqual(["dropped", "remainder", "reversed"]);
    expect([...seen.weights].sort()).toEqual(["powerMul", "shift", "sum", "zeroCounted"]);
    expect([...seen.props].sort()).toEqual(["len", "ones", "parity", "pow", "powMinus"]);
    expect([...seen.base].sort()).toEqual(["canBin", "cannotBin", "count", "max8", "range"]);
  });

  it("tier 0 weights never use shift", () => {
    const rand = seeded(1);
    for (let s = 0; s < 400; s++) {
      expect(generatePuzzle(rand, 0, "weights", true).fault!.type).not.toBe("shift");
    }
  });
});

describe("scoring", () => {
  it("multiplier thresholds", () => {
    expect([0, 2, 3, 5, 6, 20].map(multiplier)).toEqual([1, 1, 2, 2, 3, 3]);
  });
  it("find points = (10 + min(10, floor(sec))) * mult", () => {
    expect(findPoints(0, 0)).toBe(10);
    expect(findPoints(3.9, 0)).toBe(13);
    expect(findPoints(25, 2)).toBe(20);
    expect(findPoints(7, 3)).toBe(34);
    expect(findPoints(12, 6)).toBe(60);
    expect(findPoints(-1, 0)).toBe(10);
    expect(FIX_BONUS).toBe(5);
  });
  it("puzzle time per tier", () => {
    expect(puzzleTimeMs(0, 5)).toBe(18000);
    expect(puzzleTimeMs(1, 5)).toBe(14000);
    expect(puzzleTimeMs(2, 5)).toBe(11500);
  });
  it("isCorrectFind", () => {
    const rand = seeded(2);
    const bad = generatePuzzle(rand, 0, "ladder", true);
    const ok = generatePuzzle(rand, 0, "ladder", false);
    expect(isCorrectFind(bad, bad.fault!.line)).toBe(true);
    expect(isCorrectFind(bad, "none")).toBe(false);
    expect(isCorrectFind(bad, (bad.fault!.line + 1) % bad.lines.length)).toBe(false);
    expect(isCorrectFind(ok, "none")).toBe(true);
    expect(isCorrectFind(ok, 0)).toBe(false);
  });
});

describe("tier progression", () => {
  it("+1 after 3 correct, capped at 2", () => {
    let s = START_TIER;
    for (let i = 0; i < 3; i++) s = updateTier(s, true);
    expect(s.tier).toBe(1);
    for (let i = 0; i < 30; i++) s = updateTier(s, true);
    expect(s.tier).toBe(2);
  });
  it("-1 after 2 wrong in a row, floored at 0", () => {
    let s = { tier: 2 as Tier, correctSinceUp: 0, wrongRow: 0 };
    s = updateTier(s, false);
    expect(s.tier).toBe(2);
    s = updateTier(s, false);
    expect(s.tier).toBe(1);
    s = updateTier(updateTier(s, false), false);
    expect(s.tier).toBe(0);
    s = updateTier(updateTier(s, false), false);
    expect(s.tier).toBe(0);
  });
  it("a correct answer breaks the wrong streak", () => {
    let s = { tier: 1 as Tier, correctSinceUp: 0, wrongRow: 0 };
    s = updateTier(s, false);
    s = updateTier(s, true);
    s = updateTier(s, false);
    expect(s.tier).toBe(1);
  });
});

describe("selection", () => {
  it("weights favour weak skills", () => {
    expect(templateWeight(0)).toBeGreaterThan(templateWeight(0.9));
    expect(templateWeight(5)).toBeCloseTo(0.01);
  });
  it("never the same template twice in a row", () => {
    const rand = seeded(8);
    let prev: TemplateId | null = null;
    for (let i = 0; i < 500; i++) {
      const t = pickTemplate(rand, () => 0.3, prev);
      expect(t).not.toBe(prev);
      prev = t;
    }
  });
  it("weak skill is picked more often", () => {
    const rand = seeded(9);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const t = pickTemplate(rand, (sk) => (sk === "ns.base" ? 1 : 0), null);
      counts[t] = (counts[t] ?? 0) + 1;
    }
    expect(counts.ladder).toBeGreaterThan(counts.base);
  });
  it("no-fault puzzles: never twice in a row, ~20% rate", () => {
    const rand = seeded(10);
    let prev = false;
    let n = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) {
      const nf = wantNoFault(rand, 0, prev);
      expect(nf && prev).toBe(false);
      if (nf) n++;
      prev = nf;
    }
    expect(n / N).toBeGreaterThan(0.12);
    expect(n / N).toBeLessThan(0.22);
  });
});

describe("strings", () => {
  it("sup maps digits", () => {
    expect(sup(0)).toBe("⁰");
    expect(sup(10)).toBe("¹⁰");
  });
  it("every string has ru and kk", () => {
    for (const v of Object.values(S)) {
      expect(v.ru.length).toBeGreaterThan(0);
      expect(v.kk.length).toBeGreaterThan(0);
    }
  });
});
