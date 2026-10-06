"use client";

import { ArrowUp } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import { useT } from "@/i18n/useT";
import { springBouncy, springSoft } from "@/components/motion/presets";
import { subscript } from "@/lib/calc";
import { cn } from "@/lib/cn";
import type { Scene } from "@/lib/types";
import { ladderRows, readUpDigits, visibleLadderRows } from "./logic";

type LadderScene = Extract<Scene, { kind: "ladder" }>;

// Колонки: делимое | ÷b | частное | остаток | полоса для стрелки «снизу вверх».
const COLS = "minmax(0,1.05fr) 44px minmax(0,1fr) minmax(0,1fr) 30px";

/** «Лесенка»: деление на основание, остатки подсвечены. Новые строки «опускаются» сверху; readUp читает остатки снизу вверх. */
export function LadderScene({ scene }: { scene: LadderScene }) {
  const { t } = useT();
  const base = scene.base ?? 2;
  const rows = ladderRows(scene.number, base);
  const readUp = !!scene.readUp;
  const shown = visibleLadderRows(rows.length, scene.rows, readUp);
  // Строки, что были при показе, появляются лесенкой; добавленные позже — сразу.
  const [mountCount] = useState(shown);
  const digits = readUpDigits(rows);
  const resultFont = digits.length <= 6 ? 44 : digits.length <= 8 ? 36 : 28;
  const last = rows.length - 1;

  return (
    <div className="mx-auto w-full max-w-md">
      <div
        className="grid items-end gap-1 border-b-2 border-border pb-1.5 text-center text-xs font-extrabold text-muted"
        style={{ gridTemplateColumns: COLS }}
      >
        <span>{t("tools.dividend")}</span>
        <span className="font-mono text-sm">÷{base}</span>
        <span>{t("tools.quotient")}</span>
        <span className="text-primary-strong">{t("tools.remainder")}</span>
        <span />
      </div>

      <div className="relative">
        <AnimatePresence initial>
          {rows.slice(0, shown).map((r, i) => {
            const k = last - i; // порядок чтения: нижняя строка — первая
            return (
              <m.div
                key={i}
                initial={{ opacity: 0, y: -14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ ...springSoft, delay: i < mountCount ? i * 0.08 : 0 }}
                className="grid items-center gap-1 border-b border-border/70 py-1.5 last:border-b-0"
                style={{ gridTemplateColumns: COLS }}
              >
                <span className="text-center font-mono text-2xl font-extrabold">{r.value}</span>
                <span className="text-center font-mono text-base font-bold text-muted">÷{base}</span>
                <span className={cn("text-center font-mono text-2xl font-extrabold", r.quotient === 0 && "text-muted")}>{r.quotient}</span>
                <span className="flex justify-center">
                  <span
                    className={cn(
                      "inline-flex h-10 min-w-12 items-center justify-center rounded-xl border-2 px-2 font-mono text-2xl font-extrabold transition-colors duration-300",
                      readUp ? "border-primary bg-primary text-white" : "border-primary/30 bg-primary-soft text-ink-primary",
                    )}
                    style={{ transitionDelay: readUp ? `${0.2 + k * 0.12}s` : "0s" }}
                  >
                    {r.remainder}
                  </span>
                </span>
                <span />
              </m.div>
            );
          })}
        </AnimatePresence>

        <AnimatePresence>
          {readUp && (
            <m.div
              key="arrow"
              aria-hidden
              className="pointer-events-none absolute bottom-3 right-0 top-3 flex w-[30px] flex-col items-center text-primary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <m.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springBouncy, delay: 0.3 }}>
                <ArrowUp size={24} strokeWidth={3.4} />
              </m.span>
              <m.span
                className="-mt-1 w-[4px] flex-1 origin-bottom rounded-full bg-current"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.45, delay: 0.1 }}
              />
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {readUp && (
          <m.div
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={springSoft}
            className="mt-4 flex flex-col items-center gap-1"
          >
            <span className="text-sm font-extrabold text-primary-strong">{t("tools.readUp")}</span>
            <div className="flex items-end font-mono font-extrabold leading-none text-primary-strong" style={{ fontSize: resultFont }} aria-label={digits.join("")}>
              {digits.map((d, i) => (
                <m.span
                  key={i}
                  aria-hidden
                  initial={{ opacity: 0, y: 12, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ ...springBouncy, delay: 0.28 + i * 0.12 }}
                >
                  {d}
                </m.span>
              ))}
              <span className="pb-1 text-lg font-bold text-muted">{subscript(base)}</span>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
