"use client";

import { Zap } from "lucide-react";
import { m } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * «+10» с молнией: всплывает вверх и растворяется. Золотые токены (XP = золото).
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
      <Zap size={14} className="text-gold" fill="currentColor" />+{amount}
    </m.span>
  );
}
