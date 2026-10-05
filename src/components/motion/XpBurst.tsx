"use client";

import { m } from "motion/react";
import { cn } from "@/lib/cn";
import { XpIcon } from "@/components/economy/XpIcon";

/**
 * «+10» со значком XP: всплывает вверх и растворяется. Золотые токены (XP = золото).
 * Показывается заново при каждом новом `id` (счётчик событий); при `id = 0` или `amount <= 0` ничего не рисует.
 * Родитель должен быть `relative`; элемент не ловит клики.
 */
export function XpBurst({ id, amount, delay = 0, className }: { id: number; amount: number; delay?: number; className?: string }) {
  if (!id || amount <= 0) return null;
  return (
    <m.span
      key={id}
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-40 inline-flex items-center gap-0.5 rounded-full border-2 border-gold bg-gold-soft px-2 py-0.5 text-sm font-extrabold text-warning-strong shadow-sm",
        className,
      )}
      initial={{ opacity: 0, y: 6, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 0], y: [6, -8, -22, -40], scale: [0.6, 1.12, 1, 1] }}
      transition={{ duration: 0.95, times: [0, 0.2, 0.7, 1], ease: "easeOut", delay }}
    >
      +{amount}
      <XpIcon size={14} />
    </m.span>
  );
}
