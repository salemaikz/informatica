import { describe, expect, it } from "vitest";
import {
  CARDS_PER_RULE,
  D_MIN,
  D_START,
  MODE_CONFIG,
  RAMP_MAX_WEIGHT,
  RULES,
  RULE_BY_DIFFICULTY,
  RULE_ORDER,
  RULE_WEIGHT,
  SortEngine,
  badDigit,
  cardPoints,
  multiplierFor,
  pickRule,
  ruleTimeFactor,
  shapeOf,
  taskTimeMs,
  weightTerms,
  type Card,
  type RuleId,
  type Tier,
} from "@/games/bit-sort/logic";
import type { GameMode } from "@/games/types";
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
          // «10110₂ = 16 + 4 + 2 = 22 > 20»: сумма весов и вывод про порог
          expect(c.explain.ru).toMatch(new RegExp(`= ${v} ${v < t ? "<" : ">"} ${t}$`));
          expect(c.explain.kk).toBe(c.explain.ru);
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

describe("explanations (calm «why» line)", () => {
  it("parity names the item, the last digit and the verdict", () => {
    const e = new SortEngine(21);
    for (let i = 0; i < 6; i++) {
      const c = e.draw();
      const bin = String(c.item.extra?.bin);
      expect(c.explain.ru.startsWith(`${bin}₂: последняя цифра ${bin.slice(-1)} → `)).toBe(true);
      expect(c.explain.ru.endsWith(c.bin === 1 ? "нечётное" : "чётное")).toBe(true);
      expect(c.explain.kk.endsWith(c.bin === 1 ? "тақ" : "жұп")).toBe(true);
    }
  });
  it("digits shows the power-of-two bounds", () => {
    const e = new SortEngine(22);
    while (e.session.rule !== "digits") e.startSession();
    for (let i = 0; i < 8; i++) {
      const c = e.draw();
      const n = c.item.value;
      const k = n.toString(2).length;
      expect(c.explain.ru).toContain(`(${2 ** (k - 1)} ≤ ${n} < ${2 ** k})`);
    }
  });
  it("base names the item", () => {
    const e = new SortEngine(23);
    while (e.session.rule !== "base") e.startSession();
    for (let i = 0; i < 8; i++) {
      const c = e.draw();
      expect(c.explain.ru.startsWith(`${c.item.label}: `)).toBe(true);
      expect(c.explain.kk.startsWith(`${c.item.label}: `)).toBe(true);
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

  it("tracks resolved cards in total", () => {
    const e = new SortEngine(8);
    for (let i = 0; i < 5; i++) e.resolve(e.draw(), i % 2 === 0, 0.5);
    expect(e.resolvedTotal).toBe(5);
  });

  it("strings exist for all keys with both languages", () => {
    for (const v of Object.values(S)) {
      expect(v.ru.length).toBeGreaterThan(0);
      expect(v.kk.length).toBeGreaterThan(0);
    }
  });
});

// ---------- режимы темпа ----------

const MODES: GameMode[] = ["calm", "normal", "blitz"];

/** Играет игру целиком: отвечает верно/неверно по функции, возвращает карточки по порядку. */
function playAll(e: SortEngine, answer: (i: number) => boolean, cap = 500): Card[] {
  const out: Card[] = [];
  for (let i = 0; i < cap; i++) {
    const c = e.draw();
    out.push(c);
    e.resolve(c, answer(i), 0.5);
    if (e.gameDone()) break;
    if (e.sessionDone()) e.startSession();
  }
  return out;
}

describe("rule weights", () => {
  it("every rule has a weight; digits/shape are hardest, parity easiest", () => {
    for (const r of RULE_ORDER) expect(RULE_WEIGHT[r]).toBeGreaterThanOrEqual(1);
    expect(RULE_WEIGHT.parity).toBe(Math.min(...RULE_ORDER.map((r) => RULE_WEIGHT[r])));
    expect(RULE_WEIGHT.digits).toBe(Math.max(...RULE_ORDER.map((r) => RULE_WEIGHT[r])));
    expect(RULE_WEIGHT.shape).toBeGreaterThan(RULE_WEIGHT.base);
    expect(RULE_WEIGHT.shape).toBeGreaterThan(RULE_WEIGHT.compare);
    expect(RULE_WEIGHT.base).toBeGreaterThan(RULE_WEIGHT.parity);
  });
  it("difficulty order is a permutation sorted by weight", () => {
    expect([...RULE_BY_DIFFICULTY].sort()).toEqual([...RULE_ORDER].sort());
    expect(RULE_BY_DIFFICULTY[0]).toBe("parity");
    expect(RULE_BY_DIFFICULTY[RULE_BY_DIFFICULTY.length - 1]).toBe("digits");
    for (let i = 1; i < RULE_BY_DIFFICULTY.length; i++) {
      expect(RULE_WEIGHT[RULE_BY_DIFFICULTY[i]]).toBeGreaterThanOrEqual(RULE_WEIGHT[RULE_BY_DIFFICULTY[i - 1]]);
    }
  });
});

describe("MODE_CONFIG", () => {
  it("calm has no time limits and no falling", () => {
    const c = MODE_CONFIG.calm;
    expect(c.falls).toBe(false);
    expect(c.roundSeconds).toBe(0);
    expect(c.wallCapSeconds).toBe(0);
    expect(c.bannerMs).toBeNull();
    expect(c.explainMs).toBeNull();
    expect(c.pausable).toBe(false);
    for (const r of RULE_ORDER) expect(taskTimeMs(r, "calm")).toBe(Infinity);
  });

  it("normal has no global clock, a pause and a gentle ramp", () => {
    const c = MODE_CONFIG.normal;
    expect(c.roundSeconds).toBe(0);
    expect(c.wallCapSeconds).toBe(0);
    expect(c.pausable).toBe(true);
    expect(c.fallStart).toBe(8);
    expect(c.fallMin).toBe(4.5);
    expect(c.fallFactor).toBe(0.95);
    expect(c.speedUpEvery).toBe(4);
    expect(c.bannerMs).toBe(2500);
    expect(c.explainMs).toBeGreaterThanOrEqual(2000);
    // трудные правила ≈ 11 с и больше
    expect(taskTimeMs("shape", "normal")).toBeGreaterThanOrEqual(11000);
    expect(taskTimeMs("digits", "normal")).toBeGreaterThanOrEqual(11000);
    expect(taskTimeMs("parity", "normal")).toBe(8000);
  });

  it("blitz keeps today's constants", () => {
    const c = MODE_CONFIG.blitz;
    expect(c.roundSeconds).toBe(75);
    expect(c.wallCapSeconds).toBe(110);
    expect(c.fallStart).toBe(5);
    expect(c.fallMin).toBe(2.2);
    expect(c.fallFactor).toBe(0.92);
    expect(c.cardsPerRule).toBe(8);
    expect(c.pausable).toBe(false);
    expect(taskTimeMs("parity", "blitz")).toBe(5000);
  });

  it("blitz: hard rules fall 1.3× longer than the easiest; normal is clearly more relaxed", () => {
    expect(ruleTimeFactor("parity", "blitz")).toBe(1);
    expect(ruleTimeFactor("shape", "blitz")).toBeCloseTo(1.3, 5);
    expect(ruleTimeFactor("digits", "blitz")).toBeGreaterThanOrEqual(1.3);
    for (const r of RULE_ORDER) {
      const ratio = taskTimeMs(r, "normal") / taskTimeMs(r, "blitz");
      expect(ratio).toBeGreaterThanOrEqual(1.5);
      expect(ratio).toBeLessThanOrEqual(2.2);
      // и в самом быстром месте игры нормальный темп не быстрее блица
      expect(taskTimeMs(r, "normal", MODE_CONFIG.normal.fallMin)).toBeGreaterThan(taskTimeMs(r, "blitz", D_MIN));
    }
  });

  it("harder rules get more time in every falling mode", () => {
    for (const mode of ["normal", "blitz"] as GameMode[]) {
      const times = RULE_BY_DIFFICULTY.map((r) => taskTimeMs(r, mode));
      for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
      expect(times[times.length - 1]).toBeGreaterThan(times[0]);
    }
  });

  it("all modes: finite plans, tier cap, counts", () => {
    for (const mode of MODES) {
      const c = MODE_CONFIG[mode];
      expect(c.cardsPerRule).toBeGreaterThan(0);
      expect(c.maxTier).toBeLessThanOrEqual(2);
      if (c.rulesPerGame > 0) {
        expect(c.rulesPerGame).toBeLessThanOrEqual(RULE_ORDER.length);
        expect(c.byDifficulty).toBe(true);
      }
    }
    // обычный и спокойный не доходят до самого трудного уровня заданий
    expect(MODE_CONFIG.normal.maxTier).toBe(1);
    expect(MODE_CONFIG.calm.maxTier).toBe(1);
  });
});

describe("normal mode engine", () => {
  it("plays all 5 rules in difficulty order, 8 cards each = 40, then the game is done", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const e = new SortEngine(seed, () => 0.3, "normal");
      expect(e.cardsTotal).toBe(40);
      expect(e.rulesTotal).toBe(5);
      const cards = playAll(e, () => true);
      expect(cards).toHaveLength(40);
      expect(e.gameDone()).toBe(true);
      expect(e.resolvedTotal).toBe(40);
      const order = cards.map((c) => c.rule).filter((r, i, a) => i === 0 || r !== a[i - 1]);
      expect(order).toEqual(RULE_BY_DIFFICULTY);
      for (let r = 0; r < 5; r++) {
        for (const c of cards.slice(r * 8, r * 8 + 8)) expect(c.rule).toBe(RULE_BY_DIFFICULTY[r]);
      }
    }
  });

  it("is not done before the last rule is finished; mistakes retry within the rule only", () => {
    const e = new SortEngine(3, () => 0.3, "normal");
    for (let i = 0; i < 39; i++) {
      e.resolve(e.draw(), i % 5 !== 0, 0.5);
      expect(e.gameDone()).toBe(false);
      if (e.sessionDone() && e.ruleNo < 5) e.startSession();
    }
    e.resolve(e.draw(), true, 0.5);
    expect(e.gameDone()).toBe(true);
  });

  it("fall time: 8 s start, ×0.95 every 4 correct, floor 4.5 s, slows back after a mistake", () => {
    const e = new SortEngine(4, () => 0.3, "normal");
    expect(e.fallSeconds).toBe(8);
    expect(e.fallMs()).toBe(8000); // parity, вес 1
    for (let i = 0; i < 3; i++) e.resolve(e.draw(), true, 0);
    expect(e.fallSeconds).toBe(8);
    e.resolve(e.draw(), true, 0);
    expect(e.fallSeconds).toBeCloseTo(7.6, 5);
    e.resolve(e.draw(), false, 1);
    expect(e.fallSeconds).toBeCloseTo(8, 5); // 7.6 / 0.95
    expect(e.fallSeconds).toBeLessThanOrEqual(8);
    // пол
    const f = new SortEngine(5, () => 0.3, "normal");
    for (let i = 0; i < 400; i++) {
      f.resolve(f.draw(), true, 0);
      if (f.sessionDone()) f.startSession();
    }
    expect(f.fallSeconds).toBe(4.5);
  });

  it("per-card fall time follows the rule weight", () => {
    const e = new SortEngine(6, () => 0.3, "normal");
    const seen: Record<string, number> = {};
    for (let i = 0; i < 40; i++) {
      seen[e.session.rule] = e.fallMs() / e.fallSeconds / 1000;
      e.resolve(e.draw(), false, 1); // ошибки не ускоряют, секунды остаются базовыми
      if (e.sessionDone() && e.ruleNo < 5) e.startSession();
    }
    for (const r of RULE_ORDER) expect(seen[r]).toBeCloseTo(RULE_WEIGHT[r], 5);
  });

  it("tier stays ≤ 1 even with a perfect game", () => {
    const e = new SortEngine(7, () => 0.3, "normal");
    let maxTier = 0;
    for (let i = 0; i < 40; i++) {
      maxTier = Math.max(maxTier, e.tier);
      e.resolve(e.draw(), true, 0);
      if (e.sessionDone() && e.ruleNo < 5) e.startSession();
    }
    expect(maxTier).toBe(1);
    expect(e.tier).toBe(1);
  });

  it("session items respect the (capped) tier ranges", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const e = new SortEngine(seed, () => 0.3, "normal");
      for (const c of playAll(e, () => true)) {
        if (c.rule === "compare") expect(c.item.value).toBeGreaterThanOrEqual(1);
        if (c.rule === "parity") expect(String(c.item.extra?.bin).length).toBeLessThanOrEqual(6);
        if (c.rule === "digits") expect(c.item.value).toBeLessThanOrEqual(127);
      }
    }
  });
});

