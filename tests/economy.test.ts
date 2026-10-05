import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENT_CHIPS,
  AI_COST,
  AI_DAILY_CAP,
  AI_UNITS,
  BOOST_PACKS,
  CHIP_REWARD,
  CHIP_PACKS,
  DAY,
  HEART_PASSES,
  HOUR,
  LEDGER_MERGE_MS,
  MAX_LEDGER,
  MINUTE,
  PAYWALL_EVERY_DAYS,
  PLAN_FEATURES,
  PRICES,
  SHOP_ITEMS,
  START_HEARTS,
  START_WALLET,
  TRIAL_DAYS,
  WELCOME_CHIPS,
  addHearts,
  aiFreeLeft,
  applyAiUsage,
  boostActive,
  buyItem,
  canAfford,
  canStartTrial,
  chipMultiplier,
  lessonChips,
  earnAmount,
  effectiveTier,
  extendBoost,
  formatHearts,
  formatTenge,
  halfFloor,
  heartsNow,
  heartsView,
  ENTRY_COST,
  PERFECT_DROP,
  entryCost,
  itemPrice,
  lessonCost,
  REFILL_MIN_MISSING,
  refillPrice,
  spendHearts,
  packSaving,
  perMonthOfYear,
  planDaysLeft,
  pushLedger,
  quoteAi,
  refillHearts,
  refundAiUsage,
  sanitizeAiUsage,
  sanitizeBoost,
  sanitizeHearts,
  sanitizePaywall,
  sanitizePlan,
  sanitizeWallet,
  shouldShowPaywall,
  startTrial,
  usageToday,
  yearSaving,
  type AiReceipt,
  type AiUsage,
  type BuyState,
  type Hearts,
  type LedgerEntry,
  type Plan,
  type ShopItemId,
} from "@/lib/economy";

const T0 = 1_800_000_000_000;
const TODAY = "2027-01-15";

describe("тарифы и цены", () => {
  it("PLAN_FEATURES: запас, восстановление, ИИ, множитель", () => {
    expect(PLAN_FEATURES.free).toEqual({ maxHearts: 5, regenMs: 6 * HOUR, aiFree: 3, chipMultiplier: 1 });
    expect(PLAN_FEATURES.lite).toEqual({ maxHearts: 10, regenMs: 3 * HOUR, aiFree: 30, chipMultiplier: 1.5 });
    expect(PLAN_FEATURES.unlimited.maxHearts).toBe(Infinity);
    expect(PLAN_FEATURES.unlimited.aiFree).toBe(Infinity);
    expect(PLAN_FEATURES.unlimited.chipMultiplier).toBe(2);
  });

  it("PRICES: цены из запроса (1290/2590, год 9990/19990)", () => {
    expect(PRICES.lite).toEqual({ month: 1290, year: 9990 });
    expect(PRICES.unlimited).toEqual({ month: 2590, year: 19990 });
  });

  it("yearSaving: Лайт 5490 ₸ / 35%, Безлимит 11090 ₸ / 36%", () => {
    expect(yearSaving("lite")).toEqual({ amount: 5490, percent: 35 });
    expect(yearSaving("unlimited")).toEqual({ amount: 11090, percent: 36 });
  });

  it("perMonthOfYear: год делится на 12 с округлением", () => {
    expect(perMonthOfYear("lite")).toBe(833);
    expect(perMonthOfYear("unlimited")).toBe(1666);
  });

  it("formatTenge: пробелы между разрядами и знак ₸", () => {
    expect(formatTenge(0)).toBe("0 ₸");
    expect(formatTenge(390)).toBe("390 ₸");
    expect(formatTenge(1290)).toBe("1 290 ₸");
    expect(formatTenge(19990)).toBe("19 990 ₸");
    expect(formatTenge(1234567)).toBe("1 234 567 ₸");
    expect(formatTenge(832.6)).toBe("833 ₸");
  });
});

describe("effectiveTier / planDaysLeft", () => {
  it("пусто и free — free", () => {
    expect(effectiveTier(undefined, T0)).toBe("free");
    expect(effectiveTier({ tier: "free" }, T0)).toBe("free");
  });

  it("платный действует до until; на границе уже истёк", () => {
    const p: Plan = { tier: "lite", until: T0 + 1000 };
    expect(effectiveTier(p, T0)).toBe("lite");
    expect(effectiveTier(p, T0 + 999)).toBe("lite");
    expect(effectiveTier(p, T0 + 1000)).toBe("free");
    expect(effectiveTier(p, T0 + 5000)).toBe("free");
  });

  it("платный без until действует бессрочно", () => {
    expect(effectiveTier({ tier: "unlimited" }, T0 + 100 * DAY)).toBe("unlimited");
  });

  it("planDaysLeft: округление вверх, 0 для истёкшего и бесплатного", () => {
    expect(planDaysLeft({ tier: "unlimited", until: T0 + 2 * DAY }, T0)).toBe(2);
    expect(planDaysLeft({ tier: "unlimited", until: T0 + 2 * DAY - 1 }, T0)).toBe(2);
    expect(planDaysLeft({ tier: "unlimited", until: T0 + HOUR }, T0)).toBe(1);
    expect(planDaysLeft({ tier: "unlimited", until: T0 - 1 }, T0)).toBe(0);
    expect(planDaysLeft({ tier: "free" }, T0)).toBe(0);
    expect(planDaysLeft(undefined, T0)).toBe(0);
    expect(planDaysLeft({ tier: "lite" }, T0)).toBe(0);
  });
});

describe("пробный период", () => {
  it("startTrial: 7 дней Безлимита, один раз", () => {
    const p = startTrial({ tier: "free" }, T0);
    expect(p).toEqual({ tier: "unlimited", until: T0 + TRIAL_DAYS * DAY, trial: true, trialUsed: true });
    expect(effectiveTier(p, T0 + 6 * DAY)).toBe("unlimited");
    expect(effectiveTier(p, T0 + 7 * DAY)).toBe("free");
  });

  it("startTrial без тарифа работает как free", () => {
    expect(startTrial(undefined, T0).tier).toBe("unlimited");
  });

  it("повторно после окончания не даётся", () => {
    const first = startTrial({ tier: "free" }, T0);
    const later = T0 + 30 * DAY;
    expect(canStartTrial(first, later)).toBe(false);
    expect(startTrial(first, later)).toBe(first);
  });

  it("при действующем платном тарифе не меняет план", () => {
    const paid: Plan = { tier: "lite", period: "year", until: T0 + 100 * DAY };
    expect(canStartTrial(paid, T0)).toBe(false);
    expect(startTrial(paid, T0)).toBe(paid);
  });

  it("истёкший платный тариф без trialUsed пробный получить может", () => {
    const expired: Plan = { tier: "lite", period: "month", until: T0 - 1 };
    expect(canStartTrial(expired, T0)).toBe(true);
    expect(startTrial(expired, T0).tier).toBe("unlimited");
  });
});

