"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { isPartialWindow, skillDaysSince } from "@/lib/progress";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { useNow } from "@/components/economy/useEconomy";
import { formatDate } from "./format";

/**
 * Честная подпись про данные: срез по навыкам копится с версии 0.11 (#71). Если он короче выбранного периода —
 * «Данные с {дата}» (или «Данных пока нет»); когда период покрыт полностью — ничего не показываем.
 */
export function DataSince({ period, className }: { period: number; className?: string }) {
  const { t } = useT();
  const skillDays = useApp((s) => s.skillDays);
  const now = useNow();
  const since = useMemo(() => skillDaysSince(skillDays), [skillDays]);
  // now === 0 — серверный снимок до гидратации: не мигаем подписью.
  if (!now || !isPartialWindow(since, now, period)) return null;
  return <p className={cn("text-xs font-bold text-muted", className)}>{since ? t("progress.since", { date: formatDate(since) }) : t("progress.since.none")}</p>;
}
