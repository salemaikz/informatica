"use client";

import { EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import type { TopRowView } from "@/lib/social/view";
import { useT } from "@/i18n/useT";
import { PlayerAvatar, useShowName } from "./PlayerCard";
import { ReportPlayerButton } from "./ReportPlayerButton";

// Топ друзей за неделю (этап 16Д, Ф3; docs/specs/duels.md §5): место, игрок (рамка, имя, уровень), очки недели — только
// проверенные сервером результаты с людьми. Друг скрыл очки — «скрыто». Своя строка подсвечена primary.

export function FriendsTop({ rows, limit, report }: { rows: readonly TopRowView[]; limit: number; report?: boolean }) {
  const { t } = useT();
  const show = useShowName();
  const shown = rows.slice(0, limit);
  return (
    <ol className="flex flex-col gap-1.5" data-testid="friends-top">
      {shown.map((r, k) => (
        <li
          key={r.card.code}
          data-code={r.card.code}
          className={cn("flex min-h-12 items-center gap-2.5 rounded-2xl border-2 px-3 py-1.5", r.me ? "border-primary/40 bg-primary-soft" : "border-border bg-surface")}
        >
          <span className={cn("w-6 shrink-0 text-center font-mono text-sm font-black tabular-nums", k === 0 && r.score ? "text-ink-gold" : "text-muted")}>{k + 1}</span>
          <PlayerAvatar card={r.card} size={30} />
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className={cn("truncate text-sm font-extrabold", r.me && "text-ink-primary")}>{show(r.card)}</span>
            {r.me && <span className="shrink-0 text-xs font-bold text-muted">({t("social.top.you")})</span>}
            <span className="shrink-0 text-xs font-bold text-muted">· {r.card.lv}</span>
          </span>
          {r.score === null ? (
            <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-muted">
              <EyeOff size={14} aria-hidden />
              {t("social.top.hidden")}
            </span>
          ) : (
            <span className="shrink-0 font-mono text-base font-extrabold tabular-nums" data-testid="top-score">
              {r.score}
            </span>
          )}
          {report && !r.me && <ReportPlayerButton card={r.card} where="top" />}
        </li>
      ))}
    </ol>
  );
}
