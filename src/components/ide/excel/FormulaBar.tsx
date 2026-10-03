"use client";

import { Check, X } from "lucide-react";
import type { RefObject } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";

export interface FormulaBarProps {
  /** Адрес выбранной ячейки («B3»). */
  addr: string;
  /** Что показано в поле: черновик ввода или содержимое ячейки. */
  value: string;
  /** Есть неприменённый ввод. */
  dirty: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  /** Enter — применить и перейти вниз. */
  onEnter: () => void;
  /** Tab — применить и перейти вправо. */
  onTab: () => void;
  /** Escape — вернуть прежнее содержимое. */
  onEscape: () => void;
  onApply: () => void;
  onCancel: () => void;
}

/** Строка формул: адрес ячейки и поле ввода. Крупный шрифт (16 px) — iOS не приближает страницу при вводе. */
export function FormulaBar({ addr, value, dirty, inputRef, onChange, onFocus, onBlur, onEnter, onTab, onEscape, onApply, onCancel }: FormulaBarProps) {
  const { t } = useT();
  // Кнопки не забирают фокус у поля: иначе blur применил бы ввод раньше, чем сработает «Отменить».
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();
  return (
    <div className="flex items-stretch gap-2">
      <div
        aria-label={t("idexl.bar.address")}
        className="flex w-14 shrink-0 items-center justify-center rounded-xl border-2 border-border bg-surface-2 font-mono text-sm font-extrabold"
      >
        {addr}
      </div>
      <div className="flex min-w-0 flex-1 items-center rounded-xl border-2 border-border bg-surface focus-within:border-primary">
        <span aria-hidden className="select-none pl-3 font-mono text-sm font-bold italic text-primary">
          fx
        </span>
        <input
          ref={inputRef}
          value={value}
          aria-label={t("idexl.bar.aria")}
          placeholder={t("idexl.bar.placeholder")}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          className="h-11 min-w-0 flex-1 bg-transparent px-2 font-mono text-base outline-none placeholder:text-muted/70"
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => {
            onFocus();
            // Число или текст заменяются при наборе; в формуле курсор ставят пальцем, поэтому её не выделяем.
            if (!e.currentTarget.value.trimStart().startsWith("=")) e.currentTarget.select();
          }}
          onBlur={onBlur}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            } else if (e.key === "Tab" && !e.shiftKey) {
              e.preventDefault();
              onTab();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onEscape();
            }
          }}
        />
        {dirty && (
          <div className="flex shrink-0 items-center gap-1 pr-1">
            <button
              type="button"
              aria-label={t("idexl.bar.cancel")}
              onMouseDown={keepFocus}
              onClick={onCancel}
              className={cn("grid size-9 place-items-center rounded-lg text-danger hover:bg-danger-soft", "focus-visible:outline-3 focus-visible:outline-primary")}
            >
              <X size={18} aria-hidden />
            </button>
            <button
              type="button"
              aria-label={t("idexl.bar.apply")}
              onMouseDown={keepFocus}
              onClick={onApply}
              className={cn("grid size-9 place-items-center rounded-lg text-success hover:bg-success-soft", "focus-visible:outline-3 focus-visible:outline-primary")}
            >
              <Check size={18} aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
