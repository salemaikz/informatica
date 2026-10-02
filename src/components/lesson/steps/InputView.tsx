"use client";

import clsx from "clsx";
import { Delete } from "lucide-react";
import { useEffect, useRef } from "react";
import type { InputStep } from "@/lib/types";
import { useT } from "@/i18n/useT";
import type { StepProps } from "./types";

/** «₁₀» → «10»: подстрочные цифры в моноширинном шрифте могут отсутствовать. */
const fromSubscript = (s: string) => <sub>{s.replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))}</sub>;

export function InputView({ step, answer, onAnswer, locked, result }: StepProps<InputStep>) {
  const { t } = useT();
  const value = answer?.type === "input" ? answer.value : "";
  const ref = useRef<HTMLInputElement>(null);
  const set = (v: string) => onAnswer({ type: "input", value: v });

  useEffect(() => {
    // На десктопе сразу ставим курсор; на телефоне не открываем клавиатуру сами (есть кнопки 0/1).
    if (window.matchMedia("(pointer: fine)").matches) ref.current?.focus();
  }, [step.id]);

  const tone = !locked ? "border-border focus-within:border-primary" : result?.correct ? "border-success bg-success-soft" : "border-danger bg-danger-soft animate-shake";

  return (
    <div className="flex flex-col items-center gap-4">
      <label className={clsx("flex w-full max-w-sm items-baseline gap-2 rounded-2xl border-2 bg-surface px-4 py-3 transition-colors", tone)}>
        <input
          ref={ref}
          value={value}
          disabled={locked}
          onChange={(e) => set(step.mode === "binary" ? e.target.value.replace(/[^01\s]/g, "") : e.target.value)}
          inputMode={step.mode === "text" ? "text" : "numeric"}
          autoComplete="off"
          aria-label={t("lesson.typeAnswer")}
          placeholder={t("lesson.typeAnswer")}
          className="min-w-0 flex-1 bg-transparent font-mono text-3xl font-bold tracking-wider outline-none placeholder:font-sans placeholder:text-lg placeholder:font-semibold placeholder:tracking-normal placeholder:text-muted/70"
        />
        {step.suffix && <span className="font-mono text-xl font-bold text-muted">{fromSubscript(step.suffix)}</span>}
      </label>

      {step.mode === "binary" && !locked && (
        <div className="flex gap-3" aria-hidden>
          {["0", "1"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => set(value + d)}
              className="h-14 w-16 rounded-2xl border-2 border-border bg-surface font-mono text-2xl font-bold shadow-[0_3px_0_var(--border)] active:translate-y-[2px] active:shadow-none"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => set(value.slice(0, -1))}
            className="flex h-14 w-16 items-center justify-center rounded-2xl border-2 border-border bg-surface text-muted shadow-[0_3px_0_var(--border)] active:translate-y-[2px] active:shadow-none"
          >
            <Delete size={22} />
          </button>
        </div>
      )}
    </div>
  );
}
