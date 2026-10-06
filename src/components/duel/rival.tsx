"use client";

import { Send } from "lucide-react";
import { cn } from "@/lib/cn";
import type { DuelBand, PublicCard } from "@/lib/duel/types";
import { useT } from "@/i18n/useT";
import { Mascot } from "@/components/mascot/Mascot";
import { PlayerAvatar, useShowName } from "@/components/social/PlayerCard";
import { BotChip } from "./BotChip";

// Соперник на экранах дуэли (этап 16Д): бот Бит (чип «бот»), запись друга (призрак, чип «запись»), живой игрок (Ф4) или
// никого — запись своего вызова другу (solo). Экраны VS, матча и итогов рисуют соперника только через эти компоненты.

export type Rival = { kind: "bot"; band: DuelBand } | { kind: "ghost" | "human"; card: PublicCard } | { kind: "solo" };

export const BOT_RIVAL = (band: DuelBand): Rival => ({ kind: "bot", band });

/** Метка «запись» у призрака (нейтральная, как «бот»). */
export function GhostChip({ className }: { className?: string }) {
  const { t } = useT();
  return (
    <span
      data-testid="ghost-chip"
      className={cn("inline-flex shrink-0 items-center rounded-full border-2 border-border bg-surface-2 px-2 py-px text-[11px] font-extrabold text-muted", className)}
    >
      {t("social.ghost.chip")}
    </span>
  );
}

/** Аватар соперника нужного размера. */
export function RivalAvatar({ rival, size }: { rival: Rival; size: number }) {
  if (rival.kind === "bot")
    return (
      <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2" style={{ width: size, height: size }}>
        <Mascot mood="neutral" size={size - 2} />
      </span>
    );
  if (rival.kind === "solo")
    return (
      <span className="flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted" style={{ width: size, height: size }}>
        <Send size={Math.round(size * 0.5)} aria-hidden />
      </span>
    );
  return <PlayerAvatar card={rival.card} size={size} />;
}

/** Имя соперника. */
export function useRivalName(): (rival: Rival) => string {
  const { t } = useT();
  const show = useShowName();
  return (rival) => (rival.kind === "bot" ? t("duel.bot.name") : rival.kind === "solo" ? t("social.solo.name") : show(rival.card));
}

/** Метка вида соперника: «бот», «запись» или ничего (живой игрок, запись своего вызова). */
export function RivalChip({ rival, className }: { rival: Rival; className?: string }) {
  if (rival.kind === "bot") return <BotChip className={className} />;
  if (rival.kind === "ghost") return <GhostChip className={className} />;
  return null;
}
