"use client";

import { UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { playerTag, visibleName } from "@/lib/social/view";
import type { PublicCard } from "@/lib/duel/types";
import { useT } from "@/i18n/useT";
import { LevelBadge } from "@/components/app/LevelBadge";
import { AvatarFrame } from "@/components/cosmetics/AvatarFrame";
import { TitleTag } from "@/components/cosmetics/TitleTag";

// Чужой игрок в соцчасти (этап 16Д, Ф3; docs/specs/duels.md §7): имя после фильтра (или «Игрок 4821»), уровень, рамка,
// титул. Фото и буквенный аватар с сервера не приходят никогда — вместо аватара нейтральная заглушка внутри рамки.

/** Имя для показа: настоящее, если не скрыто мной (жалоба) и прошло фильтр, иначе «Игрок {n}». */
export function useShowName(): (card: Pick<PublicCard, "code" | "name">) => string {
  const { t } = useT();
  const hidden = useApp((s) => s.duels.hiddenNames);
  return (card) => visibleName(card, hidden) ?? t("social.player", { n: playerTag(card.code) });
}

/** Заглушка аватара другого игрока в его рамке. */
export function PlayerAvatar({ card, size = 40, className }: { card: Pick<PublicCard, "frame">; size?: number; className?: string }) {
  return (
    <AvatarFrame frame={card.frame} size={size} className={className}>
      <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted" style={{ width: size, height: size }}>
        <UserRound size={Math.round(size * 0.55)} strokeWidth={2.2} aria-hidden />
      </span>
    </AvatarFrame>
  );
}

/** Строка игрока: аватар в рамке, имя, уровень, титул; справа — действия. */
export function PlayerRow({
  card,
  right,
  sub,
  below,
  className,
  testId,
}: {
  card: PublicCard;
  right?: ReactNode;
  sub?: ReactNode;
  /** Действия отдельной строкой под игроком (узкий экран: имя не сжимается кнопками). */
  below?: ReactNode;
  className?: string;
  testId?: string;
}) {
  const show = useShowName();
  return (
    <div
      className={cn("flex flex-col gap-2 rounded-2xl border-2 border-border bg-surface px-3 py-2", className)}
      data-testid={testId}
      data-code={card.code}
    >
      <div className="flex min-h-10 items-center gap-3">
        <PlayerAvatar card={card} size={36} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-extrabold" data-testid="player-name">
              {show(card)}
            </span>
            <LevelBadge level={card.lv} size="sm" className="scale-90" />
          </span>
          {card.title ? <TitleTag title={card.title} size="md" className="self-start text-[11px]" /> : null}
          {sub}
        </div>
        {right}
      </div>
      {below}
    </div>
  );
}
