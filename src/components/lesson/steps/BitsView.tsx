"use client";

import clsx from "clsx";
import { Lightbulb } from "lucide-react";
import { m } from "motion/react";
import type { BitsStep } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { feedback } from "@/lib/feedback";
import type { StepProps } from "./types";

/** Интерактив «Собери число»: каждая лампочка — бит со своим весом. */
export function BitsView({ step, answer, onAnswer, locked, result }: StepProps<BitsStep>) {
  const { t } = useT();
  const value = answer?.type === "bits" ? answer.value : 0;
  const weights = Array.from({ length: step.bits }, (_, i) => 2 ** (step.bits - 1 - i));

  const toggle = (w: number) => {
    if (locked) return;
    feedback("tap");
    onAnswer({ type: "bits", value: value ^ w });
  };

  const match = value === step.target;
  const valueTone = locked ? (result?.correct ? "text-success" : "text-danger") : match ? "text-success" : "text-text";

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-sm font-semibold text-muted">{t("bits.tap")}</p>
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        {weights.map((w) => {
          const on = (value & w) !== 0;
          return (
            <m.button
              key={w}
              type="button"
              onClick={() => toggle(w)}
              disabled={locked}
              aria-pressed={on}
              aria-label={`${w}`}
              whileTap={locked ? undefined : { scale: 0.9 }}
              transition={{ type: "spring", stiffness: 600, damping: 22 }}
              className="group flex w-14 flex-col items-center gap-1.5 sm:w-16"
            >
              <m.span
                initial={false}
                animate={on ? "on" : "off"}
                variants={{ off: { scale: 1, rotate: 0 }, on: { scale: [1, 1.22, 1], rotate: [0, -8, 0], transition: { duration: 0.3, ease: "easeOut" } } }}
                className={clsx(
                  "flex h-14 w-14 items-center justify-center rounded-full border-2 transition-[background-color,border-color,box-shadow,color] duration-200 sm:h-16 sm:w-16",
                  on
                    ? "border-gold bg-gold text-white shadow-[0_0_22px_var(--gold)]"
                    : "border-border bg-surface-2 text-muted group-hover:border-primary",
                )}
              >
                <Lightbulb size={26} strokeWidth={2.4} />
              </m.span>
              <span className={clsx("font-mono text-2xl font-bold", on ? "text-text" : "text-muted")}>{on ? 1 : 0}</span>
              <span className="rounded-md bg-surface-2 px-1.5 font-mono text-xs font-bold text-muted">{w}</span>
            </m.button>
          );
        })}
      </div>
      <m.div
        initial={false}
        animate={match && !locked ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex items-center gap-4 rounded-2xl bg-surface-2 px-5 py-3 font-extrabold"
      >
        <span className={clsx("text-xl transition-colors", valueTone)}>{t("bits.current", { n: value })}</span>
        <span className="text-muted">·</span>
        <span className="text-xl">{t("bits.target", { n: step.target })}</span>
      </m.div>
    </div>
  );
}
