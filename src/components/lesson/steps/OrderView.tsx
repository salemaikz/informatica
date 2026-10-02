"use client";

import clsx from "clsx";
import { m } from "motion/react";
import { useMemo } from "react";
import type { OrderStep } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { feedback } from "@/lib/feedback";
import { InlineMarkdown } from "@/components/Markdown";
import { hashString, seeded, shuffle } from "@/lib/text";
import type { StepProps } from "./types";

/** Расставь по порядку: нажимай на карточки снизу — они встают в цепочку сверху. */
export function OrderView({ step, answer, onAnswer, locked }: StepProps<OrderStep>) {
  const { t, l } = useT();
  const pool = useMemo(() => {
    const rand = seeded(hashString(step.id));
    let s = shuffle(step.items.map((_, i) => i), rand);
    // Не показываем уже правильный порядок
    if (s.every((v, i) => v === i)) s = [...s.slice(1), s[0]];
    return s;
  }, [step.id, step.items]);
  const order = answer?.type === "order" ? answer.order : [];

  const add = (i: number) => {
    if (locked) return;
    feedback("tap");
    onAnswer({ type: "order", order: [...order, i] });
  };
  const remove = (i: number) => {
    if (locked) return;
    feedback("tap");
    onAnswer({ type: "order", order: order.filter((x) => x !== i) });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold text-muted">{t("lesson.orderHint")}</p>
      <ol className="flex min-h-40 flex-col gap-2 rounded-2xl border-2 border-dashed border-border p-2">
        {order.map((i, pos) => {
          const tone = locked ? (i === pos ? "border-success bg-success-soft" : "border-danger bg-danger-soft") : "border-primary bg-primary-soft";
          return (
            <m.li
              key={i}
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 26 }}
            >
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={locked}
                className={clsx("flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left font-bold active:scale-[0.98]", tone)}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-extrabold">{pos + 1}</span>
                <span className="min-w-0">
                  <InlineMarkdown>{l(step.items[i])}</InlineMarkdown>
                </span>
              </button>
            </m.li>
          );
        })}
      </ol>
      <div className="flex flex-col gap-2">
        {pool
          .filter((i) => !order.includes(i))
          .map((i) => (
            <m.button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => add(i)}
              whileTap={locked ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 600, damping: 24 }}
              className="w-full rounded-xl border-2 border-border bg-surface px-3 py-2.5 text-left font-bold shadow-[0_3px_0_var(--border)] hover:bg-surface-2 active:translate-y-[2px] active:shadow-none"
            >
              <InlineMarkdown>{l(step.items[i])}</InlineMarkdown>
            </m.button>
          ))}
      </div>
    </div>
  );
}
