import { describe, expect, it } from "vitest";
import { AI_COST, ENTRY_COST, HOUR, PLAN_FEATURES, PRACTICE_HEART_DAILY, PRACTICE_HEART_MIN_ACCURACY, PRACTICE_HEART_MIN_ANSWERS, REFILL_MIN_MISSING, SHOP_ITEMS, itemPrice, shopItem, buyItem, type AiKind, type HeartsView } from "@/lib/economy";
import { dayDiff, formatClock, formatCompact, formatCountdown, showBoostLine, formatMult, formatNum, formatRemaining, formatSpan, heartWaitMs, heartsGain, knownAiKind, knownShopId, shopAvailability } from "@/components/economy/shop-helpers";
import { ENTRY_RULE_KEYS, FREE_ENTRIES, FREE_ENTRY_KEYS, entryRules, practiceRule, refillGain, regenRules, shownPrice } from "@/components/economy/shop-rules";
import { compareRows } from "@/components/plans/plans-helpers";
import { dict, type DictKey } from "@/i18n/dict";

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
  it("длительность бустера и пропуска сердечек", () => {
    expect(formatSpan(24, "ru")).toBe("24\u00a0ч");
    expect(formatSpan(168, "ru")).toBe("7\u00a0дней");
    expect(formatSpan(168, "kk")).toBe("7\u00a0күн");
  });
  it("время записи", () => {
    expect(formatClock(new Date(2026, 9, 2, 9, 5).getTime())).toBe("09:05");
  });
});

describe("shopAvailability", () => {
  const heart = shopItem("heart-1")!;
  const three = shopItem("hearts-3")!;
  const full = shopItem("hearts-full")!;
  const boost = shopItem("boost-15")!;

  it("хватает чипов и есть что восстановить — можно", () => {
    expect(shopAvailability(heart, view(3), 100)).toEqual({ ok: true });
    expect(shopAvailability(three, view(2), 150)).toEqual({ ok: true });
    // полный запас: по 45 за каждое недостающее — 5 × 45
    expect(shopAvailability(full, view(0), 225)).toEqual({ ok: true });
    expect(shopAvailability(full, view(1), 180)).toEqual({ ok: true });
  });
  it("запас полный — нельзя, даже если чипов мало", () => {
    expect(shopAvailability(heart, view(5), 0)).toEqual({ ok: false, reason: "full" });
    expect(shopAvailability(three, view(5), 0)).toEqual({ ok: false, reason: "full" });
  });
  it("безлимит — нельзя", () => {
    expect(shopAvailability(full, UNLIMITED, 999)).toEqual({ ok: false, reason: "unlimited" });
    expect(shopAvailability(three, UNLIMITED, 999)).toEqual({ ok: false, reason: "unlimited" });
  });
  it("не хватает чипов — считает, сколько", () => {
    expect(shopAvailability(full, view(1), 160)).toEqual({ ok: false, reason: "chips", missing: 20 });
    expect(shopAvailability(full, view(0), 200)).toEqual({ ok: false, reason: "chips", missing: 25 });
    expect(shopAvailability(three, view(0), 115)).toEqual({ ok: false, reason: "chips", missing: 35 });
    expect(shopAvailability(heart, view(2), 59)).toEqual({ ok: false, reason: "chips", missing: 1 });
  });
  it("три сердечка не помещаются в запас — overflow (раньше, чем «не хватает чипов»)", () => {
    expect(shopAvailability(three, view(3), 100)).toEqual({ ok: false, reason: "overflow" });
    expect(shopAvailability(three, view(4), 100)).toEqual({ ok: false, reason: "overflow" });
    expect(shopAvailability(three, view(4), 0)).toEqual({ ok: false, reason: "overflow" });
    // у Лайта (запас 10) — помещается, пока не хватает хотя бы трёх
    expect(shopAvailability(three, view(7, 10), 150)).toEqual({ ok: true });
    expect(shopAvailability(three, view(8, 10), 150)).toEqual({ ok: false, reason: "overflow" });
    // поштучно продаётся всегда, пока запас не полон
    expect(shopAvailability(heart, view(4), 100)).toEqual({ ok: true });
  });
  it("полный запас — только когда не хватает хотя бы четырёх (иначе выгоднее поштучно или тройкой)", () => {
    expect(shopAvailability(full, view(2), 999)).toEqual({ ok: false, reason: "overflow" });
    expect(shopAvailability(full, view(4), 999)).toEqual({ ok: false, reason: "overflow" });
    expect(shopAvailability(full, view(1), 999)).toEqual({ ok: true });
    // у Лайта: не хватает 4 из 10 — можно, цена 4 × 45
    expect(shopAvailability(full, view(6, 10), 180)).toEqual({ ok: true });
    expect(shopAvailability(full, view(7, 10), 999)).toEqual({ ok: false, reason: "overflow" });
  });
  it("бустер не зависит от сердечек", () => {
    expect(shopAvailability(boost, view(5), 40)).toEqual({ ok: true });
    expect(shopAvailability(boost, UNLIMITED, 10)).toEqual({ ok: false, reason: "chips", missing: 30 });
  });
  it("зеркалит buyItem: те же причины отказа для каждого товара, запаса и кошелька", () => {
    const T0 = 1_800_000_000_000;
    const today = "2027-01-15";
    for (const item of SHOP_ITEMS) {
      for (const count of [0, 1, 2, 3, 4, 5]) {
        for (const chips of [0, 24, 25, 59, 60, 89, 90, 500]) {
          const hearts = { count, updatedAt: T0, day: today };
          const bought = buyItem({ wallet: { chips, earned: chips, spent: 0 }, hearts, boost: null }, item.id, "free", T0, today);
          const av = shopAvailability(item, view(count, 5, { nextAt: count < 5 ? T0 + 1 : null }), chips);
          expect(av.ok, `${item.id} ${count}/${chips}`).toBe(bought.ok);
          if (!bought.ok && !av.ok) expect(av.reason, `${item.id} ${count}/${chips}`).toBe(bought.reason);
        }
      }
      const bought = buyItem({ wallet: { chips: 999, earned: 999, spent: 0 }, hearts: { count: 0, updatedAt: T0, day: today }, boost: null }, item.id, "unlimited", T0, today);
      const av = shopAvailability(item, UNLIMITED, 999);
      expect(av.ok, item.id).toBe(bought.ok);
      if (!bought.ok && !av.ok) expect(av.reason, item.id).toBe(bought.reason);
    }
  });
});

