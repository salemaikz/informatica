"use client";

import clsx from "clsx";
import { useMemo, useRef, useState } from "react";
import type { MatchStep } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { hashString, seeded, shuffle } from "@/lib/text";
import { playSound } from "@/lib/sound";
import { useApp } from "@/lib/store";
import type { StepProps } from "./types";

type Side = "left" | "right";

/** Соедини пары. Проверяется само: когда все пары найдены — шаг завершён. */
export function MatchView({ step, onAnswer, locked }: StepProps<MatchStep>) {
  const { t, l } = useT();
  const sound = useApp((s) => s.profile.sound);
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
      setSel({ side, i });
      return;
    }
    const pair = side === "left" ? { left: i, right: sel.i } : { left: sel.i, right: i };
    setSel(null);
    if (pair.left === pair.right) {
      if (sound) playSound("tap");
      const next = [...matched, i];
      setMatched(next);
      if (next.length === step.pairs.length) {
        onAnswer({ type: "match", done: true, wrong: wrong.current }, { submit: true });
      }
    } else {
      wrong.current += 1;
      setBad(pair);
      setTimeout(() => setBad(null), 550);
    }
  };

  const tile = (side: Side, i: number) => {
    const isMatched = matched.includes(i);
    const isSel = sel?.side === side && sel.i === i;
    const isBad = bad && bad[side] === i;
    const text = l(side === "left" ? step.pairs[i].left : step.pairs[i].right);
    return (
      <button
        key={`${side}-${i}`}
        type="button"
        disabled={isMatched || locked}
        onClick={() => tap(side, i)}
        className={clsx(
          "min-h-14 w-full rounded-2xl border-2 px-3 py-2 font-mono text-lg font-bold transition-all duration-150",
          isMatched
            ? "border-success bg-success-soft text-success-strong opacity-60"
            : isBad
              ? "border-danger bg-danger-soft text-danger animate-shake"
              : isSel
                ? "border-primary bg-primary-soft text-primary shadow-[0_3px_0_var(--primary)]"
                : "border-border bg-surface shadow-[0_3px_0_var(--border)] hover:bg-surface-2 active:translate-y-[2px]",
        )}
      >
        {text}
      </button>
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
