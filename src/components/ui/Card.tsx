"use client";

import { cn } from "@/lib/cn";
import { m } from "motion/react";
import type { HTMLAttributes } from "react";
import { springSoft } from "@/components/motion/presets";

type DomDivProps = Omit<HTMLAttributes<HTMLDivElement>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "style">;

interface CardProps extends DomDivProps {
  /** Карточка-кнопка: при нажатии слегка «вдавливается». */
  interactive?: boolean;
  /** Мягко появляется снизу при показе. */
  appear?: boolean;
}

const BASE = "rounded-3xl border-2 border-border bg-surface p-4 sm:p-5";

export function Card({ className, interactive, appear, ...rest }: CardProps) {
  if (!interactive && !appear) return <div {...rest} className={cn(BASE, className)} />;
  return (
    <m.div
      {...rest}
      className={cn(BASE, interactive && "cursor-pointer select-none", className)}
      initial={appear ? { opacity: 0, y: 14 } : false}
      animate={{ opacity: 1, y: 0 }}
      whileTap={interactive ? { scale: 0.985 } : undefined}
      transition={springSoft}
    />
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-lg font-extrabold">{children}</h2>
      {action}
    </div>
  );
}