describe("сердечки: heartsNow", () => {
  const h = (count: number, updatedAt: number, day = TODAY): Hearts => ({ count, updatedAt, day });

  it("суточного пополнения нет: новый день запас не восстанавливает", () => {
    // вчерашние сердечки остаются как есть, пока не пройдёт regenMs
    const y = h(1, T0, "2027-01-14");
    expect(heartsNow(y, "free", T0, TODAY)).toBe(y);
    expect(heartsNow(y, "free", T0 + HOUR, TODAY).count).toBe(1);
    expect(heartsNow(h(0, T0, "2027-01-14"), "lite", T0 + 2 * HOUR, TODAY).count).toBe(0);
  });

  it("восстановление идёт через границу суток: одно сердечко за regenMs", () => {
    // 23:00 вчера → 05:00 сегодня = ровно 6 ч, «день» в расчёте не участвует
    const evening = new Date("2027-01-14T23:00:00Z").getTime();
    const r = heartsNow(h(0, evening, "2027-01-14"), "free", evening + 6 * HOUR, TODAY);
    expect(r).toEqual({ count: 1, updatedAt: evening + 6 * HOUR, day: TODAY });
    // за сутки (24 ч) возвращается 4 сердечка (24 / 6 = 4), а не полный запас
    expect(heartsNow(h(0, evening, "2027-01-14"), "free", evening + DAY, TODAY).count).toBe(4);
  });

  it("восстановление по одному за regenMs (6 ч)", () => {
    expect(heartsNow(h(2, T0), "free", T0 + 6 * HOUR - 1, TODAY).count).toBe(2);
    expect(heartsNow(h(2, T0), "free", T0 + 6 * HOUR, TODAY).count).toBe(3);
    const r = heartsNow(h(2, T0), "free", T0 + 13 * HOUR, TODAY);
    expect(r.count).toBe(4);
    expect(r.updatedAt).toBe(T0 + 12 * HOUR);
  });

  it("у Лайта восстановление быстрее (3 ч) и запас 10", () => {
    expect(heartsNow(h(5, T0), "lite", T0 + 3 * HOUR - 1, TODAY).count).toBe(5);
    expect(heartsNow(h(5, T0), "lite", T0 + 3 * HOUR, TODAY).count).toBe(6);
    expect(heartsNow(h(5, T0), "lite", T0 + 6 * HOUR, TODAY).count).toBe(7);
    expect(heartsNow(h(5, T0), "lite", T0 + 100 * HOUR, TODAY).count).toBe(10);
  });

  it("стартовый запас: у бесплатного полный, Лайту при первом чтении докладывается до 10", () => {
    expect(heartsNow(START_HEARTS, "free", T0, TODAY)).toBe(START_HEARTS);
    expect(heartsNow(START_HEARTS, "lite", T0, TODAY)).toEqual({ count: 10, updatedAt: T0, day: TODAY });
  });

  it("не выше запаса; при полном — время обновляется", () => {
    const r = heartsNow(h(4, T0), "free", T0 + 20 * HOUR, TODAY);
    expect(r).toEqual({ count: 5, updatedAt: T0 + 20 * HOUR, day: TODAY });
  });

  it("полный запас возвращается как есть (та же ссылка)", () => {
    const full = h(5, T0);
    expect(heartsNow(full, "free", T0 + HOUR, TODAY)).toBe(full);
  });

  it("при понижении тарифа лишние сердечки срезаются до запаса", () => {
    const r = heartsNow(h(10, T0), "free", T0 + HOUR, TODAY);
    expect(r.count).toBe(5);
  });

  it("безлимит состояние не меняет", () => {
    const x = h(1, T0, "2020-01-01");
    expect(heartsNow(x, "unlimited", T0, TODAY)).toBe(x);
  });

  it("время назад не отнимает сердечки", () => {
    expect(heartsNow(h(2, T0), "free", T0 - HOUR, TODAY).count).toBe(2);
  });

  it("heartsView: nextAt = следующее восстановление; null при полном/безлимите", () => {
    const v = heartsView(h(3, T0), "free", T0 + HOUR, TODAY);
    expect(v).toEqual({ count: 3, max: 5, unlimited: false, nextAt: T0 + 6 * HOUR });
    expect(heartsView(h(3, T0), "lite", T0 + HOUR, TODAY).nextAt).toBe(T0 + 3 * HOUR);
    expect(heartsView(h(5, T0), "free", T0, TODAY).nextAt).toBeNull();
    const u = heartsView(START_HEARTS, "unlimited", T0, TODAY);
    expect(u.unlimited).toBe(true);
    expect(u.count).toBe(Infinity);
    expect(u.nextAt).toBeNull();
  });

  it("canAfford: хватает ли сердечек на вход (безлимит — всегда)", () => {
    expect(canAfford(heartsView(h(0, T0), "free", T0, TODAY), 1)).toBe(false);
    expect(canAfford(heartsView(h(1, T0), "free", T0, TODAY), 1)).toBe(true);
    expect(canAfford(heartsView(h(1, T0), "free", T0, TODAY), 2)).toBe(false);
    expect(canAfford(heartsView(h(2, T0), "free", T0, TODAY), 2)).toBe(true);
    expect(canAfford(heartsView(h(0, T0), "unlimited", T0, TODAY), 2)).toBe(true);
  });
});

describe("сердечки: spendHearts / addHearts / refill", () => {
  const h = (count: number, updatedAt: number, day = TODAY): Hearts => ({ count, updatedAt, day });

  it("с полного запаса таймер восстановления стартует с момента списания", () => {
    expect(spendHearts(h(5, T0 - 10 * HOUR), 1, "free", T0, TODAY)).toEqual({ count: 4, updatedAt: T0, day: TODAY });
    expect(spendHearts(h(5, T0 - 10 * HOUR), 2, "free", T0, TODAY)).toEqual({ count: 3, updatedAt: T0, day: TODAY });
  });

  it("не с полного — таймер не сбрасывается", () => {
    expect(spendHearts(h(3, T0), 1, "free", T0 + HOUR, TODAY)).toEqual({ count: 2, updatedAt: T0, day: TODAY });
  });

  it("не хватает — null (ничего не списывается), в том числе вход за 2 при одном сердечке", () => {
    expect(spendHearts(h(0, T0), 1, "free", T0 + HOUR, TODAY)).toBeNull();
    expect(spendHearts(h(1, T0), 2, "free", T0 + HOUR, TODAY)).toBeNull();
    expect(spendHearts(h(2, T0), 2, "free", T0 + HOUR, TODAY)?.count).toBe(0);
  });

  it("учитывает восстановленное перед списанием", () => {
    // 0 сердечек + 1 восстановилось (6 ч) = 1, минус 1 = 0
    expect(spendHearts(h(0, T0), 1, "free", T0 + 6 * HOUR, TODAY)?.count).toBe(0);
    expect(spendHearts(h(1, T0), 1, "free", T0 + 6 * HOUR, TODAY)?.count).toBe(1);
  });

  it("новый день запас не пополняет: вчерашний ноль остаётся нулём", () => {
    expect(spendHearts(h(0, T0, "2027-01-14"), 1, "free", T0, TODAY)).toBeNull();
    expect(spendHearts(h(2, T0, "2027-01-14"), 1, "free", T0 + HOUR, TODAY)?.count).toBe(1);
  });

  it("безлимит — без изменений (та же ссылка); цена 0 — ничего не списывается", () => {
    const x = h(3, T0);
    expect(spendHearts(x, 2, "unlimited", T0, TODAY)).toBe(x);
    expect(spendHearts(h(0, T0), 0, "free", T0, TODAY)?.count).toBe(0);
  });

  it("addHearts: прибавляет, не выше запаса, отрицательные игнорирует", () => {
    expect(addHearts(h(2, T0), 1, "free", T0, TODAY).count).toBe(3);
    expect(addHearts(h(2, T0), 1, "free", T0, TODAY).updatedAt).toBe(T0);
    expect(addHearts(h(4, T0), 5, "free", T0 + 1, TODAY)).toEqual({ count: 5, updatedAt: T0 + 1, day: TODAY });
    expect(addHearts(h(2, T0), -3, "free", T0, TODAY).count).toBe(2);
    // шаг 0,5: 1,9 → 1,5; 1,4 → 1
    expect(addHearts(h(2, T0), 1.9, "free", T0, TODAY).count).toBe(3.5);
    expect(addHearts(h(2, T0), 1.4, "free", T0, TODAY).count).toBe(3);
  });

  it("addHearts при безлимите — без изменений", () => {
    const x = h(2, T0);
    expect(addHearts(x, 1, "unlimited", T0, TODAY)).toBe(x);
  });

  it("refillHearts: полный запас по тарифу", () => {
    expect(refillHearts("free", T0, TODAY)).toEqual({ count: 5, updatedAt: T0, day: TODAY });
    expect(refillHearts("lite", T0, TODAY).count).toBe(10);
  });
});

