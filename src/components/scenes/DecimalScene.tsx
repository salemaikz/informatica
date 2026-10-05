"use client";

import type { Scene } from "@/lib/types";
import { ColumnRow, DigitTile, SumLine, WeightChip } from "./primitives";
import { DecimalExtScene } from "./DecimalExtScene";
import { isDecimalExt } from "./numbers";
import { decimalParts, decimalTotal, tileMetrics } from "./logic";

type DecimalScene = Extract<Scene, { kind: "decimal" }>;

/** Обычное число с весами разрядов: ×100 ×10 ×1 (справа налево) и сумма «300 + 40 + 5 = 345». */
export function DecimalScene({ scene }: { scene: DecimalScene }) {
  // base и peel — отдельный рисунок; обычное число рисуется как раньше.
  if (isDecimalExt(scene)) return <DecimalExtScene scene={scene} />;
  const parts = decimalParts(scene.number);
  const n = parts.length;
  const mt = tileMetrics(n);
  const keys = parts.map((_, i) => n - 1 - i);
  const chipsDone = 0.2 + n * 0.1;
  const chipFont = n <= 3 ? mt.chip : n === 4 ? 13 : 11;

  return (
    <div className="flex w-full flex-col gap-2" role="group" aria-label={scene.number}>
      <ColumnRow
        keys={keys}
        max={mt.max}
        gap={5}
        render={(_, i) => <DigitTile digit={String(parts[i].digit)} height={mt.h} fontSize={mt.font} delay={i * 0.04} />}
      />
      <ColumnRow
        keys={keys}
        max={mt.max}
        gap={5}
        render={(_, i) => (
          <WeightChip label={`×${parts[i].place}`} tone="primary" delay={0.15 + (n - 1 - i) * 0.1} fontSize={chipFont} />
        )}
      />
      <SumLine
        className="mt-2"
        terms={parts.map((p, i) => ({ id: `${i}`, value: p.value }))}
        total={decimalTotal(scene.number)}
        delay={chipsDone}
      />
    </div>
  );
}
