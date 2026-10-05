// Украшения профиля (этап 16В, пакет P1; docs/specs/stage16c.md §3): рамка аватара, фон карточки, титул.
// Чистая логика без React: каталог, покупка, «надеть/снять», выбор приза кейса, проверка сохранения.
// Вид (рисунки) — components/cosmetics/*, названия — i18n `cosmetics.*`. Тесты — tests/cosmetics.test.ts.

import type { Wallet } from "./economy";
import type { Rarity } from "./rarity";

export type CosmeticSlot = "frame" | "banner" | "title";

/** Слоты в порядке показа (переключатель в магазине, разделы в профиле). */
export const COSMETIC_SLOTS: readonly CosmeticSlot[] = ["frame", "banner", "title"];

/** Цена в чипах по редкости. У легендарных цены нет: их выдаёт только кейс за уровень. */
export const COSMETIC_PRICE: Record<Exclude<Rarity, "legendary">, number> = { common: 80, rare: 160, epic: 320 };

/** Вес украшения в кейсе (на каждое некупленное): чем реже, тем меньше шанс. Обычные в кейс не попадают. */
export const COSMETIC_CASE_WEIGHT: Record<Exclude<Rarity, "common">, number> = { legendary: 1, epic: 2, rare: 3 };

// Единственный источник каталога: id → слот, редкость. Порядок = порядок в магазине.
const CATALOG = [
  ["frame-dots", "frame", "common"],
  ["frame-bits", "frame", "common"],
  ["frame-wave", "frame", "common"],
  ["frame-circuit", "frame", "rare"],
  ["frame-pixel", "frame", "rare"],
  ["frame-orbit", "frame", "rare"],
  ["frame-neon", "frame", "epic"],
  ["frame-galaxy", "frame", "epic"],
  ["frame-crown", "frame", "legendary"],
  ["frame-rainbow", "frame", "legendary"],
  ["banner-grid", "banner", "common"],
  ["banner-binary", "banner", "common"],
  ["banner-waves", "banner", "common"],
  ["banner-circuit", "banner", "rare"],
  ["banner-night", "banner", "rare"],
  ["banner-aurora", "banner", "epic"],
  ["banner-gold", "banner", "legendary"],
  ["title-newbie", "title", "common"],
  ["title-bit-friend", "title", "common"],
  ["title-night-coder", "title", "common"],
  ["title-bug-hunter", "title", "rare"],
  ["title-bit-lord", "title", "rare"],
  ["title-algo-master", "title", "epic"],
  ["title-ent-storm", "title", "epic"],
  ["title-legend", "title", "legendary"],
] as const satisfies readonly (readonly [string, CosmeticSlot, Rarity])[];

export type CosmeticId = (typeof CATALOG)[number][0];

export interface CosmeticDef {
  id: CosmeticId;
  slot: CosmeticSlot;
  rarity: Rarity;
  /** null — не продаётся (только кейс). */
  price: number | null;
}

export const COSMETICS: readonly CosmeticDef[] = CATALOG.map(([id, slot, rarity]) => ({
  id,
  slot,
  rarity,
  price: rarity === "legendary" ? null : COSMETIC_PRICE[rarity],
}));

const BY_ID = new Map<string, CosmeticDef>(COSMETICS.map((c) => [c.id, c]));

export const isCosmeticId = (x: unknown): x is CosmeticId => typeof x === "string" && BY_ID.has(x);

/** Описание украшения; неизвестный id (из чужого сохранения, записи истории) — undefined. */
export const cosmeticDef = (id: unknown): CosmeticDef | undefined => (typeof id === "string" ? BY_ID.get(id) : undefined);

/** Украшения одного слота в порядке каталога. */
export const cosmeticsOfSlot = (slot: CosmeticSlot): CosmeticDef[] => COSMETICS.filter((c) => c.slot === slot);

export type CosmeticEquipped = Record<CosmeticSlot, CosmeticId | null>;

export interface CosmeticsState {
  /** Что есть у ученика (куплено или выпало из кейса), без повторов. */
  owned: CosmeticId[];
  /** Что надето: по одному украшению на слот; надето только из `owned` и только в свой слот. */
  equipped: CosmeticEquipped;
}

export const EMPTY_COSMETICS: CosmeticsState = { owned: [], equipped: { frame: null, banner: null, title: null } };

export const owns = (s: Pick<CosmeticsState, "owned">, id: string): boolean => (s.owned as readonly string[]).includes(id);

/**
 * Приводит сохранение к корректному состоянию (данные из localStorage недоверенные): только известные id без повторов,
 * надето — только то, что есть в `owned` и подходит слоту. Всё остальное — пусто.
 */
