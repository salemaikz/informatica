"use client";

import { m } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { springSoft } from "./presets";

/** Плавное появление блока снизу; `delay` (с) — для лесенки из нескольких блоков. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <m.div
      className={cn(className)}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSoft, delay }}
    >
      {children}
    </m.div>
  );
}