describe("calm mode engine", () => {
  it("plays all 5 rules × 4 cards = 20 in difficulty order, nothing falls", () => {
    const e = new SortEngine(1, () => 0.3, "calm");
    expect(e.cardsTotal).toBe(20);
    expect(e.fallMs()).toBe(Infinity);
    const cards = playAll(e, () => true);
    expect(cards).toHaveLength(20);
    expect(e.gameDone()).toBe(true);
    for (let r = 0; r < 5; r++) {
      for (const c of cards.slice(r * 4, r * 4 + 4)) expect(c.rule).toBe(RULE_BY_DIFFICULTY[r]);
    }
  });

  it("every card has a one-line why in both languages (for the explanation after a mistake)", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const e = new SortEngine(seed, () => 0.3, "calm");
      for (const c of playAll(e, () => true)) {
        for (const lang of ["ru", "kk"] as const) {
          expect(c.explain[lang].length).toBeGreaterThan(5);
          expect(c.explain[lang]).not.toMatch(/\{|\n/);
        }
      }
    }
  });

  it("a wrong answer re-queues the card within the same rule (3 cards later)", () => {
    const e = new SortEngine(2, () => 0.3, "calm");
    const first = e.draw();
    e.resolve(first, false, 1);
    e.resolve(e.draw(), true, 1);
    e.resolve(e.draw(), true, 1);
    const again = e.draw();
    expect(again.retry).toBe(true);
    expect(again.item.label).toBe(first.item.label);
    expect(e.sessionDone()).toBe(false);
    e.resolve(again, true, 1);
    expect(e.sessionDone()).toBe(true);
  });

  it("fall time is never touched (no speed-up, no slow-down)", () => {
    const e = new SortEngine(3, () => 0.3, "calm");
    for (let i = 0; i < 20; i++) {
      e.resolve(e.draw(), i % 3 !== 0, 1);
      if (e.sessionDone() && !e.gameDone()) e.startSession();
    }
    expect(e.fallMs()).toBe(Infinity);
  });
});

