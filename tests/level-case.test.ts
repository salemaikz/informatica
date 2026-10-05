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
import { COSMETICS, cosmeticDef, sanitizeCosmetics, type CosmeticId } from "@/lib/cosmetics";
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
  cosmetics: sanitizeCosmetics(null),
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
    // boost — предпоследний (вес 8 из 110), украшение — последнее (вес 10)
    expect(pickPrizeId(99 / 110)).toBe("boost");
    expect(pickPrizeId(0.999999)).toBe("cosmetic");
  });

  it("веса: украшение 10, сумма 110, остальные не менялись", () => {
    expect(LEVEL_CASE_WEIGHTS.cosmetic).toBe(10);
    expect(Object.values(LEVEL_CASE_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(110);
    expect(LEVEL_CASE_WEIGHTS).toMatchObject({ xp50: 24, xp100: 8, hearts: 18, chips10: 22, chips20: 14, chips30: 6, boost: 8 });
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

describe("приз «украшение»", () => {
  const OWNED_ALL_RARE = COSMETICS.filter((c) => c.rarity !== "common").map((c) => c.id);

  /** Первый seed, при котором выпадает украшение (сердечки полные, у ученика пусто / есть owned). */
  const cosmeticSeed = (owned: CosmeticId[] = []): number => {
    for (let seed = 1; seed < 20000; seed++) if (rollLevelCase(2, seed, true, owned).prize.kind === "cosmetic") return seed;
    throw new Error("seed не найден");
  };

  it("выбор украшения — до анимации: приз несёт id, лента показывает тот же приз", () => {
    const seed = cosmeticSeed();
    const r = rollLevelCase(2, seed, true);
    expect(r.prize.kind).toBe("cosmetic");
    expect(r.prize.id).toBe("cosmetic");
    expect(r.prize.amount).toBe(0);
    const def = cosmeticDef(r.prize.cosmetic);
    expect(def).toBeDefined();
    expect(def!.rarity).not.toBe("common");
    expect(r.strip[CASE_WIN_INDEX]).toEqual(r.prize);
    // повтор с теми же входными — то же украшение
    expect(rollLevelCase(2, seed, true).prize).toEqual(r.prize);
  });

  it("не выпадает то, что уже есть (и в призе, и в ленте)", () => {
    const owned: CosmeticId[] = ["frame-neon", "frame-crown", "banner-night", "title-bug-hunter", "frame-orbit"];
    let seen = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const r = rollLevelCase(2, seed, true, owned);
      for (const p of [r.prize, ...r.strip]) {
        if (p.kind !== "cosmetic") continue;
        seen++;
        expect(owned).not.toContain(p.cosmetic);
      }
    }
    expect(seen).toBeGreaterThan(50);
  });

  it("всё редкое уже есть — вместо украшения чипы 30, в ленте тоже", () => {
    let swapped = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const r = rollLevelCase(2, seed, true, OWNED_ALL_RARE);
      expect([r.prize, ...r.strip].some((p) => p.kind === "cosmetic")).toBe(false);
      if (rollLevelCase(2, seed, true).prize.kind === "cosmetic") {
        // тот же seed без owned дал бы украшение, а здесь — чипы 30
        expect(r.prize).toEqual(prizeOf("chips30"));
        swapped++;
      }
    }
    expect(swapped).toBeGreaterThan(0);
  });

  it("prizeOf: cosmetic без id — чипы 30; с id — приз-украшение", () => {
    expect(prizeOf("cosmetic")).toEqual(prizeOf("chips30"));
    expect(prizeOf("cosmetic", "frame-neon")).toEqual({ id: "cosmetic", kind: "cosmetic", amount: 0, cosmetic: "frame-neon" });
  });

  it("доля украшений в кейсе близка к 10/110", () => {
    const N = 20000;
    let n = 0;
    for (let seed = 1; seed <= N; seed++) if (rollLevelCase(2, seed * 7919, true).prize.kind === "cosmetic") n++;
    expect(Math.abs(n / N - 10 / 110)).toBeLessThan(0.02);
  });

  it("claimLevelCase: украшение попадает в owned, не надевается; чипы, XP и история не тронуты", () => {
    const seed = cosmeticSeed();
    const s = base();
    const c = claimLevelCase(s, 2, seed, ctx)!;
    const id = c.roll.prize.cosmetic!;
    expect(c.roll.prize.kind).toBe("cosmetic");
    expect(c.state.cosmetics.owned).toEqual([id]);
    expect(c.state.cosmetics.equipped).toEqual({ frame: null, banner: null, title: null });
    expect(c.state.wallet).toEqual(s.wallet);
    expect(c.state.ledger).toEqual([]);
    expect(c.state.xp).toBe(s.xp);
    expect(c.state.pendingCases).toEqual([]);
    // исходное состояние не изменено
    expect(s.cosmetics.owned).toEqual([]);
  });

  it("claimLevelCase: уже надетое остаётся надетым, новое добавляется к имеющемуся", () => {
    const have = sanitizeCosmetics({ owned: ["frame-dots", "frame-wave"], equipped: { frame: "frame-wave" } });
    const seed = cosmeticSeed(have.owned);
    const c = claimLevelCase(base({ cosmetics: have }), 2, seed, ctx)!;
    expect(c.roll.prize.kind).toBe("cosmetic");
    expect(c.state.cosmetics.owned).toEqual(["frame-dots", "frame-wave", c.roll.prize.cosmetic]);
    expect(c.state.cosmetics.equipped.frame).toBe("frame-wave");
  });

  it("claimLevelCase: всё редкое уже есть — выдаются чипы 30 вместо украшения", () => {
    const have = sanitizeCosmetics({ owned: OWNED_ALL_RARE });
    const seed = cosmeticSeed(); // seed, на котором без owned выпало бы украшение
    const s = base({ cosmetics: have });
    const c = claimLevelCase(s, 2, seed, ctx)!;
    expect(c.roll.prize).toEqual(prizeOf("chips30"));
    expect(c.state.wallet.chips).toBe(s.wallet.chips + 30);
    expect(c.state.cosmetics.owned).toEqual(OWNED_ALL_RARE);
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
