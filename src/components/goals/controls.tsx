"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Выбор из нескольких вариантов (сегментированные кнопки). */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            "min-h-10 rounded-xl border-2 px-3.5 py-1.5 text-sm font-bold transition-colors",
            value === o.id ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Строка настройки: подпись слева (или сверху на телефоне), элемент управления справа. */
export function Row({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id?: string }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <span id={id} className="font-extrabold">
          {label}
        </span>
        {hint && <p className="text-sm font-semibold text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Переключатель «вкл/выкл». */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        // Видимый переключатель 32 px, а зона касания — 44 px (псевдоэлемент after).
        "relative h-8 w-14 shrink-0 rounded-full border-2 transition-colors after:absolute after:-inset-1.5 after:content-[''] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
        checked ? "border-primary bg-primary" : "border-border bg-surface-2",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span className={cn("absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform", checked && "translate-x-6")} />
    </button>
  );
}
