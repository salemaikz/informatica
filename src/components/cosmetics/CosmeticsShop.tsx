"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { COSMETIC_SLOTS, cosmeticsOfSlot, type CosmeticId, type CosmeticSlot } from "@/lib/cosmetics";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { CosmeticCard } from "./CosmeticCard";
import { TryOnSheet } from "./TryOnSheet";

const SLOT_LABEL: Record<CosmeticSlot, DictKey> = {
  frame: "cosmetics.slot.frame",
  banner: "cosmetics.slot.banner",
  title: "cosmetics.slot.title",
};

/**
 * Раздел магазина «Украшения профиля»: переключатель «Рамки · Фоны · Титулы» (крупные сегменты) и сетка карточек —
 * 2 колонки на телефоне, 3 на широком экране. Нажатие на карточку — шторка «Примерка». Метка `data-tour="shop-cosmetics"`.
 */
export function CosmeticsShop() {
  const { t } = useT();
  const owned = useApp((s) => s.cosmetics.owned);
  const [slot, setSlot] = useState<CosmeticSlot>("frame");
  // Что открыто в шторке — отдельно от open, чтобы содержимое не пропадало, пока шторка закрывается.
  const [sheet, setSheet] = useState<{ open: boolean; id: CosmeticId }>({ open: false, id: "frame-dots" });
  const uid = useId();
  const defs = cosmeticsOfSlot(slot);

  return (
    <section id="shop-cosmetics" data-tour="shop-cosmetics" className="flex scroll-mt-20 flex-col gap-3">
      <div>
        <h2 className="text-lg font-extrabold">{t("cosmetics.shop.title")}</h2>
        <p className="text-sm font-semibold text-muted">{t("cosmetics.shop.hint")}</p>
      </div>

      <div role="tablist" aria-label={t("cosmetics.shop.tabs")} className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
        {COSMETIC_SLOTS.map((sl) => {
          const all = cosmeticsOfSlot(sl);
          const have = all.filter((c) => owned.includes(c.id)).length;
          const on = sl === slot;
          return (
            <button
              key={sl}
              type="button"
              role="tab"
              id={`${uid}-tab-${sl}`}
              aria-controls={`${uid}-panel`}
              aria-selected={on}
              onClick={() => setSlot(sl)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center rounded-xl px-1 py-1 text-sm font-extrabold leading-tight transition-colors focus-visible:outline-3 focus-visible:outline-primary",
                on ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-text",
              )}
            >
              {t(SLOT_LABEL[sl])}
              <span className="text-[11px] font-bold tabular-nums opacity-70">
                {have}/{all.length}
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${slot}`} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {defs.map((def) => (
          <CosmeticCard key={def.id} def={def} onOpen={() => setSheet({ open: true, id: def.id })} />
        ))}
      </div>

      <TryOnSheet open={sheet.open} id={sheet.id} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
    </section>
  );
}