describe("blitz mode engine", () => {
  it("ramps from easy: first rule parity, second rule easy-or-medium, never hard before the third", () => {
    const seen = new Set<RuleId>();
    for (let seed = 1; seed <= 200; seed++) {
      const e = new SortEngine(seed, () => 0.3, "blitz");
      expect(e.session.rule).toBe("parity");
      for (let i = 0; i < 8; i++) e.resolve(e.draw(), true, 0.5);
      const second = e.startSession();
      expect(RULE_WEIGHT[second.rule]).toBeLessThanOrEqual(RAMP_MAX_WEIGHT);
      expect(second.rule).not.toBe("parity");
      for (let i = 0; i < 8; i++) e.resolve(e.draw(), true, 0.5);
      seen.add(e.startSession().rule);
    }
    // с третьего правила доступны и трудные
    expect(seen.has("digits") || seen.has("shape")).toBe(true);
  });

  it("blitz never ends by rule count and keeps the 8-card rule length", () => {
    const e = new SortEngine(9, () => 0.3, "blitz");
    expect(e.cardsTotal).toBe(0);
    for (let i = 0; i < 80; i++) {
      e.resolve(e.draw(), true, 0.5);
      expect(e.gameDone()).toBe(false);
      if (e.sessionDone()) e.startSession();
    }
  });

  it("blitz fall time scales with the rule weight", () => {
    const e = new SortEngine(10, () => 0.3, "blitz");
    expect(e.fallMs()).toBe(5000);
    while (e.session.rule !== "digits") e.startSession();
    expect(e.fallMs()).toBe(Math.round(5 * ruleTimeFactor("digits", "blitz") * 1000));
    expect(e.fallMs()).toBeGreaterThanOrEqual(6500);
  });

  it("pickRule with a weight cap never returns heavier rules", () => {
    const rand = seeded(12);
    for (let i = 0; i < 500; i++) {
      const r = pickRule(rand, () => 0.3, "parity", RAMP_MAX_WEIGHT);
      expect(RULE_WEIGHT[r]).toBeLessThanOrEqual(RAMP_MAX_WEIGHT);
      expect(r).not.toBe("parity");
    }
  });
});
