"use client";

import { m } from "motion/react";
import type { BillingPeriod } from "@/lib/economy";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { springSnappy } from "@/components/motion/presets";

/** Переключатель «Месяц / Год −N%»: подложка плавно переезжает (без layout-анимаций — хватает базового набора motion). */
export function BillingToggle({ value, percent, onChange }: { value: BillingPeriod; percent: number; onChange: (v: BillingPeriod) => void }) {
  const { t } = useT();
  const options: { id: BillingPeriod; label: string }[] = [
    { id: "month", label: t("plans.billing.month") },
    { id: "year", label: t("plans.billing.year") },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={t("plans.billing.label")}
      className="relative mx-auto grid w-full max-w-sm grid-cols-2 rounded-2xl border-2 border-border bg-surface-2 p-1"
    >
      <m.span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-xl border-2 border-primary bg-surface shadow-[0_2px_0_var(--primary)]"
        initial={false}
        animate={{ x: value === "year" ? "100%" : "0%" }}
        transition={springSnappy}
      />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "relative z-10 flex h-11 items-center justify-center gap-2 rounded-xl text-base font-extrabold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
            value === o.id ? "text-primary" : "text-muted hover:text-text",
          )}
        >
          {o.label}
          {o.id === "year" && (
            <span className="rounded-full border border-gold bg-gold-soft px-1.5 py-0.5 text-xs font-extrabold leading-none text-warning-strong">{t("plans.billing.save", { n: percent })}</span>
          )}
        </button>
      ))}
    </div>
  );
}
