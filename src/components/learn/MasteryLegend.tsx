"use client";

import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { STEPS, stepLevel, stepTone, type LessonStep } from "@/lib/mastery-steps";

// Легенда ступеней освоения: под картой курса или в шторке. Отметки те же, что у узлов на карте.

/** Четыре отметки-ступени (декоративные: текст ступени даёт подпись рядом или aria-label кнопки). */
export function StepMarks({ step, className }: { step: LessonStep; className?: string }) {
  const level = stepLevel(step);
  const fill = stepTone(step) === "success" ? "bg-success" : "bg-warning";
  return (
    <span aria-hidden className={cn("flex shrink-0 gap-1", className)}>
      {STEPS.map((s, i) => (
        <span key={s} className={cn("h-2 w-2 rounded-full", i < level ? fill : "bg-border")} />
      ))}
    </span>
  );
}

export function MasteryLegend({ className }: { className?: string }) {
  const { t } = useT();
  return (
    <section className={cn("rounded-2xl border-2 border-border bg-surface p-4", className)}>
      <h3 className="font-extrabold">{t("mastery.legend.title")}</h3>
      <p className="mb-3 text-sm font-semibold text-muted">{t("mastery.legend.hint")}</p>
      <ul className="flex flex-col gap-2.5">
        {STEPS.map((s) => (
          <li key={s} className="flex items-start gap-3">
            <StepMarks step={s} className="mt-1.5" />
            <span className="min-w-0 text-sm font-semibold leading-snug">
              <b className="font-extrabold">{t(`mastery.step.${s}`)}</b>
              {" — "}
              <span className="text-muted">{t(`mastery.legend.${s}`)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
