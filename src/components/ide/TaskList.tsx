"use client";

import { Check, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Mascot } from "@/components/mascot/Mascot";
import { HeartCost } from "@/components/economy/HeartCost";
import { cn } from "@/lib/cn";
import { ENTRY_COST } from "@/lib/economy";
import type { IdeLang, IdeTask } from "@/lib/ide/types";
import { skillById } from "@/content/skills";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { firstOpenGroup, groupByLevel, groupBySkill, LEVEL_LETTER, shouldGroupBySkill, type CodeTasks } from "./shell-helpers";

/** Строка задачи: номер или галочка, название, (в группах по навыку) буква уровня. */
function TaskRow({ lang, task, n, stat, showLevel }: { lang: IdeLang; task: IdeTask; n: number; stat: CodeTasks[string] | undefined; showLevel?: boolean }) {
  const { t, l } = useT();
  const solved = !!stat?.solved;
  return (
    <li>
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
            solved ? "bg-action-success text-white" : "bg-surface-2 text-muted",
          )}
        >
          {solved ? <Check size={20} strokeWidth={3} /> : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block font-extrabold leading-snug">{l(task.title)}</span>
          {/* Уровень, цена (задача стоит сердечко, этап 16Г, #120: списывается при первом запуске или проверке) и попытки — отдельной строкой, чтобы название не обрезалось. */}
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {showLevel && (
              <span
                title={t("ide.level", { l: LEVEL_LETTER[task.level] })}
                className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-lg bg-primary-soft px-1.5 text-xs font-extrabold text-ink-primary"
              >
                {LEVEL_LETTER[task.level]}
              </span>
            )}
            <HeartCost n={ENTRY_COST.code} />
            {!solved && stat && stat.attempts > 0 && <span className="text-xs font-bold text-muted">{t("ide.list.attempts", { n: stat.attempts })}</span>}
          </span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

/**
 * Список задач языка. До 12 задач — группы по уровням A → C; больше — группы по навыку (внутри от A к C),
 * у группы счётчик «Решено: 3 из 8»; раскрыта первая группа с нерешёнными задачами, остальные можно раскрыть.
 */
export function TaskList({ lang, tasks }: { lang: IdeLang; tasks: readonly IdeTask[] }) {
  const { t, l } = useT();
  const codeTasks = useApp((s) => s.codeTasks);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border bg-surface p-6 text-center">
        <Mascot mood="thinking" size={72} />
        <p className="max-w-sm font-semibold text-muted">{t("ide.list.empty")}</p>
      </div>
    );
  }

  if (shouldGroupBySkill(tasks)) {
    const groups = groupBySkill(tasks, codeTasks);
    const firstOpen = firstOpenGroup(groups);
    const offsets = groups.map((_, i) => groups.slice(0, i).reduce((sum, g) => sum + g.tasks.length, 0));
    return (
      <div className="flex flex-col gap-3">
        {groups.map((g, gi) => {
          const key = g.skill ?? "";
          const isOpen = toggled[key] ?? gi === firstOpen;
          const skill = g.skill ? skillById(g.skill) : undefined;
          const title = skill ? l(skill.title) : t("ide.level", { l: LEVEL_LETTER[g.tasks[0].level] });
          const done = g.solved === g.tasks.length;
          const panelId = `ide-skill-${lang}-${key || "other"}`;
          return (
            <section key={key} className="flex flex-col gap-2">
              <h2>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setToggled((m) => ({ ...m, [key]: !isOpen }))}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 bg-surface px-3.5 py-2 text-left transition-colors hover:bg-surface-2",
                    done ? "border-success/40" : "border-border",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block font-extrabold leading-snug">{title}</span>
                    <span className={cn("block text-xs font-bold", done ? "text-success" : "text-muted")}>{t("ide.hub.solved", { done: g.solved, total: g.tasks.length })}</span>
                  </span>
                  <ChevronDown size={20} className={cn("shrink-0 text-muted transition-transform", isOpen && "rotate-180")} aria-hidden />
                </button>
              </h2>
              {isOpen && (
                <ul id={panelId} className="flex flex-col gap-2">
                  {g.tasks.map((task, ti) => (
                    <TaskRow key={task.id} lang={lang} task={task} n={offsets[gi] + ti + 1} stat={codeTasks[task.id]} showLevel />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
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
            <span className="flex h-6 min-w-6 items-center justify-center rounded-lg bg-primary-soft px-1.5 text-xs text-ink-primary">{LEVEL_LETTER[g.level]}</span>
            {t(`ide.levelName.${g.level}`)}
          </h2>
          <ul className="flex flex-col gap-2">
            {g.tasks.map((task, ti) => (
              <TaskRow key={task.id} lang={lang} task={task} n={offsets[gi] + ti + 1} stat={codeTasks[task.id]} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
