"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { HeartCost } from "@/components/economy/HeartCost";
import { useHearts } from "@/components/economy/useEconomy";
import { ENTRY_COST } from "@/lib/economy";
import { useT } from "@/i18n/useT";

/**
 * Цена задачи кода на кнопках (этап 16Г, #120): пока задача не оплачена, на «Запустить» / «Проверить» виден значок «· ♥1»,
 * а при нуле сердечек под кнопками — плашка со ссылкой в магазин. Оболочка (IdeShell) кладёт сюда `due`;
 * в песочнице провайдера нет — цены нет. Значок скрыт от скринридера: имя кнопки остаётся «Проверить» (на него опираются тесты).
 */
const EntryPriceCtx = createContext(false);

export function EntryPriceProvider({ due, children }: { due: boolean; children: ReactNode }) {
  return <EntryPriceCtx.Provider value={due}>{children}</EntryPriceCtx.Provider>;
}

/** Вход в задачу ещё не оплачен (на кнопках виден значок цены): узкие кнопки прячут иконку, чтобы подпись не переносилась. */
export function useEntryDue(): boolean {
  return useContext(EntryPriceCtx);
}

/** Подпись платной кнопки: текст и, пока вход не оплачен, «· ♥1». */
export function PaidLabel({ children }: { children: ReactNode }) {
  const due = useContext(EntryPriceCtx);
  if (!due) return <>{children}</>;
  return (
    <>
      <span className="whitespace-nowrap">{children}</span>
      <span aria-hidden className="inline-flex items-center gap-1.5">
        <span className="opacity-70 max-[399px]:hidden">·</span>
        <HeartCost n={ENTRY_COST.code} variant="solid" />
      </span>
    </>
  );
}

/** Под кнопками: вход не оплачен, а сердечек не хватает — подсказка и ссылка в магазин (запуск откроет окно «Сердечки закончились»). */
export function EntryNote() {
  const { t } = useT();
  const due = useContext(EntryPriceCtx);
  const hearts = useHearts();
  if (!due || hearts.unlimited || hearts.count >= ENTRY_COST.code) return null;
  return (
    <p className="flex items-center gap-2 rounded-2xl bg-heart-soft px-3 py-2 text-sm font-bold text-ink-heart">
      <Heart size={16} className="shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{t("pol16d.code.noHearts")}</span>
      <Link href="/shop" className="inline-flex min-h-11 shrink-0 items-center rounded-xl border-2 border-heart/40 bg-surface px-3 font-extrabold text-ink-heart hover:bg-surface-2">
        {t("pol16d.code.toShop")}
      </Link>
    </p>
  );
}
