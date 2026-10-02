"use client";

import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";
import type { Scene } from "@/lib/types";
import { ColumnRow, LampBulb, SumLine, WeightChip } from "./primitives";
import { binarySum, parseBits, sumTerms, tileMetrics, weightsRtl } from "./logic";

type LampsScene = Extract<Scene, { kind: "lamps" }>;

/** Одна лампа: вес сверху (по желанию), лампочка, цифра 1/0 снизу. Включение — лёгкий «поп». */
export function LampColumn({
  on,
  size,
  weight,
  weightDelay = 0,
  weightFont = 14,
  digitFont = 24,
}: {
  on: boolean;
  size: number;
  /** undefined — вес не показывается. */
  weight?: number;
  weightDelay?: number;
  weightFont?: number;
  digitFont?: number;
}) {
  return (
    <div className="flex flex-col items-center">
      <AnimatePresence initial>
        {weight !== undefined && (
          <m.div
            key="w"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 30, opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.22 }}
            className="flex items-start justify-center"
          >
            <WeightChip label={weight} tone={on ? "gold" : "primary"} delay={weightDelay} fontSize={weightFont} />
          </m.div>
        )}
      </AnimatePresence>
      <m.div
        initial={false}
        animate={on ? { scale: [1, 1.14, 1] } : { scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <LampBulb on={on} size={size} />
      </m.div>
      <span
        className={cn("mt-1 font-mono font-bold leading-none transition-colors duration-300", on ? "text-warning-strong" : "text-muted")}
        style={{ fontSize: digitFont }}
      >
        {on ? 1 : 0}
      </span>
    </div>
  );
}

/** Ряд лампочек по состояниям «1011»; веса справа налево и сумма — по флагам. */
export function LampsScene({ scene }: { scene: LampsScene }) {
  const digits = parseBits(scene.states);
  const n = digits.length;
  const mt = tileMetrics(n);
  const ws = weightsRtl(n);
  const keys = digits.map((_, i) => n - 1 - i);

  return (
    <div className="flex w-full flex-col gap-3" role="group" aria-label={scene.states}>
      <ColumnRow
        keys={keys}
        max={mt.max + 8}
        gap={6}
        render={(_, i) => (
          <LampColumn
            on={digits[i] === "1"}
            size={mt.lamp}
            weight={scene.weights ? ws[i] : undefined}
            weightDelay={0.1 + (n - 1 - i) * 0.09}
            weightFont={mt.chip}
            digitFont={Math.round(mt.font * 0.65)}
          />
        )}
      />
      <AnimatePresence initial>
        {scene.sum && <SumLine key="sum" terms={sumTerms(scene.states).map((w) => ({ id: String(w), value: w }))} total={binarySum(scene.states)} delay={0.1} />}
      </AnimatePresence>
    </div>
  );
}