describe("прочее", () => {
  it("сколько сердечек даст товар", () => {
    expect(heartsGain(shopItem("heart-1")!, view(2))).toBe(1);
    expect(heartsGain(shopItem("hearts-3")!, view(2))).toBe(3);
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
    expect(knownShopId("hearts-3")).toBe("hearts-3");
    expect(knownShopId("<script>")).toBeUndefined();
    expect(knownAiKind("photo")).toBe("photo");
    expect(knownAiKind("voice")).toBe("voice");
    expect(knownAiKind("zzz")).toBeUndefined();
  });
  it("все виды ИИ, кроме неизвестных, опознаются; у каждого есть подпись в словаре", () => {
    for (const kind of Object.keys(AI_COST) as AiKind[]) {
      expect(knownAiKind(kind), kind).toBe(kind);
      expect(dict[`shop.ai.${kind}` as keyof typeof dict], kind).toBeDefined();
    }
  });
  it("у каждого товара магазина есть название и описание в словаре", () => {
    for (const item of SHOP_ITEMS) {
      expect(dict[`shop.item.${item.id}` as keyof typeof dict], item.id).toBeDefined();
      expect(dict[`shop.item.${item.id}.desc` as keyof typeof dict], item.id).toBeDefined();
    }
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

describe("словарь магазина, сердечек и тарифов", () => {
  const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const keys = Object.keys(dict).filter((k) => /^(shop|hearts|aicost|plans|soon)\./.test(k));

  it("плейсхолдеры в ru и kk совпадают", () => {
    expect(keys.length).toBeGreaterThan(100);
    for (const k of keys) {
      const v = dict[k as keyof typeof dict];
      expect(ph(v.kk), k).toEqual(ph(v.ru));
    }
  });

  it("после плейсхолдера в казахском тексте нет падежного окончания", () => {
    // «{n}-ті», «{time}да» и т.п. запрещены: окончание после подставляемого значения ломает сингармонизм
    for (const k of keys) {
      const kk = dict[k as keyof typeof dict].kk;
      expect(kk, k).not.toMatch(/\}[-]?(да|де|та|те|ды|ді|ты|ті|дан|ден|тан|тен|ға|ге|қа|ке|ның|нің|дың|дің|тың|тің)(?![а-яәіңғүұқөһ])/i);
    }
  });

  it("новые тексты не называют старые правила (суточный полный запас, 1 чип за 5 XP, 150/40 чипов)", () => {
    const all = keys.map((k) => `${dict[k as keyof typeof dict].ru}\n${dict[k as keyof typeof dict].kk}`).join("\n");
    expect(all).not.toMatch(/Каждый день запас|Күн сайын қор|= 1 чип/);
  });

  it("тексты магазина и тарифов не обещают чипов за опыт (#105)", () => {
    const re = /за XP|за опыт|XP үшін|Тәжірибе үшін|XP\s*=/;
    for (const k of Object.keys(dict)) {
      if (!/^(shop|plans|aicost|xp)\./.test(k)) continue;
      const v = dict[k as keyof typeof dict];
      expect(v.ru, k).not.toMatch(re);
      expect(v.kk, k).not.toMatch(re);
    }
  });
});

describe("строка сердечек и бустера в магазине", () => {
  it("обратный отсчёт часами", () => {
    expect(formatCountdown(4 * 60_000 + 12_000)).toBe("4:12");
    expect(formatCountdown(12 * 60_000 + 30_000)).toBe("12:30");
    expect(formatCountdown(3_600_000 + 5 * 60_000 + 30_000)).toBe("1:05:30");
    expect(formatCountdown(500)).toBe("0:01");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-9000)).toBe("0:00");
  });
  it("множитель ×1 и закончившийся бустер не показываем", () => {
    expect(showBoostLine(null, 2, 0)).toBe(false);
    expect(showBoostLine({ until: 5000 }, 1, 0)).toBe(false);
    expect(showBoostLine({ until: 5000 }, 2, 6000)).toBe(false);
    expect(showBoostLine({ until: 5000 }, 2, 1000)).toBe(true);
    expect(showBoostLine({ until: 5000 }, 2, 0)).toBe(false); // SSR/гидратация: часов ещё нет
  });
  it("тексты строки состояния и цены голоса: плейсхолдеры совпадают", () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of ["shop.status.heartsOf", "shop.status.next", "shop.status.boost", "shop.ai.voice.sub", "voice.startPaid"] as const) {
      expect(ph(dict[k].kk), k).toEqual(ph(dict[k].ru));
    }
    expect(ph(dict["shop.status.boost"].ru)).toEqual(["mult", "time"]);
    expect(ph(dict["voice.startPaid"].ru)).toEqual(["n"]);
    expect(AI_COST.voice).toBe(2);
  });
  it("старые ключи карточки баланса удалены", () => {
    expect(Object.keys(dict).filter((k) => k.startsWith("shop.balance"))).toEqual([]);
  });
});

