"use client";

import { XpIcon } from "@/components/economy/XpIcon";
import { BookCheck, Clock, Flame, Gamepad2, Share2, Target, Trophy } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { levelTitle } from "@/lib/gamification";
import { useLevel, useStreak } from "@/lib/hooks";
import { dayTotals } from "@/lib/progress";
import { encodeShare, type ShareResult } from "@/lib/share-code";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { ShareSheet } from "@/components/share/ShareSheet";
import { Card } from "@/components/ui/Card";
import { formatDate, formatDuration, percent, toneOfRatio, TONE_TEXT } from "./format";

function Tile({ icon, label, value, sub, action }: { icon: ReactNode; label: string; value: string | number; sub?: string; action?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border-2 border-border bg-surface p-3">
      <p className="flex items-center gap-1.5 text-xs font-extrabold text-muted">
        {icon} <span className="min-w-0 truncate">{label}</span>
      </p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {sub && <p className="truncate text-xs font-bold text-muted">{sub}</p>}
      {action}
    </div>
  );
}

/**
 * Числа «Прогресса»: XP, уровень, серия, уроки; затем точность и время — честные (#66, #68):
 * точность по баллам первых попыток («сам / с подсказкой / пропущено»), «приблизительно», если есть только старые дни;
 * время — активное, игры отдельной строкой.
 */
export function StatsTiles({ className }: { className?: string }) {
  const { t, l, lang } = useT();
  const days = useApp((s) => s.days);
  const lessons = useApp((s) => s.lessons);
  const { xp, level } = useLevel();
  const { current, best } = useStreak();
  const totals = useMemo(() => dayTotals(days), [days]);
  const passed = useMemo(() => Object.values(lessons).filter((s) => (s?.completions ?? 0) > 0).length, [lessons]);

  // «Поделиться» серией — когда она идёт (≥ 1 дня); в коде только числа, рекорд не меньше текущей серии (#72).
  const streakShare = useMemo<ShareResult | null>(() => {
    if (current < 1) return null;
    const r: ShareResult = { t: "streak", days: current, best: Math.max(best, current), lang };
    return encodeShare(r) ? r : null;
  }, [current, best, lang]);

  const acc = totals.accuracy;
  const accText = acc.value === null ? "—" : `${percent(acc.value)}%`;
  // Есть и старые дни (до учёта по баллам), и новые: точность — только по новым, честно «с {дата}», а не «за всё время» (C20).
  const accSpan = acc.partial && acc.since ? t("progress.acc.since", { date: formatDate(acc.since) }) : t("progress.acc.allTime");

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile icon={<XpIcon size={14} />} label={t("stats.totalXp")} value={xp} />
        <Tile icon={<Trophy size={14} className="text-primary" aria-hidden />} label={t("stats.level")} value={level} sub={l(levelTitle(level))} />
        <Tile icon={<Flame size={14} className="text-streak" aria-hidden />} label={t("stats.streak")} value={current}
          sub={t("stats.best", { n: best })}
          action={
            streakShare && (
              <ShareSheet source={streakShare} what="streak" label={t("share.btn.short")} icon={<Share2 size={14} className="text-streak" aria-hidden />} variant="secondary" size="sm" block className="mt-2 h-11" />
            )
          }
        />
        <Tile icon={<BookCheck size={14} className="text-primary" aria-hidden />} label={t("progress.tiles.lessons")} value={passed} />
      </div>

      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-extrabold text-muted">
            <Target size={14} className="text-success" aria-hidden /> {t("progress.acc.title")} · {accSpan}
          </p>
          <p className={cn("mt-1 text-3xl font-extrabold tabular-nums", acc.value === null ? "text-muted" : TONE_TEXT[toneOfRatio(acc.value)])}>{accText}</p>
          {acc.value !== null &&
            (acc.approx ? (
              <p className="text-xs font-bold text-muted">{t("progress.acc.approx")}</p>
            ) : (
              <p className="text-xs font-bold text-muted">
                {t("progress.acc.split", { self: totals.self, hint: totals.hinted, skip: totals.skipped })}
              </p>
            ))}
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-extrabold text-muted">
            <Clock size={14} className="text-primary" aria-hidden /> {t("progress.time.title")}
          </p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{formatDuration(totals.seconds, t)}</p>
          <p className="text-xs font-bold text-muted">{t("progress.time.active")}</p>
          {totals.gameSeconds > 0 && <p className="text-xs font-bold text-muted">{t("progress.time.games", { t: formatDuration(totals.gameSeconds, t) })}</p>}
        </div>
        {totals.games > 0 && (
          <div className="flex min-w-0 items-center gap-2 border-t-2 border-border pt-3 sm:col-span-2">
            <Gamepad2 size={18} className="shrink-0 text-primary" aria-hidden />
            <p className="min-w-0 text-sm font-bold">
              <span className="font-extrabold">{t("progress.games.title")}: </span>
              {t("progress.games.line", { n: totals.games, k: totals.gameCorrect })}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
