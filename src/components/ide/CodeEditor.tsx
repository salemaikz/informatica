"use client";

import type { EditorLanguage } from "@/lib/ide/types";
import { cn } from "@/lib/cn";

// ВРЕМЕННАЯ версия (textarea): исполнитель I0 заменит на CodeMirror 6 с теми же пропсами (docs/specs/ide.md).
export interface CodeEditorProps {
  value: string;
  onChange: (v: string) => void;
  language: EditorLanguage;
  ariaLabel: string;
  minHeight?: number;
  readOnly?: boolean;
  /** Подсветить строку (1-based) — пошаговое выполнение Python. */
  highlightLine?: number;
  className?: string;
}

export function CodeEditor({ value, onChange, ariaLabel, minHeight = 200, readOnly, className }: CodeEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      readOnly={readOnly}
      spellCheck={false}
      style={{ minHeight }}
      className={cn("w-full rounded-2xl border-2 border-border bg-surface p-3 font-mono text-[15px] outline-none focus:border-primary", className)}
    />
  );
}
