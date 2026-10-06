"use client";

import { useMemo } from "react";
import { m } from "motion/react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { springSoft } from "@/components/motion/presets";
import { useT } from "@/i18n/useT";
import type { Scene } from "@/lib/types";
import { iconFor } from "./icons";
import { barWidths, formatBytes } from "./sizes";

type SizesData = Extract<Scene, { kind: "sizes" }>;

/**
 * Сравнение объёмов: полосы в логарифмическом масштабе (иначе гигабайт «съел» бы всё остальное),
 * подпись, иконка и размер в Б/КБ/МБ/ГБ/ТБ.
 */
export function SizesScene({ scene }: { scene: SizesData }) {
  const { t, l, lang } = useT();
  const reduce = useReduceMotion();
  const widths = useMemo(() => barWidths(scene.items.map((i) => i.bytes)), [scene.items]);

  return (
    <div className="mx-auto w-full max-w-xl">
      <ul aria-label={t("basics.sizes.aria")} className="flex flex-col gap-2">
        {scene.items.map((item, i) => {
          const Icon = item.icon ? iconFor(item.icon) : null;
          return (
            <li key={i} className="rounded-2xl border border-border bg-surface px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                {Icon && (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-ink-primary" aria-hidden="true">
                    <Icon className="size-[18px]" strokeWidth={2} />
                  </span>
                )}
                <span className="min-w-0 flex-1 text-sm font-bold leading-tight text-text">{l(item.label)}</span>
                <span className="shrink-0 whitespace-nowrap text-base font-extrabold tabular-nums text-ink-primary">{formatBytes(item.bytes, lang)}</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                <m.div
                  className="h-full rounded-full bg-primary"
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${widths[i]}%` }}
                  transition={{ ...springSoft, delay: reduce ? 0 : Math.min(i, 8) * 0.06 }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-center text-xs leading-snug text-muted">{t("basics.sizes.note")}</p>
    </div>
  );
}
