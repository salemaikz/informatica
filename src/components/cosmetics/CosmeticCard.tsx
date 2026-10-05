"use client";

import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { owns, type CosmeticDef } from "@/lib/cosmetics";
import type { Rarity } from "@/lib/rarity";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Pill } from "@/components/ui/Pill";
import { RARITY_LABEL, RARITY_TEXT } from "@/components/ui/rarity";
import { ChipPrice } from "@/components/economy/ShopParts";
import { CosmeticPreview } from "./CosmeticPreview";
import { cosmeticName } from "./names";

// Статические классы: у редких и выше рамка карточки слегка подсвечена цветом редкости.
const CARD_BORDER: Record<Rarity, string> = {
  common: "border-border",
  rare: "border-rarity-rare/40",
  epic: "border-rarity-epic/50",
  legendary: "border-rarity-legendary/60",
};

/**
 * Карточка украшения в магазине: превью на своём аватаре и имени, название, редкость цветом и состояние —
 * цена в чипах / «Есть» / «Надето» / «Только в кейсе» (замок). Нажатие открывает шторку «Примерка».
 */
export function CosmeticCard({ def, onOpen }: { def: CosmeticDef; onOpen: () => void }) {
  const { t } = useT();
  const owned = useApp((s) => owns(s.cosmetics, def.id));
  const equipped = useApp((s) => s.cosmetics.equipped[def.slot] === def.id);
  const name = cosmeticName(def.id, t);
  const rarity = t(RARITY_LABEL[def.rarity]);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("cosmetics.card.open", { name, rarity })}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-3xl border-2 bg-surface p-2.5 text-left transition-[translate] active:translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
        equipped ? "border-primary" : CARD_BORDER[def.rarity],
      )}
    >
      <CosmeticPreview id={def.id} />
      <div className="min-w-0 px-0.5">
        <p className="break-words font-extrabold leading-tight">{name}</p>
        <p className={cn("text-xs font-extrabold", RARITY_TEXT[def.rarity])}>{rarity}</p>
      </div>
      <div className="px-0.5 pb-0.5">
        {equipped ? (
          <Pill tone="primary" icon={<Check size={13} strokeWidth={3.2} aria-hidden="true" />}>
            {t("cosmetics.state.equipped")}
          </Pill>
        ) : owned ? (
          <Pill tone="success" icon={<Check size={13} strokeWidth={3.2} aria-hidden="true" />}>
            {t("cosmetics.state.owned")}
          </Pill>
        ) : def.price === null ? (
          <Pill tone="muted" icon={<Lock size={13} strokeWidth={2.8} aria-hidden="true" />}>
            {t("cosmetics.state.caseOnly")}
          </Pill>
        ) : (
          <Pill tone="gold" className="py-1 text-sm">
            <ChipPrice n={def.price} />
          </Pill>
        )}
      </div>
    </button>
  );
}
