"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import type { ClozeBlank, ClozeStep, ClozeToken } from "@/lib/types";
import { checkInput } from "@/lib/check";
import { cn } from "@/lib/cn";
import { clozeBlanks, isBlank } from "@/lib/evaluate";
import { useT } from "@/i18n/useT";
import { SceneView } from "@/components/scenes/SceneView";
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
  const { t, l } = useT();
  const blanks = useMemo(() => clozeBlanks(step), [step]);
  const rows = useMemo(() => {
    let index = 0;
    return step.lines.map((line) => line.map((token): Cell => (isBlank(token) ? { kind: "blank", blank: token, index: index++ } : { kind: "text", token })));
  }, [step]);
  const values = useMemo(
    () => (answer?.type === "cloze" && answer.values.length === blanks.length ? answer.values : blanks.map(() => "")),
    [answer, blanks],
  );
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  // Верно ли заполнен пропуск — считаем один раз (после проверки подсвечиваем и подписываем верный ответ).
  const wrongAt = (i: number) => locked && !checkInput(values[i], blanks[i].blank, blanks[i].mode);

  useEffect(() => {
    // На десктопе сразу ставим курсор в первое поле; на телефоне клавиатуру сами не открываем.
    if (window.matchMedia("(pointer: fine)").matches) inputs.current[0]?.focus();
  }, [step.id]);

  const setValue = (i: number, raw: string) => {
    const value = blanks[i].mode === "binary" ? raw.replace(/[^01\s]/g, "") : raw;
    onAnswer({ type: "cloze", values: values.map((v, j) => (j === i ? value : v)) });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    // Сначала пустые поля после текущего, потом с начала.
    const order = [...blanks.keys()].filter((j) => j > i).concat([...blanks.keys()].filter((j) => j < i));
    const target = order.find((j) => !values[j].trim());
    if (target === undefined) return; // всё заполнено — Enter дойдёт до плеера и проверит ответ
    e.preventDefault();
    e.stopPropagation();
    inputs.current[target]?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      {step.scene && <SceneView scene={step.scene} />}
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
    </div>
  );
}
