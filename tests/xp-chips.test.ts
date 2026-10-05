import { describe, expect, it } from "vitest";
import { chipsEstimate, chipsKey, lessonXpMax, multSuffix, xpChipRate } from "@/components/economy/xp-chips";

describe("xp-chips", () => {
  it("курс чипов берётся из экономики", () => {
    expect(xpChipRate()).toEqual({ xp: 5, n: 2 });
    expect(chipsEstimate(100)).toBe(40);
  });
  it("максимум XP за урок: повтор без бонусов", () => {
    // 8 заданий: 80 + комбо 6·5 + прохождение 20 + «идеально» 20
    expect(lessonXpMax(16, 1)).toBe(150);
    // повтор: «идеально» не даётся, остальное — по множителю
    expect(lessonXpMax(16, 0.5, true)).toBe(Math.round(80 * 0.5) + Math.round(30 * 0.5) + Math.round(20 * 0.5));
  });
  it("склонение ключей чипов", () => {
    expect(chipsKey("xp.chipsPlus", 1)).toBe("xp.chipsPlus.one");
    expect(chipsKey("xp.chipsPlus", 4)).toBe("xp.chipsPlus.few");
    expect(chipsKey("xp.chipsPlus", 22)).toBe("xp.chipsPlus.few");
    expect(chipsKey("xp.chipsPlus", 11)).toBe("xp.chipsPlus.many");
    expect(multSuffix(1)).toBe("");
    expect(multSuffix(2)).toBe(" · ×2");
  });
});
