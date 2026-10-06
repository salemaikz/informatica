"use client";

import { AnimatePresence, m } from "motion/react";
import { springBouncy, springSoft } from "@/components/motion/presets";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import type { Scene } from "@/lib/types";
import { coinCode, coinRows, coinSum, MARK, splitMark } from "./logic";
import { Coin, NumberLabel } from "./primitives";

type CoinsScene = Extract<Scene, { kind: "coins" }>;

/**
 * Монеты-веса + итог: сколько набрано, прогресс к цели и (когда сумма равна цели) двоичный код набора.
 * Общая для сцены и песочницы: с `onToggle` монеты кликабельны.
 * `liveCode` — показывать код всегда, когда что-то взято (песочница без цели).
 */
export function CoinsPanel({
  values,
  picked,
  target,
  onToggle,
  liveCode = false,
}: {
  values: number[];
  picked: number[];
  target?: number;
  onToggle?: (value: number) => void;
  liveCode?: boolean;
}) {
  const { t } = useT();
  const sorted = [...values].sort((a, b) => b - a);
  const rows = coinRows(sorted);
  const sum = coinSum(values, picked);
  const reached = target !== undefined && sum === target;
  const canCode = target !== undefined || liveCode;
  const showCode = target !== undefined ? reached : liveCode && sum > 0;
  const code = coinCode(values, picked);
  const set = new Set(picked);
  const size = Math.max(...rows.map((r) => r.length)) >= 5 ? 52 : 60;
  const [pickedBefore, pickedAfter] = splitMark(t("explore.picked", { n: MARK }));

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex w-full flex-col items-center gap-3">
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-2 pt-3">
            {row.map((v, ci) => {
              const index = ri === 0 ? ci : rows[0].length + ci;
              return (
                <div key={v} className="flex flex-col items-center">
                  <Coin value={v} picked={set.has(v)} size={size} delay={index * 0.06} onClick={onToggle ? () => onToggle(v) : undefined} />
                  <div className={canCode ? "h-6" : "h-0"}>
                    <AnimatePresence>
                      {showCode && (
                        <m.span
                          key="bit"
                          initial={{ opacity: 0, y: -6, scale: 0.6 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, transition: { duration: 0.1 } }}
                          transition={{ ...springBouncy, delay: 0.1 + index * 0.1 }}
                          className={cn("block font-mono text-xl font-extrabold leading-6", set.has(v) ? "text-ink-warning" : "text-muted")}
                        >
                          {set.has(v) ? 1 : 0}
                        </m.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex w-full flex-col items-center gap-2" aria-live="polite">
        <span className="sr-only">{t("explore.picked", { n: sum })}</span>
        <NumberLabel
          before={pickedBefore}
          after={pickedAfter}
          value={sum}
          numberClassName={reached ? "text-ink-success" : "text-text"}
          extra={target !== undefined ? <span className="font-mono text-2xl font-extrabold text-muted">/ {target}</span> : undefined}
        />
        {target !== undefined && (
          <ProgressBar
            value={target > 0 ? Math.min(1, sum / target) : 1}
            color={sum > target ? "var(--danger)" : reached ? "var(--success)" : "var(--primary)"}
            height={10}
            className="w-full max-w-64"
          />
        )}
        <AnimatePresence>
          {showCode && (
            <m.p
              key="code"
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ ...springSoft, delay: 0.15 }}
              className="mt-1 rounded-2xl bg-success-soft px-4 py-2 font-mono text-lg font-extrabold text-ink-success"
            >
              {t("explore.code", { c: code })}
            </m.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Сцена «монеты»: какие монеты взяты, сколько набрано, прогресс к цели и код набора. */
export function CoinsScene({ scene }: { scene: CoinsScene }) {
  return <CoinsPanel values={scene.values} picked={scene.picked ?? []} target={scene.target} />;
}
