import { beforeEach, describe, expect, it } from "vitest";
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

  it("openLevelCase: выдаёт приз, убирает кейс, нового кейса не создаёт; повтор — null", () => {
    useApp.getState().recordAnswer(right("a"), 290); // уровень 2, до уровня 3 осталось 10 XP
    const before = useApp.getState();
    const roll = useApp.getState().openLevelCase(2, 4242);
    expect(roll).not.toBeNull();
    const after = useApp.getState();
    expect(after.pendingCases).toEqual([]);
    if (roll!.prize.kind === "xp") expect(after.xp).toBe(before.xp + roll!.prize.amount);
    if (roll!.prize.kind === "chips") expect(after.wallet.chips).toBe(before.wallet.chips + roll!.prize.amount);
    expect(useApp.getState().openLevelCase(2, 4242)).toBeNull();
  });
});
