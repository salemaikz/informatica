"use client";

import { Send } from "lucide-react";
import { cn } from "@/lib/cn";
import type { DuelBand, PublicCard } from "@/lib/duel/types";
import { useT } from "@/i18n/useT";
import { Mascot } from "@/components/mascot/Mascot";
import { PlayerAvatar, useShowName } from "@/components/social/PlayerCard";
import { BotChip } from "./BotChip";

// Соперник на экранах дуэли (этап 16Д) — одна модель для DuelPlay, ChallengePlay и LivePlay:
//   bot   — Бит (вычисляемый), всегда с чипом «бот»;
//   ghost — запись друга (вызов, Ф3), чип «запись»;
//   solo  — никого: запись своего вызова другу (Ф3);
//   human — живой игрок (Ф4), без чипа; card null — ещё не известен.
// Экраны VS, матча и итогов рисуют соперника только через эти компоненты; имя — через useShowName (скрытое жалобой — «Игрок N»).

export type Rival =
  | { kind: "bot"; band: DuelBand }
  | { kind: "ghost"; card: PublicCard }
  | { kind: "human"; card: PublicCard | null }
  | { kind: "solo" };

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
  return <PlayerAvatar card={rival.card ?? { frame: null }} size={size} />;
}

/** Имя соперника. */
export function useRivalName(): (rival: Rival) => string {
  const { t } = useT();
  const show = useShowName();
  return (rival) =>
    rival.kind === "bot" ? t("duel.bot.name") : rival.kind === "solo" ? t("social.solo.name") : rival.card ? show(rival.card) : t("duel.search.unknown");
}

/** Метка вида соперника: «бот», «запись» или ничего (живой игрок, запись своего вызова). */
export function RivalChip({ rival, className }: { rival: Rival; className?: string }) {
  if (rival.kind === "bot") return <BotChip className={className} />;
  if (rival.kind === "ghost") return <GhostChip className={className} />;
  return null;
}
