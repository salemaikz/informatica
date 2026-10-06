"use client";

import { UserRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { playerLabel } from "@/lib/duel/live";
import type { PublicCard } from "@/lib/duel/types";
import { useT } from "@/i18n/useT";
import { LevelBadge } from "@/components/app/LevelBadge";
import { AvatarFrame } from "@/components/cosmetics/AvatarFrame";
import { TitleTag } from "@/components/cosmetics/TitleTag";

// Живой соперник на экранах дуэли (этап 16Д, Ф4; docs/specs/duels.md §7–§8): имя из профиля после фильтра сервера
// (нет имени — «Игрок 4821» на языке зрителя), уровень, надетые рамка и титул. Фото-аватар и буквенный аватар
// на сервер не уходят — у соперника нейтральная иконка в его рамке.

/** Подпись соперника: имя или номер. */
export function useOppName(card: Pick<PublicCard, "code" | "name"> | null): string {
  const { t } = useT();
  if (!card) return t("duel.search.unknown");
  return playerLabel(card, (n) => t("duel.player.anon", { n }));
}

/** Аватар соперника: нейтральная иконка в его рамке. */
export function OppAvatar({ card, size, className }: { card: PublicCard | null; size: number; className?: string }) {
  const inner = (
    <span className="flex items-center justify-center rounded-full bg-surface-2 text-muted" style={{ width: size, height: size }} aria-hidden>
      <UserRound size={Math.round(size * 0.6)} strokeWidth={2.2} />
    </span>
  );
  if (!card?.frame || size < 40) return <span className={cn("shrink-0", className)}>{inner}</span>;
  return (
    <AvatarFrame frame={card.frame} size={size} className={className}>
      {inner}
    </AvatarFrame>
  );
}

/** Карточка соперника для «VS»: аватар, имя, уровень, титул. */
export function OppCard({ card, className }: { card: PublicCard | null; className?: string }) {
  const name = useOppName(card);
  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-2 rounded-3xl border-2 border-border bg-surface p-3 text-center", className)} data-testid="duel-opp-card">
      <AvatarFrame frame={card?.frame ?? null} size={60} reserve>
        <OppAvatar card={null} size={60} />
      </AvatarFrame>
      <p className="w-full truncate font-extrabold" data-testid="duel-opp-name">
        {name}
      </p>
      {card && <LevelBadge level={card.lv} size="sm" />}
      {card?.title && <TitleTag title={card.title} size="sm" className="max-w-full" />}
    </div>
  );
}
