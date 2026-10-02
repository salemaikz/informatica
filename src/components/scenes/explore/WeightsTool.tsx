"use client";

import { m } from "motion/react";
import { useState } from "react";
import { useT } from "@/i18n/useT";
import { feedback } from "@/lib/feedback";
import { LampColumn } from "../LampsScene";
import { ColumnRow, NumberLabel, SumLine } from "../primitives";
import { MARK, clampLamps, lampsTerms, lampsValue, newLamps, splitMark, tileMetrics, toggleLamp } from "../logic";
import type { SandboxState } from "./LampsTool";

/** Песочница «Веса»: над каждой лампой её вес (справа налево 1, 2, 4…), сумма включённых считается сама. */
export function WeightsTool({ size, target, onChange }: { size: number; target?: number; onChange: (s: SandboxState) => void }) {
  const { t } = useT();
  const n = clampLamps(size);
  const [bits, setBits] = useState(() => newLamps(n));
  const mt = tileMetrics(n);
  const sum = lampsValue(bits);
  const keys = bits.map((_, j) => n - 1 - j);
  const [before, after] = splitMark(t("explore.sum", { n: MARK }));
  const reached = target !== undefined && sum === target;

  const toggle = (power: number) => {
    feedback("tap");
    const next = toggleLamp(bits, power);
    setBits(next);
    onChange({ lamps: n, sum: lampsValue(next) });
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <ColumnRow
        keys={keys}
        max={mt.max + 8}
        gap={6}
        render={(power) => (
          <m.button
            type="button"
            onClick={() => toggle(power)}
            aria-pressed={bits[power]}
            aria-label={String(2 ** power)}
            whileTap={{ scale: 0.92 }}
            className="flex w-full cursor-pointer justify-center rounded-2xl py-1 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-primary"
          >
            <LampColumn
              on={bits[power]}
              size={mt.lamp}
              weight={2 ** power}
              weightDelay={0.1 + power * 0.09}
              weightFont={mt.chip}
              digitFont={Math.round(mt.font * 0.65)}
            />
          </m.button>
        )}
      />

      <div className="flex w-full flex-col items-center gap-3">
        <span className="sr-only" aria-live="polite">
          {t("explore.sum", { n: sum })}
        </span>
        <div aria-hidden>
          <NumberLabel
            before={before}
            after={after}
            value={sum}
            numberClassName={reached ? "text-success-strong" : "text-text"}
            extra={target !== undefined ? <span className="font-mono text-2xl font-extrabold text-muted">/ {target}</span> : undefined}
          />
        </div>
        <div className="min-h-11" aria-hidden>
          <SumLine terms={lampsTerms(bits).map((w) => ({ id: String(w), value: w }))} total={sum} showTotal={false} quick />
        </div>
      </div>
    </div>
  );
}
