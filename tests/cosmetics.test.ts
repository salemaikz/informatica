import { describe, expect, it } from "vitest";
import {
  COSMETICS,
  COSMETIC_CASE_WEIGHT,
  COSMETIC_PRICE,
  COSMETIC_SLOTS,
  EMPTY_COSMETICS,
  buyAndEquipCosmetic,
  buyCosmetic,
  caseCosmeticPool,
  cosmeticDef,
  cosmeticsOfSlot,
  equipCosmetic,
  isCosmeticId,
  pickCaseCosmetic,
  sanitizeCosmetics,
  type CosmeticId,
  type CosmeticsState,
} from "@/lib/cosmetics";
import { RARITIES } from "@/lib/rarity";
import { START_WALLET, type Wallet } from "@/lib/economy";
import { dict } from "@/i18n/dict";

const wallet = (chips: number, spent = 0): Wallet => ({ chips, earned: chips + spent, spent });
const state = (owned: CosmeticId[], equipped: Partial<CosmeticsState["equipped"]> = {}): CosmeticsState => ({
  owned,
  equipped: { frame: null, banner: null, title: null, ...equipped },
});

describe("каталог украшений", () => {
  it("25 украшений: 10 рамок, 7 фонов, 8 титулов; id уникальны", () => {
    expect(COSMETICS).toHaveLength(25);
    expect(new Set(COSMETICS.map((c) => c.id)).size).toBe(25);
    expect(cosmeticsOfSlot("frame")).toHaveLength(10);
    expect(cosmeticsOfSlot("banner")).toHaveLength(7);
    expect(cosmeticsOfSlot("title")).toHaveLength(8);
  });

  it("id начинается со слота, слот и редкость известны", () => {
    for (const c of COSMETICS) {
      expect(c.id.startsWith(`${c.slot}-`)).toBe(true);
      expect(COSMETIC_SLOTS).toContain(c.slot);
      expect(RARITIES).toContain(c.rarity);
    }
  });

  it("цены по редкости: 80 / 160 / 320; легендарные не продаются", () => {
    expect(COSMETIC_PRICE).toEqual({ common: 80, rare: 160, epic: 320 });
    for (const c of COSMETICS) {
      if (c.rarity === "legendary") expect(c.price).toBeNull();
      else expect(c.price).toBe(COSMETIC_PRICE[c.rarity]);
    }
  });

  it("легендарных четыре: две рамки, фон и титул (как в ТЗ)", () => {
    const ids = COSMETICS.filter((c) => c.rarity === "legendary").map((c) => c.id);
    expect(ids).toEqual(["frame-crown", "frame-rainbow", "banner-gold", "title-legend"]);
  });

  it("у каждого украшения есть название на обоих языках (cosmetics.name.<id>)", () => {
    for (const c of COSMETICS) {
      const entry = (dict as Record<string, { ru: string; kk: string } | undefined>)[`cosmetics.name.${c.id}`];
      expect(entry?.ru?.trim(), c.id).toBeTruthy();
      expect(entry?.kk?.trim(), c.id).toBeTruthy();
    }
  });

  it("isCosmeticId / cosmeticDef не пропускают мусор", () => {
    expect(isCosmeticId("frame-neon")).toBe(true);
    expect(isCosmeticId("frame-nope")).toBe(false);
    expect(isCosmeticId(5)).toBe(false);
    expect(isCosmeticId("__proto__")).toBe(false);
    expect(isCosmeticId("constructor")).toBe(false);
    expect(cosmeticDef("title-legend")).toMatchObject({ slot: "title", rarity: "legendary", price: null });
    expect(cosmeticDef(undefined)).toBeUndefined();
  });
});

describe("sanitizeCosmetics", () => {
  it("мусор и пустые данные — пустое состояние (каждый раз новый объект)", () => {
    for (const raw of [undefined, null, 5, "x", [], {}, { owned: 3, equipped: "x" }]) {
      expect(sanitizeCosmetics(raw)).toEqual(EMPTY_COSMETICS);
    }
    expect(sanitizeCosmetics(null)).not.toBe(EMPTY_COSMETICS);
  });

  it("оставляет только известные id без повторов", () => {
    const s = sanitizeCosmetics({ owned: ["frame-dots", "frame-dots", "nope", 7, null, "title-newbie"], equipped: {} });
    expect(s.owned).toEqual(["frame-dots", "title-newbie"]);
  });

  it("надето — только из owned и только в свой слот", () => {
    const raw = {
      owned: ["frame-dots", "banner-grid", "title-newbie"],
      equipped: { frame: "frame-dots", banner: "title-newbie", title: "title-legend" },
    };
    const s = sanitizeCosmetics(raw);
    expect(s.equipped).toEqual({ frame: "frame-dots", banner: null, title: null });
  });

  it("корректное состояние проходит без изменений", () => {
    const ok = state(["frame-neon", "banner-aurora", "title-bug-hunter"], { frame: "frame-neon", title: "title-bug-hunter" });
    expect(sanitizeCosmetics(JSON.parse(JSON.stringify(ok)))).toEqual(ok);
  });

  it("старое сохранение без поля не ломает загрузку", () => {
    expect(sanitizeCosmetics(undefined).owned).toEqual([]);
  });
});