describe("сердечки с шагом 0,5 (этап 15)", () => {
  const h = (count: number, updatedAt: number, day = TODAY): Hearts => ({ count, updatedAt, day });

  it("halfFloor: вниз до 0,5, целые не трогает", () => {
    expect(halfFloor(2)).toBe(2);
    expect(halfFloor(2.5)).toBe(2.5);
    expect(halfFloor(2.49)).toBe(2);
    expect(halfFloor(0.99)).toBe(0.5);
    expect(halfFloor(0.4)).toBe(0);
    expect(halfFloor(-1)).toBe(-1);
  });

  it("formatHearts: запятая и в русском, и в казахском; целые без дроби", () => {
    expect(formatHearts(4.5)).toBe("4,5");
    expect(formatHearts(0.5)).toBe("0,5");
    expect(formatHearts(5)).toBe("5");
    expect(formatHearts(0)).toBe("0");
    expect(formatHearts(4.9)).toBe("4,5");
    expect(formatHearts(Infinity)).toBe("∞");
  });

  it("теория 0,5: с полного запаса таймер стартует с момента списания, потом не сбрасывается", () => {
    const a = spendHearts(h(5, T0 - 10 * HOUR), 0.5, "free", T0, TODAY)!;
    expect(a).toEqual({ count: 4.5, updatedAt: T0, day: TODAY });
    const b = spendHearts(a, 0.5, "free", T0 + HOUR, TODAY)!;
    expect(b).toEqual({ count: 4, updatedAt: T0, day: TODAY });
  });

  it("не хватает 0,5 — null; ровно 0,5 — списывается до нуля; дробь цены округляется вниз до 0,5", () => {
    expect(spendHearts(h(0, T0), 0.5, "free", T0, TODAY)).toBeNull();
    expect(spendHearts(h(0.5, T0), 0.5, "free", T0, TODAY)?.count).toBe(0);
    expect(spendHearts(h(0.5, T0), 1, "free", T0, TODAY)).toBeNull();
    expect(spendHearts(h(3, T0), 0.7, "free", T0, TODAY)?.count).toBe(2.5);
  });

  it("восстановление — целыми: 4,5 + одно за 6 ч = 5 (потолок), 3,5 + одно = 4,5", () => {
    expect(heartsNow(h(4.5, T0), "free", T0 + 6 * HOUR, TODAY).count).toBe(5);
    expect(heartsNow(h(3.5, T0), "free", T0 + 6 * HOUR, TODAY).count).toBe(4.5);
    expect(heartsNow(h(0.5, T0), "free", T0 + 12 * HOUR, TODAY).count).toBe(2.5);
    // до срока — без изменений
    expect(heartsNow(h(3.5, T0), "free", T0 + 5 * HOUR, TODAY).count).toBe(3.5);
  });

  it("canAfford и heartsView с половинками", () => {
    const v = heartsView(h(0.5, T0), "free", T0, TODAY);
    expect(v.count).toBe(0.5);
    expect(canAfford(v, 0.5)).toBe(true);
    expect(canAfford(v, 1)).toBe(false);
    expect(v.nextAt).toBe(T0 + 6 * HOUR);
  });

  it("безлимит не тратит и половинки", () => {
    const x = h(3, T0);
    expect(spendHearts(x, 0.5, "unlimited", T0, TODAY)).toBe(x);
  });

  it("покупки целые: +1 при 4,5 из 5 даёт полный запас; полный запас считается по целым за каждое недостающее", () => {
    const state: BuyState = { wallet: { chips: 500, earned: 500, spent: 0 }, hearts: h(4.5, T0), boost: null };
    const bought = buyItem(state, "heart-1", "free", T0, TODAY);
    expect(bought.ok && bought.hearts.count).toBe(5);
    // 0,5 из 5: не хватает 4,5 → платим за 5 (вверх), а не за 4
    expect(refillPrice(4.5)).toBe(5 * 45);
    expect(refillPrice(0.5)).toBe(45);
    expect(refillPrice(4)).toBe(4 * 45);
    const refill = buyItem({ ...state, hearts: h(0.5, T0) }, "hearts-full", "free", T0, TODAY);
    expect(refill.ok && refill.wallet.chips).toBe(500 - 5 * 45);
    expect(refill.ok && refill.hearts.count).toBe(5);
  });
});

describe("плата за вход (#40)", () => {
  it("цены входа: урок, проверка, пробник, игра, тренировка — 1; контрольная и экстерн — 2; теория урока — 0,5", () => {
    expect(ENTRY_COST).toEqual({ lesson: 1, check: 1, exam: 1, checkpoint: 2, extern: 2, game: 1, theory: 0.5, drill: 1 });
    expect(entryCost("theory")).toBe(0.5);
    // этап 16В: любая тренировка стоит сердечко (решение F), у «урока игрой» цена урока не меняется
    expect(entryCost("drill")).toBe(1);
  });
  it("большой урок (hearts: 2) — 2; «урок игрой» стоит как урок", () => {
    expect(lessonCost(undefined)).toBe(1);
    expect(lessonCost({})).toBe(1);
    expect(lessonCost({ hearts: 2 })).toBe(2);
    expect(entryCost("lesson", { hearts: 2 })).toBe(2);
    expect(entryCost("game")).toBe(1);
    expect(entryCost("game", {})).toBe(1);
    expect(entryCost("game", { hearts: 2 })).toBe(2);
    // «Проверить себя» большого урока — как тест, 1
    expect(entryCost("check", { hearts: 2 })).toBe(1);
    expect(entryCost("checkpoint")).toBe(2);
  });
});

