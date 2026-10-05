import { describe, expect, it } from "vitest";
import {
  CASE_STRIP_LENGTH,
  CASE_WIN_INDEX,
  casesForLevelUp,
  claimLevelCase,
  pickPrizeId,
  prizeOf,
  queueCases,
  rollLevelCase,
  type CaseState,
} from "@/lib/level-case";
import { LEVEL_CASE_WEIGHTS, MINUTE, PLAN_FEATURES, START_HEARTS, START_WALLET, type CasePrizeId } from "@/lib/economy";
import { MAX_PENDING_CASES } from "@/lib/rewards-state";
import { levelInfo } from "@/lib/gamification";

const NOW = 1_800_000_000_000;
const TODAY = "2026-10-05";
const MAX = PLAN_FEATURES.free.maxHearts;

const base = (over: Partial<CaseState> = {}): CaseState => ({
  xp: 120,
  wallet: { ...START_WALLET },
  hearts: { count: MAX, updatedAt: NOW, day: TODAY },
  boost: null,
  ledger: [],
  pendingCases: [2],
  ...over,
});
const ctx = { now: NOW, today: TODAY, tier: "free" as const, ledgerId: "L1" };

describe("rollLevelCase", () => {
  it("детерминирован по (уровень, seed)", () => {
    expect(rollLevelCase(3, 12345)).toEqual(rollLevelCase(3, 12345));
    expect(rollLevelCase(3, 12345)).not.toEqual(rollLevelCase(4, 12345));
  });

  it("приз стоит на позиции победителя в ленте, лента нужной длины", () => {
    for (let seed = 0; seed < 50; seed++) {
      const r = rollLevelCase(2, seed);
      expect(r.strip).toHaveLength(CASE_STRIP_LENGTH);
      expect(r.strip[CASE_WIN_INDEX]).toEqual(r.prize);
      expect(r.landing).toBeGreaterThanOrEqual(0.15);
      expect(r.landing).toBeLessThanOrEqual(0.85);
    }
  });

  it("распределение близко к весам", () => {
    const N = 20000;
    const counts: Record<string, number> = {};
    for (let seed = 1; seed <= N; seed++) {
      const id = rollLevelCase(2, seed * 7919).prize.id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    const total = Object.values(LEVEL_CASE_WEIGHTS).reduce((a, b) => a + b, 0);
    for (const id of Object.keys(LEVEL_CASE_WEIGHTS) as CasePrizeId[]) {
      const expected = LEVEL_CASE_WEIGHTS[id] / total;
      expect(Math.abs((counts[id] ?? 0) / N - expected)).toBeLessThan(0.02);
    }
  });

  it("pickPrizeId: границы [0, 1) покрывают все призы", () => {
    expect(pickPrizeId(0)).toBe("xp50");
    expect(pickPrizeId(0.999999)).toBe("boost");
  });

  it("полные сердечки: «все сердечки» заменяются чипами 15, и в ленте тоже", () => {
    let sawSwap = false;
    for (let seed = 1; seed <= 400; seed++) {
      const r = rollLevelCase(2, seed, true);
      expect(r.strip.some((p) => p.kind === "hearts")).toBe(false);
      if (r.prize.id === "chips15") {
        sawSwap = true;
        expect(r.prize).toEqual(prizeOf("chips15"));
        expect(r.prize.amount).toBe(15);
      }
    }
    expect(sawSwap).toBe(true);
    // без замены сердечки встречаются
    expect(Array.from({ length: 400 }, (_, i) => rollLevelCase(2, i + 1).prize.kind)).toContain("hearts");
  });
});

describe("очередь кейсов", () => {
  it("casesForLevelUp: по кейсу на каждый достигнутый уровень, первый уровень без кейса", () => {
    expect(casesForLevelUp(1, 2)).toEqual([2]);
    expect(casesForLevelUp(1, 4)).toEqual([2, 3, 4]);
    expect(casesForLevelUp(3, 3)).toEqual([]);
    expect(casesForLevelUp(0, 1)).toEqual([]);
  });

  it("совпадает с levelInfo: 100 XP — уровень 2", () => {
    expect(casesForLevelUp(levelInfo(99).level, levelInfo(100).level)).toEqual([2]);
    expect(casesForLevelUp(levelInfo(100).level, levelInfo(250).level)).toEqual([]);
  });

  it("queueCases: без повторов, по возрастанию, не больше лимита", () => {
    expect(queueCases([2], [2, 3])).toEqual([2, 3]);
    expect(queueCases([], [])).toEqual([]);
    const many = queueCases([], Array.from({ length: 12 }, (_, i) => i + 2));
    expect(many).toHaveLength(MAX_PENDING_CASES);
    expect(many[many.length - 1]).toBe(13);
  });
});

describe("claimLevelCase", () => {
  const prizeSeeds = (kind: string, heartsMissing = false) => {
    for (let seed = 1; seed < 5000; seed++) {
      const r = rollLevelCase(2, seed, !heartsMissing);
      if (r.prize.kind === kind) return seed;
    }
    throw new Error(`нет seed для ${kind}`);
  };

  it("нет такого кейса — null и состояние не трогаем", () => {
    expect(claimLevelCase(base({ pendingCases: [] }), 2, 1, ctx)).toBeNull();
    expect(claimLevelCase(base({ pendingCases: [3] }), 2, 1, ctx)).toBeNull();
  });

  it("кейс убирается из очереди; повторное открытие невозможно", () => {
    const first = claimLevelCase(base({ pendingCases: [2, 3] }), 2, 7, ctx)!;
    expect(first.state.pendingCases).toEqual([3]);
    expect(claimLevelCase(first.state, 2, 7, ctx)).toBeNull();
  });

  it("опыт: прибавляется к xp, новых кейсов не порождает (очередь не растёт)", () => {
    const seed = prizeSeeds("xp");
    const s = base({ xp: 290 });
    const c = claimLevelCase(s, 2, seed, ctx)!;
    expect(c.roll.prize.kind).toBe("xp");
    expect(c.state.xp).toBe(290 + c.roll.prize.amount);
    // уровень мог вырасти от приза, но кейс за него не появился
    expect(c.state.pendingCases).toEqual([]);
    expect(c.state.wallet).toEqual(s.wallet);
  });

  it("чипы: кошелёк и история; сердечки и бустер не тронуты", () => {
    const seed = prizeSeeds("chips");
    const s = base();
    const c = claimLevelCase(s, 2, seed, ctx)!;
    const n = c.roll.prize.amount;
    expect(c.state.wallet.chips).toBe(s.wallet.chips + n);
    expect(c.state.wallet.earned).toBe(s.wallet.earned + n);
    expect(c.state.ledger[0]).toMatchObject({ id: "L1", amount: n, reason: "case" });
    expect(c.state.boost).toBeNull();
  });

  it("сердечки: не полные — восстанавливаются до максимума", () => {
    const seed = prizeSeeds("hearts", true);
    const s = base({ hearts: { count: 1, updatedAt: NOW, day: TODAY } });
    const c = claimLevelCase(s, 2, seed, ctx)!;
    expect(c.roll.prize.kind).toBe("hearts");
    expect(c.state.hearts.count).toBe(MAX);
  });

  it("сердечки полные: вместо них 15 чипов", () => {
    // seed, который при неполных сердечках дал бы hearts
    const seed = prizeSeeds("hearts", true);
    const c = claimLevelCase(base(), 2, seed, ctx)!;
    expect(c.roll.prize).toEqual(prizeOf("chips15"));
    expect(c.state.wallet.chips).toBe(START_WALLET.chips + 15);
    expect(c.state.hearts).toEqual(base().hearts);
  });

  it("бустер ×2 на 15 минут", () => {
    const seed = prizeSeeds("boost");
    const c = claimLevelCase(base(), 2, seed, ctx)!;
    expect(c.state.boost).toEqual({ mult: 2, until: NOW + 15 * MINUTE });
  });

  it("безлимитные сердечки считаются полными", () => {
    const seed = prizeSeeds("hearts", true);
    const c = claimLevelCase(base(), 2, seed, { ...ctx, tier: "unlimited" })!;
    expect(c.roll.prize.id).toBe("chips15");
  });
});

describe("стартовые сердечки", () => {
  it("START_HEARTS полон (проверка допущения тестов)", () => {
    expect(START_HEARTS.count).toBe(MAX);
  });
});