describe("цены и «Полный запас» в магазине (#60)", () => {
  const full = shopItem("hearts-full")!;
  const T0 = 1_800_000_000_000;
  const today = "2027-01-15";

  it("полный запас: цена за недостающие и «+N»", () => {
    expect(shownPrice(full, view(0))).toBe(5 * full.price);
    expect(refillGain(full, view(0))).toBe(5);
    expect(shownPrice(full, view(1))).toBe(4 * full.price);
    expect(refillGain(full, view(1))).toBe(4);
    // у «Лайта» запас 10: не хватает 6 — 6 × 45
    expect(shownPrice(full, view(4, 10))).toBe(6 * full.price);
    expect(refillGain(full, view(4, 10))).toBe(6);
  });
  it("ниже порога продажи цена всё равно за недостающие (кнопка неактивна, причина — overflow)", () => {
    const missing = REFILL_MIN_MISSING - 1;
    expect(shownPrice(full, view(5 - missing))).toBe(missing * full.price);
    expect(shopAvailability(full, view(5 - missing), 999)).toEqual({ ok: false, reason: "overflow" });
  });
  it("запас полон или безлимит — недостающих нет, показываем цену запаса, пустого до конца", () => {
    expect(refillGain(full, view(5))).toBe(0);
    expect(shownPrice(full, view(5))).toBe(5 * full.price);
    expect(shownPrice(full, view(10, 10))).toBe(10 * full.price);
    expect(refillGain(full, UNLIMITED)).toBe(0);
    expect(shownPrice(full, UNLIMITED)).toBe(PLAN_FEATURES.free.maxHearts * full.price);
  });
  it("остальные товары — цена товара, «+N» только у полного запаса", () => {
    for (const item of SHOP_ITEMS.filter((i) => i.kind !== "refill")) {
      expect(shownPrice(item, view(2)), item.id).toBe(item.price);
      expect(refillGain(item, view(2)), item.id).toBe(0);
    }
  });
  it("цена на кнопке — ровно то, что спишет покупка (buyItem), когда покупка возможна", () => {
    for (const item of SHOP_ITEMS) {
      for (const count of [0, 1, 2, 3, 4]) {
        const hearts = { count, updatedAt: T0, day: today };
        const bought = buyItem({ wallet: { chips: 999, earned: 999, spent: 0 }, hearts, boost: null }, item.id, "free", T0, today);
        if (!bought.ok) continue;
        expect(bought.wallet.spent, `${item.id} ${count}`).toBe(shownPrice(item, view(count)));
        expect(bought.wallet.spent, `${item.id} ${count}`).toBe(itemPrice(item, view(count)));
      }
    }
  });
});