describe("магазин: buyItem", () => {
  const base = (over: Partial<BuyState> = {}): BuyState => ({
    wallet: { chips: 500, earned: 500, spent: 0 },
    hearts: { count: 2, updatedAt: T0, day: TODAY },
    boost: null,
    ...over,
  });
  const buy = (s: BuyState, id: ShopItemId, tier: "free" | "lite" | "unlimited" = "free", now = T0) => buyItem(s, id, tier, now, TODAY);

  const heartsAt = (count: number): Hearts => ({ count, updatedAt: T0, day: TODAY });
  const walletOf = (chips: number) => ({ chips, earned: chips, spent: 0 });

  it("heart-1: +1 сердечко за 60 чипов", () => {
    const r = buy(base(), "heart-1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.hearts.count).toBe(3);
    expect(r.wallet).toEqual({ chips: 440, earned: 500, spent: 60 });
    expect(r.boost).toBeNull();
  });

  it("hearts-3: +3 сердечка за 150 чипов (дешевле, чем по одному)", () => {
    const item = SHOP_ITEMS.find((i) => i.id === "hearts-3");
    expect(item).toMatchObject({ kind: "heart", price: 150, amount: 3 });
    const r = buy(base(), "hearts-3");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.hearts.count).toBe(5);
    expect(r.wallet).toEqual({ chips: 350, earned: 500, spent: 150 });
    // с пустого запаса: 0 → 3, таймер восстановления не сбрасывается
    const z = buy(base({ hearts: heartsAt(0) }), "hearts-3");
    expect(z.ok && z.hearts).toEqual({ count: 3, updatedAt: T0, day: TODAY });
  });

  it("hearts-3 у Лайта (запас 10): помещается, пока не хватает хотя бы трёх", () => {
    const r = buy(base({ hearts: heartsAt(7) }), "hearts-3", "lite");
    expect(r.ok && r.hearts.count).toBe(10);
    expect(buy(base({ hearts: heartsAt(8) }), "hearts-3", "lite")).toEqual({ ok: false, reason: "overflow" });
  });

  it("hearts-3 переполняет запас — отказ overflow, чипы не списываются; поштучно можно", () => {
    // 3 из 5: не хватает 2 < 3
    expect(buy(base({ hearts: heartsAt(3) }), "hearts-3")).toEqual({ ok: false, reason: "overflow" });
    expect(buy(base({ hearts: heartsAt(4) }), "hearts-3")).toEqual({ ok: false, reason: "overflow" });
    // ровно по запасу — проходит
    expect(buy(base({ hearts: heartsAt(2) }), "hearts-3").ok).toBe(true);
    // поштучно при переполнении остаётся доступным; полный запас — только когда не хватает хотя бы четырёх
    expect(buy(base({ hearts: heartsAt(4) }), "heart-1").ok).toBe(true);
    expect(buy(base({ hearts: heartsAt(4) }), "hearts-full")).toEqual({ ok: false, reason: "overflow" });
  });

  it("порядок проверок: unlimited → full → overflow → chips", () => {
    expect(buy(base({ hearts: heartsAt(4) }), "hearts-3", "unlimited")).toEqual({ ok: false, reason: "unlimited" });
    expect(buy(base({ hearts: heartsAt(5) }), "hearts-3")).toEqual({ ok: false, reason: "full" });
    // переполнение важнее нехватки чипов: пусть сразу берёт по одному
    expect(buy(base({ hearts: heartsAt(4), wallet: walletOf(0) }), "hearts-3")).toEqual({ ok: false, reason: "overflow" });
    expect(buy(base({ hearts: heartsAt(1), wallet: walletOf(149) }), "hearts-3")).toEqual({ ok: false, reason: "chips" });
  });

  it("hearts-full: по 45 за каждое недостающее сердечко, от четырёх недостающих", () => {
    expect(buy(base(), "hearts-full")).toEqual({ ok: false, reason: "overflow" }); // 2 из 5: не хватает 3
    const r = buy(base({ hearts: heartsAt(1) }), "hearts-full");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.hearts.count).toBe(5);
    expect(r.wallet.chips).toBe(500 - 4 * 45);
    const z = buy(base({ hearts: heartsAt(0) }), "hearts-full");
    expect(z.ok && z.wallet.chips).toBe(500 - 5 * 45);
    // Лайт: 2 из 10 — 8 × 45
    const lite = buy(base(), "hearts-full", "lite");
    expect(lite.ok && lite.hearts.count).toBe(10);
    expect(lite.ok && lite.wallet.chips).toBe(500 - 8 * 45);
  });

  it("refillPrice / itemPrice", () => {
    expect(REFILL_MIN_MISSING).toBe(4);
    expect(refillPrice(5)).toBe(225);
    expect(refillPrice(-1)).toBe(0);
    const full = SHOP_ITEMS.find((i) => i.id === "hearts-full")!;
    expect(itemPrice(full, heartsView(heartsAt(1), "free", T0, TODAY))).toBe(180);
    expect(itemPrice(full)).toBe(225);
    expect(itemPrice(SHOP_ITEMS[0])).toBe(60);
  });

  it("причины отказа: unknown / unlimited / full / overflow / chips", () => {
    expect(buy(base(), "nope" as ShopItemId)).toEqual({ ok: false, reason: "unknown" });
    expect(buy(base(), "heart-1", "unlimited")).toEqual({ ok: false, reason: "unlimited" });
    expect(buy(base(), "hearts-full", "unlimited")).toEqual({ ok: false, reason: "unlimited" });
    expect(buy(base({ hearts: heartsAt(5) }), "heart-1")).toEqual({ ok: false, reason: "full" });
    expect(buy(base({ hearts: heartsAt(5) }), "hearts-full")).toEqual({ ok: false, reason: "full" });
    expect(buy(base({ hearts: heartsAt(4) }), "hearts-3")).toEqual({ ok: false, reason: "overflow" });
    expect(buy(base({ wallet: walletOf(59) }), "heart-1")).toEqual({ ok: false, reason: "chips" });
    expect(buy(base({ wallet: walletOf(149) }), "hearts-3")).toEqual({ ok: false, reason: "chips" });
    expect(buy(base({ hearts: heartsAt(0), wallet: walletOf(224) }), "hearts-full")).toEqual({ ok: false, reason: "chips" });
    expect(buy(base({ wallet: walletOf(39) }), "boost-15")).toEqual({ ok: false, reason: "chips" });
    expect(buy(base({ wallet: walletOf(119) }), "boost-60")).toEqual({ ok: false, reason: "chips" });
  });

  it("ровно хватает чипов — покупка проходит, баланс 0", () => {
    const r = buy(base({ wallet: walletOf(60) }), "heart-1");
    expect(r.ok && r.wallet.chips).toBe(0);
    const r3 = buy(base({ wallet: walletOf(150) }), "hearts-3");
    expect(r3.ok && r3.wallet.chips).toBe(0);
  });

  it("при восстановлении «полный запас» считается с учётом времени", () => {
    // 4 сердечка + прошло 6 ч = полный запас → покупать нечего
    const s = base({ hearts: heartsAt(4) });
    expect(buy(s, "heart-1", "free", T0 + 6 * HOUR)).toEqual({ ok: false, reason: "full" });
    // 3 сердечка + 6 ч = 4: набор из трёх уже не поместится
    expect(buy(base({ hearts: heartsAt(3) }), "hearts-3", "free", T0 + 6 * HOUR)).toEqual({ ok: false, reason: "overflow" });
  });

  it("бустер не трогает сердечки и работает при безлимите", () => {
    const r = buy(base(), "boost-15", "unlimited");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.boost).toEqual({ mult: 2, until: T0 + 15 * MINUTE });
    expect(r.hearts).toEqual(base().hearts);
    expect(r.wallet.chips).toBe(460);
  });

  it("повторная покупка бустера продлевает время", () => {
    const first = buy(base(), "boost-15");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = buy(first, "boost-60", "free", T0 + 5 * MINUTE);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.boost).toEqual({ mult: 2, until: T0 + 15 * MINUTE + 60 * MINUTE });
  });

  it("цены каталога (порядок: сердечки по возрастанию, потом бустеры)", () => {
    expect(SHOP_ITEMS.map((i) => i.id)).toEqual(["heart-1", "hearts-3", "hearts-full", "boost-15", "boost-60"]);
    expect(Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, i.price]))).toEqual({
      "heart-1": 60,
      "hearts-3": 150,
      "hearts-full": 45,
      "boost-15": 40,
      "boost-60": 120,
    });
  });

  it("чем больше сердечек, тем дешевле штука; полный запас дешевле любой сборки из одиночных и троек", () => {
    const one = SHOP_ITEMS.find((i) => i.id === "heart-1")!;
    const three = SHOP_ITEMS.find((i) => i.id === "hearts-3")!;
    expect(three.price / (three.amount ?? 1)).toBeLessThan(one.price);
    expect(refillPrice(1) / 1).toBeLessThan(three.price / (three.amount ?? 1));
    for (let missing = REFILL_MIN_MISSING; missing <= PLAN_FEATURES.lite.maxHearts; missing++) {
      const combo = Math.floor(missing / 3) * three.price + (missing % 3) * one.price;
      expect(refillPrice(missing)).toBeLessThan(combo);
    }
  });

  it("наборы чипов за деньги: цены, без бонуса, бейджи", () => {
    expect(CHIP_PACKS.map((p) => [p.id, p.chips, p.price])).toEqual([
      ["chips-100", 100, 249],
      ["chips-300", 300, 590],
      ["chips-750", 750, 1290],
      ["chips-2000", 2000, 2990],
    ]);
    expect(CHIP_PACKS.every((p) => p.bonus === 0)).toBe(true);
    expect(CHIP_PACKS.find((p) => p.badge === "popular")?.id).toBe("chips-750");
    expect(CHIP_PACKS.find((p) => p.badge === "best")?.id).toBe("chips-2000");
  });

  it("packSaving: выгода против самого маленького набора", () => {
    expect(packSaving(CHIP_PACKS[0])).toBe(0);
    expect(packSaving(CHIP_PACKS[1])).toBe(21); // 590/300 = 1,967 против 2,49 ₸ за чип
    expect(packSaving(CHIP_PACKS[2])).toBe(31); // 1290/750 = 1,72
    expect(packSaving(CHIP_PACKS[3])).toBe(40); // 2990/2000 = 1,495
    // чем больше набор, тем выгоднее
    const savings = CHIP_PACKS.map(packSaving);
    expect([...savings].sort((a, b) => a - b)).toEqual(savings);
  });

  it("packSaving учитывает бонус и не бывает отрицательным", () => {
    expect(packSaving({ id: "x", chips: 100, bonus: 100, price: 249 })).toBe(50);
    expect(packSaving({ id: "y", chips: 10, bonus: 0, price: 1000 })).toBe(0);
  });

  it("HEART_PASSES: сердечки без ограничений на 24 часа и 7 дней", () => {
    expect(HEART_PASSES.map((p) => [p.id, p.hours, p.price])).toEqual([
      ["hearts-24h", 24, 149],
      ["hearts-7d", 168, 590],
    ]);
    // неделя дешевле, чем семь суточных пропусков
    const [day, week] = HEART_PASSES;
    expect(week.price).toBeLessThan((week.hours / day.hours) * day.price);
  });

  it("бустеры за деньги: ×2 на 24 часа и 7 дней", () => {
    expect(BOOST_PACKS.map((p) => [p.id, p.mult, p.hours, p.price])).toEqual([
      ["boost-24h", 2, 24, 290],
      ["boost-7d", 2, 168, 990],
    ]);
  });
});

