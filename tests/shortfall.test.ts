import { describe, expect, it } from "vitest";
import { CHIP_PACKS, FREE_PLAN, HOUR, START_HEARTS, TRIAL_DAYS, DAY, type HeartsView, type Plan } from "@/lib/economy";
import { packFor, shortfallOptions } from "@/components/economy/shortfall";

// Чистая логика окна «Не хватает» (этап 16Г, пакет C).

const NOW = 1_800_000_000_000;
const view = (count: number, over: Partial<HeartsView> = {}): HeartsView => ({ count, max: 5, unlimited: false, nextAt: count < 5 ? NOW + HOUR : null, ...over });
const UNLIM: Plan = { tier: "unlimited", until: NOW + 10 * DAY };

describe("packFor: наименьший набор чипов, закрывающий нехватку", () => {
  it("нечего добирать — набора нет", () => {
    expect(packFor(0)).toBeNull();
    expect(packFor(-5)).toBeNull();
  });
  it("берёт наименьший набор, которого хватает", () => {
    expect(packFor(40)?.id).toBe(CHIP_PACKS[0].id);
    expect(packFor(100)?.id).toBe(CHIP_PACKS[0].id);
    expect(packFor(101)?.chips).toBe(300);
    expect(packFor(700)?.chips).toBe(750);
  });
  it("не хватает ни одному — самый большой", () => {
    expect(packFor(1_000_000)?.chips).toBe(Math.max(...CHIP_PACKS.map((p) => p.chips)));
  });
});

describe("shortfallOptions: сердечки", () => {
  it("0 сердечек, 20 чипов: все три покупки, ни одна не по карману, набор чипов покрывает самую дешёвую", () => {
    const o = shortfallOptions({ need: "hearts", cost: 1, chips: 20, hearts: view(0), plan: FREE_PLAN, now: NOW });
    expect(o.heartItems.map((h) => [h.id, h.ok])).toEqual([
      ["heart-1", false],
      ["hearts-3", false],
      ["hearts-full", false],
    ]);
    expect(o.heartItems[0].missing).toBe(40);
    expect(o.missingChips).toBe(40);
    expect(o.pack?.chips).toBe(100);
    expect(o.refill).toBe(true);
    expect(o.plan).toBe(true);
    expect(o.trial).toBe(true);
    expect(o.waitUntil).toBe(NOW + HOUR);
  });

  it("чипов хватает на сердечко — набор чипов не предлагаем", () => {
    const o = shortfallOptions({ need: "hearts", cost: 1, chips: 80, hearts: view(0), plan: FREE_PLAN, now: NOW });
    expect(o.heartItems[0]).toEqual({ id: "heart-1", ok: true, missing: 0 });
    expect(o.missingChips).toBe(0);
    expect(o.pack).toBeNull();
  });

  it("продаём только недостающие: запас 4 из 5 — только одно сердечко; тройка и «полный запас» не помещаются", () => {
    const o = shortfallOptions({ need: "hearts", cost: 2, chips: 0, hearts: view(4), plan: FREE_PLAN, now: NOW });
    expect(o.heartItems.map((h) => h.id)).toEqual(["heart-1"]);
  });

  it("запас полон — покупать нечего, пополнения нет", () => {
    const o = shortfallOptions({ need: "hearts", cost: 1, chips: 500, hearts: view(5), plan: FREE_PLAN, now: NOW });
    expect(o.heartItems).toEqual([]);
    expect(o.refill).toBe(false);
  });

  it("«Безлимит»: нет ни покупок, ни пополнения, ни предложения тарифа, ни ожидания", () => {
    const o = shortfallOptions({ need: "hearts", cost: 1, chips: 0, hearts: view(0, { unlimited: true, max: Infinity, nextAt: null }), plan: UNLIM, now: NOW });
    expect(o.heartItems).toEqual([]);
    expect(o.refill).toBe(false);
    expect(o.plan).toBe(false);
    expect(o.trial).toBe(false);
    expect(o.waitUntil).toBeNull();
  });

  it("пробный период предлагаем один раз", () => {
    const used: Plan = { ...FREE_PLAN, trialUsed: true };
    expect(shortfallOptions({ need: "hearts", cost: 1, chips: 0, hearts: view(0), plan: used, now: NOW }).trial).toBe(false);
    expect(TRIAL_DAYS).toBeGreaterThan(0);
  });
});

describe("shortfallOptions: чипы", () => {
  it("нет сердечек-покупок и пополнения; набор закрывает нехватку", () => {
    const o = shortfallOptions({ need: "chips", cost: 120, chips: 20, hearts: view(START_HEARTS.count), plan: FREE_PLAN, now: NOW });
    expect(o.heartItems).toEqual([]);
    expect(o.refill).toBe(false);
    expect(o.waitUntil).toBeNull();
    expect(o.missingChips).toBe(100);
    expect(o.pack?.chips).toBe(100);
  });
  it("нехватка больше сотни — набор побольше", () => {
    const o = shortfallOptions({ need: "chips", cost: 500, chips: 0, hearts: view(5), plan: FREE_PLAN, now: NOW });
    expect(o.pack?.chips).toBe(750);
  });
  it("«Безлимит» (платный тариф) — тариф не предлагаем; бесплатный и Lite — предлагаем", () => {
    expect(shortfallOptions({ need: "chips", cost: 10, chips: 0, hearts: view(5), plan: UNLIM, now: NOW }).plan).toBe(false);
    expect(shortfallOptions({ need: "chips", cost: 10, chips: 0, hearts: view(5), plan: { tier: "lite", until: NOW + DAY }, now: NOW }).plan).toBe(true);
    expect(shortfallOptions({ need: "chips", cost: 10, chips: 0, hearts: view(5), plan: FREE_PLAN, now: NOW }).plan).toBe(true);
  });
  it("хватает чипов — нехватки и набора нет", () => {
    const o = shortfallOptions({ need: "chips", cost: 5, chips: 20, hearts: view(5), plan: FREE_PLAN, now: NOW });
    expect(o.missingChips).toBe(0);
    expect(o.pack).toBeNull();
  });
});
