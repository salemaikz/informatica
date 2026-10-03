"use client";

import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Mascot } from "@/components/mascot/Mascot";
import { cn } from "@/lib/cn";
import type { IdeLang, IdeTask } from "@/lib/ide/types";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { groupByLevel, LEVEL_LETTER } from "./shell-helpers";

/** Список задач языка: группы по уровням A → C, решённые — с зелёной галочкой. */
export function TaskList({ lang, tasks }: { lang: IdeLang; tasks: readonly IdeTask[] }) {
  const { t, l } = useT();
  const codeTasks = useApp((s) => s.codeTasks);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border bg-surface p-6 text-center">
        <Mascot mood="thinking" size={72} />
        <p className="max-w-sm font-semibold text-muted">{t("ide.list.empty")}</p>
      </div>
    );
  }

  // Сквозная нумерация по группам считается заранее (без изменения переменных во время рендера).
  const groups = groupByLevel(tasks);
  const offsets = groups.map((_, i) => groups.slice(0, i).reduce((sum, g) => sum + g.tasks.length, 0));
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g, gi) => (
        <section key={g.level} aria-label={t("ide.level", { l: LEVEL_LETTER[g.level] })} className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-lg bg-primary-soft px-1.5 text-xs text-primary">{LEVEL_LETTER[g.level]}</span>
            {t(`ide.levelName.${g.level}`)}
          </h2>
          <ul className="flex flex-col gap-2">
            {g.tasks.map((task, ti) => {
              const n = offsets[gi] + ti + 1;
              const stat = codeTasks[task.id];
              const solved = !!stat?.solved;
              return (
                <li key={task.id}>
                  <Link
                    href={`/code/${lang}/${task.id}`}
                    className={cn(
                      "flex min-h-16 items-center gap-3 rounded-2xl border-2 bg-surface px-3.5 py-2.5 transition-colors hover:bg-surface-2 active:translate-y-px",
                      solved ? "border-success/40" : "border-border",
                    )}
                  >
                    <span
                      role="img"
                      aria-label={t(solved ? "ide.list.solved" : "ide.list.todo")}
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
                        solved ? "bg-success text-white" : "bg-surface-2 text-muted",
                      )}
                    >
                      {solved ? <Check size={20} strokeWidth={3} /> : n}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-extrabold">{l(task.title)}</span>
                      {!solved && stat && stat.attempts > 0 && (
                        <span className="block text-xs font-bold text-muted">{t("ide.list.attempts", { n: stat.attempts })}</span>
                      )}
                    </span>
                    <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