describe("бустеры и множитель чипов", () => {
  it("boostActive: нужно время и множитель больше 1", () => {
    expect(boostActive(null, T0)).toBe(false);
    expect(boostActive(undefined, T0)).toBe(false);
    expect(boostActive({ mult: 2, until: T0 + 1 }, T0)).toBe(true);
    expect(boostActive({ mult: 2, until: T0 }, T0)).toBe(false);
    expect(boostActive({ mult: 1, until: T0 + 1000 }, T0)).toBe(false);
  });

  it("chipMultiplier = тариф × бустер", () => {
    const boost = { mult: 2, until: T0 + HOUR };
    expect(chipMultiplier("free", null, T0)).toBe(1);
    expect(chipMultiplier("free", boost, T0)).toBe(2);
    expect(chipMultiplier("lite", boost, T0)).toBe(3);
    expect(chipMultiplier("unlimited", boost, T0)).toBe(4);
    expect(chipMultiplier("lite", null, T0)).toBe(1.5);
    expect(chipMultiplier("lite", { mult: 2, until: T0 - 1 }, T0)).toBe(1.5);
  });

  it("extendBoost: время складывается, множитель — наибольший", () => {
    expect(extendBoost(null, 2, 15, T0)).toEqual({ mult: 2, until: T0 + 15 * MINUTE });
    expect(extendBoost({ mult: 3, until: T0 + 10 * MINUTE }, 2, 15, T0)).toEqual({ mult: 3, until: T0 + 25 * MINUTE });
    // истёкший бустер не учитывается
    expect(extendBoost({ mult: 3, until: T0 - 1 }, 2, 15, T0)).toEqual({ mult: 2, until: T0 + 15 * MINUTE });
  });

  it("sanitizeBoost: мусор — null, множитель в пределах 1..3", () => {
    expect(sanitizeBoost(null)).toBeNull();
    expect(sanitizeBoost(undefined)).toBeNull();
    expect(sanitizeBoost("x")).toBeNull();
    expect(sanitizeBoost({ mult: "2", until: 5 })).toBeNull();
    expect(sanitizeBoost({ mult: 2, until: NaN })).toBeNull();
    expect(sanitizeBoost({ mult: 2, until: Infinity })).toBeNull();
    expect(sanitizeBoost({ mult: 10, until: 5 })).toEqual({ mult: 3, until: 5 });
    expect(sanitizeBoost({ mult: 0.2, until: 5 })).toEqual({ mult: 1, until: 5 });
    expect(sanitizeBoost({ mult: 2, until: 5 })).toEqual({ mult: 2, until: 5 });
  });
});

describe("чипы: заработок", () => {
  it("earnAmount: вниз до целого, мусор — 0", () => {
    expect(earnAmount(5, 1.5)).toBe(7);
    expect(earnAmount(0, 2)).toBe(0);
    expect(earnAmount(-5, 2)).toBe(0);
    expect(earnAmount(5, 0)).toBe(0);
    expect(earnAmount(NaN, 1)).toBe(0);
  });

  it("приветственные 20 чипов", () => {
    expect(WELCOME_CHIPS).toBe(20);
    expect(START_WALLET).toEqual({ chips: 20, earned: 20, spent: 0 });
  });

  it("CHIP_REWARD: числа решения #105 (идеального бонуса +5 больше нет — этап 16В; достижения — по редкости)", () => {
    expect(CHIP_REWARD).toEqual({ lessonFirst: 3, lessonRepeat: 1, dailyGoal: 5, unit: 10, exam: 10 });
    expect("perfect" in CHIP_REWARD).toBe(false);
  });

  it("ACHIEVEMENT_CHIPS: достижение платит по редкости (5 / 10 / 20 / 40)", () => {
    expect(ACHIEVEMENT_CHIPS).toEqual({ common: 5, rare: 10, epic: 20, legendary: 40 });
  });

  it("PERFECT_DROP: шанс 20% на пол-сердечка, 20% на 3 чипа (этап 16В, решение B)", () => {
    expect(PERFECT_DROP).toEqual({ heartChance: 0.2, chipsChance: 0.2, chips: 3, heart: 0.5 });
    // шанс «ничего» — остаток: 60%
    expect(1 - PERFECT_DROP.heartChance - PERFECT_DROP.chipsChance).toBeCloseTo(0.6, 10);
  });

  it("lessonChips: урок 3 (повтор 1); множитель тарифа и бустера", () => {
    expect(lessonChips(true, 1)).toBe(3);
    expect(lessonChips(false, 1)).toBe(1);
    expect(lessonChips(true, 1.5)).toBe(4);
    expect(lessonChips(false, 1.5)).toBe(1);
    expect(lessonChips(true, chipMultiplier("unlimited", { mult: 2, until: T0 + 1 }, T0))).toBe(12);
    expect(lessonChips(true, 0)).toBe(0);
  });
});

