"use client";

import { ChevronDown, Eye, EyeOff, Lightbulb, Lock } from "lucide-react";
import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { EditorLanguage, IdeTask } from "@/lib/ide/types";
import { useT } from "@/i18n/useT";
import { CodeEditor } from "./CodeEditor";
import { LEVEL_LETTER } from "./shell-helpers";

/**
 * Карточка условия: заголовок, уровень, условие (markdown), «Подсказка» и «Показать решение»
 * (решение — после решения задачи или после двух неудачных проверок).
 */
export function TaskPanel({
  task,
  editor,
  solutionOpenable,
}: {
  task: IdeTask;
  /** Язык подсветки решения (null — Excel: показываем как текст). */
  editor: EditorLanguage | null;
  solutionOpenable: boolean;
}) {
  const { t, l } = useT();
  const [collapsed, setCollapsed] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);

  return (
    <section className="rounded-3xl border-2 border-border bg-surface p-4">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        aria-label={t(collapsed ? "ide.task.expand" : "ide.task.collapse")}
        className="flex min-h-11 w-full items-center gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="mb-1 flex items-center gap-2">
            <span className="rounded-lg bg-primary-soft px-2 py-0.5 text-xs font-extrabold text-primary">{t("ide.level", { l: LEVEL_LETTER[task.level] })}</span>
            <span className="text-xs font-extrabold uppercase tracking-wide text-muted">{t(`ide.levelName.${task.level}`)}</span>
          </span>
          <h1 className="text-xl font-extrabold leading-tight">{l(task.title)}</h1>
        </span>
        <ChevronDown size={22} className={cn("shrink-0 text-muted transition-transform", !collapsed && "rotate-180")} aria-hidden />
      </button>

      {!collapsed && (
        <div className="mt-3 flex flex-col gap-3">
          <Markdown>{l(task.prompt)}</Markdown>

          <div className="flex flex-wrap gap-2">
            {task.hint && (
              <Button variant="secondary" size="sm" icon={<Lightbulb size={16} />} onClick={() => setHintOpen((v) => !v)} aria-expanded={hintOpen}>
                {t(hintOpen ? "ide.task.hintHide" : "ide.task.hint")}
              </Button>
            )}
            {solutionOpenable ? (
              <Button variant="secondary" size="sm" icon={solutionOpen ? <EyeOff size={16} /> : <Eye size={16} />} onClick={() => setSolutionOpen((v) => !v)} aria-expanded={solutionOpen}>
                {t(solutionOpen ? "ide.task.solutionHide" : "ide.task.solution")}
              </Button>
            ) : (
              <p className="flex min-h-9 items-center gap-1.5 text-xs font-bold text-muted">
                <Lock size={14} aria-hidden /> {t("ide.task.solutionLocked")}
              </p>
            )}
          </div>

          {hintOpen && task.hint && (
            <div className="rounded-2xl border-2 border-primary/25 bg-primary-soft px-4 py-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-primary">
                <Lightbulb size={14} aria-hidden /> {t("ide.task.hint")}
              </p>
              <Markdown>{l(task.hint)}</Markdown>
            </div>
          )}

          {solutionOpen && solutionOpenable && (
            <div>
              <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-muted">{t("ide.task.solutionTitle")}</p>
              {editor ? (
                <CodeEditor value={task.solution} onChange={() => {}} language={editor} ariaLabel={t("ide.task.solutionAria")} readOnly minHeight={80} />
              ) : (
                <pre aria-label={t("ide.task.solutionAria")} className="overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border-2 border-border bg-surface-2 p-3 font-mono text-[15px]">
                  {task.solution}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
