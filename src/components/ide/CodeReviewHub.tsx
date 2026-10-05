"use client";

import { ArrowLeft, ChevronRight, Code2, Database, FileCode, Globe, Shuffle, Table2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { HeartCost } from "@/components/economy/HeartCost";
import { ENTRY_COST } from "@/lib/economy";
import { READ_KINDS } from "@/lib/code-read";
import { REVIEW_MIN_ITEMS, type ReviewArea } from "@/lib/code-review-areas";
import type { ReadKind } from "@/lib/types";
import { useT } from "@/i18n/useT";

const AREA_ICON: Record<ReviewArea, LucideIcon> = {
  py: Code2,
  db: Database,
  sql: FileCode,
  sheet: Table2,
  web: Globe,
  mix: Shuffle,
};

export interface ReviewAreaCount {
  id: ReviewArea;
  total: number;
  byKind: Partial<Record<ReadKind, number>>;
}

/**
 * /code/review: тренировка «Чтение кода» как на ЕНТ (#87) — выбор области, 10 заданий в тренировке.
 * Счётчики считает сервер (page.tsx): банк ЕНТ не попадает в клиентский код страницы.
 */
export function CodeReviewHub({ areas }: { areas: readonly ReviewAreaCount[] }) {
  const { t } = useT();

  return (
    <div className="flex flex-col gap-5">
      <ButtonLink href="/code" variant="ghost" icon={<ArrowLeft size={18} />} className="-ml-2 self-start">
        {t("ide.title")}
      </ButtonLink>

      <div>
        <h1 className="text-2xl font-extrabold">{t("codeview.title")}</h1>
        <p className="font-semibold text-muted">{t("codeview.subtitle")}</p>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {areas.map((a) => {
          const Icon = AREA_ICON[a.id];
          const ready = a.total >= REVIEW_MIN_ITEMS;
          const body = (
            <>
              <span className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Icon size={26} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-extrabold leading-tight">{t(`codeview.area.${a.id}`)}</span>
                  <span className="block text-sm font-semibold text-muted">{t(`codeview.area.${a.id}.about`)}</span>
                </span>
                {ready && <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />}
              </span>
              <span className="flex flex-wrap gap-2">
                <Pill tone={ready ? "primary" : "muted"}>{ready ? t("codeview.count", { n: a.total }) : t("codeview.few")}</Pill>
                {READ_KINDS.filter((k) => k !== "output" && (a.byKind[k] ?? 0) > 0).map((k) => (
                  <Pill key={k} tone="muted">
                    {t(`codeview.kind.${k}`)} · {a.byKind[k]}
                  </Pill>
                ))}
              </span>
            </>
          );
          return (
            <li key={a.id} className="min-w-0">
              {ready ? (
                <Link
                  href={`/drill?mode=codeview&area=${a.id}`}
                  className="flex h-full min-h-16 flex-col gap-2 rounded-3xl border-2 border-border bg-surface p-4 transition-colors hover:bg-surface-2 active:translate-y-px"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex h-full min-h-16 flex-col gap-2 rounded-3xl border-2 border-dashed border-border bg-surface p-4 opacity-70">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
        {t("econ16c.codeview.note")}
        <HeartCost n={ENTRY_COST.drill} />
      </p>
    </div>
  );
}