describe("pushLedger", () => {
  const e = (over: Partial<LedgerEntry> = {}): LedgerEntry => ({ id: "a", at: T0, amount: 2, reason: "xp", ...over });

  it("нулевая запись игнорируется", () => {
    const l = [e()];
    expect(pushLedger(l, e({ amount: 0 }))).toBe(l);
  });

  it("новая запись — первой", () => {
    const r = pushLedger([e()], e({ id: "b", reason: "lesson", amount: 5 }));
    expect(r.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("та же причина в окне склеивается: сумма и новое время, id старый", () => {
    const r = pushLedger([e()], e({ id: "b", at: T0 + 5 * MINUTE, amount: 3 }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: "a", amount: 5, at: T0 + 5 * MINUTE, reason: "xp" });
  });

  it("на границе окна склеивается, позже — нет", () => {
    expect(pushLedger([e()], e({ id: "b", at: T0 + LEDGER_MERGE_MS })).length).toBe(1);
    expect(pushLedger([e()], e({ id: "b", at: T0 + LEDGER_MERGE_MS + 1 })).length).toBe(2);
  });

  it("не склеивается: другая причина, другой note, другой знак, время назад", () => {
    expect(pushLedger([e()], e({ id: "b", reason: "lesson" })).length).toBe(2);
    expect(pushLedger([e({ reason: "ai", note: "hint", amount: -5 })], e({ id: "b", reason: "ai", note: "chat", amount: -10 })).length).toBe(2);
    expect(pushLedger([e({ reason: "ai", amount: -5 })], e({ id: "b", reason: "ai", amount: 5 })).length).toBe(2);
    expect(pushLedger([e()], e({ id: "b", at: T0 - 1 })).length).toBe(2);
  });

  it("траты одной причины тоже склеиваются", () => {
    const r = pushLedger([e({ reason: "ai", note: "hint", amount: -5 })], e({ id: "b", reason: "ai", note: "hint", amount: -5, at: T0 + 1 }));
    expect(r).toHaveLength(1);
    expect(r[0].amount).toBe(-10);
  });

  it("склеивается только с последней записью", () => {
    const l = [e({ id: "c", reason: "lesson", amount: 5 }), e({ id: "a" })];
    expect(pushLedger(l, e({ id: "b", at: T0 + 1 })).length).toBe(3);
  });

  it(`история не длиннее ${MAX_LEDGER}`, () => {
    let l: LedgerEntry[] = [];
    for (let i = 0; i < MAX_LEDGER + 20; i++) l = pushLedger(l, e({ id: `x${i}`, reason: i % 2 ? "lesson" : "xp", at: T0 + i }));
    expect(l).toHaveLength(MAX_LEDGER);
    expect(l[0].id).toBe(`x${MAX_LEDGER + 19}`);
  });
});

describe("ИИ: quoteAi", () => {
  /** free — дневной счётчик («Лайт»), freeTotal — за всё время («Бесплатный»): в тестах квот они совпадают, если не задано иное. */
  const usage = (free: number, count = free, day = TODAY, freeTotal = free): AiUsage => ({ day, count, free, freeTotal });

  it("бесплатный лимит по тарифу, потом чипы", () => {
    expect(quoteAi("hint", "free", undefined, 100, TODAY)).toEqual({ ok: true, kind: "hint", day: TODAY, pay: "free", cost: 0 });
    expect(quoteAi("hint", "free", usage(2), 100, TODAY).pay).toBe("free");
    expect(quoteAi("hint", "free", usage(3), 100, TODAY)).toEqual({ ok: true, kind: "hint", day: TODAY, pay: "chips", cost: AI_COST.hint });
    expect(quoteAi("photo", "free", usage(3), 100, TODAY).cost).toBe(10);
    expect(quoteAi("chat", "free", usage(3), 100, TODAY).cost).toBe(7);
  });

  it("цены обращений: подсказка 3, разбор 5, вопрос 5, чат 7, фото 10, разбор пробника 15, голос 2, отзыв 0", () => {
    expect(AI_COST).toEqual({ hint: 3, explain: 5, ask: 5, chat: 7, photo: 10, review: 15, voice: 2, feedback: 0 });
  });

  it("голосовой вопрос: расшифровка стоит 2 чипа сверх бесплатного, бесплатна в пределах лимита и при безлимите", () => {
    expect(quoteAi("voice", "free", usage(3), 100, TODAY)).toEqual({ ok: true, kind: "voice", day: TODAY, pay: "chips", cost: 2 });
    expect(quoteAi("voice", "free", usage(3), 2, TODAY).ok).toBe(true);
    expect(quoteAi("voice", "free", usage(3), 1, TODAY)).toEqual({ ok: false, kind: "voice", day: TODAY, cost: 2, reason: "chips" });
    expect(quoteAi("voice", "free", usage(0), 0, TODAY)).toMatchObject({ ok: true, pay: "free", cost: 0 });
    expect(quoteAi("voice", "unlimited", usage(500, 10), 0, TODAY)).toMatchObject({ ok: true, pay: "plan", cost: 0 });
    // голос съедает бесплатный лимит как одно обращение, а в дневной потолок идёт за 4 (AI_UNITS)
    expect(applyAiUsage(undefined, quoteAi("voice", "free", undefined, 0, TODAY))).toEqual({ day: TODAY, count: 4, free: 1, freeTotal: 1 });
  });

  it("не хватает чипов — причина chips и цена", () => {
    expect(quoteAi("ask", "free", usage(3), 4, TODAY)).toEqual({ ok: false, kind: "ask", day: TODAY, cost: 5, reason: "chips" });
    expect(quoteAi("ask", "free", usage(3), 5, TODAY).ok).toBe(true);
  });

  it("Лайт: 30 бесплатных", () => {
    expect(quoteAi("hint", "lite", usage(29), 0, TODAY).pay).toBe("free");
    expect(quoteAi("hint", "lite", usage(30), 100, TODAY).pay).toBe("chips");
  });

  it("безлимит — оплачено тарифом, чипы не нужны", () => {
    expect(quoteAi("photo", "unlimited", usage(500, 10), 0, TODAY)).toEqual({ ok: true, kind: "photo", day: TODAY, pay: "plan", cost: 0 });
  });

  it("отзыв после урока всегда бесплатен, даже без чипов и лимита", () => {
    const r = quoteAi("feedback", "free", usage(3), 0, TODAY);
    expect(r).toMatchObject({ ok: true, pay: "free", cost: 0 });
    expect(AI_COST.feedback).toBe(0);
  });

  it("вес обращений в потолке дня: чат, подсказка, разбор, вопрос — 1; фото и разбор пробника — 2; голос — 4; отзыв — 0", () => {
    expect(AI_UNITS).toEqual({ hint: 1, explain: 1, ask: 1, chat: 1, photo: 2, review: 2, voice: 4, feedback: 0 });
  });

  it("потолок дня (решение #48, правка v0.9.1): 65 обращений для всех трёх тарифов", () => {
    expect(AI_DAILY_CAP).toEqual({ free: 65, lite: 65, unlimited: 65 });
  });

  it("потолок дня: отказ, если count + вес обращения > 65; для любого тарифа", () => {
    for (const tier of ["free", "lite", "unlimited"] as const) {
      expect(quoteAi("hint", tier, usage(0, 65), 999, TODAY), tier).toMatchObject({ ok: false, reason: "cap", cost: 0 });
      expect(quoteAi("hint", tier, usage(0, 64), 999, TODAY).ok, tier).toBe(true);
      // фото весит 2: при 63 обращениях ещё можно (63 + 2 = 65), при 64 — уже нельзя (66 > 65)
      expect(quoteAi("photo", tier, usage(0, 63), 999, TODAY).ok, tier).toBe(true);
      expect(quoteAi("photo", tier, usage(0, 64), 999, TODAY), tier).toMatchObject({ ok: false, reason: "cap" });
      // голос весит 4: при 61 можно (65), при 62 — нельзя (66)
      expect(quoteAi("voice", tier, usage(0, 61), 999, TODAY).ok, tier).toBe(true);
      expect(quoteAi("voice", tier, usage(0, 62), 999, TODAY), tier).toMatchObject({ ok: false, reason: "cap" });
    }
    // «Безлимит» без чипов упирается в тот же потолок
    expect(quoteAi("hint", "unlimited", usage(0, 65), 0, TODAY)).toMatchObject({ ok: false, reason: "cap" });
  });

  it("бесплатные по тарифу (3 / 30 / без счёта) и чипы — внутри потолка 65, потолок не зависит от них", () => {
    // бесплатный: 3 бесплатных, дальше за чипы, но всего не больше 65
    expect(quoteAi("hint", "free", usage(3, 40), 999, TODAY)).toMatchObject({ ok: true, pay: "chips", cost: AI_COST.hint });
    expect(quoteAi("hint", "free", usage(3, 64), 999, TODAY)).toMatchObject({ ok: true, pay: "chips" });
    expect(quoteAi("hint", "free", usage(3, 65), 999, TODAY)).toMatchObject({ ok: false, reason: "cap" });
    // Лайт: 30 бесплатных, потом чипы, потолок тот же
    expect(quoteAi("hint", "lite", usage(30, 64), 999, TODAY)).toMatchObject({ ok: true, pay: "chips" });
    expect(quoteAi("hint", "lite", usage(30, 65), 999, TODAY)).toMatchObject({ ok: false, reason: "cap" });
    // Безлимит: без чипов, пока не упрётся в потолок
    expect(quoteAi("hint", "unlimited", usage(0, 64), 0, TODAY)).toMatchObject({ ok: true, pay: "plan", cost: 0 });
  });

  it("отзыв после урока весит 0: не упирается в потолок, пока он не превышен", () => {
    expect(quoteAi("feedback", "lite", usage(0, AI_DAILY_CAP.lite), 999, TODAY)).toMatchObject({ ok: true, pay: "free" });
    expect(quoteAi("feedback", "lite", usage(0, AI_DAILY_CAP.lite + 1), 999, TODAY)).toMatchObject({ ok: false, reason: "cap" });
  });

  it("использование за вчера не считается: дневной счёт «Лайт» обнуляется, дневной потолок тоже", () => {
    expect(quoteAi("hint", "lite", usage(30, 99, "2027-01-14", 0), 0, TODAY).pay).toBe("free");
    expect(quoteAi("hint", "free", usage(0, 99, "2027-01-14", 0), 0, TODAY).pay).toBe("free");
  });

  it("«Бесплатный»: 3 бесплатных обращения за всё время, а не в день (#99)", () => {
    // Потрачены вчера — сегодня их всё равно нет.
    expect(aiFreeLeft("free", usage(3, 3, "2027-01-14", 3), TODAY)).toBe(0);
    expect(quoteAi("hint", "free", usage(3, 3, "2027-01-14", 3), 100, TODAY)).toMatchObject({ ok: true, pay: "chips", cost: AI_COST.hint });
    expect(quoteAi("hint", "free", usage(3, 3, "2027-01-14", 3), 2, TODAY)).toMatchObject({ ok: false, reason: "chips" });
    // Осталось одно из трёх — и завтра останется одно.
    expect(aiFreeLeft("free", usage(2, 2, "2027-01-14", 2), TODAY)).toBe(1);
    expect(aiFreeLeft("free", usage(0, 0, TODAY, 3), TODAY)).toBe(0);
    // «Лайт» считает по дням: вчерашние 30 не мешают.
    expect(aiFreeLeft("lite", usage(30, 30, "2027-01-14", 30), TODAY)).toBe(30);
    expect(aiFreeLeft("lite", usage(10, 10, TODAY, 10), TODAY)).toBe(20);
  });

  it("aiFreeLeft / usageToday", () => {
    expect(aiFreeLeft("free", undefined, TODAY)).toBe(3);
    expect(aiFreeLeft("free", usage(1), TODAY)).toBe(2);
    expect(aiFreeLeft("free", usage(7), TODAY)).toBe(0);
    expect(aiFreeLeft("lite", usage(2, 2, "2027-01-14"), TODAY)).toBe(30);
    expect(aiFreeLeft("unlimited", undefined, TODAY)).toBe(Infinity);
    // Дневные счётчики сбрасываются, «всего» — нет.
    expect(usageToday(usage(2), "2027-01-16")).toEqual({ day: "2027-01-16", count: 0, free: 0, freeTotal: 2 });
  });
});

describe("ИИ: applyAiUsage / refundAiUsage", () => {
  const rc = (over: Partial<AiReceipt> = {}): AiReceipt => ({ ok: true, kind: "hint", day: TODAY, pay: "free", cost: 0, ...over });

  it("бесплатное обращение: count и free растут", () => {
    expect(applyAiUsage(undefined, rc())).toEqual({ day: TODAY, count: 1, free: 1, freeTotal: 1 });
  });

  it("за чипы — только count; по тарифу — только count", () => {
    expect(applyAiUsage({ day: TODAY, count: 3, free: 3, freeTotal: 3 }, rc({ pay: "chips", cost: 5 }))).toEqual({ day: TODAY, count: 4, free: 3, freeTotal: 3 });
    expect(applyAiUsage({ day: TODAY, count: 0, free: 0, freeTotal: 0 }, rc({ pay: "plan" }))).toEqual({ day: TODAY, count: 1, free: 0, freeTotal: 0 });
  });

  it("отзыв: вес 0 — в count не идёт и бесплатный лимит не съедает", () => {
    expect(applyAiUsage(undefined, rc({ kind: "feedback" }))).toEqual({ day: TODAY, count: 0, free: 0, freeTotal: 0 });
  });

  it("вес обращения в count: фото +2, голос +4, подсказка +1; бесплатные — штуками", () => {
    expect(applyAiUsage(undefined, rc({ kind: "photo" }))).toEqual({ day: TODAY, count: 2, free: 1, freeTotal: 1 });
    expect(applyAiUsage(undefined, rc({ kind: "voice", pay: "chips", cost: 2 }))).toEqual({ day: TODAY, count: 4, free: 0, freeTotal: 0 });
    expect(applyAiUsage({ day: TODAY, count: 5, free: 3, freeTotal: 3 }, rc({ kind: "review", pay: "plan" }))).toEqual({ day: TODAY, count: 7, free: 3, freeTotal: 3 });
  });

  it("возврат вычитает тот же вес, не уходя ниже нуля", () => {
    const u: AiUsage = { day: TODAY, count: 6, free: 1, freeTotal: 1 };
    expect(refundAiUsage(u, rc({ kind: "voice", pay: "chips", cost: 2 }))).toEqual({ day: TODAY, count: 2, free: 1, freeTotal: 1 });
    expect(refundAiUsage({ day: TODAY, count: 1, free: 1, freeTotal: 1 }, rc({ kind: "photo" }))).toEqual({ day: TODAY, count: 0, free: 0, freeTotal: 0 });
  });

  it("неудачная квитанция ничего не меняет", () => {
    expect(applyAiUsage({ day: TODAY, count: 2, free: 1, freeTotal: 1 }, rc({ ok: false, reason: "chips" }))).toEqual({ day: TODAY, count: 2, free: 1, freeTotal: 1 });
  });

  it("вчерашнее дневное использование обнуляется, а бесплатные «за всё время» копятся", () => {
    expect(applyAiUsage({ day: "2027-01-14", count: 9, free: 3, freeTotal: 3 }, rc())).toEqual({ day: TODAY, count: 1, free: 1, freeTotal: 4 });
  });

  it("возврат: обратный applyAiUsage", () => {
    const u0: AiUsage = { day: TODAY, count: 2, free: 2, freeTotal: 2 };
    for (const r of [rc(), rc({ pay: "chips", cost: 5 }), rc({ pay: "plan" }), rc({ kind: "feedback" })]) {
      expect(refundAiUsage(applyAiUsage(u0, r), r)).toEqual(u0);
    }
  });

  it("возврат не уходит ниже нуля", () => {
    expect(refundAiUsage({ day: TODAY, count: 0, free: 0, freeTotal: 0 }, rc())).toEqual({ day: TODAY, count: 0, free: 0, freeTotal: 0 });
  });

  it("возврат в другой день: дневные счётчики не трогаем, бесплатное «за всё время» возвращается (#99)", () => {
    const u: AiUsage = { day: "2027-01-16", count: 4, free: 3, freeTotal: 3 };
    expect(refundAiUsage(u, rc())).toEqual({ day: "2027-01-16", count: 4, free: 3, freeTotal: 2 });
    expect(refundAiUsage(u, rc({ pay: "chips", cost: 3 }))).toEqual(u);
  });

  it("возврат неудачной квитанции ничего не меняет", () => {
    const u: AiUsage = { day: TODAY, count: 4, free: 3, freeTotal: 3 };
    expect(refundAiUsage(u, rc({ ok: false, reason: "cap" }))).toEqual(u);
  });

  it("возврат без учёта за день — нули", () => {
    expect(refundAiUsage(undefined, rc())).toEqual({ day: TODAY, count: 0, free: 0, freeTotal: 0 });
  });
});

describe("окно тарифов", () => {
  it("бесплатному — если ещё не показывали или прошло 3 дня", () => {
    expect(shouldShowPaywall("free", undefined, T0)).toBe(true);
    expect(shouldShowPaywall("free", { lastShownAt: 0, views: 0 }, T0)).toBe(true);
    expect(shouldShowPaywall("free", { lastShownAt: T0 - DAY, views: 1 }, T0)).toBe(false);
    expect(shouldShowPaywall("free", { lastShownAt: T0 - PAYWALL_EVERY_DAYS * DAY + 1, views: 1 }, T0)).toBe(false);
    expect(shouldShowPaywall("free", { lastShownAt: T0 - PAYWALL_EVERY_DAYS * DAY, views: 1 }, T0)).toBe(true);
  });

  it("платным — никогда", () => {
    expect(shouldShowPaywall("lite", undefined, T0)).toBe(false);
    expect(shouldShowPaywall("unlimited", { lastShownAt: 0, views: 0 }, T0)).toBe(false);
  });
});

describe("sanitize*: мусор на входе", () => {
  const garbage: unknown[] = [null, undefined, 0, 5, "str", true, [], [1, 2], {}, { x: 1 }, NaN];

  it("sanitizePlan", () => {
    for (const g of garbage) expect(sanitizePlan(g)).toEqual({ tier: "free" });
    expect(sanitizePlan({ tier: "gold" })).toEqual({ tier: "free" });
    expect(sanitizePlan({ tier: "lite", period: "year", until: T0, trial: 1, trialUsed: 1 })).toEqual({
      tier: "lite",
      period: "year",
      until: T0,
      trial: true,
      trialUsed: true,
    });
    expect(sanitizePlan({ tier: "unlimited", period: "week", until: "x" })).toEqual({ tier: "unlimited", until: 0 });
    expect(sanitizePlan({ tier: "unlimited", until: Infinity }).until).toBe(0);
    // бесплатный не хранит чужие поля, но помнит trialUsed
    expect(sanitizePlan({ tier: "free", until: T0, trial: true, trialUsed: true })).toEqual({ tier: "free", trialUsed: true });
  });

  it("sanitizeHearts", () => {
    for (const g of garbage) {
      const h = sanitizeHearts(g);
      expect(Number.isInteger(h.count)).toBe(true);
      expect(h.count).toBeGreaterThanOrEqual(0);
      expect(h.updatedAt).toBe(0);
      expect(h.day).toBe("");
    }
    expect(sanitizeHearts({ count: -4, updatedAt: 5, day: "2027-01-01" })).toEqual({ count: 0, updatedAt: 5, day: "2027-01-01" });
    expect(sanitizeHearts({ count: 1000 }).count).toBe(99);
    // половинки (этап 15): дробь — вниз до 0,5; целые из старых сохранений читаются как есть
    expect(sanitizeHearts({ count: 2.9 }).count).toBe(2.5);
    expect(sanitizeHearts({ count: 4.5 }).count).toBe(4.5);
    expect(sanitizeHearts({ count: 4.2 }).count).toBe(4);
    expect(sanitizeHearts({ count: 3 }).count).toBe(3);
    expect(sanitizeHearts({ count: 0.5 }).count).toBe(0.5);
    expect(sanitizeHearts({ count: Infinity }).count).toBe(START_HEARTS.count);
    expect(sanitizeHearts({ day: "завтра" }).day).toBe("");
    expect(sanitizeHearts({ updatedAt: Infinity }).updatedAt).toBe(0);
  });

  it("sanitizeWallet: мусор — стартовые 20 чипов, не отрицательные", () => {
    for (const g of garbage) expect(sanitizeWallet(g)).toEqual({ chips: START_WALLET.chips, earned: START_WALLET.earned, spent: 0 });
    expect(sanitizeWallet({ chips: -5, earned: "x", spent: -1 })).toEqual({ chips: 20, earned: 20, spent: 0 });
    expect(sanitizeWallet({ chips: 7.8, earned: 20, spent: 13 })).toEqual({ chips: 7, earned: 20, spent: 13 });
    expect(sanitizeWallet({ chips: 0 }).chips).toBe(0);
  });

  it("sanitizeAiUsage", () => {
    for (const g of garbage) expect(sanitizeAiUsage(g)).toEqual({ day: "", count: 0, free: 0, freeTotal: 0 });
    expect(sanitizeAiUsage({ day: TODAY, count: -3, free: 2.7, freeTotal: 1 })).toEqual({ day: TODAY, count: 0, free: 2, freeTotal: 1 });
    expect(sanitizeAiUsage({ day: 5, count: Infinity })).toEqual({ day: "", count: 0, free: 0, freeTotal: 0 });
    expect(sanitizeAiUsage({ day: TODAY, count: 1, free: 1, freeTotal: -4 })).toMatchObject({ freeTotal: 0 });
  });

  it("sanitizeAiUsage: миграция (#99) — потраченное сегодня считается потраченным из «трёх навсегда»", () => {
    // Старое сохранение без freeTotal: сегодняшние бесплатные становятся потраченными навсегда.
    expect(sanitizeAiUsage({ day: TODAY, count: 3, free: 3 }, TODAY)).toEqual({ day: TODAY, count: 3, free: 3, freeTotal: 3 });
    expect(aiFreeLeft("free", sanitizeAiUsage({ day: TODAY, count: 2, free: 2 }, TODAY), TODAY)).toBe(1);
    // Вчерашние не считаем (их нельзя отличить от «уже восстановленных»), без «сегодня» — тоже ноль.
    expect(sanitizeAiUsage({ day: "2027-01-14", count: 3, free: 3 }, TODAY).freeTotal).toBe(0);
    expect(sanitizeAiUsage({ day: TODAY, count: 3, free: 3 }).freeTotal).toBe(0);
    // Повторная загрузка уже мигрированных данных их не меняет.
    const once = sanitizeAiUsage({ day: TODAY, count: 3, free: 3 }, TODAY);
    expect(sanitizeAiUsage(once, "2027-01-20")).toEqual(once);
  });

  it("sanitizePaywall", () => {
    for (const g of garbage) expect(sanitizePaywall(g)).toEqual({ lastShownAt: 0, views: 0 });
    expect(sanitizePaywall({ lastShownAt: T0, views: 2.6 })).toEqual({ lastShownAt: T0, views: 2 });
    expect(sanitizePaywall({ lastShownAt: -1, views: -1 })).toEqual({ lastShownAt: 0, views: 0 });
  });
});

