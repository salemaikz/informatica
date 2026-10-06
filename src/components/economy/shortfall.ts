import { CHIP_PACKS, SHOP_ITEMS, canStartTrial, effectiveTier, type ChipPack, type HeartsView, type Plan, type ShopItemId } from "@/lib/economy";
import { shopAvailability } from "./shop-helpers";

// Чистая логика окна «Не хватает» (без React): что предложить, когда не хватает сердечек или чипов (#121).

export type ShortfallNeed = "hearts" | "chips";

export interface ShortfallInput {
  need: ShortfallNeed;
  /** Сердечки: сколько нужно на вход (0,5 / 1 / 2). Чипы: цена покупки или обращения к ИИ. */
  cost: number;
  chips: number;
  hearts: HeartsView;
  plan: Plan | undefined;
  now: number;
}

export interface HeartOption {
  id: ShopItemId;
  /** Чипов хватает на покупку прямо сейчас. */
  ok: boolean;
  /** Сколько чипов не хватает (0, если хватает). */
  missing: number;
}

export interface ShortfallPlan {
  /** Сколько чипов не хватает: у чипов — до цены покупки; у сердечек — до самой дешёвой подходящей покупки. */
  missingChips: number;
  /** Сердечки за чипы: только те наборы, которые помещаются в запас (лишнее не продаём). Для need="chips" — пусто. */
  heartItems: HeartOption[];
  /** Наименьший набор чипов, который закрывает нехватку (или самый большой, если ни один не хватает); null — чипов хватает. */
  pack: ChipPack | null;
  /** «Пополнить все сердечки» за ₸ (скоро): только при нехватке сердечек, пока запас не полон и нет безлимита. */
  refill: boolean;
  /** «Безлимит» предлагаем всем, кроме тех, у кого он уже есть. */
  plan: boolean;
  /** Пробный период ещё не использован. */
  trial: boolean;
  /** Когда вернётся следующее сердечко (мс); null — не ждём. */
  waitUntil: number | null;
}

const HEART_IDS: ShopItemId[] = ["heart-1", "hearts-3", "hearts-full"];

/** Наименьший набор чипов, дающий не меньше `missing` (бонус считается); не хватает ни одному — самый большой; нечего добирать — null. */
export function packFor(missing: number): ChipPack | null {
  if (missing <= 0) return null;
  const sorted = [...CHIP_PACKS].sort((a, b) => a.chips + a.bonus - (b.chips + b.bonus));
  return sorted.find((p) => p.chips + p.bonus >= missing) ?? sorted[sorted.length - 1];
}

export function shortfallOptions(input: ShortfallInput): ShortfallPlan {
  const { need, cost, chips, hearts, plan, now } = input;
  const unlimited = effectiveTier(plan ?? undefined, now) === "unlimited";

  let heartItems: HeartOption[] = [];
  if (need === "hearts") {
    heartItems = SHOP_ITEMS.filter((i) => HEART_IDS.includes(i.id))
      .map((item) => ({ id: item.id, av: shopAvailability(item, hearts, chips) }))
      .filter((x) => x.av.ok || x.av.reason === "chips")
      .map(({ id, av }) => ({ id, ok: av.ok, missing: av.ok ? 0 : (av.missing ?? 0) }));
  }

  let missingChips = 0;
  if (need === "chips") missingChips = Math.max(0, cost - chips);
  else if (heartItems.length && !heartItems.some((h) => h.ok)) missingChips = Math.min(...heartItems.map((h) => h.missing));

  return {
    missingChips,
    heartItems,
    pack: packFor(missingChips),
    refill: need === "hearts" && !hearts.unlimited && hearts.count < hearts.max,
    plan: !unlimited,
    trial: canStartTrial(plan, now),
    waitUntil: need === "hearts" && !hearts.unlimited ? hearts.nextAt : null,
  };
}
