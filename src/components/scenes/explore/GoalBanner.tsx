"use client";

import { Check, Target } from "lucide-react";
import { m } from "motion/react";
import { springBouncy } from "@/components/motion/presets";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";

/** Цель песочницы сверху: голубая, пока не достигнута; зелёная с «Получилось!» — когда готово. */
export function GoalBanner({ text, reached }: { text: string; reached: boolean }) {
  const { t } = useT();
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-colors duration-300",
        reached ? "border-success bg-success-soft" : "border-primary/30 bg-primary-soft",
      )}
    >
      <m.span
        key={reached ? "done" : "goal"}
        initial={{ scale: 0.5, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={springBouncy}
        className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-white", reached ? "bg-action-success" : "bg-action-primary")}
      >
        {reached ? <Check size={20} strokeWidth={3.4} /> : <Target size={20} strokeWidth={2.6} />}
      </m.span>
      <div className="min-w-0">
        <p className="text-base font-bold leading-snug">{text}</p>
        <p className="text-sm font-extrabold text-ink-success" role="status" aria-live="polite">
          {reached ? t("lesson.goalDone") : null}
        </p>
      </div>
    </div>
  );
}