describe("«Как работают сердечки»: числа из констант", () => {
  it("цены входа: урок 1, большой урок 2, «Проверить себя» 1, пробный ЕНТ 1, тест по разделу 2, игра 1, теория 0,5 (экстерна в правилах больше нет)", () => {
    const rules = Object.fromEntries(entryRules().map((r) => [r.id, r.cost]));
    expect(rules).toEqual({ lesson: 1, bigLesson: 2, check: 1, exam: 1, checkpoint: 2, game: 1, theory: 0.5 });
    expect(rules.theory).toBe(ENTRY_COST.theory);
    // теория платная: в бесплатных её больше нет, зато есть шпаргалка
    expect(FREE_ENTRIES).not.toContain("theory");
    expect(FREE_ENTRIES).toContain("cheatsheet");
    expect(rules.lesson).toBe(ENTRY_COST.lesson);
    expect(rules.checkpoint).toBe(ENTRY_COST.checkpoint);
  });
  it("восстановление: бесплатный 5 за 6 ч, «Лайт» 10 за 3 ч, «Безлимит» не тратится", () => {
    const [free, lite, unl] = regenRules();
    expect(free).toMatchObject({ tier: "free", max: 5, regenMs: 6 * HOUR, unlimited: false });
    expect(lite).toMatchObject({ tier: "lite", max: 10, regenMs: 3 * HOUR, unlimited: false });
    expect(unl).toMatchObject({ tier: "unlimited", unlimited: true });
    expect(formatRemaining(free.regenMs, "ru")).toBe("6 ч");
    expect(formatRemaining(lite.regenMs, "kk")).toBe("3 сағ");
  });
  it("возврат за тренировку: от 6 ответов, точность 70%, до 3 раз в день", () => {
    expect(practiceRule()).toEqual({ answers: PRACTICE_HEART_MIN_ANSWERS, percent: Math.round(PRACTICE_HEART_MIN_ACCURACY * 100), daily: PRACTICE_HEART_DAILY });
    expect(practiceRule()).toEqual({ answers: 6, percent: 70, daily: 3 });
  });
  it("у каждой строки правил есть подпись в словаре (ru и kk)", () => {
    const keys: string[] = [...entryRules().map((r) => ENTRY_RULE_KEYS[r.id]), ...FREE_ENTRIES.map((id) => FREE_ENTRY_KEYS[id])];
    keys.push("shop.rules.title", "shop.rules.hint", "shop.rules.paid", "hearts15.rules.when", "shop.rules.free", "shop.rules.regen", "shop.rules.regen.row", "shop.rules.regen.unlimited", "shop.rules.practice");
    for (const k of keys) {
      const v = dict[k as DictKey];
      expect(v, k).toBeDefined();
      expect(v.ru.length, k).toBeGreaterThan(0);
      expect(v.kk.length, k).toBeGreaterThan(0);
    }
  });
  it("числа в текстах правил — только плейсхолдерами (кроме «+1» у возврата за время)", () => {
    const keys = Object.keys(dict).filter((k) => /^shop\.rules\.|^shop\.item\.hearts-full|^shop\.fail\.overflowRefill|^shop\.hearts\.hint$|^shop\.free\.practice$/.test(k));
    expect(keys.length).toBeGreaterThan(20);
    for (const k of keys) {
      const v = dict[k as DictKey];
      const strip = (s: string) => s.replace(/\{\w+\}/g, "").replace("+1", "");
      expect(strip(v.ru), k).not.toMatch(/\d/);
      expect(strip(v.kk), k).not.toMatch(/\d/);
    }
  });
  it("плейсхолдеры правил: {max}/{time}, {n}/{p}/{d}", () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    expect(ph(dict["shop.rules.regen.row"].ru)).toEqual(["max", "time"]);
    expect(ph(dict["shop.rules.practice"].ru)).toEqual(["d", "n", "p"]);
    expect(ph(dict["shop.free.practice"].ru)).toEqual(["n", "p"]);
    expect(ph(dict["shop.item.hearts-full.plus"].ru)).toEqual(["n"]);
    expect(ph(dict["shop.item.hearts-full.desc"].ru)).toEqual(["p"]);
  });
  it("причина overflow у полного запаса — «Выгоднее по одному или тройкой»; у тройки текст прежний", () => {
    expect(dict["shop.fail.overflowRefill"].ru).toBe("Выгоднее по одному или тройкой");
    expect(dict["shop.fail.overflow"].ru).toBe("Столько не поместится — бери по одному");
  });
});

