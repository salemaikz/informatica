"use client";

import { Star } from "lucide-react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import type { Stars } from "@/lib/exam";

/** Три звезды теста по разделу: золотые — заработанные. Для скринридера — одна подпись, значки скрыты. */
export function StarRow({ stars, size = 20, className }: { stars: Stars; size?: number; className?: string }) {
  const { t } = useT();
  return (
    <span role="img" aria-label={t("exam.unit.stars", { n: stars })} className={cn("flex shrink-0 items-center gap-0.5", className)}>
      {[0, 1, 2].map((i) => (
        <Star key={i} size={size} aria-hidden strokeWidth={2} fill={i < stars ? "currentColor" : "none"} className={i < stars ? "text-gold" : "text-border"} />
      ))}
    </span>
  );
}
