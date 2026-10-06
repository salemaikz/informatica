"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";

/**
 * Прогресс по карточкам урока: «Карточка 2 из 5» (у конспекта — «Конспект») и полоски-сегменты, как в историях:
 * пройденные и текущая — синие, остальные — серые; нажатие на сегмент — к этой карточке.
 * total — карточек вместе с конспектом (он последний). `aside` — элемент справа от подписи (переключатель «По карточкам / Всё сразу»):
 * так подпись, переключатель и сегменты занимают две строки, а не три. Сегмент 24 px, зона касания — 44 px (невидимая, выше и ниже).
 */
export function CardProgress({ index, total, onGo, aside }: { index: number; total: number; onGo: (i: number) => void; aside?: ReactNode }) {
  const { t } = useT();
  const last = total - 1;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <p className="shrink-0 whitespace-nowrap text-sm font-extrabold text-muted" aria-live="polite">
          {index >= last ? t("theory.conspect") : t("theory16c.card.of", { n: index + 1, m: last })}
        </p>
        {/* Переключатель выше невидимых зон сегментов: их зона касания заходит на строку подписи. */}
        {aside && <div className="relative z-10 min-w-0">{aside}</div>}
      </div>
      <ol className="flex gap-1" aria-label={t("theory16c.dots")}>
        {Array.from({ length: total }, (_, i) => (
          <li key={i} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onGo(i)}
              aria-label={i === last ? t("theory16c.dot.conspect") : t("theory16c.dot", { n: i + 1 })}
              aria-current={i === index ? "step" : undefined}
              className="group relative flex h-6 w-full items-center after:absolute after:-inset-y-2.5 after:inset-x-0 after:content-[''] focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-primary"
            >
              <span className={cn("h-1.5 w-full rounded-full transition-colors", i <= index ? "bg-primary" : "bg-border group-hover:bg-muted/40")} />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
