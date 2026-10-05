"use client";

import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/cn";
import { COSMETIC_SLOTS, cosmeticsOfSlot, type CosmeticDef, type CosmeticSlot } from "@/lib/cosmetics";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RARITY_LABEL, RARITY_TEXT } from "@/components/ui/rarity";
import { CosmeticPreview } from "./CosmeticPreview";
import { cosmeticName } from "./names";

const SLOT_LABEL: Record<CosmeticSlot, DictKey> = {
  frame: "cosmetics.slot.frame",
  banner: "cosmetics.slot.banner",
  title: "cosmetics.slot.title",
};

function OwnedTile({ def, on }: { def: CosmeticDef; on: boolean }) {
  const { t } = useT();
  const equip = useApp((s) => s.equipCosmetic);
  const name = cosmeticName(def.id, t);
  return (
    <li className={cn("flex min-w-0 flex-col gap-2 rounded-2xl border-2 bg-surface p-2", on ? "border-primary" : "border-border")}>
      <CosmeticPreview id={def.id} />
      <div className="min-w-0 px-0.5">
        <p className="break-words text-sm font-extrabold leading-tight">{name}</p>
        <p className={cn("text-xs font-extrabold", RARITY_TEXT[def.rarity])}>{t(RARITY_LABEL[def.rarity])}</p>
      </div>
      <Button
        variant={on ? "secondary" : "primary"}
        size="sm"
        block
        aria-label={`${on ? t("cosmetics.act.unequip") : t("cosmetics.act.equip")}: ${name}`}
        onClick={() => equip(def.slot, on ? null : def.id)}
      >
        {on ? t("cosmetics.act.unequip") : t("cosmetics.act.equip")}
      </Button>
    </li>
  );
}

/**
 * Профиль, раздел «Мои украшения»: купленное и выпавшее из кейса — по слотам, с кнопками «Надеть» / «Снять».
 * Пока ничего нет — короткий текст и ссылка «В магазин».
 */
export function MyCosmetics() {
  const { t } = useT();
  const cosmetics = useApp((s) => s.cosmetics);

  return (
    <Card id="my-cosmetics" className="scroll-mt-20">
      <h2 className="text-lg font-extrabold">{t("cosmetics.mine.title")}</h2>
      {cosmetics.owned.length === 0 ? (
        <div className="mt-1 flex flex-col items-start gap-3">
          <p className="text-sm font-semibold text-muted">{t("cosmetics.mine.empty")}</p>
          <ButtonLink href="/shop#shop-cosmetics" variant="secondary" icon={<ShoppingBag size={18} aria-hidden="true" />}>
            {t("cosmetics.mine.shop")}
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-1 flex flex-col gap-4">
          <p className="text-sm font-semibold text-muted">{t("cosmetics.mine.hint")}</p>
          {COSMETIC_SLOTS.map((slot) => {
            const mine = cosmeticsOfSlot(slot).filter((c) => cosmetics.owned.includes(c.id));
            return (
              <section key={slot} className="flex flex-col gap-2">
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-muted">
                  {t(SLOT_LABEL[slot])} <span className="tabular-nums">· {mine.length}</span>
                </h3>
                {mine.length === 0 ? (
                  <p className="text-sm font-semibold text-muted">{t("cosmetics.mine.slotEmpty")}</p>
                ) : (
                  <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {mine.map((def) => (
                      <OwnedTile key={def.id} def={def} on={cosmetics.equipped[slot] === def.id} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}
