"use client";

import { BookOpen, Brain, Check, ChevronRight, ClipboardCheck, Timer, Trophy, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { taskHref, type PlanTask } from "@/lib/plan";
import { useT } from "@/i18n/useT";
import { useTaskLabel } from "./useTaskLabel";

const ICON: Record<PlanTask["type"], LucideIcon> = {
  lesson: BookOpen,
  checkpoint: Trophy,
  exam: Timer,
  review: Brain,
};

/** Одно дело недели: ссылка на урок / контрольную / пробный ЕНТ / повторение; сделанное — с зелёной галочкой. */
export function TaskRow({ task }: { task: PlanTask }) {
  const { t } = useT();
  const label = useTaskLabel();
  const { title, sub } = label(task);
  const Icon = task.type === "exam" && task.exam === "full" ? ClipboardCheck : ICON[task.type];

  return (
    <Link
      href={taskHref(task)}
      className="flex min-h-12 items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors hover:bg-surface-2 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-primary"
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          task.done ? "bg-success-soft text-success-strong" : "bg-primary-soft text-primary",
        )}
      >
        {task.done ? <Check size={20} strokeWidth={3} aria-hidden /> : <Icon size={20} aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block break-words font-bold leading-snug", task.done && "text-muted")}>{title}</span>
        {sub && <span className="block break-words text-xs font-semibold leading-snug text-muted">{sub}</span>}
      </span>
      {task.done && <span className="sr-only">{t("plan.task.done")}</span>}
      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
    </Link>
  );
}
