"use client";

import { ChevronRight, Inbox, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { getTop, type HomeData } from "@/lib/social/client";
import { challengePath } from "@/lib/duel/challenge";
import type { TopRowView } from "@/lib/social/view";
import { useT } from "@/i18n/useT";
import { Pill } from "@/components/ui/Pill";
import { FriendsTop } from "@/components/social/FriendsTop";
import { useShowName } from "@/components/social/PlayerCard";
import { MODE_TITLE } from "./mode-meta";

// Карточка «Друзья» на хабе дуэлей (этап 16Д, Ф3; docs/specs/duels.md §9): топ-3 друзей за неделю, входящие (кто сыграл против
// моей записи), число заявок и вход на /duel/friends. Нет профиля игрока — приглашение добавить друзей.

export function FriendsCard({ home }: { home: HomeData | null }) {
  const { t } = useT();
  const show = useShowName();
  const [top, setTop] = useState<TopRowView[] | null>(null);
  const hasPlayer = !!home?.player;

  useEffect(() => {
    if (!hasPlayer) return;
    const ctl = new AbortController();
    void getTop(Date.now(), ctl.signal).then((r) => {
      if (!ctl.signal.aborted && r.ok && r.data) setTop(r.data);
    });
    return () => ctl.abort();
  }, [hasPlayer]);

  const inbox = home?.inbox ?? [];
  const requests = home?.requests ?? 0;
  return (
    <section className="flex flex-col gap-3 rounded-3xl border-2 border-border bg-surface p-4" data-testid="duel-friends-card">
      <Link href="/duel/friends" className="flex items-center gap-2 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-ink-primary">
          <Users size={18} aria-hidden />
        </span>
        <span className="flex-1 text-lg font-extrabold">{t("social.friends.title")}</span>
        {requests > 0 && <Pill tone="primary">{t("social.hub.requests", { n: requests })}</Pill>}
        <ChevronRight size={20} className="text-muted" aria-hidden />
      </Link>

      {!hasPlayer ? (
        <Link href="/duel/friends" className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-border px-3 py-3 text-sm font-semibold text-muted hover:bg-surface-2">
          <UserPlus size={18} className="shrink-0" aria-hidden />
          {t("social.hub.empty")}
        </Link>
      ) : (
        <>
          {inbox.length > 0 && (
            <div className="flex flex-col gap-1.5" data-testid="duel-inbox">
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-muted">
                <Inbox size={16} aria-hidden />
                {t("social.hub.inbox", { n: inbox.length })}
              </p>
              {inbox.slice(0, 3).map((it) => (
                <Link
                  key={`${it.id}.${it.at}`}
                  href={challengePath(it.id)}
                  className="flex min-h-12 items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2 hover:bg-border/40"
                  data-testid="duel-inbox-item"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold">{it.from ? show(it.from) : "—"}</span>
                    <span className="block truncate text-xs font-semibold text-muted">{t(MODE_TITLE[it.mode])}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="font-mono text-sm font-extrabold tabular-nums">
                      {it.mine.score} : {it.their.score}
                    </span>
                    <span className={cn("text-xs font-extrabold", it.outcome === "win" ? "text-ink-success" : it.outcome === "draw" ? "text-ink-warning" : "text-muted")}>
                      {it.outcome === "win" ? t("social.inbox.win") : it.outcome === "draw" ? t("duel.result.draw") : t("social.inbox.loss")}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
          {top && top.length > 1 ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-extrabold text-muted">{t("social.top")}</p>
              <FriendsTop rows={top} limit={3} />
            </div>
          ) : (
            <p className="text-sm font-semibold text-muted">{t("social.top.empty")}</p>
          )}
        </>
      )}
    </section>
  );
}
