import { Cpu, Heart, Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CasePrize } from "@/lib/level-case";
import { cosmeticDef } from "@/lib/cosmetics";
import type { DictKey } from "@/i18n/dict";
import { cosmeticWhat } from "@/components/cosmetics/names";
import { XpIcon } from "@/components/economy/XpIcon";
import { CosmeticTile } from "./CosmeticPrize";

type Translate = (key: DictKey, params?: Record<string, string | number>) => string;

/** Название приза кейса для ученика. */
export function prizeName(prize: CasePrize, t: Translate): string {
  switch (prize.kind) {
    case "xp":
      return t("case.prize.xp", { n: prize.amount });
    case "hearts":
      return t("case.prize.hearts");
    case "chips":
      return t("case.prize.chips", { n: prize.amount });
    case "boost":
      return t("case.prize.boost");
    case "cosmetic":
      return prize.cosmetic ? cosmeticWhat(prize.cosmetic, t) : "";
  }
}

/** Короткая подпись для карточки в ленте: у украшения — «Рамка» / «Фон» / «Титул» (полное название в узкую карточку не влезает). */
export function prizeShortName(prize: CasePrize, t: Translate): string {
  const def = prize.kind === "cosmetic" ? cosmeticDef(prize.cosmetic) : undefined;
  return def ? t(`cosmetics.noun.${def.slot}`) : prizeName(prize, t);
}

/** Пояснение к призу (после открытия); чипы вместо полных сердечек — с пометкой почему. */
export function prizeDesc(prize: CasePrize, t: Translate): string {
  switch (prize.kind) {
    case "xp":
      return t("case.prize.xp.desc");
    case "hearts":
      return t("case.prize.hearts.desc");
    case "chips":
      return prize.id === "chips15" ? t("case.prize.chips.swap") : t("case.prize.chips.desc");
    case "boost":
      return t("case.prize.boost.desc");
    case "cosmetic":
      return t("cosmetics.case.desc");
  }
}

/** Плитка с иконкой приза: золото — XP, чипы и бустер опыта; розово-красный — только сердечки; цвет редкости — украшения. */
export function PrizeIcon({ prize, size = 40, className }: { prize: CasePrize; size?: number; className?: string }) {
  // Украшение — плитка цвета редкости с превью на аватаре ученика (а не золотая плитка с иконкой).
  if (prize.kind === "cosmetic" && prize.cosmetic) return <CosmeticTile id={prize.cosmetic} size={size} className={className} />;
  const hearts = prize.kind === "hearts";
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl border-2",
        hearts ? "border-heart bg-heart-soft text-heart" : "border-gold bg-gold-soft text-warning-strong",
        className,
      )}
    >
      {prize.kind === "xp" && <XpIcon size={size * 0.5} decorative />}
      {hearts && <Heart size={size} fill="currentColor" />}
      {prize.kind === "chips" && <Cpu size={size} className="text-gold" />}
      {prize.kind === "boost" && <Zap size={size} fill="currentColor" className="text-gold" />}
    </span>
  );
}
