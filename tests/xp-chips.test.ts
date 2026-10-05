import { describe, expect, it } from "vitest";
import { chipsEstimate, lessonXpMax, xpChipRate } from "@/components/economy/xp-chips";

describe("xp-chips", () => {
  it("курс чипов берётся из экономики", () => {
    expect(xpChipRate()).toEqual({ xp: 5, n: 2 });
    expect(chipsEstimate(100)).toBe(40);
  });
  it("максимум XP за урок: повтор без бонусов", () => {
    expect(lessonXpMax(16, 1)).toBe(8 * 10 + 40);
    expect(lessonXpMax(16, 0.5)).toBe(40);
  });
});
