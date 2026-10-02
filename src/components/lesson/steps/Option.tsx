import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export type OptionState = "idle" | "selected" | "correct" | "wrong" | "dim";

const STATES: Record<OptionState, string> = {
  idle: "border-border bg-surface shadow-[0_3px_0_var(--border)] hover:bg-surface-2",
  selected: "border-primary bg-primary-soft text-primary shadow-[0_3px_0_var(--primary)]",
  correct: "border-success bg-success-soft text-success-strong shadow-[0_3px_0_var(--success)]",
  wrong: "border-danger bg-danger-soft text-danger shadow-[0_3px_0_var(--danger)] animate-shake",
  dim: "border-border bg-surface opacity-50",
};

export function Option({
  state,
  onClick,
  children,
  badge,
  disabled,
  className,
}: {
  state: OptionState;
  onClick?: () => void;
  children: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === "selected"}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[17px] font-bold transition-[transform,background-color,border-color] duration-100 active:translate-y-[2px]",
        STATES[state],
        disabled && "pointer-events-none",
        className,
      )}
    >
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
    </button>
  );
}
