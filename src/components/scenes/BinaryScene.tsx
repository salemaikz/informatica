"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import type { Scene } from "@/lib/types";
import { subscript } from "@/lib/calc";
import { cn } from "@/lib/cn";
import { ColumnRow, DigitTile, SumLine, WeightChip, type ChipTone, type SumTerm, type TileTone } from "./primitives";
import { BinaryExtScene } from "./BinaryExtScene";
import { isBinaryExt } from "./numbers";
import { binarySum, chipWeights, parseBits, sumTerms, tileMetrics, wrongSum } from "./logic";

type BinaryScene = Extract<Scene, { kind: "binary" }>;

const toTerms = (ws: number[]): SumTerm[] => ws.map((w) => ({ id: String(w), value: w }));

/** Стрелка-направление под весами: верно — справа налево (к старшему), ловушка — слева направо. */
function Direction({ wrong, delay }: { wrong: boolean; delay: number }) {
  return (
    <div aria-hidden className={cn("mt-1.5 flex h-5 items-center gap-1 px-1", wrong ? "text-danger" : "text-primary")}>
      {!wrong && <ArrowLeft size={18} strokeWidth={3} className="shrink-0" />}
      <m.span
        className={cn("h-[3px] flex-1 rounded-full bg-current opacity-60", wrong ? "origin-left" : "origin-right")}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.4, delay }}
      />
      {wrong && <ArrowRight size={18} strokeWidth={3} className="shrink-0" />}
    </div>
  );
}

/** Двоичная запись: цифры → веса (справа налево) → зачёркнутые нули → сумма. Элементы живут между шагами. */
export function BinaryScene({ scene }: { scene: BinaryScene }) {
  // Новые параметры (группы, сдвиг, пропуск, И) — отдельный рисунок; старые сцены рисуются как раньше.
  if (isBinaryExt(scene)) return <BinaryExtScene scene={scene} />;
  const digits = parseBits(scene.bits);
  const n = digits.length;
  const wrong = !!scene.wrongDirection;
  const showWeights = !!scene.weights || wrong;
  const crossed = !!scene.cross;
  const mt = tileMetrics(n);
  const ws = chipWeights(n, wrong);
  const hi = new Set(scene.highlight ?? []);
  const keys = digits.map((_, i) => n - 1 - i);
  const chipsDone = 0.2 + n * 0.09;

  const tileTone = (i: number): TileTone => {
    if (hi.has(i)) return "highlight";
    if (crossed) return digits[i] === "1" ? "one" : "zero";
    return "default";
  };
  const chipTone = (i: number): ChipTone => {
    const zero = digits[i] === "0";
    if (wrong) return crossed && zero ? "muted" : "danger";
    if (crossed) return zero ? "muted" : "gold";
    return "primary";
  };
  // Порядок появления: верно — с правого края, ловушка — с левого (чтобы это бросалось в глаза).
  const order = (i: number) => (wrong ? i : n - 1 - i);

  return (
    <div className="flex w-full flex-col" role="group" aria-label={`${scene.bits}${subscript(2)}`}>
      <ColumnRow
        keys={keys}
        max={mt.max}
        gap={5}
        reserve
        trailing={<span className="pb-1 font-mono text-xl font-bold leading-none text-muted">{subscript(2)}</span>}
        render={(_, i) => <DigitTile digit={digits[i]} tone={tileTone(i)} height={mt.h} fontSize={mt.font} delay={i * 0.04} />}
      />

      <AnimatePresence initial>
        {showWeights && (
          <m.div
            key="weights"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.18 } }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="pb-1 pt-2">
              <ColumnRow
                keys={keys}
                max={mt.max}
                gap={5}
                reserve
                render={(_, i) => (
                  <WeightChip
                    label={ws[i]}
                    tone={chipTone(i)}
                    crossed={crossed && digits[i] === "0"}
                    delay={0.12 + order(i) * 0.09}
                    strikeDelay={0.05 + order(i) * 0.1}
                    fontSize={mt.chip}
                  />
                )}
              />
              <Direction wrong={wrong} delay={0.15} />
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial>
        {wrong && (
          <SumLine
            key="wrong"
            className="mt-3"
            tone="danger"
            terms={toTerms(sumTerms(scene.bits, true))}
            total={wrongSum(scene.bits)}
            delay={chipsDone}
          />
        )}
        {scene.sum && (
          <SumLine
            key="sum"
            className="mt-3"
            terms={toTerms(sumTerms(scene.bits))}
            total={binarySum(scene.bits)}
            delay={wrong ? chipsDone + 0.6 : 0.1}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
