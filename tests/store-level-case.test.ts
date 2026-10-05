import { beforeEach, describe, expect, it } from "vitest";
import { caseAllowedPath, caseBlockedPath } from "@/components/rewards/CaseAgent";
import { levelInfo } from "@/lib/gamification";
import { rollLevelCase, type CasePrize } from "@/lib/level-case";
import { useApp } from "@/lib/store";
import type { AnswerRecord } from "@/lib/types";

const right = (stepId: string): AnswerRecord => ({
  stepId,
  skill: "ns.dec2bin",
  correct: true,
  score: 1,
  given: "1",
  expected: "1",
  prompt: "?",
  retry: false,
  timeMs: 1000,
});

describe("стор: кейс за уровень", () => {
  beforeEach(() => useApp.getState().resetProgress());

  it("рост опыта до нового уровня добавляет кейс в очередь; внутри уровня — нет", () => {
    const s = useApp.getState();
    s.recordAnswer(right("a"), 50);
    expect(useApp.getState().pendingCases).toEqual([]);
    s.recordAnswer(right("b"), 60); // 110 XP — уровень 2
    expect(useApp.getState().pendingCases).toEqual([2]);
    s.recordAnswer(right("c"), 20);
    expect(useApp.getState().pendingCases).toEqual([2]);
  });

  it("за несколько уровней сразу — по кейсу на уровень", () => {
    useApp.getState().recordAnswer(right("a"), 310); // уровни 2 и 3
    expect(useApp.getState().pendingCases).toEqual([2, 3]);
  });

  /** Подбирает seed, при котором на уровне level (сердечки полные) выпадает нужный приз. */
  const seedFor = (level: number, want: (p: CasePrize) => boolean): number => {
    for (let seed = 1; seed < 5000; seed++) if (want(rollLevelCase(level, seed, true).prize)) return seed;
    throw new Error("seed не найден");
  };

  it("openLevelCase: выдаёт чипы, убирает кейс, нового кейса не создаёт; повтор — null", () => {
    useApp.getState().recordAnswer(right("a"), 290); // уровень 2, до уровня 3 осталось 10 XP
    const seed = seedFor(2, (p) => p.id === "chips20");
    const before = useApp.getState();
    const roll = useApp.getState().openLevelCase(2, seed);
    expect(roll!.prize.id).toBe("chips20");
    const after = useApp.getState();
    expect(after.pendingCases).toEqual([]);
    expect(after.wallet.chips).toBe(before.wallet.chips + 20);
    expect(after.xp).toBe(before.xp);
    expect(useApp.getState().openLevelCase(2, seed)).toBeNull();
  });

  it("openLevelCase: бустер включается", () => {
    useApp.getState().recordAnswer(right("a"), 150);
    const roll = useApp.getState().openLevelCase(2, seedFor(2, (p) => p.kind === "boost"));
    expect(roll!.prize.kind).toBe("boost");
    expect(useApp.getState().boost).not.toBeNull();
    expect(useApp.getState().pendingCases).toEqual([]);
  });

  it("кейс не порождает кейс: приз XP переводит уровень, но очередь остаётся пустой; кейс даёт только следующий обычный рост", () => {
    useApp.getState().recordAnswer(right("a"), 290); // 290 XP: уровень 2, до уровня 3 — 10 XP
    expect(levelInfo(useApp.getState().xp).level).toBe(2);
    const seed = seedFor(2, (p) => p.id === "xp100");
    const roll = useApp.getState().openLevelCase(2, seed);
    expect(roll!.prize.id).toBe("xp100");
    expect(useApp.getState().xp).toBe(390);
    expect(levelInfo(390).level).toBe(3);
    expect(useApp.getState().pendingCases).toEqual([]); // уровень 3 достигнут призом — кейса за него нет
    useApp.getState().recordAnswer(right("b"), 5); // обычное начисление внутри уровня 3 — кейса тоже нет
    expect(useApp.getState().pendingCases).toEqual([]);
    const lvl4 = useApp.getState().xp;
    useApp.getState().recordAnswer(right("c"), 600 - lvl4); // дорастаем до уровня 4 обычным путём — кейс есть
    expect(levelInfo(useApp.getState().xp).level).toBeGreaterThanOrEqual(4);
    expect(useApp.getState().pendingCases).toEqual([4]);
  });

  it("опыт из приза засчитывает достижение xp_500 сразу", () => {
    useApp.getState().recordAnswer(right("a"), 480);
    expect(useApp.getState().achievements.xp_500).toBeUndefined();
    const seed = seedFor(2, (p) => p.id === "xp50");
    useApp.getState().openLevelCase(2, seed);
    expect(useApp.getState().xp).toBe(530);
    expect(useApp.getState().achievements.xp_500).toBeDefined();
    expect(useApp.getState().newAchievements).toContain("xp_500");
  });
});

describe("агент кейса: где кейс открывается сам", () => {
  it("только карта, профиль, статистика", () => {
    for (const p of ["/learn", "/profile", "/stats"]) expect(caseAllowedPath(p)).toBe(true);
  });
  it("занятые страницы, в том числе чат-наставник с квизом, — нет", () => {
    for (const p of ["/tutor", "/tutor/abc", "/lesson/x", "/drill/y", "/exam", "/game/z", "/code", "/plans", "/practice", "/onboarding", "/r/abc", "/unknown"]) {
      expect(caseBlockedPath(p)).toBe(true);
    }
  });
});
