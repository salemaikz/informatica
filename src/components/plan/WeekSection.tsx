"use client";

import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatWeekRange, type PlanWeek } from "@/lib/plan";
import { useT } from "@/i18n/useT";
import { Pill } from "@/components/ui/Pill";
import { TaskRow } from "./TaskRow";

/** Неделя плана: заголовок-кнопка (номер, даты, «сделано N из M») и раскрывающийся список дел. */
export function WeekSection({ week, open, onToggle }: { week: PlanWeek; open: boolean; onToggle: () => void }) {
  const { t, lang } = useT();
  const range = formatWeekRange(week.start, week.end, lang);
  const complete = week.total > 0 && week.done >= week.total;
  const current = week.status === "current";
  const late = week.status === "past" && !complete;
  const panelId = `plan-week-${week.n}`;

  return (
    <section className={cn("overflow-hidden rounded-3xl border-2 bg-surface", current ? "border-primary/50" : "border-border")}>
      <h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label={t("plan.week.toggle", { n: week.n, range, done: week.done, total: week.total })}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-primary"
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
              complete ? "bg-action-success text-white" : current ? "bg-action-primary text-white" : "bg-surface-2 text-muted",
            )}
          >
            {complete ? <Check size={20} strokeWidth={3} /> : week.n}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-extrabold">{t("plan.week", { n: week.n })}</span>
              {current && <Pill tone="primary">{t("plan.week.current")}</Pill>}
              {week.review && <Pill tone="muted">{t("plan.week.review")}</Pill>}
            </span>
            <span className="block text-sm font-semibold text-muted">{range}</span>
          </span>
          <Pill tone={complete ? "success" : late ? "warning" : current ? "primary" : "muted"} className="shrink-0 text-[13px]">
            {t("plan.card.tasks", { done: week.done, total: week.total })}
          </Pill>
          <ChevronDown size={20} aria-hidden className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
        </button>
      </h2>
      {open && (
        <div id={panelId} className="flex flex-col border-t-2 border-border px-2 py-2">
          {week.tasks.map((task) => (
            <TaskRow key={task.key} task={task} />
          ))}
        </div>
      )}
    </section>
  );
}
