"use client";

import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const BTN =
  "flex h-11 w-11 shrink-0 select-none items-center justify-center rounded-2xl border-2 border-primary/40 bg-primary-soft text-primary transition-colors hover:bg-primary-soft/70 active:translate-y-px focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-muted disabled:opacity-60";

/**
 * Точное число кнопками −/+ (шаг 1): число крупно между кнопками. Кнопки — 44 px, на пределе (min/max) кнопка выключается.
 * `suffix` — подпись рядом с числом («из 50»); `dim` — число приглушено (значение по умолчанию, ещё не подтверждено).
 */
export function NumberStepper({
  value,
  min,
  max,
  onChange,
  decLabel,
  incLabel,
  suffix,
  dim,
  className,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  decLabel: string;
  incLabel: string;
  suffix?: ReactNode;
  dim?: boolean;
  className?: string;
}) {
  const v = Math.min(max, Math.max(min, Math.round(value)));
  return (
    <div role="group" className={cn("flex items-center gap-2", className)}>
      <button type="button" className={BTN} aria-label={decLabel} disabled={v <= min} onClick={() => onChange(Math.max(min, v - 1))}>
        <Minus size={22} strokeWidth={3} aria-hidden />
      </button>
      <output
        aria-live="polite"
        className={cn("flex min-w-16 items-baseline justify-center gap-1 whitespace-nowrap text-center", dim ? "text-muted" : "text-primary")}
      >
        <span className="text-3xl font-extrabold leading-none tabular-nums">{v}</span>
        {suffix && (
          <>
            {" "}
            <span className="text-sm font-bold text-muted">{suffix}</span>
          </>
        )}
      </output>
      <button type="button" className={BTN} aria-label={incLabel} disabled={v >= max} onClick={() => onChange(Math.min(max, v + 1))}>
        <Plus size={22} strokeWidth={3} aria-hidden />
      </button>
    </div>
  );
}