export function sanitizeCosmetics(raw: unknown): CosmeticsState {
  const empty: CosmeticsState = { owned: [], equipped: { frame: null, banner: null, title: null } };
  if (typeof raw !== "object" || raw === null) return empty;
  const r = raw as { owned?: unknown; equipped?: unknown };
  const owned: CosmeticId[] = [];
  if (Array.isArray(r.owned)) for (const x of r.owned) if (isCosmeticId(x) && !owned.includes(x)) owned.push(x);
  const eq = typeof r.equipped === "object" && r.equipped !== null ? (r.equipped as Record<string, unknown>) : {};
  const equipped: CosmeticEquipped = { ...empty.equipped };
  for (const slot of COSMETIC_SLOTS) {
    const id = eq[slot];
    if (isCosmeticId(id) && owned.includes(id) && BY_ID.get(id)?.slot === slot) equipped[slot] = id;
  }
  return { owned, equipped };
}

/** chips — не хватает чипов; owned — уже есть; notForSale — легендарное (только кейс); unknown — нет такого id. */
export type CosmeticBuyFail = "chips" | "owned" | "notForSale" | "unknown";

export type CosmeticBuy =
  | { ok: true; state: CosmeticsState; wallet: Wallet }
  | { ok: false; reason: CosmeticBuyFail };

/** Результат действия стора `buyCosmetic`. */
export type CosmeticBuyResult = { ok: true } | { ok: false; reason: CosmeticBuyFail };

/**
 * Покупка за чипы: украшение попадает в `owned`, чипы списываются (`spent` растёт). Не надевает — «сразу надеть» делает стор.
 * Порядок проверок: нет такого → уже есть → не продаётся → не хватает чипов.
 */
export function buyCosmetic(s: CosmeticsState, wallet: Wallet, id: string): CosmeticBuy {
  const def = cosmeticDef(id);
  if (!def) return { ok: false, reason: "unknown" };
  if (owns(s, def.id)) return { ok: false, reason: "owned" };
  if (def.price === null) return { ok: false, reason: "notForSale" };
  if (wallet.chips < def.price) return { ok: false, reason: "chips" };
  return {
    ok: true,
    state: { ...s, owned: [...s.owned, def.id] },
    wallet: { ...wallet, chips: wallet.chips - def.price, spent: wallet.spent + def.price },
  };
}

/**
 * Надеть украшение в слот или снять (`id = null`). Чужой слот, не купленное и неизвестное украшение — состояние не меняется
 * (возвращается тот же объект).
 */
export function equipCosmetic(s: CosmeticsState, slot: CosmeticSlot, id: string | null): CosmeticsState {
  if (!COSMETIC_SLOTS.includes(slot)) return s;
  if (id === null) return s.equipped[slot] === null ? s : { ...s, equipped: { ...s.equipped, [slot]: null } };
  const def = cosmeticDef(id);
  if (!def || def.slot !== slot || !owns(s, def.id)) return s;
  if (s.equipped[slot] === def.id) return s;
  return { ...s, equipped: { ...s.equipped, [slot]: def.id } };
}

/** Купить и сразу надеть (то, что делает действие стора). */
export function buyAndEquipCosmetic(s: CosmeticsState, wallet: Wallet, id: string): CosmeticBuy {
  const res = buyCosmetic(s, wallet, id);
  if (!res.ok) return res;
  const def = cosmeticDef(id)!;
  return { ...res, state: equipCosmetic(res.state, def.slot, def.id) };
}

/** Что ещё может выпасть из кейса: редкие и выше, которых у ученика нет. */
export function caseCosmeticPool(owned: readonly string[]): CosmeticDef[] {
  return COSMETICS.filter((c) => c.rarity !== "common" && !owned.includes(c.id));
}

/**
 * Украшение для приза кейса по равномерному числу r ∈ [0, 1): среди некупленных редких и выше, вес каждого —
 * legendary 1 · epic 2 · rare 3. Всё уже есть — null (кейс тогда выдаёт чипы вместо украшения).
 */
export function pickCaseCosmetic(owned: readonly string[], r: number): CosmeticId | null {
  const pool = caseCosmeticPool(owned);
  if (!pool.length) return null;
  const weight = (c: CosmeticDef) => COSMETIC_CASE_WEIGHT[c.rarity as Exclude<Rarity, "common">];
  const total = pool.reduce((sum, c) => sum + weight(c), 0);
  let x = Math.min(Math.max(r, 0), 0.999999999) * total;
  for (const c of pool) {
    x -= weight(c);
    if (x < 0) return c.id;
  }
  return pool[pool.length - 1].id;
}
