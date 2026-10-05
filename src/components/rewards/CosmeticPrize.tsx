"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { cosmeticDef, type CosmeticId } from "@/lib/cosmetics";
import { feedback } from "@/lib/feedback";
import type { Rarity } from "@/lib/rarity";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Avatar } from "@/components/app/Avatar";
import { AvatarFrame } from "@/components/cosmetics/AvatarFrame";
import { CosmeticPreview } from "@/components/cosmetics/CosmeticPreview";
import { ProfileBanner } from "@/components/cosmetics/ProfileBanner";
import { TitleGlyph } from "@/components/cosmetics/TitleTag";
import { cosmeticWhat } from "@/components/cosmetics/names";
import { Button } from "@/components/ui/Button";
import { RARITY_LABEL, RARITY_SOFT, RARITY_TEXT } from "@/components/ui/rarity";

// Приз-украшение в кейсе за уровень (волна P1): плитка в ленте, итог с крупным превью и кнопка «Надеть».
// Цвет приза — цвет редкости (а не золото, как у XP и чипов).

// Статические классы (Tailwind не видит собранные на лету).
const TILE: Record<Rarity, string> = {
  common: "border-rarity-common bg-rarity-common-soft",
  rare: "border-rarity-rare bg-rarity-rare-soft",
  epic: "border-rarity-epic bg-rarity-epic-soft",
  legendary: "border-rarity-legendary bg-rarity-legendary-soft",
};

/** Рамка и фон блока итога приза-украшения. */
export const COSMETIC_PRIZE_BOX: Record<Rarity, string> = {
  common: "border-rarity-common/60 bg-rarity-common-soft",
  rare: "border-rarity-rare/60 bg-rarity-rare-soft",
  epic: "border-rarity-epic/60 bg-rarity-epic-soft",
  legendary: "border-rarity-legendary/60 bg-rarity-legendary-soft",
};

/** Плитка приза-украшения для ленты кейса: рамка на аватаре ученика / полоска фона / значок титула — в цвете редкости. */
export function CosmeticTile({ id, size = 32, className }: { id: CosmeticId; size?: number; className?: string }) {
  const name = useApp((s) => s.profile.name);
  const avatar = useApp((s) => s.profile.avatar);
  const def = cosmeticDef(id);
  if (!def) return null;
  return (
    <span aria-hidden="true" className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border-2", TILE[def.rarity], className)}>
      {def.slot === "frame" && (
        <AvatarFrame frame={id} size={size} full>
          <Avatar config={avatar} name={name} size={size} />
        </AvatarFrame>
      )}
      {def.slot === "banner" && <ProfileBanner banner={id} className="absolute inset-0" />}
      {def.slot === "title" && <TitleGlyph id={id} size={size} strokeWidth={2.2} className={RARITY_TEXT[def.rarity]} />}
    </span>
  );
}

/** Содержимое итога: «Новая рамка!», крупное превью на своём аватаре, название, редкость, пояснение. */
export function CosmeticPrizeBody({ id }: { id: CosmeticId }) {
  const { t } = useT();
  const def = cosmeticDef(id);
  if (!def) return null;
  return (
    <>
      <span className={cn("rounded-full bg-surface px-3.5 py-1 text-sm font-extrabold", RARITY_TEXT[def.rarity])}>{t(`cosmetics.case.new.${def.slot}`)}</span>
      <CosmeticPreview id={id} size="lg" />
      <p className="break-words text-2xl font-extrabold leading-tight">{cosmeticWhat(id, t)}</p>
      <p className={cn("rounded-full px-3 py-0.5 text-xs font-extrabold uppercase tracking-wide", RARITY_SOFT[def.rarity], RARITY_TEXT[def.rarity])}>{t(RARITY_LABEL[def.rarity])}</p>
      <p className="text-balance font-semibold text-muted">{t("cosmetics.case.desc")}</p>
    </>
  );
}

/** Вторичная кнопка «Надеть» рядом с основной: надевает выпавшее украшение; надето — неактивная «Надето». */
export function EquipPrizeButton({ id }: { id: CosmeticId }) {
  const { t } = useT();
  const def = cosmeticDef(id);
  const on = useApp((s) => (def ? s.cosmetics.equipped[def.slot] === id : false));
  if (!def) return null;
  if (on) {
    return (
      <Button variant="secondary" size="lg" block disabled icon={<Check size={18} strokeWidth={3} aria-hidden="true" />}>
        {t("cosmetics.state.equipped")}
      </Button>
    );
  }
  return (
    <Button
      variant="secondary"
      size="lg"
      block
      onClick={() => {
        useApp.getState().equipCosmetic(def.slot, id);
        feedback("pop");
      }}
    >
      {t("cosmetics.act.equip")}
    </Button>
  );
}
