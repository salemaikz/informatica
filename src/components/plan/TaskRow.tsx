"use client";

import { BookOpen, Brain, Check, ChevronRight, ClipboardCheck, Timer, Trophy, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { UNITS } from "@/content/course";
import { cn } from "@/lib/cn";
import { REVIEW_ANSWERS, taskHref, type PlanTask } from "@/lib/plan";
import { useT } from "@/i18n/useT";

const ICON: Record<PlanTask["type"], LucideIcon> = {
  lesson: BookOpen,
  checkpoint: Trophy,
  exam: Timer,
  review: Brain,
};

/** Одно дело недели: ссылка на урок / контрольную / пробный ЕНТ / повторение; сделанное — с зелёной галочкой. */
export function TaskRow({ task }: { task: PlanTask }) {
  const { t, l } = useT();

  let title = "";
  let sub = "";
  let Icon = ICON[task.type];
  if (task.type === "lesson") {
    const unit = UNITS.find((u) => u.id === task.unit);
    const ref = unit?.lessons.find((r) => r.id === task.id);
    title = ref ? l(ref.title) : task.id;
    sub = unit ? l(unit.title) : "";
  } else if (task.type === "checkpoint") {
    const unit = UNITS.find((u) => u.id === task.unit);
    title = t("plan.task.checkpoint", { unit: unit ? l(unit.title) : task.unit });
    sub = t("plan.task.checkpoint.sub");
  } else if (task.type === "exam") {
    title = task.exam === "full" ? t("exam.mode.full") : t("exam.mode.mini");
    sub = task.exam === "full" ? t("exam.mode.full.desc") : t("exam.mode.mini.desc");
    if (task.exam === "full") Icon = ClipboardCheck;
  } else {
    title = t("plan.task.review");
    sub = t("plan.task.review.sub", { n: REVIEW_ANSWERS });
  }

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
