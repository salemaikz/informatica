"use client";

import clsx from "clsx";
import { m } from "motion/react";
import { useMemo, useRef, useState } from "react";
import type { MatchStep } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { hashString, plainText, seeded, shuffle } from "@/lib/text";
import { InlineMarkdown } from "@/components/Markdown";
import { feedback } from "@/lib/feedback";
import type { StepProps } from "./types";

type Side = "left" | "right";

/** Соедини пары. Проверяется само: когда все пары найдены — шаг завершён. */
export function MatchView({ step, onAnswer, locked }: StepProps<MatchStep>) {
  const { t, l } = useT();
  const rand = useMemo(() => seeded(hashString(step.id)), [step.id]);
  const left = useMemo(() => shuffle(step.pairs.map((_, i) => i), rand), [step.pairs, rand]);
  const right = useMemo(() => shuffle(step.pairs.map((_, i) => i), rand), [step.pairs, rand]);

  const [sel, setSel] = useState<{ side: Side; i: number } | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [bad, setBad] = useState<{ left: number; right: number } | null>(null);
  const wrong = useRef(0);

  const tap = (side: Side, i: number) => {
    if (locked || matched.includes(i)) return;
    if (!sel || sel.side === side) {
      feedback("tap");
      setSel({ side, i });
      return;
    }
    const pair = side === "left" ? { left: i, right: sel.i } : { left: sel.i, right: i };
    setSel(null);
    if (pair.left === pair.right) {
      feedback("pop");
      const next = [...matched, i];
      setMatched(next);
      if (next.length === step.pairs.length) {
        onAnswer({ type: "match", done: true, wrong: wrong.current }, { submit: true });
      }
    } else {
      wrong.current += 1;
      feedback("wrong");
      setBad(pair);
      setTimeout(() => setBad(null), 550);
    }
  };

  const tile = (side: Side, i: number) => {
    const isMatched = matched.includes(i);
    const isSel = sel?.side === side && sel.i === i;
    const isBad = bad && bad[side] === i;
    const text = l(side === "left" ? step.pairs[i].left : step.pairs[i].right);
    // Числа и коды — моноширинным, слова — обычным шрифтом.
    const mono = /^[0-9₀-₉A-F\s,.+=−-]+$/u.test(plainText(text));
    return (
      <m.button
        key={`${side}-${i}`}
        type="button"
        disabled={isMatched || locked}
        onClick={() => tap(side, i)}
        whileTap={isMatched || locked ? undefined : { scale: 0.96 }}
        initial={false}
        animate={isMatched ? { scale: [1, 1.07, 1] } : isSel ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={clsx(
          "min-h-14 w-full rounded-2xl border-2 px-3 py-2 font-bold transition-[translate,background-color,border-color,box-shadow,opacity] duration-150",
          mono ? "font-mono text-lg" : "text-base",
          isMatched
            ? "border-success bg-success-soft text-success-strong opacity-60"
            : isBad
              ? "border-danger bg-danger-soft text-danger animate-shake"
              : isSel
                ? "border-primary bg-primary-soft text-primary shadow-[0_3px_0_var(--primary)]"
                : "border-border bg-surface shadow-[0_3px_0_var(--border)] hover:bg-surface-2 active:translate-y-[2px]",
        )}
      >
        <InlineMarkdown>{text}</InlineMarkdown>
      </m.button>
    );
  };

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-muted">{t("lesson.tapPairs")}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">{left.map((i) => tile("left", i))}</div>
        <div className="flex flex-col gap-3">{right.map((i) => tile("right", i))}</div>
      </div>
    </div>
  );
}
