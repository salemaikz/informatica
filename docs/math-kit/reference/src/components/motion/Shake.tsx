"use client";

import { m } from "motion/react";
import type { ReactNode } from "react";

/** Один раз встряхивает содержимое, когда `active` становится true (например, неверный ответ). */
export function Shake({ active, children, className, strength = 7 }: { active: boolean; children: ReactNode; className?: string; strength?: number }) {
  const s = strength;
  return (
    <m.div
      className={className}
      initial={false}
      animate={active ? "shake" : "rest"}
      variants={{
        rest: { x: 0 },
        shake: { x: [0, -s, s, -s * 0.6, s * 0.6, 0], transition: { duration: 0.36, ease: "easeInOut" } },
      }}
    >
      {children}
    </m.div>
  );
}
