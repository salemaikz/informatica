"use client";

import { Check, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { pluralIndex, type LessonReadStatus, type ReadingStats } from "@/lib/theory";
import type { L } from "@/lib/types";
import { Pill } from "@/components/ui/Pill";

const CARDS_KEY: DictKey[] = ["theory16c.cards.one", "theory16c.cards.few", "theory16c.cards.many"];

/** Кружок с номером: пройден — зелёный с галочкой, прочитан — синий, не начат — пустой. */
const NUMBER_CLASS: Record<LessonReadStatus, string> = {
  done: "border-success bg-success text-white",
  read: "border-primary/40 bg-primary-soft text-primary",
  new: "border-border bg-surface text-muted",
};

/**
 * Строка урока в разделе «Теории»: номер по порядку и статус (пройден / прочитан / не начат), название, сколько карточек.
 * Готовый — ссылка на чтение; «скоро» — серая и некликабельная (number не нужен).
 */
export function LessonCard({
  id,
  number,
  title,
  stats,
  status = "new",
  color,
}: {
  id: string;
  /** Номер урока в разделе (с 1); у «скоро» не нужен. */
  number?: number;
  title: L;
  /** null — урок ещё не готов. */
  stats: ReadingStats | null;
  status?: LessonReadStatus;
  color: string;
}) {
  const { t, l, lang } = useT();

  if (!stats) {
    return (
      <li className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-surface-2/50 px-3 py-2.5 text-muted">
        <span className="min-w-0 flex-1 text-sm font-bold">{l(title)}</span>
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
          "group flex items-center gap-3 rounded-2xl border-2 border-border bg-surface px-3 py-3 transition-colors hover:bg-surface-2",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
        )}
      >
        <span
          aria-hidden
          className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-extrabold tabular-nums", NUMBER_CLASS[status])}
          style={status === "new" ? { borderColor: `color-mix(in srgb, ${color} 45%, var(--border))` } : undefined}
        >
          {status === "done" ? <Check size={18} strokeWidth={3.5} /> : number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-snug">{l(title)}</p>
          {/* Статус — в строке со статистикой, чтобы не сжимать длинное (казахское) название. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-xs font-bold text-muted">
              {t(CARDS_KEY[lang === "ru" ? pluralIndex(stats.cards) : 2], { n: stats.cards })} · {t("theory16c.min", { n: stats.minutes })}
            </p>
            {status === "done" && <Pill tone="success">{t("theory16c.status.done")}</Pill>}
            {status === "read" && <Pill tone="primary">{t("theory16c.status.read")}</Pill>}
            {status === "new" && <span className="sr-only">{t("theory16c.status.new")}</span>}
          </div>
        </div>
        <ChevronRight size={20} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}
