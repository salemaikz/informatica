"use client";

import { m } from "motion/react";
import { GraduationCap, Target } from "lucide-react";
import type { Track } from "@/lib/types";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";

// Переключатель трека «ЕНТ | Школа» (profile.track). Одна «таблетка» скользит между сегментами.

export function TrackSwitch({ className }: { className?: string }) {
  const { t } = useT();
  const track = useApp((s) => s.profile.track);
  const updateProfile = useApp((s) => s.updateProfile);
  const items: { id: Track; label: string; icon: typeof Target }[] = [
    { id: "ent", label: t("school.track.ent"), icon: Target },
    { id: "school", label: t("school.track.school"), icon: GraduationCap },
  ];
  return (
    <div role="group" aria-label={t("school.track.label")} className={cn("relative grid grid-cols-2 rounded-2xl border-2 border-border bg-surface-2 p-1", className)}>
      <m.span
        aria-hidden
        className="absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-xl bg-surface shadow-[0_2px_0_var(--border)]"
        initial={false}
        animate={{ x: track === "school" ? "100%" : "0%" }}
        transition={{ type: "spring", stiffness: 520, damping: 36 }}
      />
      {items.map(({ id, label, icon: Icon }) => {
        const on = track === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => !on && updateProfile({ track: id })}
            className={cn(
              "relative flex h-11 items-center justify-center gap-2 rounded-xl text-[15px] font-extrabold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
              on ? "text-primary" : "text-muted hover:text-text",
            )}
          >
            <Icon size={19} className="relative" />
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
