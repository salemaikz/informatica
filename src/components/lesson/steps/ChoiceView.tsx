"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import { useEffect } from "react";
import { ignoreKey } from "@/lib/keys";
import type { ChoiceStep, MultiStep } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { feedback } from "@/lib/feedback";
import { Option, type OptionState } from "./Option";
import type { StepProps } from "./types";

function useDigitKeys(count: number, onPick: (i: number) => void, disabled: boolean) {
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      // Цифры, набранные в калькуляторе/черновике или в поле ввода, — не выбор варианта.
      if (ignoreKey(e)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= count) onPick(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, onPick, disabled]);
}

export function ChoiceView({ step, answer, onAnswer, locked }: StepProps<ChoiceStep>) {
  const { l } = useT();
  const sel = answer?.type === "choice" ? answer.index : -1;
  const short = step.options.every((o) => l(o).length <= 14);
  const numeric = step.options.every((o) => /^[0-9₀-₉\s,.+=−-]+$/u.test(l(o)));
  const pick = (i: number) => {
    feedback("tap");
    onAnswer({ type: "choice", index: i });
  };
  useDigitKeys(step.options.length, pick, locked);

  return (
    <div className={clsx("grid gap-3", short ? "grid-cols-2" : "grid-cols-1")}>
      {step.options.map((o, i) => {
        let state: OptionState = i === sel ? "selected" : "idle";
        if (locked) state = i === step.correct ? "correct" : i === sel ? "wrong" : "dim";
        return (
          <Option key={i} index={i} state={state} badge={i + 1} disabled={locked} onClick={() => pick(i)} className={clsx(short && "justify-center text-center", numeric && "font-mono text-xl")}>
            {l(o)}
          </Option>
        );
      })}
    </div>
  );
}

export function MultiView({ step, answer, onAnswer, locked }: StepProps<MultiStep>) {
  const { l, t } = useT();
  const sel = answer?.type === "multi" ? answer.indices : [];
  const toggle = (i: number) => {
    feedback("tap");
    const next = sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i];
    onAnswer({ type: "multi", indices: next });
  };
  useDigitKeys(step.options.length, toggle, locked);

  return (
    <div>
      <p className="mb-3 text-sm font-bold text-muted">{t("lesson.selectAll")}</p>
      <div className="grid grid-cols-2 gap-3">
        {step.options.map((o, i) => {
          const chosen = sel.includes(i);
          const right = step.correct.includes(i);
          let state: OptionState = chosen ? "selected" : "idle";
          if (locked) state = right ? "correct" : chosen ? "wrong" : "dim";
          return (
            <Option key={i} index={i} state={state} disabled={locked} onClick={() => toggle(i)} className="justify-center font-mono text-xl">
              <span className="flex items-center justify-center gap-2">
                <span
                  className={clsx(
                    "flex h-5 w-5 items-center justify-center rounded-md border-2 text-[11px]",
                    chosen || (locked && right) ? "border-current bg-current" : "border-border",
                  )}
                >
                  {(chosen || (locked && right)) && <Check size={14} strokeWidth={3.5} className="text-surface" />}
                </span>
                {l(o)}
              </span>
            </Option>
          );
        })}
      </div>
    </div>
  );
}