describe("buyCosmetic", () => {
  it("покупка: чипы списаны, spent вырос, украшение в owned, не надето", () => {
    const w = wallet(200, 10);
    const res = buyCosmetic(EMPTY_COSMETICS, w, "frame-dots");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.wallet).toEqual({ chips: 120, earned: 210, spent: 90 });
    expect(res.state.owned).toEqual(["frame-dots"]);
    expect(res.state.equipped.frame).toBeNull();
    // вход не изменён
    expect(w).toEqual(wallet(200, 10));
    expect(EMPTY_COSMETICS.owned).toEqual([]);
  });

  it("цены: обычное 80, редкое 160, эпическое 320; ровно хватает — можно", () => {
    expect(buyCosmetic(EMPTY_COSMETICS, wallet(80), "banner-grid")).toMatchObject({ ok: true, wallet: { chips: 0 } });
    expect(buyCosmetic(EMPTY_COSMETICS, wallet(160), "frame-circuit")).toMatchObject({ ok: true, wallet: { chips: 0 } });
    expect(buyCosmetic(EMPTY_COSMETICS, wallet(320), "title-algo-master")).toMatchObject({ ok: true, wallet: { chips: 0 } });
  });

  it("не хватает чипов — отказ chips, ничего не меняется", () => {
    expect(buyCosmetic(EMPTY_COSMETICS, wallet(79), "frame-dots")).toEqual({ ok: false, reason: "chips" });
    expect(buyCosmetic(EMPTY_COSMETICS, wallet(319), "frame-neon")).toEqual({ ok: false, reason: "chips" });
    expect(buyCosmetic(EMPTY_COSMETICS, START_WALLET, "banner-night")).toEqual({ ok: false, reason: "chips" });
  });

  it("повторная покупка — owned (чипы не тратятся)", () => {
    const first = buyCosmetic(EMPTY_COSMETICS, wallet(500), "frame-dots");
    if (!first.ok) throw new Error("ожидали покупку");
    expect(buyCosmetic(first.state, first.wallet, "frame-dots")).toEqual({ ok: false, reason: "owned" });
  });

  it("легендарное не продаётся, сколько бы ни было чипов", () => {
    for (const id of ["frame-crown", "frame-rainbow", "banner-gold", "title-legend"]) {
      expect(buyCosmetic(EMPTY_COSMETICS, wallet(100_000), id)).toEqual({ ok: false, reason: "notForSale" });
    }
  });

  it("легендарное из кейса, уже лежащее в owned, — owned, а не notForSale", () => {
    expect(buyCosmetic(state(["frame-crown"]), wallet(100_000), "frame-crown")).toEqual({ ok: false, reason: "owned" });
  });

  it("неизвестный id — unknown", () => {
    expect(buyCosmetic(EMPTY_COSMETICS, wallet(1000), "frame-nope")).toEqual({ ok: false, reason: "unknown" });
    expect(buyCosmetic(EMPTY_COSMETICS, wallet(1000), "")).toEqual({ ok: false, reason: "unknown" });
  });

  it("buyAndEquipCosmetic: купленное сразу надето, остальные слоты не тронуты", () => {
    const s = state(["banner-grid", "frame-dots"], { banner: "banner-grid", frame: "frame-dots" });
    const res = buyAndEquipCosmetic(s, wallet(500), "frame-wave");
    if (!res.ok) throw new Error("ожидали покупку");
    expect(res.state.equipped).toEqual({ frame: "frame-wave", banner: "banner-grid", title: null });
    expect(res.state.owned).toEqual(["banner-grid", "frame-dots", "frame-wave"]);
    expect(buyAndEquipCosmetic(s, wallet(1), "frame-wave")).toEqual({ ok: false, reason: "chips" });
  });
});

