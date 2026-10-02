"use client";

import clsx from "clsx";
import { ArrowUp } from "lucide-react";
import { m } from "motion/react";
import { useMemo } from "react";
import type { LadderStep } from "@/lib/types";
import { divisionLadder } from "@/lib/check";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n/useT";
import type { StepProps } from "./types";

/** Интерактив «лесенка деления»: частные показаны, ученик выбирает остатки. */
export function LadderView({ step, answer, onAnswer, locked }: StepProps<LadderStep>) {
  const { t } = useT();
  const rows = useMemo(() => divisionLadder(step.number), [step.number]);
  const rem = answer?.type === "ladder" ? answer.remainders : rows.map(() => null);

  const set = (i: number, v: number) => {
    if (locked) return;
    feedback("tap");
    const next = [...rem];
    next[i] = v;
    onAnswer({ type: "ladder", remainders: next });
  };

  const assembled = [...rem].reverse().map((r) => (r === null ? "?" : String(r))).join("");

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm font-semibold text-muted">{t("ladder.pick")}</p>
      <div className="flex items-stretch gap-3">
        <div className="flex flex-col gap-2">
          {rows.map((r, i) => {
            const chosen = rem[i];
            const wrong = locked && chosen !== r.remainder;
            return (
              <div key={i} style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }} className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2 font-mono text-lg font-bold animate-rise-in">
                <span className="w-10 text-right">{r.value}</span>
                <span className="text-muted">: 2 =</span>
                <span className="w-8">{r.quotient}</span>
                <span className="hidden text-xs font-sans font-bold text-muted sm:inline">{t("ladder.remainder")}</span>
                <div className="flex gap-1.5">
                  {[0, 1].map((v) => (
                    <m.button
                      key={v}
                      type="button"
                      disabled={locked}
                      onClick={() => set(i, v)}
                      whileTap={locked ? undefined : { scale: 0.88 }}
                      initial={false}
                      animate={chosen === v && !locked ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className={clsx(
                        "h-10 w-10 rounded-xl border-2 text-lg font-bold transition-colors",
                        chosen === v
                          ? locked
                            ? wrong
                              ? "border-danger bg-danger-soft text-danger"
                              : "border-success bg-success-soft text-success-strong"
                            : "border-primary bg-primary-soft text-primary"
                          : locked && v === r.remainder
                            ? "border-success text-success"
                            : "border-border bg-surface text-muted hover:border-primary",
                      )}
                    >
                      {v}
                    </m.button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col items-center justify-end gap-1 text-primary" aria-hidden>
          <ArrowUp size={22} strokeWidth={3} />
          <div className="w-1 flex-1 rounded-full bg-primary/40" />
        </div>
      </div>
      <div className="flex items-baseline gap-2 rounded-2xl border-2 border-dashed border-primary/50 px-5 py-2">
        <span className="text-sm font-bold text-muted">{t("ladder.read")}</span>
        <m.span
          key={assembled}
          initial={{ scale: 1.12 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className="font-mono text-2xl font-bold tracking-widest text-primary"
        >
          {assembled}
          <sub className="text-sm">2</sub>
        </m.span>
      </div>
    </div>
  );
}
