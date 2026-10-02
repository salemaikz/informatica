"use client";

import { Check, ChevronDown, Clock, Minus, X, type LucideIcon } from "lucide-react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { contextQuestionOf, type ExamAnswers } from "@/lib/exam";
import { plain } from "@/lib/text";
import { Markdown } from "@/components/Markdown";
import { SceneView } from "@/components/scenes/SceneView";
import {
  chosenIndexes,
  correctIndexes,
  explanationOf,
  formatClock,
  letter,
  optionsOf,
  questionPrompt,
  whyWrongOf,
  type ReviewRow,
  type ReviewStatus,
} from "./logic";

const STATUS: Record<ReviewStatus, { icon: LucideIcon; badge: string }> = {
  correct: { icon: Check, badge: "bg-success-soft text-success-strong" },
  partial: { icon: Minus, badge: "bg-warning-soft text-warning-strong" },
  wrong: { icon: X, badge: "bg-danger-soft text-danger" },
  skipped: { icon: Minus, badge: "bg-surface-2 text-muted" },
};

/** Разбор одного задания: условие, ответ ученика, верный ответ, объяснение, разбор выбранного неверного варианта. Бесплатно, без ИИ. */
function Detail({ row, answers }: { row: ReviewRow; answers: ExamAnswers }) {
  const { t, l, lang } = useT();
  const { q } = row;
  const item = q.item;
  const a = answers[q.key];
  const cq = contextQuestionOf(q);
  const chosen = chosenIndexes(q, a);
  const correct = correctIndexes(q);
  const opts = optionsOf(q);
  const prompt = cq ? l(cq.prompt) : item.kind === "context" ? "" : l(item.prompt);
  const why = whyWrongOf(q, a, lang);
  const explanation = explanationOf(q, lang);
  const timeSec = Math.round((a?.timeMs ?? 0) / 1000);

  return (
    <div className="flex flex-col gap-3 border-t-2 border-border px-3.5 pb-4 pt-3">
      {item.kind === "context" && (
        <div className="rounded-2xl bg-surface-2/60 p-3">
          <Markdown>{l(item.text)}</Markdown>
          {item.scene && <SceneView scene={item.scene} className="mt-3" />}
        </div>
      )}
      {prompt && <Markdown className="font-semibold">{prompt}</Markdown>}
      {item.kind !== "context" && item.scene && <SceneView scene={item.scene} />}

      {item.kind === "match" ? (
        <ul className="flex flex-col gap-2">
          {item.items.map((it, i) => {
            const given = a?.match?.[i];
            const ok = given === item.answer[i];
            return (
              <li key={i} className="rounded-xl border-2 border-border p-2.5 text-sm">
                <p className="font-extrabold">
                  {letter(i)}. {l(it)}
                </p>
                <p className={cn("mt-1 font-semibold", ok ? "text-success-strong" : "text-danger")}>
                  {t("exam.review.yours")}: {typeof given === "number" ? `${given + 1}. ${l(item.choices[given])}` : "—"}
                </p>
                {!ok && (
                  <p className="font-semibold text-success-strong">
                    {t("exam.review.correct")}: {item.answer[i] + 1}. {l(item.choices[item.answer[i]])}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {opts.map((o, i) => {
            const right = correct.includes(i);
            const picked = chosen.includes(i);
            return (
              <li
                key={i}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border-2 px-2.5 py-2 text-sm font-semibold",
                  right ? "border-success bg-success-soft" : picked ? "border-danger bg-danger-soft" : "border-border",
                )}
              >
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-xs font-extrabold", right ? "border-success text-success-strong" : picked ? "border-danger text-danger" : "border-border text-muted")}>
                  {letter(i)}
                </span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words pt-px">{l(o)}</span>
                {picked && <span className="shrink-0 text-xs font-extrabold text-muted">{t("exam.review.yoursShort")}</span>}
                {right && <Check size={16} className="mt-0.5 shrink-0 text-success-strong" aria-hidden />}
              </li>
            );
          })}
        </ul>
      )}

      {chosen.length === 0 && item.kind !== "match" && <p className="text-sm font-bold text-muted">{t("exam.review.skipped")}</p>}

      {why && (
        <div className="rounded-2xl bg-danger-soft p-3 text-sm">
          <p className="mb-1 font-extrabold text-danger">{t("exam.review.whyWrong")}</p>
          <Markdown>{why}</Markdown>
        </div>
      )}
      {explanation && (
        <div className="rounded-2xl bg-surface-2 p-3 text-sm">
          <p className="mb-1 font-extrabold text-muted">{t("exam.review.explanation")}</p>
          <Markdown>{explanation}</Markdown>
        </div>
      )}
      {timeSec > 0 && (
        <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
          <Clock size={14} aria-hidden /> {t("exam.review.time", { time: formatClock(timeSec) })}
        </p>
      )}
    </div>
  );
}

export function ReviewList({
  rows,
  answers,
  open,
  onToggle,
}: {
  rows: ReviewRow[];
  answers: ExamAnswers;
  open: Set<string>;
  onToggle: (key: string) => void;
}) {
  const { t, lang } = useT();
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => {
        const S = STATUS[r.status];
        const isOpen = open.has(r.q.key);
        return (
          <li key={r.q.key} id={`rv-${r.q.key}`} className="scroll-mt-20 overflow-hidden rounded-2xl border-2 border-border bg-surface">
            <button type="button" aria-expanded={isOpen} onClick={() => onToggle(r.q.key)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface-2">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", S.badge)}>
                <S.icon size={18} strokeWidth={3} aria-label={t(`exam.status.${r.status}` as const)} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-extrabold text-muted">
                  {t("exam.q.number", { n: r.index + 1 })} · {r.points}/{r.max}
                </span>
                <span className="line-clamp-2 text-sm font-bold">{plain(questionPrompt(r.q, lang))}</span>
              </span>
              <ChevronDown size={18} className={cn("shrink-0 text-muted transition-transform", isOpen && "rotate-180")} aria-hidden />
            </button>
            {isOpen && <Detail row={r} answers={answers} />}
          </li>
        );
      })}
    </ul>
  );
}
