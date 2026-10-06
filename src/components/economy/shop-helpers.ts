import { MINUTE, DAY, REFILL_MIN_MISSING, SHOP_ITEMS, itemPrice, type BuyFail, type HeartsView, type ShopItem } from "@/lib/economy";
import { daysText } from "@/lib/goals";
import type { Lang } from "@/lib/types";

// Чистые помощники магазина (без React): подписи времени, доступность покупки, группировка истории чипов.

/** «1 ч 20 мин», «12 мин», «< 1 мин» — оставшееся время до сердечка или конца бустера. */
export function formatRemaining(ms: number, lang: Lang): string {
  const h = lang === "kk" ? "сағ" : "ч";
  const min = "мин";
  if (ms <= 0) return `< 1 ${min}`;
  const totalMin = Math.max(1, Math.ceil(ms / MINUTE));
  if (totalMin >= 24 * 60) return daysText(Math.ceil(ms / DAY), lang);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (!hours) return `${mins} ${min}`;
  return mins ? `${hours} ${h} ${mins} ${min}` : `${hours} ${h}`;
}

/** Длительность бустера из набора за деньги: «24 ч», «7 дней» (неразрывный пробел — число не отрывается от единицы). */
export function formatSpan(hours: number, lang: Lang): string {
  const text = hours >= 48 && hours % 24 === 0 ? daysText(hours / 24, lang) : `${hours} ${lang === "kk" ? "сағ" : "ч"}`;
  return text.replace(/ /g, "\u00a0");
}

/** Множитель: «×2», «×1,5» (запятая и в русском, и в казахском). */
export function formatMult(n: number): string {
  return `×${String(Math.round(n * 100) / 100).replace(".", ",")}`;
}

/** Число с пробелом между разрядами: 1 000. */
export function formatNum(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Компактно для шапки: до 9 999 — как есть, дальше «12,3K» / «123K» (место в шапке телефона ограничено). */
export function formatCompact(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v < 10_000) return formatNum(v);
  const k = v / 1000;
  return `${(k < 100 ? Math.floor(k * 10) / 10 : Math.floor(k)).toString().replace(".", ",")}K`;
}

export type ShopAvailability = { ok: true } | { ok: false; reason: BuyFail; missing?: number };

/**
 * Можно ли купить товар за чипы сейчас. Порядок причин как в buyItem:
 * безлимит → запас полон → набор не помещается или полный запас невыгоден (overflow) → не хватает чипов.
 * Цена — itemPrice (у полного запаса зависит от числа недостающих сердечек).
 * Для бустеров запас сердечек не важен.
 */
export function shopAvailability(item: ShopItem, hearts: HeartsView, chips: number): ShopAvailability {
  if (item.kind === "heart" || item.kind === "refill") {
    if (hearts.unlimited) return { ok: false, reason: "unlimited" };
    if (hearts.count >= hearts.max) return { ok: false, reason: "full" };
    if (item.kind === "heart" && (item.amount ?? 1) > 1 && hearts.max - hearts.count < (item.amount ?? 1)) return { ok: false, reason: "overflow" };
    if (item.kind === "refill" && hearts.max - hearts.count < REFILL_MIN_MISSING) return { ok: false, reason: "overflow" };
  }
  const price = itemPrice(item, hearts);
  if (chips < price) return { ok: false, reason: "chips", missing: price - chips };
  return { ok: true };
}

/** Сколько сердечек добавит товар (для подписи). */
export function heartsGain(item: ShopItem, hearts: HeartsView): number {
  if (item.kind === "heart") return item.amount ?? 1;
  if (item.kind === "refill" && !hearts.unlimited) return Math.max(0, hearts.max - hearts.count);
  return 0;
}

/** Ключ товара из note записи «buy»: только известные id (note приходит из localStorage). */
export function knownShopId(note: string | undefined): ShopItem["id"] | undefined {
  return SHOP_ITEMS.find((i) => i.id === note)?.id;
}

const AI_KINDS = ["hint", "explain", "ask", "chat", "voice", "photo", "feedback"] as const;
export function knownAiKind(note: string | undefined): (typeof AI_KINDS)[number] | undefined {
  return AI_KINDS.find((k) => k === note);
}

/** Подпись дня для истории: «Сегодня» / «Вчера» / «2 окт.» — по разнице календарных дней. */
export function dayDiff(at: number, now: number): number {
  const a = new Date(at);
  const b = new Date(now);
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / DAY);
}

/** «14:05» — время записи. */
export function formatClock(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Через сколько мс вернётся сердечко (0, если запас полон или безлимит). */
export function heartWaitMs(v: HeartsView, now: number): number {
  return v.nextAt === null ? 0 : Math.max(0, v.nextAt - now);
}

/** Обратный отсчёт часами: «4:12», «12:30», «1:05:30». Минус и ноль — «0:00». */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Нужно ли показывать строку множителя: часы уже идут (now > 0, не SSR), идёт бустер и итоговый множитель больше ×1. */
export function showBoostLine(boost: { until: number } | null, multiplier: number, now: number): boolean {
  return now > 0 && boost !== null && boost.until > now && multiplier > 1;
}
