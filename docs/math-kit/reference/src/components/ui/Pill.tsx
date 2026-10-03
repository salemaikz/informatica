import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Tone = "primary" | "success" | "danger" | "warning" | "gold" | "streak" | "ai" | "muted";

const TONES: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success-strong",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning-strong",
  gold: "bg-gold-soft text-warning-strong",
  streak: "bg-streak-soft text-streak",
  ai: "bg-ai-soft text-ai",
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
