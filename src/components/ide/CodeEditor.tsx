"use client";

import dynamic from "next/dynamic";
import type { EditorLanguage } from "@/lib/ide/types";

// Редактор кода на CodeMirror 6 (docs/specs/ide.md, I0). CodeMirror грузится только в браузере и отдельным куском —
// страницы без редактора остаются лёгкими. Пропсы — контракт, которым пользуются рабочие области языков.
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

const Editor = dynamic(() => import("./CmEditor"), {
  ssr: false,
  loading: () => <div aria-hidden className="w-full flex-1 animate-pulse rounded-2xl border-2 border-border bg-surface-2" />,
});

export function CodeEditor(props: CodeEditorProps) {
  // Обёртка держит высоту, пока редактор грузится, — страница не «прыгает».
  return (
    <div className="flex flex-col" style={{ minHeight: props.minHeight ?? 200 }}>
      <Editor {...props} />
    </div>
  );
}
