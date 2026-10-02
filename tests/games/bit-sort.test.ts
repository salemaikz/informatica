import { describe, expect, it } from "vitest";
import {
  CARDS_PER_RULE,
  D_MIN,
  D_START,
  RULES,
  RULE_ORDER,
  SortEngine,
  badDigit,
  cardPoints,
  multiplierFor,
  pickRule,
  shapeOf,
  weightTerms,
  type Card,
  type RuleId,
  type Tier,
} from "@/games/bit-sort/logic";
import { seeded } from "@/lib/text";
import { S } from "@/games/bit-sort/strings";

const isBin = (s: string) => /^1[01]*$/.test(s);

function sessionCards(rule: RuleId, tier: Tier, seed: number, n = CARDS_PER_RULE): Card[] {
  const e = new SortEngine(seed);
  e.tier = tier;
  // принудительно запускаем нужное правило
  e.startSession();
  for (let i = 0; i < 200 && e.session.rule !== rule; i++) e.startSession();
  const out: Card[] = [];
  for (let i = 0; i < n; i++) out.push(e.draw());
  return out;
}

describe("scoring", () => {
  it("multiplier by streak", () => {
    expect([0, 3, 4, 7, 8, 11, 12, 30].map(multiplierFor)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
  it("points formula", () => {
    expect(cardPoints(0, 0)).toBe(15);
    expect(cardPoints(1, 0)).toBe(10);
    expect(cardPoints(0.5, 0)).toBe(13);
    expect(cardPoints(0, 12)).toBe(60);
    expect(cardPoints(2, 0)).toBe(10);
    expect(cardPoints(-1, 4)).toBe(30);
  });
});

describe("helpers", () => {
  it("weightTerms", () => {
    expect(weightTerms(22)).toEqual([16, 4, 2]);
    expect(weightTerms(16)).toEqual([16]);
    expect(weightTerms(1)).toEqual([1]);
    expect(weightTerms(255).reduce((a, b) => a + b, 0)).toBe(255);
  });
  it("shapeOf", () => {
    expect(shapeOf("1000")).toBe(0);
    expect(shapeOf("111")).toBe(1);
    expect(shapeOf("1001")).toBe(2);
    expect(shapeOf("11011")).toBe(2);
  });
  it("badDigit", () => {
    expect(badDigit("1021", 2)).toBe("2");
    expect(badDigit("1011", 2)).toBeNull();
    expect(badDigit("1781", 8)).toBe("8");
    expect(badDigit("1777", 8)).toBeNull();
  });
});

describe("rule generators", () => {
  const tiers: Tier[] = [0, 1, 2];
  for (const rule of RULE_ORDER) {
    for (const tier of tiers) {
      it(`${rule} tier ${tier}: unique items, valid answers`, () => {
        for (let seed = 1; seed <= 60; seed++) {
          const cards = sessionCards(rule, tier, seed);
          const labels = cards.map((c) => c.item.label);
          expect(new Set(labels).size).toBe(labels.length);
          for (let i = 1; i < labels.length; i++) expect(labels[i]).not.toBe(labels[i - 1]);
          for (const c of cards) expect(c.rule).toBe(rule);
        }
      });
    }
  }

  it("parity: answer = last bit; no leading zero; bit counts by tier", () => {
    const range: Record<Tier, [number, number]> = { 0: [4, 5], 1: [5, 6], 2: [7, 8] };
    for (const tier of [0, 1, 2] as Tier[]) {
      for (const c of sessionCards("parity", tier, 7 + tier, 20)) {
        const bin = String(c.item.extra?.bin);
        expect(isBin(bin)).toBe(true);
        expect(bin.length).toBeGreaterThanOrEqual(range[tier][0]);
        expect(bin.length).toBeLessThanOrEqual(range[tier][1]);
        expect(c.bin).toBe(parseInt(bin, 2) % 2);
        expect(c.item.label).toBe(`${bin}₂`);
      }
    }
  });

  it("digits: correct bin always among the 3; ranges by tier", () => {
    const range: Record<Tier, [number, number]> = { 0: [8, 63], 1: [16, 127], 2: [32, 255] };
    for (const tier of [0, 1, 2] as Tier[]) {
      const e = new SortEngine(3);
      e.tier = tier;
      while (e.session.rule !== "digits") e.startSession();
      const k0 = e.session.param;
      expect(e.session.bins).toHaveLength(3);
      for (let i = 0; i < 8; i++) {
        const c = e.draw();
        const n = c.item.value;
        expect(n).toBeGreaterThanOrEqual(range[tier][0]);
        expect(n).toBeLessThanOrEqual(range[tier][1]);
        expect(c.bin).toBeGreaterThanOrEqual(0);
        expect(c.bin).toBeLessThanOrEqual(2);
        expect(n.toString(2).length).toBe(k0 + c.bin);
        expect(c.explain.ru).toContain(`${n.toString(2)}₂`);
      }
    }
  });

  it("shape: classification, no leading zero, mixture of kinds", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 30; seed++) {
      for (const c of sessionCards("shape", 2, seed)) {
        const bin = String(c.item.extra?.bin);
        expect(isBin(bin)).toBe(true);
        expect(bin.length).toBeGreaterThanOrEqual(5);
        expect(bin.length).toBeLessThanOrEqual(8);
        const v = parseInt(bin, 2);
        const isPow = (v & (v - 1)) === 0;
        const isMinus = (v & (v + 1)) === 0;
        expect(c.bin).toBe(isPow ? 0 : isMinus ? 1 : 2);
        seen.add(c.bin);
      }
    }
    expect(seen.size).toBe(3);
  });

  it("base: strings 3-5 digits, no leading zero, answer by digits", () => {
    for (const tier of [0, 1, 2] as Tier[]) {
      const kinds = new Set<number>();
      for (let seed = 1; seed <= 40; seed++) {
        const e = new SortEngine(seed);
        e.tier = tier;
        while (e.session.rule !== "base") e.startSession();
        if (tier === 0) expect(e.session.param).toBe(2);
        for (let i = 0; i < 8; i++) {
          const c = e.draw();
          const s = c.item.label;
          expect(s).toMatch(/^[1-9]\d{2,4}$/);
          const base = e.session.param;
          const ok = [...s].every((d) => Number(d) < base);
          expect(c.bin).toBe(ok ? 0 : 1);
          kinds.add(c.bin);
          if (!ok) expect([...s].filter((d) => Number(d) >= base)).toHaveLength(1);
        }
      }
      expect(kinds.size).toBe(2);
    }
    // tier 1+ gives both bases overall
    const params = new Set<number>();
    for (let seed = 1; seed <= 80; seed++) {
      const e = new SortEngine(seed);
      e.tier = 1;
      while (e.session.rule !== "base") e.startSession();
      params.add(e.session.param);
    }
    expect(params).toEqual(new Set([2, 8]));
  });

  it("compare: threshold range, never equal, tier 2 close, explanation sums", () => {
    const tr: Record<Tier, [number, number]> = { 0: [8, 20], 1: [20, 50], 2: [50, 120] };
    for (const tier of [0, 1, 2] as Tier[]) {
      for (let seed = 1; seed <= 40; seed++) {
        const e = new SortEngine(seed);
        e.tier = tier;
        while (e.session.rule !== "compare") e.startSession();
        const t = e.session.param;
        expect(t).toBeGreaterThanOrEqual(tr[tier][0]);
        expect(t).toBeLessThanOrEqual(tr[tier][1]);
        for (let i = 0; i < 8; i++) {
          const c = e.draw();
          const v = c.item.value;
          expect(v).not.toBe(t);
          expect(v).toBeGreaterThanOrEqual(1);
          expect(c.item.label).toBe(`${v.toString(2)}₂`);
          expect(c.bin).toBe(v < t ? 0 : 1);
          if (tier === 2) expect(Math.abs(v - t)).toBeLessThanOrEqual(6);
          expect(c.explain.ru.endsWith(`= ${v}`)).toBe(true);
          const terms = weightTerms(v);
          expect(terms.reduce((a, b) => a + b, 0)).toBe(v);
        }
      }
    }
  });

  it("every card has both languages for explain and bins", () => {
    for (const rule of RULE_ORDER) {
      const e = new SortEngine(11);
      e.tier = 1;
      while (e.session.rule !== rule) e.startSession();
      for (const b of e.session.bins) {
        expect(b.ru.length).toBeGreaterThan(0);
        expect(b.kk.length).toBeGreaterThan(0);
        expect(b.ru).not.toMatch(/\{/);
        expect(b.kk).not.toMatch(/\{/);
      }
      const c = e.draw();
      expect(c.explain.ru).not.toMatch(/\{/);
      expect(c.explain.kk).not.toMatch(/\{/);
      expect(RULES[rule].skill).toMatch(/^ns\./);
    }
  });
});

describe("pickRule", () => {
  it("never repeats and favours weak skills", () => {
    const rand = seeded(5);
    const counts: Record<string, number> = {};
    let prev: RuleId | null = "parity";
    for (let i = 0; i < 3000; i++) {
      const r = pickRule(rand, (s) => (s === "ns.base" ? 0 : 1), prev);
      expect(r).not.toBe(prev);
      counts[r] = (counts[r] ?? 0) + 1;
      prev = r;
    }
    expect(counts.base).toBeGreaterThan(counts.compare);
  });
});

describe("SortEngine", () => {
  it("starts with parity and switches only after 8 resolved cards", () => {
    const e = new SortEngine(1);
    expect(e.session.rule).toBe("parity");
    for (let i = 0; i < CARDS_PER_RULE - 1; i++) {
      e.resolve(e.draw(), true, 0.5);
      expect(e.sessionDone()).toBe(false);
    }
    e.resolve(e.draw(), true, 0.5);
    expect(e.sessionDone()).toBe(true);
    const prev = e.session.rule;
    const s = e.startSession();
    expect(s.rule).not.toBe(prev);
    expect(e.resolvedInSession).toBe(0);
  });

  it("score accumulates with streak multiplier", () => {
    const e = new SortEngine(2);
    let expected = 0;
    for (let i = 0; i < 10; i++) {
      const r = e.resolve(e.draw(), true, 0);
      expected += 15 * (i >= 8 ? 3 : i >= 4 ? 2 : 1);
      expect(r.points).toBe(15 * (i >= 8 ? 3 : i >= 4 ? 2 : 1));
      if (e.sessionDone()) e.startSession();
    }
    expect(e.score).toBe(expected);
  });

  it("wrong gives 0, resets streak, slows fall, never lowers score", () => {
    const e = new SortEngine(3);
    for (let i = 0; i < 4; i++) e.resolve(e.draw(), true, 0);
    expect(e.fallSeconds).toBeCloseTo(D_START * 0.92 > D_START ? D_START : D_START * 0.92, 5);
    const before = e.score;
    const r = e.resolve(e.draw(), false, 1);
    expect(r.points).toBe(0);
    expect(e.score).toBe(before);
    expect(e.streak).toBe(0);
    expect(e.fallSeconds).toBe(D_START);
  });

  it("fall time shrinks to floor", () => {
    const e = new SortEngine(4);
    for (let i = 0; i < 200; i++) {
      e.resolve(e.draw(), true, 0);
      if (e.sessionDone()) e.startSession();
    }
    expect(e.fallSeconds).toBe(D_MIN);
  });

  it("tier rises every 6 correct (max 2) and drops after two wrong in a row", () => {
    const e = new SortEngine(5);
    const step = (ok: boolean) => {
      e.resolve(e.draw(), ok, 0.2);
      if (e.sessionDone()) e.startSession();
    };
    for (let i = 0; i < 5; i++) step(true);
    expect(e.tier).toBe(0);
    step(true);
    expect(e.tier).toBe(1);
    for (let i = 0; i < 6; i++) step(true);
    expect(e.tier).toBe(2);
    for (let i = 0; i < 6; i++) step(true);
    expect(e.tier).toBe(2);
    step(false);
    expect(e.tier).toBe(2);
    step(false);
    expect(e.tier).toBe(1);
    step(false);
    step(false);
    step(false);
    step(false);
    expect(e.tier).toBe(0);
  });

  it("re-queues a wrong card once, 3 cards later, same session only", () => {
    const e = new SortEngine(6);
    const first = e.draw();
    e.resolve(first, false, 1);
    const c2 = e.draw();
    e.resolve(c2, true, 0.5);
    const c3 = e.draw();
    e.resolve(c3, true, 0.5);
    const c4 = e.draw();
    expect(c4.item.label).toBe(first.item.label);
    expect(c4.retry).toBe(true);
    // wrong again: not re-queued a second time
    e.resolve(c4, false, 1);
    const later = Array.from({ length: 3 }, () => e.draw());
    expect(later.some((c) => c.item.label === first.item.label && c.retry)).toBe(false);
  });

  it("drops queued items when the rule changes", () => {
    const e = new SortEngine(7);
    const c = e.draw();
    e.resolve(c, false, 1);
    while (!e.sessionDone()) e.resolve(e.draw(), true, 0.5);
    e.startSession();
    for (let i = 0; i < 8; i++) {
      const n = e.draw();
      expect(n.retry).toBe(false);
      expect(n.rule).toBe(e.session.rule);
    }
  });

  it("is deterministic by seed", () => {
    const a = new SortEngine(99);
    const b = new SortEngine(99);
    for (let i = 0; i < 8; i++) expect(a.draw().item.label).toBe(b.draw().item.label);
  });

  it("strings exist for all keys with both languages", () => {
    for (const v of Object.values(S)) {
      expect(v.ru.length).toBeGreaterThan(0);
      expect(v.kk.length).toBeGreaterThan(0);
    }
  });
});
