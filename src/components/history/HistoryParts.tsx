"use client";

import { BookOpen, Dumbbell, ListChecks, Timer, type LucideIcon } from "lucide-react";
import type { Tone } from "@/components/exam/logic";
import { cn } from "@/lib/cn";
import type { HistoryKind } from "@/lib/history";

/** Цвет полоски результата — токены семантики (зелёный / янтарный / красный). */
export const TONE_COLOR: Record<Tone, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

export const TONE_TEXT: Record<Tone, string> = {
  success: "text-success-strong",
  warning: "text-warning-strong",
  danger: "text-danger",
};

const KIND_ICON: Record<HistoryKind, LucideIcon> = {
  lesson: BookOpen,
  check: ListChecks,
  drill: Dumbbell,
  exam: Timer,
};

/** Иконка вида записи в цветной плитке. */
export function KindIcon({ kind, size = 44, className }: { kind: HistoryKind; size?: number; className?: string }) {
  const Icon = KIND_ICON[kind];
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary", className)}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.52)} strokeWidth={2.4} />
    </span>
  );
}
