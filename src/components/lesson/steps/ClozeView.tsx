"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { clozeBank } from "@/lib/cloze-bank";
import type { ClozeBlank, ClozeStep, ClozeToken } from "@/lib/types";
import { checkInput } from "@/lib/check";
import { cn } from "@/lib/cn";
import { clozeBlanks, isBlank } from "@/lib/evaluate";
import { useT } from "@/i18n/useT";
import type { StepProps } from "./types";

type Cell = { kind: "text"; token: Exclude<ClozeToken, ClozeBlank> } | { kind: "blank"; blank: ClozeBlank; index: number };

/** Пробелы по краям токена — неразрывные: во flex-строке обычные пробелы на краях схлопнулись бы. */
const keepEdges = (s: string) => s.replace(/^ +| +$/g, (spaces) => " ".repeat(spaces.length));

/**
 * «Решаем вместе»: пример с пропусками. Строки — ряды из текста и полей ввода.
 * Пробелы между токенами ставит автор в самих строках («13 ÷ 2 = », «ост. »).
 * Enter переходит к следующему пустому полю, а когда пустых нет — всплывает до плеера и проверяет ответ.
 */
export function ClozeView({ step, answer, onAnswer, locked }: StepProps<ClozeStep>) {
  const { t, l, lang } = useT();
  const blanks = useMemo(() => clozeBlanks(step), [step]);
  const rows = useMemo(() => {
    let index = 0;
    return step.lines.map((line) => line.map((token): Cell => (isBlank(token) ? { kind: "blank", blank: token, index: index++ } : { kind: "text", token })));
  }, [step]);
  const values = useMemo(
    () => (answer?.type === "cloze" && answer.values.length === blanks.length ? answer.values : blanks.map(() => "")),
    [answer, blanks],
  );
  // Банк плашек: текстовые пропуски с label заполняются выбором, числовые и двоичные — вводом.
  const bank = useMemo(() => clozeBank(step, lang), [step, lang]);
  const isPick = (i: number) => bank.length > 0 && blanks[i].mode === "text" && !!blanks[i].label;
  const pickIdx = blanks.map((_, i) => i).filter(isPick);
  const currentPick = locked ? undefined : pickIdx.find((i) => !values[i].trim());
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  // Верно ли заполнен пропуск — считаем один раз (после проверки подсвечиваем и подписываем верный ответ).
  const wrongAt = (i: number) => locked && !checkInput(values[i], blanks[i].blank, blanks[i].mode);

  useEffect(() => {
    // На десктопе сразу ставим курсор в первое поле; на телефоне клавиатуру сами не открываем.
    if (window.matchMedia("(pointer: fine)").matches) inputs.current.find((el) => !!el)?.focus();
  }, [step.id]);

  const setValue = (i: number, raw: string) => {
    const value = blanks[i].mode === "binary" ? raw.replace(/[^01\s]/g, "") : raw;
    onAnswer({ type: "cloze", values: values.map((v, j) => (j === i ? value : v)) });
  };

  // Плашка заполняет первый пустой выбираемый пропуск.
  const pickChip = (word: string) => {
    if (locked || currentPick === undefined) return;
    onAnswer({ type: "cloze", values: values.map((v, j) => (j === currentPick ? word : v)) });
  };
  const clearPick = (i: number) => {
    if (locked) return;
    onAnswer({ type: "cloze", values: values.map((v, j) => (j === i ? "" : v)) });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    // Сначала пустые поля после текущего, потом с начала.
    const typed = [...blanks.keys()].filter((j) => !isPick(j));
    const order = typed.filter((j) => j > i).concat(typed.filter((j) => j < i));
    const target = order.find((j) => !values[j].trim());
    if (target === undefined) return; // всё заполнено — Enter дойдёт до плеера и проверит ответ
    e.preventDefault();
    e.stopPropagation();
    inputs.current[target]?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Схему-условие (step.scene) рисует экран задания (плеер урока, чат «Дай задачи») — здесь не повторяем. */}
      <div className="flex flex-col gap-3 rounded-3xl border-2 border-border bg-surface px-4 py-4">
        {rows.map((row, r) => (
          // Под неверным пропуском печатается верный ответ — оставляем ему место в строке.
          <div
            key={r}
            className={cn(
              "flex flex-wrap items-center gap-y-2 text-xl font-semibold transition-[padding] sm:text-2xl",
              row.some((cell) => cell.kind === "blank" && wrongAt(cell.index)) && "pb-6",
            )}
          >
            {row.map((cell, c) => {
              if (cell.kind === "text") {
                const text = typeof cell.token === "string" ? cell.token : l(cell.token);
                return (
                  <span key={c} className={cn("min-w-0 whitespace-pre-wrap", typeof cell.token === "string" && "font-mono")}>
                    {keepEdges(text)}
                  </span>
                );
              }
              const { blank, index } = cell;
              const value = values[index];
              const wrong = wrongAt(index);
              const right = locked && !wrong;
              const size = Math.max(2, blank.width ?? Math.max(...blank.blank.map((a) => a.length))) + 1;
              if (isPick(index)) {
                const shown = blank.label ? l(blank.label) : blank.blank[0];
                return (
                  <span key={c} className="relative mx-1 inline-flex">
                    <button
                      type="button"
                      disabled={locked || !value}
                      onClick={() => clearPick(index)}
                      aria-label={`${t("resume.blankN", { n: index + 1 })}${value ? `: ${value}` : ""}`}
                      className={cn(
                        "min-h-12 min-w-16 rounded-xl border-2 px-3 text-center font-mono font-bold transition-colors",
                        !locked && !value && "border-dashed border-border bg-surface-2",
                        !locked && !value && index === currentPick && "border-primary ring-4 ring-primary/25",
                        !locked && !!value && "border-primary bg-primary-soft text-primary",
                        right && "border-success bg-success-soft",
                        wrong && "animate-shake border-danger bg-danger-soft text-danger",
                      )}
                    >
                      {value || "\u00a0"}
                    </button>
                    {wrong && (
                      <span className="absolute left-1/2 top-full mt-0.5 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap font-mono text-sm font-bold text-success-strong">
                        <Check size={14} strokeWidth={3.5} aria-hidden />
                        {shown}
                      </span>
                    )}
                  </span>
                );
              }
              return (
                <span key={c} className="relative mx-1 inline-flex">
                  <input
                    ref={(el) => {
                      inputs.current[index] = el;
                    }}
                    value={value}
                    readOnly={locked}
                    tabIndex={locked ? -1 : undefined}
                    onChange={(e) => setValue(index, e.target.value)}
                    onKeyDown={(e) => onKeyDown(e, index)}
                    inputMode={blank.mode === "text" ? "text" : "numeric"}
                    enterKeyHint={index === blanks.length - 1 ? "done" : "next"}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    aria-label={`${t("lesson.typeAnswer")} ${index + 1}`}
                    style={{ width: `calc(${size}ch + 1.5rem)` }}
                    className={cn(
                      "h-12 max-w-full rounded-xl border-2 bg-surface px-3 text-center font-mono font-bold outline-none transition-colors",
                      !locked && "border-border focus:border-primary focus:ring-4 focus:ring-primary/25",
                      right && "pointer-events-none border-success bg-success-soft",
                      wrong && "pointer-events-none animate-shake border-danger bg-danger-soft text-danger",
                    )}
                  />
                  {wrong && (
                    <span className="absolute left-1/2 top-full mt-0.5 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap font-mono text-sm font-bold text-success-strong">
                      <Check size={14} strokeWidth={3.5} aria-hidden />
                      {blank.blank[0]}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {bank.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("resume.pick")}</p>
          <ul className="flex flex-wrap gap-2">
            {bank.map((word) => {
              const used = values.some((v, i) => isPick(i) && v === word);
              return (
                <li key={word}>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => pickChip(word)}
                    aria-label={t("resume.chip", { word })}
                    aria-pressed={used}
                    className={cn(
                      "min-h-12 rounded-2xl border-2 px-4 text-base font-bold shadow-[0_3px_0_var(--border)] transition-[translate,box-shadow] active:translate-y-[3px] active:shadow-none disabled:shadow-none",
                      used ? "border-border bg-surface-2 text-muted" : "border-border bg-surface hover:bg-surface-2",
                    )}
                  >
                    {word}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
