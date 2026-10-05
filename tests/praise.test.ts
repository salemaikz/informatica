import { describe, expect, it } from "vitest";
import { BASE_PRAISE, COMBO_PRAISE, comboTier, pickPraise } from "@/lib/praise";
import { praiseDict } from "@/i18n/parts/praise";

describe("praise", () => {
  it("ключи praise.* есть в словаре, ru и kk заполнены", () => {
    for (const k of [...BASE_PRAISE, ...COMBO_PRAISE].filter((x) => x.startsWith("praise."))) {
      const e = (praiseDict as Record<string, { ru: string; kk: string }>)[k];
      expect(e?.ru, k).toBeTruthy();
      expect(e?.kk, k).toBeTruthy();
    }
  });
  it("не повторяет прошлую фразу", () => {
    for (let i = 0; i < 20; i++) expect(pickPraise(0, "praise.1", i / 20)).not.toBe("praise.1");
  });
  it("при комбо есть огненные фразы", () => {
    const set = new Set(Array.from({ length: 30 }, (_, i) => pickPraise(5, null, i / 30)));
    expect([...set].some((k) => k.startsWith("praise.combo"))).toBe(true);
  });
  it("ступени комбо", () => {
    expect([0, 2, 3, 4, 5, 9, 10, 30].map(comboTier)).toEqual([0, 0, 3, 3, 5, 5, 10, 10]);
  });
});