describe("тексты магазина и тарифов: сердечко — за вход, не за ошибку (#40)", () => {
  const keys = Object.keys(dict).filter((k) => /^(shop|plans|soon)\./.test(k));
  it("нет текстов, что сердечко снимается за ошибку", () => {
    const old = /тратится за ошибку|за ошибку в уроке|ошибка с первой попытки|Сабақтағы қате үшін|қате үшін бір жүрек/i;
    for (const k of keys) {
      expect(dict[k as DictKey].ru, k).not.toMatch(old);
      expect(dict[k as DictKey].kk, k).not.toMatch(old);
    }
  });
  it("время восстановления в тарифах — из PLAN_FEATURES: 6 ч и 3 ч (не 4 и не 5)", () => {
    expect(PLAN_FEATURES.free.regenMs).toBe(6 * HOUR);
    expect(PLAN_FEATURES.lite.regenMs).toBe(3 * HOUR);
    const texts = keys.map((k) => `${dict[k as DictKey].ru}\n${dict[k as DictKey].kk}`).join("\n");
    expect(texts).not.toMatch(/\b[45] ?(ч|сағ)\b/);
  });
  it("строка сердечек в таблице тарифов: подпись «вход в урок, тест или игру»", () => {
    const row = compareRows("ru").find((r) => r.id === "hearts")!;
    expect(row.sub).toBe("plans.cmp.heartsFor");
    expect(dict["plans.cmp.heartsFor"].ru).toBe("вход в урок, тест или игру");
    expect(dict["plans.cmp.heartsFor"].kk.length).toBeGreaterThan(0);
  });
  it("«Безлимит»: уроки, тесты и игры без сердечек", () => {
    expect(dict["plans.perk.unl.hearts"].ru).toBe("Уроки, тесты и игры без сердечек");
    expect(dict["plans.perk.unl.hearts"].kk).toBe("Сабаққа, тестке және ойынға жүрек жұмсалмайды");
  });
});
