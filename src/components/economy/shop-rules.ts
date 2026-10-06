import {
  ENTRY_COST,
  PLAN_FEATURES,
  itemPrice,
  refillPrice,
  type HeartsView,
  type PlanTier,
  type ShopItem,
} from "@/lib/economy";
import type { DictKey } from "@/i18n/dict";
import { heartsGain } from "./shop-helpers";

// Чистые помощники магазина про сердечки (без React): блок «Как работают сердечки» и цена «Полного запаса».
// Все числа — из lib/economy.ts: в текстах и разметке они не вписываются.

export type EntryRuleId = "lesson" | "drill" | "check" | "exam" | "checkpoint" | "game" | "theory" | "code";

/**
 * За что платятся сердечки и сколько (#40, #60; теория — этап 15; тренировка — этап 16В; практикум кода, без «большого урока» — этап 16Г):
 * строки списка «Вход стоит сердечко».
 */
export function entryRules(): { id: EntryRuleId; cost: number }[] {
  return [
    { id: "lesson", cost: ENTRY_COST.lesson },
    { id: "drill", cost: ENTRY_COST.drill },
    { id: "check", cost: ENTRY_COST.check },
    { id: "exam", cost: ENTRY_COST.exam },
    { id: "checkpoint", cost: ENTRY_COST.checkpoint },
    { id: "game", cost: ENTRY_COST.game },
    { id: "theory", cost: ENTRY_COST.theory },
    { id: "code", cost: ENTRY_COST.code },
  ];
}

/** Что бесплатно: шпаргалка и формулы, чат с Битом (теория урока — за 0,5; тренировка любого вида и задача практикума кода — за 1, этап 16Г). */
export const FREE_ENTRIES = ["cheatsheet", "chat"] as const;
export type FreeEntryId = (typeof FREE_ENTRIES)[number];

/** Подписи строк правил в словаре. */
export const ENTRY_RULE_KEYS: Record<EntryRuleId, DictKey> = {
  lesson: "shop.rules.lesson",
  drill: "econ16c.rules.drill",
  check: "shop.rules.check",
  exam: "shop.rules.exam",
  checkpoint: "shop.rules.checkpoint",
  game: "shop.rules.game",
  theory: "hearts15.rules.theory",
  code: "hearts16d.rules.code",
};
export const FREE_ENTRY_KEYS: Record<FreeEntryId, DictKey> = {
  cheatsheet: "hearts15.rules.free.cheatsheet",
  chat: "shop.rules.free.chat",
};

export interface RegenRule {
  tier: PlanTier;
  /** Запас; Infinity — сердечки не тратятся. */
  max: number;
  /** Через сколько возвращается одно сердечко, мс (0 — у безлимита не нужно). */
  regenMs: number;
  unlimited: boolean;
}

/** Восстановление сердечек по тарифам (из PLAN_FEATURES): бесплатный, «Лайт», «Безлимит». */
export function regenRules(): RegenRule[] {
  return (["free", "lite", "unlimited"] as const).map((tier) => {
    const f = PLAN_FEATURES[tier];
    return { tier, max: f.maxHearts, regenMs: f.regenMs, unlimited: !Number.isFinite(f.maxHearts) };
  });
}

/**
 * Цена на кнопке товара (чипы). Сердечки и бустеры — цена товара; «Полный запас» — за недостающие сейчас (itemPrice).
 * Когда недостающих нет (запас полон или безлимит), товар всё равно неактивен: показываем цену запаса, пустого до конца.
 */
export function shownPrice(item: ShopItem, v: HeartsView): number {
  if (item.kind !== "refill") return item.price;
  if (heartsGain(item, v) > 0) return itemPrice(item, v);
  return refillPrice(v.unlimited ? PLAN_FEATURES.free.maxHearts : v.max);
}

/** Сколько сердечек добавит «Полный запас» сейчас — для подписи «(+N)». 0 — у других товаров и когда добавлять нечего. */
export function refillGain(item: ShopItem, v: HeartsView): number {
  return item.kind === "refill" ? heartsGain(item, v) : 0;
}
