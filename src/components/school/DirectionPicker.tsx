"use client";

import type { SchoolDirection } from "@/lib/types";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";

// Направление 10–11 классов (этап 15): ЕМН — естественно-математическое, ОГН — общественно-гуманитарное.
// Меняет profile.direction; показывается только у 10 и 11 классов.

const DIRECTIONS: readonly SchoolDirection[] = ["emn", "ogn"];

export function DirectionPicker({ className }: { className?: string }) {
  const { t } = useT();
  const direction = useApp((s) => s.profile.direction);
  const updateProfile = useApp((s) => s.updateProfile);
  return (
    <div role="group" aria-label={t("school.dir.label")} className={cn("grid grid-cols-2 gap-1.5", className)}>
      {DIRECTIONS.map((d) => {
        const on = direction === d;
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => updateProfile({ direction: d })}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center rounded-xl border-2 px-2 py-1.5 text-center transition-[translate,box-shadow,background-color] duration-75 active:translate-y-[2px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
              on
                ? "border-primary bg-primary text-white shadow-[0_3px_0_var(--primary-strong)]"
                : "border-border bg-surface text-muted shadow-[0_3px_0_var(--border)] hover:bg-surface-2 hover:text-text",
            )}
          >
            <span className="text-base font-extrabold">{t(`school.dir.${d}`)}</span>
            <span className={cn("text-xs font-bold leading-tight", on ? "opacity-90" : "")}>{t(`school.dir.${d}.full`)}</span>
          </button>
        );
      })}
    </div>
  );
}
