"use client";

import { Flag } from "lucide-react";
import { memo } from "react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { isAnswered, type ExamAnswers, type ExamPaper } from "@/lib/exam";

/**
 * Навигатор заданий: сетка номеров. Отвечено — заливка primary, отмечено флажком — янтарная рамка и флажок,
 * текущее — жирная рамка. На телефоне открывается шторкой, на десктопе стоит сбоку.
 */
export const Navigator = memo(function Navigator({
  paper,
  answers,
  current,
  onGo,
}: {
  paper: ExamPaper;
  answers: ExamAnswers;
  current: number;
  onGo: (index: number) => void;
}) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 gap-2">
        {paper.items.map((q, i) => {
          const a = answers[q.key];
          const done = isAnswered(q, a);
          const flagged = !!a?.flagged;
          return (
            <button
              key={q.key}
              type="button"
              onClick={() => onGo(i)}
              aria-current={i === current ? "step" : undefined}
              aria-label={`${t("exam.q.number", { n: i + 1 })}${done ? `, ${t("exam.nav.answered")}` : ""}${flagged ? `, ${t("exam.nav.flagged")}` : ""}`}
              className={cn(
                "relative flex h-11 items-center justify-center rounded-xl border-2 text-sm font-extrabold transition-colors",
                done ? "border-primary bg-action-primary text-white" : flagged ? "border-warning bg-warning-soft text-warning-strong" : "border-border bg-surface text-text hover:bg-surface-2",
                flagged && done && "border-warning",
                i === current && "outline-3 outline-offset-2 outline-text",
              )}
            >
              {i + 1}
              {flagged && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-warning text-white">
                  <Flag size={10} fill="currentColor" aria-hidden />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-bold text-muted">
        <li className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded bg-primary" aria-hidden /> {t("exam.nav.answered")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border-2 border-warning bg-warning-soft" aria-hidden /> {t("exam.nav.flagged")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border-2 border-border bg-surface" aria-hidden /> {t("exam.nav.empty")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border-2 border-border outline-2 outline-offset-1 outline-text" aria-hidden /> {t("exam.nav.current")}
        </li>
      </ul>
    </div>
  );
});
