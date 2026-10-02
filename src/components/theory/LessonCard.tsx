"use client";

import { Check, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { pluralIndex, type ReadingStats } from "@/lib/theory";
import type { L } from "@/lib/types";
import { Pill } from "@/components/ui/Pill";

const CARDS_KEY: DictKey[] = ["theory.cards.one", "theory.cards.few", "theory.cards.many"];

/** Карточка урока в справочнике: готовый — ссылка на чтение, «скоро» — серая и некликабельная. */
export function LessonCard({
  id,
  title,
  description,
  stats,
  done,
  color,
}: {
  id: string;
  title: L;
  description?: L;
  /** null — урок ещё не готов. */
  stats: ReadingStats | null;
  done?: boolean;
  color: string;
}) {
  const { t, l, lang } = useT();

  if (!stats) {
    return (
      <li className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-surface-2/50 px-4 py-3 text-muted">
        <span className="min-w-0 flex-1 font-bold">{l(title)}</span>
        <Pill tone="muted" icon={<Clock size={12} />}>
          {t("common.soon")}
        </Pill>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={`/theory/${id}`}
        className={cn(
          "group flex items-center gap-3 rounded-2xl border-2 border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-2",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
        )}
      >
        <span aria-hidden className="h-10 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-snug">{l(title)}</p>
          {description && <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-muted">{l(description)}</p>}
          {/* «Пройден» — в строке со статистикой, чтобы не сжимать длинное (казахское) название. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-xs font-bold text-muted">
              {t(CARDS_KEY[lang === "ru" ? pluralIndex(stats.cards) : 2], { n: stats.cards })} · {t("theory.readMin", { n: stats.minutes })}
            </p>
            {done && (
              <Pill tone="success" icon={<Check size={12} strokeWidth={3.5} />}>
                {t("theory.done")}
              </Pill>
            )}
          </div>
        </div>
        <ChevronRight size={20} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}
