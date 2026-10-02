"use client";

import { ChevronRight, History } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { historyTotals } from "@/lib/history";
import { useApp } from "@/lib/store";

/** Строка-ссылка на «Практике»: история тестов рядом с работой над ошибками. */
export function HistoryPracticeCard() {
  const { t } = useT();
  const count = useApp((s) => s.history.length);
  return (
    <Link href="/history" className="flex items-center gap-4 rounded-3xl border-2 border-border bg-surface p-4 hover:bg-surface-2 active:translate-y-0.5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <History size={26} strokeWidth={2.4} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold">{t("history.practice.title")}</span>
        <span className="block text-sm font-semibold text-muted">{t("history.practice.desc")}</span>
      </span>
      {count > 0 && <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-extrabold tabular-nums text-muted">{count}</span>}
      <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />
    </Link>
  );
}

/** Карточка в «Прогрессе»: итоги истории тестов и ссылка на неё. */
export function HistoryStatsCard() {
  const { t } = useT();
  const history = useApp((s) => s.history);
  const mistakes = useApp((s) => s.mistakes.length);
  const totals = useMemo(() => historyTotals(history), [history]);
  const percent = Math.round(totals.avgScore * 100);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <History size={24} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-extrabold">{t("history.stats.title")}</p>
          {totals.tests > 0 ? (
            <>
              <p className="text-sm font-semibold text-muted">
                {t("history.stats.line", { n: totals.tests, p: percent })}
              </p>
              <p className={cn("text-sm font-extrabold", mistakes > 0 ? "text-danger" : "text-success-strong")}>{t("history.stats.open", { n: mistakes })}</p>
            </>
          ) : (
            <p className="text-sm font-semibold text-muted">{t("history.stats.empty")}</p>
          )}
        </div>
      </div>
      <ButtonLink href="/history" variant="secondary" block>
        {t("history.stats.link")}
      </ButtonLink>
    </Card>
  );
}
