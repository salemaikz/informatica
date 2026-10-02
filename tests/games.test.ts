import { describe, expect, it } from "vitest";
import { gameReward } from "@/lib/games";

const result = (correct: number, total: number, score = correct * 10) => ({
  score,
  correct,
  total,
  attempts: Array.from({ length: total }, (_, i) => ({ skill: i % 2 ? "ns.bin2dec" : "ns.dec2bin", correct: i < correct })),
});

describe("награды мини-игр", () => {
  it("XP ограничен сверху и бонус за рекорд — только при наличии прошлого рекорда", () => {
    expect(gameReward(result(5, 6), undefined)).toMatchObject({ xp: 10, newBest: true });
    expect(gameReward(result(40, 40), 100).xp).toBe(30 + 5);
    expect(gameReward(result(3, 5, 30), 50)).toMatchObject({ xp: 6, newBest: false });
  });
  it("освоение — доля верных по навыку, только если действий ≥ 3", () => {
    const r = gameReward(result(4, 6), undefined);
    expect(r.skillScores["ns.dec2bin"]).toBeCloseTo(2 / 3);
    expect(Object.keys(gameReward(result(2, 2), undefined).skillScores)).toHaveLength(0);
  });
});
