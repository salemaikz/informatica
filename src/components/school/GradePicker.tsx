"use client";

import { SCHOOL_GRADES, toSchoolGrade } from "@/lib/school";
import type { Grade } from "@/lib/types";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";

// Выбор класса 5–11 (меняет profile.grade). «Другое» — ни один класс не выбран.

export function GradePicker({ className }: { className?: string }) {
  const { t } = useT();
  const grade = useApp((s) => s.profile.grade);
  const updateProfile = useApp((s) => s.updateProfile);
  const current = toSchoolGrade(grade);
  return (
    <div role="group" aria-label={t("school.grade.label")} className={cn("grid grid-cols-7 gap-1.5", className)}>
      {SCHOOL_GRADES.map((g) => {
        const on = current === g;
        return (
          <button
            key={g}
            type="button"
            aria-pressed={on}
            aria-label={t("onb.grade.n", { n: g })}
            onClick={() => updateProfile({ grade: g as Grade })}
            className={cn(
              "flex h-12 items-center justify-center rounded-xl border-2 text-lg font-extrabold transition-[translate,box-shadow,background-color] duration-75 active:translate-y-[2px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
              on
                ? "border-action-primary bg-action-primary text-white shadow-[0_3px_0_var(--action-primary-edge)]"
                : "border-border bg-surface text-muted shadow-[0_3px_0_var(--border)] hover:bg-surface-2 hover:text-text",
            )}
          >
            {g}
          </button>
        );
      })}
    </div>
  );
}
