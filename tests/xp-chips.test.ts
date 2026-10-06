import { describe, expect, it } from "vitest";
import { chipsEstimate, chipsKey, lessonXpMax } from "@/components/economy/xp-chips";

describe("xp-chips", () => {
  it("оценка чипов за урок: 2 за первое прохождение, 0 за повтор, множитель сверху", () => {
    expect(chipsEstimate(false)).toBe(2);
    expect(chipsEstimate(true)).toBe(0);
    expect(chipsEstimate(false, 2)).toBe(4);
    expect(chipsEstimate(true, 1.5)).toBe(0);
  });
  it("максимум XP за урок: повтор без бонусов", () => {
    // 8 заданий: 80 + комбо 6·5 + прохождение 20 + «идеально» 20
    expect(lessonXpMax(16, 1)).toBe(150);
    // повтор: «идеально» не даётся, остальное — по множителю
    expect(lessonXpMax(16, 0.5, true)).toBe(Math.round(80 * 0.5) + Math.round(30 * 0.5) + Math.round(20 * 0.5));
  });
  it("бустер «Опыт ×2» удваивает оценку «до +N XP» (#122)", () => {
    expect(lessonXpMax(16, 1, false, 2)).toBe(300);
    expect(lessonXpMax(16, 0.5, true, 2)).toBe(2 * lessonXpMax(16, 0.5, true));
    expect(lessonXpMax(16, 1, false, 1)).toBe(lessonXpMax(16, 1));
  });
  it("склонение ключей чипов", () => {
    expect(chipsKey("xp.chipsPlus", 1)).toBe("xp.chipsPlus.one");
    expect(chipsKey("xp.chipsPlus", 4)).toBe("xp.chipsPlus.few");
    expect(chipsKey("xp.chipsPlus", 22)).toBe("xp.chipsPlus.few");
    expect(chipsKey("xp.chipsPlus", 11)).toBe("xp.chipsPlus.many");
    expect(chipsKey("econ16c.drop.chips", 3)).toBe("econ16c.drop.chips.few");
  });
});
