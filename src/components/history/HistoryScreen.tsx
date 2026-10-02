"use client";

import { CircleCheck, History, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDay } from "@/components/exam/logic";
import { useNow } from "@/components/economy/useEconomy";
import { Mascot } from "@/components/mascot/Mascot";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { filterHistory, historyTotals, type HistoryFilter } from "@/lib/history";
import { useApp } from "@/lib/store";
import { toneOf } from "@/components/exam/logic";
import { TONE_TEXT } from "./HistoryParts";
import { HistoryRow } from "./HistoryRow";
import { filterCounts, groupByDay, HISTORY_FILTERS, relativeDay } from "./logic";

function Tile({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-between rounded-2xl border-2 border-border bg-surface p-3">
      <p className="text-[11px] font-extrabold leading-tight text-muted">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-extrabold leading-none tabular-nums", valueClass)}>{value}</p>
    </div>
  );
}

/** Содержимое страницы «История тестов»: итоги, работа над ошибками, фильтры, список по дням. */
export function HistoryScreen() {
  const { t, lang } = useT();
  const history = useApp((s) => s.history);
  const mistakes = useApp((s) => s.mistakes);
  const now = useNow();
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const totals = useMemo(() => historyTotals(history), [history]);
  const counts = useMemo(() => filterCounts(history), [history]);
  const groups = useMemo(() => groupByDay(filterHistory(history, filter)), [history, filter]);
  const avgPercent = Math.round(totals.avgScore * 100);
  const hasHistory = history.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">{t("history.title")}</h1>
        <p className="font-semibold text-muted">{t("history.subtitle")}</p>
      </div>

      {!hasHistory && mistakes.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <Mascot mood="thinking" size={88} />
          <p className="text-lg font-extrabold">{t("history.empty.title")}</p>
          <p className="max-w-xs text-sm font-semibold text-muted">{t("history.empty.text")}</p>
          <div className="mt-1 flex w-full max-w-xs flex-col gap-2">
            <ButtonLink href="/learn" block>
              {t("history.empty.lessons")}
            </ButtonLink>
            <ButtonLink href="/exam" variant="secondary" block>
              {t("history.empty.exam")}
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Tile label={t("history.tile.tests")} value={totals.tests} />
            <Tile
              label={t("history.tile.avg")}
              value={hasHistory ? `${avgPercent}%` : "—"}
              valueClass={hasHistory ? TONE_TEXT[toneOf(totals.avgScore)] : "text-muted"}
            />
            <Tile label={t("history.tile.open")} value={mistakes.length} valueClass={mistakes.length > 0 ? "text-danger" : "text-success-strong"} />
          </div>

          {mistakes.length > 0 ? (
            <div className="flex flex-col gap-2">
              <ButtonLink href="/drill?mode=mistakes" variant="danger" size="lg" block icon={<RotateCcw size={20} aria-hidden />}>
                {t("history.redo.cta", { n: mistakes.length })}
              </ButtonLink>
              <p className="text-center text-sm font-semibold text-muted">{t("history.redo.hint")}</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-3xl border-2 border-success/40 bg-success-soft p-4">
              <CircleCheck size={28} className="shrink-0 text-success-strong" aria-hidden />
              <div className="min-w-0">
                <p className="font-extrabold text-success-strong">{t("history.redo.done")}</p>
                <p className="text-sm font-semibold text-muted">{t("history.redo.doneHint")}</p>
              </div>
            </div>
          )}

          {hasHistory && (
            <>
              {/* Фильтры: полоса прокручивается по горизонтали, чтобы не ломать вёрстку на 360 px. */}
              <div role="group" aria-label={t("history.filter.label")} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:px-0">
                {HISTORY_FILTERS.map((f) => {
                  const active = filter === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilter(f)}
                      className={cn(
                        "flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-3.5 text-sm font-bold transition-colors",
                        active ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted hover:text-text",
                      )}
                    >
                      {t(`history.filter.${f}` as DictKey)}
                      <span className={cn("text-xs tabular-nums", active ? "text-primary" : "text-muted")}>{counts[f]}</span>
                    </button>
                  );
                })}
              </div>

              {groups.length === 0 ? (
                <p className="flex items-center justify-center gap-2 py-8 text-center font-bold text-muted">
                  <History size={18} aria-hidden /> {t("history.emptyFilter")}
                </p>
              ) : (
                <div className="flex flex-col gap-5">
                  {groups.map((g, gi) => {
                    const rel = relativeDay(g.key, now);
                    return (
                      <Reveal key={g.key} delay={Math.min(gi, 4) * 0.04}>
                        <section aria-label={rel ? t(`history.day.${rel}` as DictKey) : formatDay(g.at, lang, false, now)}>
                          <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-muted">
                            {rel ? t(`history.day.${rel}` as DictKey) : formatDay(g.at, lang, false, now)}
                          </h2>
                          <ul className="flex flex-col gap-2.5">
                            {g.entries.map((e) => (
                              <li key={e.id}>
                                <HistoryRow entry={e} />
                              </li>
                            ))}
                          </ul>
                        </section>
                      </Reveal>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
