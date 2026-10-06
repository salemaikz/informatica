import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Tone = "primary" | "success" | "danger" | "warning" | "gold" | "streak" | "ai" | "muted";

const TONES: Record<Tone, string> = {
  // Текст поверх -soft — «чернила» ink-* (контраст ≥ 4,5:1 в обеих темах, RULES 2.1).
  primary: "bg-primary-soft text-ink-primary",
  success: "bg-success-soft text-ink-success",
  danger: "bg-danger-soft text-ink-danger",
  warning: "bg-warning-soft text-ink-warning",
  gold: "bg-gold-soft text-ink-gold",
  streak: "bg-streak-soft text-ink-streak",
  ai: "bg-ai-soft text-ink-ai",
  muted: "bg-surface-2 text-muted",
};

export function Pill({ tone = "muted", children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold", TONES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