describe("equipCosmetic", () => {
  const s = state(["frame-dots", "frame-wave", "banner-grid", "title-newbie"]);

  it("надевает купленное в свой слот; замена в слоте", () => {
    const a = equipCosmetic(s, "frame", "frame-dots");
    expect(a.equipped.frame).toBe("frame-dots");
    const b = equipCosmetic(a, "frame", "frame-wave");
    expect(b.equipped.frame).toBe("frame-wave");
    expect(s.equipped.frame).toBeNull();
  });

  it("не купленное и чужой слот — без изменений (тот же объект)", () => {
    expect(equipCosmetic(s, "frame", "frame-neon")).toBe(s);
    expect(equipCosmetic(s, "banner", "frame-dots")).toBe(s);
    expect(equipCosmetic(s, "title", "banner-grid")).toBe(s);
    expect(equipCosmetic(s, "frame", "nope")).toBe(s);
    expect(equipCosmetic(s, "nope" as never, "frame-dots")).toBe(s);
  });

  it("снять: null; в пустом слоте — без изменений", () => {
    const on = equipCosmetic(s, "title", "title-newbie");
    expect(equipCosmetic(on, "title", null).equipped.title).toBeNull();
    expect(equipCosmetic(s, "title", null)).toBe(s);
  });

  it("повторное «надеть» того же — тот же объект", () => {
    const on = equipCosmetic(s, "banner", "banner-grid");
    expect(equipCosmetic(on, "banner", "banner-grid")).toBe(on);
  });
});

describe("pickCaseCosmetic (приз кейса)", () => {
  const ALL = COSMETICS.map((c) => c.id);

  it("пул — редкие и выше, которых ещё нет; обычные в кейс не попадают", () => {
    const pool = caseCosmeticPool([]);
    expect(pool.every((c) => c.rarity !== "common")).toBe(true);
    expect(pool).toHaveLength(7 + 5 + 4);
    expect(caseCosmeticPool(["frame-neon", "title-legend", "frame-dots"])).toHaveLength(16 - 2);
  });

  it("не возвращает обычное и уже имеющееся при любом r", () => {
    const owned: CosmeticId[] = ["frame-neon", "frame-crown", "banner-night", "title-bug-hunter"];
    for (let i = 0; i < 2000; i++) {
      const id = pickCaseCosmetic(owned, i / 2000);
      expect(id).not.toBeNull();
      expect(owned).not.toContain(id);
      expect(cosmeticDef(id)!.rarity).not.toBe("common");
    }
  });

  it("всё редкое уже есть — null (кейс выдаст чипы)", () => {
    const rareUp = COSMETICS.filter((c) => c.rarity !== "common").map((c) => c.id);
    expect(pickCaseCosmetic(rareUp, 0.3)).toBeNull();
    expect(pickCaseCosmetic(ALL, 0.9)).toBeNull();
  });

  it("границы: r = 0 — первый из пула, r → 1 — последний; r вне [0, 1) не падает", () => {
    const pool = caseCosmeticPool([]);
    expect(pickCaseCosmetic([], 0)).toBe(pool[0].id);
    expect(pickCaseCosmetic([], 0.9999999)).toBe(pool[pool.length - 1].id);
    expect(pickCaseCosmetic([], -1)).toBe(pool[0].id);
    expect(pickCaseCosmetic([], 5)).toBe(pool[pool.length - 1].id);
  });

  it("веса на каждое украшение: legendary 1 · epic 2 · rare 3", () => {
    expect(COSMETIC_CASE_WEIGHT).toEqual({ legendary: 1, epic: 2, rare: 3 });
    const N = 35_000;
    const counts = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const id = pickCaseCosmetic([], (i + 0.5) / N)!;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    // 7 редких × 3 + 5 эпических × 2 + 4 легендарных × 1 = 35 долей
    for (const c of caseCosmeticPool([])) {
      expect(counts.get(c.id), c.id).toBe(COSMETIC_CASE_WEIGHT[c.rarity as "rare" | "epic" | "legendary"] * 1000);
    }
  });

  it("чем больше есть, тем чаще выпадает оставшееся: шансы пересчитываются", () => {
    // остались только легендарные — каждый по 1/4
    const owned = COSMETICS.filter((c) => c.rarity === "rare" || c.rarity === "epic").map((c) => c.id);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) seen.add(pickCaseCosmetic(owned, (i + 0.5) / 400)!);
    expect([...seen].sort()).toEqual(["banner-gold", "frame-crown", "frame-rainbow", "title-legend"]);
  });
});
