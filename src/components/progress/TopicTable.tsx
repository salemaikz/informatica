"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { ENT_TOPICS } from "@/content/ent-topics";
import { cn } from "@/lib/cn";
import { topicStats, topicTrend } from "@/lib/progress";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Segmented } from "@/components/goals/controls";
import { useEntVisible } from "@/components/school/useEntVisible";
import { useNow } from "@/components/economy/useEconomy";
import { DataSince } from "./DataSince";
import { formatDuration, LEVEL_COLOR, percent, toneOfRatio, TONE_TEXT } from "./format";
import { Sparkline } from "./Sparkline";

type Period = 7 | 30;

/**
 * 13 тем ЕНТ: точность и время за 7 или 30 дней, полоса освоения, мини-график точности и изменение «неделя к неделе».
 * Две строки на тему — на 360 px без горизонтальной прокрутки. Показывать только при `useEntVisible()` (решает страница).
 */
export function TopicTable({ className }: { className?: string }) {
  const { t, l } = useT();
  const skills = useApp((s) => s.skills);
  const skillDays = useApp((s) => s.skillDays);
  const now = useNow();
  // Темы ЕНТ — только у ученика, готовящегося к ЕНТ (#52); школьнику таблицу не показываем, даже если её вставят по ошибке.
  const ent = useEntVisible();
  const [period, setPeriod] = useState<Period>(30);

  const rows = useMemo(() => topicStats(skillDays, skills, period, now), [skillDays, skills, period, now]);
  const trends = useMemo(() => Object.fromEntries(ENT_TOPICS.map((tp) => [tp.id, topicTrend(skillDays, tp.id, now, period)])), [skillDays, now, period]);

  if (!ent) return null;
  return (
    <Card className={className}>
      <h2 className="text-lg font-extrabold">{t("progress.topics.title")}</h2>
      <p className="text-sm font-semibold text-muted">{t("progress.topics.sub")}</p>
      <div className="my-3">
        <Segmented<Period>
          label={t("progress.topics.period")}
          value={period}
          onChange={setPeriod}
          options={[
            { id: 7, label: t("progress.topics.d7") },
            { id: 30, label: t("progress.topics.d30") },
          ]}
        />
      </div>
      <p className="mb-1 text-right text-[11px] font-extrabold text-muted">{t("progress.topics.head")}</p>
      <ul className="divide-y-2 divide-border">
        {rows.map((r) => {
          const topic = ENT_TOPICS.find((x) => x.id === r.topic)!;
          const trend = trends[r.topic];
          const change = trend.change === null ? null : Math.round(trend.change * 100);
          const tone = change === null || change === 0 ? "primary" : change > 0 ? "success" : "danger";
          const Trend = change === null || change === 0 ? Minus : change > 0 ? TrendingUp : TrendingDown;
          const details = r.n > 0 ? `${r.n} · ${formatDuration(r.sec, t)}` : "";
          const hasPoints = trend.points.some((p) => p.n > 0);
          return (
            <li key={r.topic} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate font-extrabold" title={l(topic.title)}>
                  {l(topic.short)}
                </span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-muted">{details}</span>
                <span className={cn("w-12 shrink-0 text-right font-extrabold tabular-nums", r.acc === null ? "text-muted" : TONE_TEXT[toneOfRatio(r.acc)])}>
                  {r.acc === null ? "—" : `${percent(r.acc)}%`}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <ProgressBar value={r.mastery} color={LEVEL_COLOR[r.level]} height={8} className="min-w-0 flex-1" label={t("progress.topics.mastery", { p: percent(r.mastery) })} />
                <span className="w-9 shrink-0 text-right text-xs font-extrabold tabular-nums text-muted">{percent(r.mastery)}%</span>
                <Sparkline
                  points={trend.points}
                  tone={tone}
                  label={hasPoints ? t("progress.spark.aria", { topic: l(topic.title), days: period }) : t("progress.spark.few", { topic: l(topic.title) })}
                  caption={l(topic.title)}
                  headers={[t("progress.table.day"), t("progress.table.n"), t("progress.table.acc")]}
                />
                <span
                  className={cn(
                    "flex w-11 shrink-0 items-center justify-end gap-0.5 text-xs font-extrabold tabular-nums",
                    tone === "success" ? "text-success-strong" : tone === "danger" ? "text-danger" : "text-muted",
                  )}
                >
                  {change !== null && (
                    <>
                      <Trend size={12} aria-hidden />
                      <span aria-hidden>{change > 0 ? `+${change}` : change < 0 ? `−${Math.abs(change)}` : "0"}</span>
                      {trend.recent.acc !== null && trend.prev.acc !== null && (
                        <span className="sr-only">{t("progress.trend", { a: percent(trend.recent.acc), b: percent(trend.prev.acc) })}</span>
                      )}
                    </>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-col gap-0.5">
        <DataSince period={period} />
        <p className="text-xs font-semibold text-muted">{t("progress.topics.dataHint")}</p>
      </div>
    </Card>
  );
}
