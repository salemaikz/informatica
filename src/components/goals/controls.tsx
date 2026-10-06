"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Выбор из нескольких вариантов (сегментированные кнопки). */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  size = "md",
  equal,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
  /** sm — компактные сегменты в одну строку с другими элементами (визуально 32 px, зона касания шире на невидимые 6 px сверху и снизу). */
  size?: "md" | "sm";
  /** Все варианты в одну строку равной ширины (короткие подписи, 2–4 варианта): без переноса «одинокой» кнопки на вторую строку. */
  equal?: boolean;
}) {
  const sm = size === "sm";
  return (
    <div
      role="group"
      aria-label={label}
      style={equal ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
      className={cn("min-w-0 max-w-full", equal ? "grid gap-1.5" : cn("flex", sm ? "gap-1" : "flex-wrap gap-1.5"))}
    >
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            "max-w-full border-2 font-bold transition-colors",
            sm
              ? "relative min-h-8 rounded-lg px-2 text-xs font-extrabold after:absolute after:-inset-x-0.5 after:-inset-y-1.5 after:content-['']"
              : cn("min-h-10 rounded-xl py-1.5 text-sm", equal ? "px-1.5 text-center" : "px-3.5"),
            value === o.id ? "border-primary bg-primary-soft text-ink-primary" : "border-border bg-surface text-muted hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Строка настройки: подпись и элемент управления.
 * На телефоне — друг под другом. От 640px — в одну строку (подпись слева, управление справа), а если управление
 * (длинные варианты выбора) не помещается рядом с подписью, оно переносится целиком под подпись и само переносит кнопки:
 * ничего не вылезает за карточку и не закрывает подпись.
 */
export function Row({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id?: string }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
      <div className="min-w-0 sm:min-w-40 sm:flex-1">
        <span id={id} className="font-extrabold">
          {label}
        </span>
        {hint && <p className="text-sm font-semibold text-muted">{hint}</p>}
      </div>
      <div className="min-w-0 max-w-full">{children}</div>
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
        // Выключен: заметная серая дорожка (в светлой теме bg-surface-2 почти сливался с карточкой).
        checked ? "border-primary bg-primary" : "border-muted/50 bg-muted/30",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span className={cn("absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-md ring-1 ring-black/15 transition-transform", checked && "translate-x-6")} />
    </button>
  );
}
