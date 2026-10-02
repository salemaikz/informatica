import { describe, expect, it } from "vitest";
import { shopItem, type HeartsView } from "@/lib/economy";
import { dayDiff, formatClock, formatCompact, formatMult, formatNum, formatRemaining, formatSpan, heartWaitMs, heartsGain, knownAiKind, knownShopId, shopAvailability } from "@/components/economy/shop-helpers";

const view = (count: number, max = 5, extra: Partial<HeartsView> = {}): HeartsView => ({ count, max, unlimited: false, nextAt: count < max ? 1000 : null, ...extra });
const UNLIMITED: HeartsView = { count: Infinity, max: Infinity, unlimited: true, nextAt: null };

describe("formatRemaining", () => {
  it("минуты, часы, дни", () => {
    expect(formatRemaining(12 * 60_000, "ru")).toBe("12 мин");
    expect(formatRemaining(80 * 60_000, "ru")).toBe("1 ч 20 мин");
    expect(formatRemaining(2 * 3_600_000, "ru")).toBe("2 ч");
    expect(formatRemaining(80 * 60_000, "kk")).toBe("1 сағ 20 мин");
    expect(formatRemaining(3 * 86_400_000, "ru")).toBe("3 дня");
  });
  it("меньше минуты округляется вверх, ноль — «< 1 мин»", () => {
    expect(formatRemaining(10_000, "ru")).toBe("1 мин");
    expect(formatRemaining(0, "ru")).toBe("< 1 мин");
    expect(formatRemaining(-5, "ru")).toBe("< 1 мин");
  });
});

describe("форматы", () => {
  it("множитель с запятой", () => {
    expect(formatMult(2)).toBe("×2");
    expect(formatMult(1.5)).toBe("×1,5");
  });
  it("число с разрядами", () => {
    expect(formatNum(1250)).toBe("1 250");
    expect(formatNum(40)).toBe("40");
  });
  it("длительность бустера", () => {
    expect(formatSpan(24, "ru")).toBe("24 ч");
    expect(formatSpan(168, "ru")).toBe("7 дней");
    expect(formatSpan(168, "kk")).toBe("7 күн");
  });
  it("время записи", () => {
    expect(formatClock(new Date(2026, 9, 2, 9, 5).getTime())).toBe("09:05");
  });
});

describe("shopAvailability", () => {
  const heart = shopItem("heart-1")!;
  const full = shopItem("hearts-full")!;
  const boost = shopItem("boost-15")!;

  it("хватает чипов и есть что восстановить — можно", () => {
    expect(shopAvailability(heart, view(3), 100)).toEqual({ ok: true });
    expect(shopAvailability(full, view(0), 150)).toEqual({ ok: true });
  });
  it("запас полный — нельзя, даже если чипов мало", () => {
    expect(shopAvailability(heart, view(5), 0)).toEqual({ ok: false, reason: "full" });
  });
  it("безлимит — нельзя", () => {
    expect(shopAvailability(full, UNLIMITED, 999)).toEqual({ ok: false, reason: "unlimited" });
  });
  it("не хватает чипов — считает, сколько", () => {
    expect(shopAvailability(full, view(1), 120)).toEqual({ ok: false, reason: "chips", missing: 30 });
  });
  it("бустер не зависит от сердечек", () => {
    expect(shopAvailability(boost, view(5), 60)).toEqual({ ok: true });
    expect(shopAvailability(boost, UNLIMITED, 10)).toEqual({ ok: false, reason: "chips", missing: 50 });
  });
});

describe("прочее", () => {
  it("сколько сердечек даст товар", () => {
    expect(heartsGain(shopItem("heart-1")!, view(2))).toBe(1);
    expect(heartsGain(shopItem("hearts-full")!, view(2))).toBe(3);
    expect(heartsGain(shopItem("hearts-full")!, UNLIMITED)).toBe(0);
    expect(heartsGain(shopItem("boost-15")!, view(2))).toBe(0);
  });
  it("ожидание сердечка", () => {
    expect(heartWaitMs(view(2), 400)).toBe(600);
    expect(heartWaitMs(view(5), 400)).toBe(0);
    expect(heartWaitMs(view(2), 5000)).toBe(0);
  });
  it("note из истории — только известные значения", () => {
    expect(knownShopId("boost-60")).toBe("boost-60");
    expect(knownShopId("<script>")).toBeUndefined();
    expect(knownAiKind("photo")).toBe("photo");
    expect(knownAiKind("zzz")).toBeUndefined();
  });
  it("разница календарных дней", () => {
    const now = new Date(2026, 9, 2, 1, 0).getTime();
    expect(dayDiff(new Date(2026, 9, 2, 0, 5).getTime(), now)).toBe(0);
    expect(dayDiff(new Date(2026, 9, 1, 23, 50).getTime(), now)).toBe(1);
    expect(dayDiff(new Date(2026, 8, 20).getTime(), now)).toBe(12);
  });
});


describe("formatCompact (значок чипов в шапке)", () => {
  it("до 9 999 — с пробелами, дальше — K", () => {
    expect(formatCompact(235)).toBe("235");
    expect(formatCompact(9999)).toBe("9 999");
    expect(formatCompact(12345)).toBe("12,3K");
    expect(formatCompact(10000)).toBe("10K");
    expect(formatCompact(123456)).toBe("123K");
  });
});
