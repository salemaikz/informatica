"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, type FormEvent } from "react";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";

/** Поле поиска с кнопкой «очистить». onSubmit — Enter или кнопка поиска на клавиатуре телефона. */
export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder,
  autoFocus,
  clearLabel = "search.clear",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  autoFocus?: boolean;
  clearLabel?: DictKey;
}) {
  const { t } = useT();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
    // На телефоне прячем клавиатуру, чтобы увидеть результаты.
    ref.current?.blur();
  };

  return (
    <form role="search" onSubmit={submit} className="relative">
      <Search size={20} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={200}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-13 w-full appearance-none rounded-2xl border-2 border-border bg-surface pl-12 pr-12 text-base font-bold text-text outline-none transition-colors placeholder:font-semibold placeholder:text-muted focus:border-primary [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label={t(clearLabel)}
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text"
        >
          <X size={18} />
        </button>
      )}
    </form>
  );
}
