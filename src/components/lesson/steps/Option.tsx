"use client";

import { m, type Variants } from "motion/react";
import { cn } from "@/lib/cn";
import type { CSSProperties, ReactNode } from "react";

export type OptionState = "idle" | "selected" | "correct" | "wrong" | "dim";

const STATES: Record<OptionState, string> = {
  idle: "border-border bg-surface shadow-[0_3px_0_var(--border)] hover:bg-surface-2",
  selected: "border-primary bg-primary-soft text-primary shadow-[0_3px_0_var(--primary)]",
  correct: "border-success bg-success-soft text-success-strong shadow-[0_3px_0_var(--success)]",
  wrong: "border-danger bg-danger-soft text-danger shadow-[0_3px_0_var(--danger)]",
  dim: "border-border bg-surface opacity-50",
};

/** Движение по состояниям: выбор — «поп», верный — лёгкий всплеск, неверный — одно встряхивание (≤ 400 мс). */
const MOTION: Variants = {
  idle: { scale: 1, x: 0, transition: { type: "spring", stiffness: 520, damping: 30 } },
  dim: { scale: 1, x: 0 },
  selected: { scale: [1, 1.04, 1], x: 0, transition: { duration: 0.22, ease: "easeOut" } },
  correct: { scale: [1, 1.035, 1], x: 0, transition: { duration: 0.3, ease: "easeOut" } },
  wrong: { scale: 1, x: [0, -7, 7, -4, 4, 0], transition: { duration: 0.36, ease: "easeInOut" } },
};

export function Option({
  state,
  onClick,
  children,
  badge,
  disabled,
  className,
  index = 0,
}: {
  state: OptionState;
  onClick?: () => void;
  children: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  className?: string;
  /** Номер в списке — для лесенки появления. */
  index?: number;
}) {
  const style: CSSProperties = { animationDelay: `${Math.min(index, 5) * 40}ms` };
  return (
    <m.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === "selected"}
      style={style}
      initial={false}
      animate={state}
      variants={MOTION}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={cn(
        "relative flex min-h-14 w-full animate-rise-in items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[17px] font-bold transition-[translate,background-color,border-color,box-shadow] duration-100 active:translate-y-[2px]",
        STATES[state],
        disabled && "pointer-events-none",
        className,
      )}
    >
      {state === "correct" && (
        // Короткая вспышка-кольцо вокруг верного варианта (opacity/transform, один раз).
        <span aria-hidden className="pointer-events-none absolute -inset-1 rounded-[1.25rem] border-4 border-success animate-ring-out" />
      )}
      {badge !== undefined && (
        <span
          className={cn(
            "hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-extrabold sm:flex",
            state === "idle" || state === "dim" ? "border-border text-muted" : "border-current",
          )}
        >
          {badge}
        </span>
      )}
      <span className="flex-1">{children}</span>
    </m.button>
  );
}
