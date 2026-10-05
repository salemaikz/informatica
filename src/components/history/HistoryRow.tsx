"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { entryScore, type HistoryEntry } from "@/lib/history";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { KindIcon, TONE_COLOR, TONE_TEXT } from "./HistoryParts";
import { detailHref, entryClock, entryPercent, entryResult, entryTitle, entryTone, mistakeCounts } from "./logic";

/** Строка списка: иконка вида, заголовок, время, результат, полоска цвета, ошибки. */
export function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const { t } = useT();
  const tone = entryTone(entry);
  const counts = mistakeCounts(entry);
  const clean = counts.total === 0 && entryScore(entry) >= 1;
  const clock = entryClock(entry.at);
  const kind = t(`history.kind.${entry.kind}` as DictKey);

  return (
    <Link
      href={detailHref(entry.id)}
      className="block rounded-3xl border-2 border-border bg-surface p-3.5 transition-transform hover:bg-surface-2 active:translate-y-0.5"
    >
      <div className="flex items-center gap-3">
        <KindIcon kind={entry.kind} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold leading-tight">{entryTitle(entry, t)}</p>
          <p className="mt-0.5 truncate text-xs font-bold text-muted">{clock ? `${clock} · ${kind}` : kind}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("font-extrabold leading-tight tabular-nums", TONE_TEXT[tone])}>{entryPercent(entry)}%</p>
          {/* «верно X из N»: пропущенные задания входят в N (#66) */}
          <p className="text-xs font-bold tabular-nums text-muted">{entryResult(entry, t)}</p>
        </div>
        <ChevronRight size={18} className="-mr-1 shrink-0 text-muted" aria-hidden />
      </div>
      <ProgressBar value={entryScore(entry)} color={TONE_COLOR[tone]} height={6} className="mt-3" label={entryResult(entry, t)} />
      {(counts.total > 0 || clean) && (
        <p className={cn("mt-2 text-xs font-extrabold", counts.open > 0 ? "text-danger" : "text-success-strong")}>
          {counts.total > 0 ? t("history.row.mistakes", { n: counts.total, k: counts.fixed }) : t("history.row.clean")}
        </p>
      )}
    </Link>
  );
}
