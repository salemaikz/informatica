"use client";

import clsx from "clsx";
import { m } from "motion/react";
import { useState } from "react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";

const GROW_SPRING = { type: "spring", stiffness: 150, damping: 22 } as const;

/** Полоса прогресса: ширина плавно «догоняет» значение пружиной, при росте по полосе пробегает мягкий блик. */
export function ProgressBar({
  value,
  color = "var(--success)",
  className,
  height = 14,
  label,
}: {
  value: number;
  color?: string;
  className?: string;
  height?: number;
  label?: string;
}) {
  const reduce = useReduceMotion();
  const pct = Math.max(0, Math.min(1, value)) * 100;

  // Считаем, сколько раз значение выросло: по ключу перезапускаем блик (setState при рендере — штатный приём «предыдущего значения»).
  const [prev, setPrev] = useState(pct);
  const [grown, setGrown] = useState(0);
  if (pct !== prev) {
    setPrev(pct);
    if (pct > prev) setGrown((g) => g + 1);
  }

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className={clsx("relative w-full overflow-hidden rounded-full bg-surface-2 [contain:layout_paint]", className)}
      style={{ height }}
    >
      <m.div
        className="relative h-full overflow-hidden rounded-full"
        style={{ background: color, minWidth: pct > 0 ? height : 0 }}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={reduce ? { duration: 0 } : GROW_SPRING}
      >
        <span
          className="absolute left-2 right-2 top-[3px] rounded-full bg-white/30"
          style={{ height: Math.max(2, height / 4) }}
        />
        {grown > 0 && !reduce && (
          <m.span
            key={grown}
            aria-hidden
            className="absolute inset-y-0 left-0 w-1/2 bg-linear-to-r from-transparent via-white/45 to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "260%" }}
            transition={{ duration: 0.7, delay: 0.12, ease: "easeOut" }}
          />
        )}
      </m.div>
    </div>
  );
}

/** Кольцевой прогресс — для дневной цели. */
export function Ring({ value, size = 56, stroke = 7, color = "var(--gold)", children }: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
