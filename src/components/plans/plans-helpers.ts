import type { DictKey } from "@/i18n/dict";
import type { Lang } from "@/lib/types";
import { AI_DAILY_CAP, AI_UNITS, HOUR, PAID_TIERS, PLAN_FEATURES, yearSaving, type PlanTier } from "@/lib/economy";

// Чистые помощники окна тарифов (без React): разбор адреса, сравнение тарифов, форматирование.

export const PLANS_FROM = ["onboarding", "auto", "shop", "profile", "hearts", "ai"] as const;
export type PlansFrom = (typeof PLANS_FROM)[number];

/** Откуда открыли окно (параметр адреса — недоверенный). */
export function parseFrom(raw: string | null | undefined): PlansFrom | undefined {
  return (PLANS_FROM as readonly string[]).includes(raw ?? "") ? (raw as PlansFrom) : undefined;
}

/** Куда ведёт крестик: после онбординга и автопоказа — на карту, иначе «назад» (если истории нет — на карту). */
export function closeAction(from: PlansFrom | undefined, historyLength: number): "learn" | "back" {
  if (from === "onboarding" || from === "auto") return "learn";
  return historyLength > 1 ? "back" : "learn";
}

/** Подзаголовок под контекст: сердечки закончились / упёрлись в ИИ / обычный. */
export function subtitleKey(from: PlansFrom | undefined): DictKey {
  if (from === "hearts") return "plans.sub.hearts";
  if (from === "ai") return "plans.sub.ai";
  return "plans.sub.default";
}

/** Параметры текста «Ограничения ИИ»: суточный потолок (общий для тарифов) и вес фото, расшифровки голоса и «Разбора от Бита» — из economy.ts, не из словаря. */
export function aiLimitParams(): { n: number; photo: number; voice: number; review: number } {
  return { n: Math.max(...Object.values(AI_DAILY_CAP)), photo: AI_UNITS.photo, voice: AI_UNITS.voice, review: AI_UNITS.review };
}

/** Скидка за год для переключателя: гарантированная для обоих тарифов (меньший процент). */
export function yearDiscountPercent(): number {
  return Math.min(...PAID_TIERS.map((t) => yearSaving(t).percent));
}

/** «1,5» — десятичная запятая и в русском, и в казахском. */
export function formatNumber(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

/** «×1,5». */
export function formatMult(n: number): string {
  return `×${formatNumber(n)}`;
}

/** «2 ч» / «2 сағ». */
export function formatHours(ms: number, lang: Lang): string {
  return `${formatNumber(ms / HOUR)} ${lang === "kk" ? "сағ" : "ч"}`;
}

/** Подпись выбранного товара для шторки «Оплата скоро»: «Безлимит · 19 990 ₸ / год». */
export function planWhat(name: string, price: string, unit: string): string {
  return `${name} · ${price} / ${unit}`;
}

export type CellValue = { kind: "check" } | { kind: "dash" } | { kind: "text"; text: string };

export interface CompareRow {
  id: "access" | "history" | "hearts" | "regen" | "ai" | "chips";
  label: DictKey;
  cells: Record<PlanTier, CellValue>;
}

const TIERS: PlanTier[] = ["free", "lite", "unlimited"];

function perTier(fn: (tier: PlanTier) => CellValue): Record<PlanTier, CellValue> {
  return Object.fromEntries(TIERS.map((t) => [t, fn(t)])) as Record<PlanTier, CellValue>;
}

/** Строки таблицы сравнения. Значения берутся из PLAN_FEATURES — цены и лимиты в одном месте. */
export function compareRows(lang: Lang): CompareRow[] {
  const check = () => ({ kind: "check" }) as const;
  return [
    { id: "access", label: "plans.cmp.access", cells: perTier(check) },
    { id: "history", label: "plans.cmp.history", cells: perTier(check) },
    {
      id: "hearts",
      label: "plans.cmp.hearts",
      cells: perTier((t) => ({ kind: "text", text: Number.isFinite(PLAN_FEATURES[t].maxHearts) ? String(PLAN_FEATURES[t].maxHearts) : "∞" })),
    },
    {
      id: "regen",
      label: "plans.cmp.regen",
      cells: perTier((t) => (PLAN_FEATURES[t].regenMs > 0 ? { kind: "text", text: formatHours(PLAN_FEATURES[t].regenMs, lang) } : { kind: "dash" })),
    },
    {
      id: "ai",
      label: "plans.cmp.ai",
      cells: perTier((t) => ({ kind: "text", text: Number.isFinite(PLAN_FEATURES[t].aiFree) ? String(PLAN_FEATURES[t].aiFree) : "∞" })),
    },
    { id: "chips", label: "plans.cmp.chips", cells: perTier((t) => ({ kind: "text", text: formatMult(PLAN_FEATURES[t].chipMultiplier) })) },
  ];
}
