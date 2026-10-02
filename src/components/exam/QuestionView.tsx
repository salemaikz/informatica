"use client";

import { Check, Flag } from "lucide-react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { pickMatch, pickSingle, toggleMulti } from "@/lib/exam-store";
import { contextQuestionOf, type ExamAnswers, type ExamQuestion } from "@/lib/exam";
import { Markdown } from "@/components/Markdown";
import { SceneView } from "@/components/scenes/SceneView";
import { Pill } from "@/components/ui/Pill";
import { letter, optionsOf } from "./logic";

const NUMERIC = /^[0-9₀-₉\s,.+=−-]+$/u;

/** Кнопка варианта: спокойная, без «правильно/неправильно» — только выбрано или нет. */
function OptionButton({
  selected,
  disabled,
  badge,
  box,
  onClick,
  mono,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  badge: string;
  /** Флажок-квадрат (несколько верных). */
  box?: boolean;
  onClick: () => void;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left text-[17px] font-bold transition-colors active:translate-y-px",
        selected ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface hover:bg-surface-2",
        disabled && "pointer-events-none opacity-70",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-extrabold",
          box && "rounded-md",
          selected ? "border-primary bg-primary text-white" : "border-border text-muted",
        )}
      >
        {box && selected ? <Check size={18} strokeWidth={3.5} aria-hidden /> : badge}
      </span>
      <span className={cn("min-w-0 flex-1 whitespace-pre-wrap break-words", mono && "font-mono text-lg")}>{children}</span>
    </button>
  );
}

/**
 * Одно задание «как на ЕНТ»: условие, схема, варианты ответа. Для контекстного — общий текст сверху и «вопрос 2 из 5».
 * Ничего не подсказывает и не проверяет. Ответы меняются через onChange (чистые функции из exam-store).
 */
export function QuestionView({
  q,
  number,
  answers,
  onChange,
  locked,
  flagged,
}: {
  q: ExamQuestion;
  number: number;
  answers: ExamAnswers;
  onChange: (next: ExamAnswers) => void;
  locked?: boolean;
  flagged?: boolean;
}) {
  const { t, l } = useT();
  const item = q.item;
  const a = answers[q.key];
  const cq = contextQuestionOf(q);
  const opts = optionsOf(q);
  const numeric = item.kind !== "match" && opts.length > 0 && opts.every((o) => NUMERIC.test(l(o)));

  const typeKey = item.kind === "multi" ? "exam.q.multi" : item.kind === "match" ? "exam.q.match" : "exam.q.single";
  const prompt = cq ? l(cq.prompt) : item.kind === "context" ? "" : l(item.prompt);
  const scene = item.scene;

  return (
    <article className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-black">{t("exam.q.number", { n: number })}</span>
        {flagged && (
          <Pill tone="warning" icon={<Flag size={12} fill="currentColor" aria-hidden />}>
            {t("exam.nav.flagged")}
          </Pill>
        )}
      </div>

      {item.kind === "context" && (
        <>
          <div className="rounded-2xl border-2 border-border bg-surface-2/60 p-3.5">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted">{t("exam.q.context")}</p>
            <Markdown>{l(item.text)}</Markdown>
            {scene && <SceneView scene={scene} className="mt-3" />}
          </div>
          <p className="text-sm font-extrabold text-primary">{t("exam.q.sub", { n: (q.sub ?? 0) + 1, total: item.questions.length })}</p>
        </>
      )}

      {prompt && <Markdown className="text-[17px] font-semibold">{prompt}</Markdown>}
      {item.kind !== "context" && scene && <SceneView scene={scene} />}

      <div className="flex flex-col gap-3">
        <p className="text-sm font-bold text-muted">{t(typeKey)}</p>

        {(item.kind === "single" || item.kind === "context") &&
          opts.map((o, i) => (
            <OptionButton key={i} badge={letter(i)} selected={a?.choice === i} disabled={locked} mono={numeric} onClick={() => onChange(pickSingle(answers, q.key, i))}>
              {l(o)}
            </OptionButton>
          ))}

        {item.kind === "multi" &&
          item.options.map((o, i) => (
            <OptionButton key={i} badge={letter(i)} box selected={!!a?.multi?.includes(i)} disabled={locked} mono={numeric} onClick={() => onChange(toggleMulti(answers, q.key, i))}>
              {l(o)}
            </OptionButton>
          ))}

        {item.kind === "match" && (
          <>
            <ol className="flex flex-col gap-2 rounded-2xl bg-surface-2/60 p-3">
              {item.choices.map((c, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-surface text-sm font-extrabold text-muted">{i + 1}</span>
                  <span className="pt-0.5 font-semibold">{l(c)}</span>
                </li>
              ))}
            </ol>
            {item.items.map((it, row) => (
              <div key={row} className="rounded-2xl border-2 border-border bg-surface p-3">
                <p className="mb-2.5 font-extrabold">
                  <span className="mr-2 text-primary">{letter(row)}.</span>
                  {l(it)}
                </p>
                <div className="grid grid-cols-4 gap-2" role="group" aria-label={`${letter(row)}`}>
                  {item.choices.map((_, c) => {
                    const sel = a?.match?.[row] === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={sel}
                        disabled={locked}
                        onClick={() => onChange(pickMatch(answers, q.key, row, c, item.items.length))}
                        className={cn(
                          "h-12 rounded-xl border-2 text-lg font-extrabold transition-colors active:translate-y-px",
                          sel ? "border-primary bg-primary text-white" : "border-border bg-surface hover:bg-surface-2",
                          locked && "pointer-events-none opacity-70",
                        )}
                      >
                        {c + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </article>
  );
}
