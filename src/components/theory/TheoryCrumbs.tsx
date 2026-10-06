"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { lessonMeta } from "@/content/catalog";
import { cn } from "@/lib/cn";
import type { LessonPlace, LessonReadStatus } from "@/lib/theory";
import { theoryUnitHref } from "@/lib/theory-href";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";

const STATUS_KEY: Record<LessonReadStatus, DictKey> = {
  done: "theory16c.status.done",
  read: "theory16c.status.read",
  new: "theory16c.status.new",
};

/**
 * Кружок урока в ленте: текущий — сплошной синий, пройденный — зелёный, прочитанный — мягкий синий, остальные — пустые.
 * Как в списке уроков (LessonCard): зелёный — только «пройден», «прочитан» — синий.
 */
function dotClass(current: boolean, status: LessonReadStatus): string {
  if (current) return "border-primary bg-action-primary text-white";
  if (status === "done") return "border-success bg-action-success text-white";
  if (status === "read") return "border-primary/40 bg-primary-soft text-ink-primary";
  return "border-border bg-surface text-muted hover:bg-surface-2";
}

/**
 * «Где я»: «← Раздел 2 · Логика … Урок 3 из 8» (одна строка) и лента уроков раздела (кружки с номерами; нажатие — к другому уроку раздела).
 * Номер раздела — как на карте курса; номер урока — среди готовых уроков раздела.
 */
export function TheoryCrumbs({ place, lessonId, statusOf }: { place: LessonPlace; lessonId: string; statusOf: (id: string) => LessonReadStatus }) {
  const { t, l } = useT();
  const current = useRef<HTMLAnchorElement>(null);

  // Длинный раздел: текущий урок — в середину ленты (прокручивается только сама лента, не страница).
  useEffect(() => {
    const el = current.current;
    const strip = el?.closest<HTMLElement>("[data-strip]");
    if (!el || !strip) return;
    const from = strip.getBoundingClientRect();
    const at = el.getBoundingClientRect();
    strip.scrollLeft += at.left - from.left - (strip.clientWidth - at.width) / 2;
  }, [lessonId]);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Одна строка: ссылка на раздел (длинное название переносится на вторую строку, не обрезается) и счётчик «Урок K из M» у правого края. */}
      <nav className="flex min-w-0 items-center justify-between gap-3">
        <Link
          href={theoryUnitHref(place.unit.id)}
          className="-ml-2 flex min-h-10 min-w-0 items-center gap-1.5 rounded-xl px-2 py-1 text-sm font-extrabold leading-tight hover:bg-surface-2"
          style={{ color: place.unit.color }}
        >
          <ArrowLeft size={16} className="shrink-0" aria-hidden />
          <span className="min-w-0 break-words">
            {t("learn.unit", { n: place.unitIndex + 1 })} · {l(place.unit.title)}
          </span>
        </Link>
        <span className="shrink-0 whitespace-nowrap text-sm font-extrabold text-muted">{t("theory16c.crumb.lesson", { n: place.number, m: place.total })}</span>
      </nav>

      {place.total > 1 && (
        <div data-strip className="-mx-4 -my-1 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden" aria-label={t("theory16c.strip.label")} role="group">
          <ol className="flex w-max gap-3">
            {place.ids.map((id, i) => {
              const isCurrent = id === lessonId;
              const status = statusOf(id);
              const title = lessonMeta(id)?.title;
              return (
                <li key={id}>
                  <Link
                    ref={isCurrent ? current : undefined}
                    href={`/theory/${id}`}
                    aria-current={isCurrent ? "page" : undefined}
                    aria-label={t("theory16c.strip.item", { n: i + 1, title: title ? l(title) : "", status: t(STATUS_KEY[status]) })}
                    className={cn(
                      // Кружок 32 px (лента ниже ростом), зона касания — 44 px (лента с отступом 6 px — зона не обрезается прокруткой).
                      "relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-extrabold tabular-nums transition-colors after:absolute after:-inset-1.5 after:content-['']",
                      "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      dotClass(isCurrent, status),
                    )}
                  >
                    {i + 1}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
