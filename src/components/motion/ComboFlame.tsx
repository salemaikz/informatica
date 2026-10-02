"use client";

import { Flame } from "lucide-react";
import { m } from "motion/react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { springBouncy } from "./presets";

/**
 * Счётчик комбо в шапке урока (оранжевый — «streak»-семантика).
 * Растёт и пульсирует с серией: 3+ — слегка, 5+ — сильнее и со свечением, 7+ — быстрее и крупнее.
 * На порогах 3 / 5 / 7+ от пламени расходится кольцо.
 */
export function ComboFlame({ combo }: { combo: number }) {
  const { t } = useT();
  const tier = combo >= 7 ? 3 : combo >= 5 ? 2 : combo >= 3 ? 1 : 0;
  const scale = [1, 1.08, 1.18, 1.3][tier];
  const milestone = combo === 3 || combo === 5 || combo >= 7;

  return (
    <div
      className={cn("relative flex min-w-14 items-center justify-end gap-1 font-extrabold transition-colors", combo >= 2 ? "text-streak" : "text-muted")}
      title={t("res.combo")}
    >
      <m.span className="relative flex" animate={{ scale }} transition={springBouncy}>
        {milestone && (
          <m.span
            key={combo}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-streak"
            initial={{ scale: 0.8, opacity: 0.9 }}
            animate={{ scale: 2.6, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        )}
        <m.span
          className="flex"
          style={tier >= 2 ? { filter: "drop-shadow(0 0 5px var(--streak))" } : undefined}
          animate={tier >= 1 ? { scale: [1, 1.14, 1] } : { scale: 1 }}
          transition={tier >= 1 ? { duration: tier >= 3 ? 0.55 : 0.9, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
        >
          <Flame size={20} fill={combo >= 2 ? "currentColor" : "none"} />
        </m.span>
      </m.span>
      <m.span
        key={combo}
        className="inline-block"
        initial={combo > 0 ? { scale: 1.5, y: -4 } : false}
        animate={{ scale: 1, y: 0 }}
        transition={springBouncy}
      >
        {combo}
      </m.span>
    </div>
  );
}
