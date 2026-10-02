"use client";

import { Minus, Plus } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/useT";
import { feedback } from "@/lib/feedback";
import { LampColumn } from "../LampsScene";
import { ColumnRow, NumberLabel } from "../primitives";
import { MARK, MAX_LAMPS, MIN_LAMPS, addLamp, lampsValue, newLamps, removeLamp, signalsCount, splitMark, tileMetrics, toggleLamp } from "../logic";
import { SignalGrid } from "./SignalGrid";

export interface SandboxState {
  /** Сколько ламп/разрядов сейчас. */
  lamps: number;
  /** Текущее значение (набранная сумма). */
  sum: number;
}

/** Песочница «Лампы»: нажимай лампы, добавляй и убирай их — число разных сигналов удваивается с каждой лампой. */
export function LampsTool({ size, onChange }: { size: number; onChange: (s: SandboxState) => void }) {
  const { t } = useT();
  const [bits, setBits] = useState(() => newLamps(size));
  const n = bits.length;
  const mt = tileMetrics(n);
  const value = lampsValue(bits);
  const signals = signalsCount(n);
  const keys = bits.map((_, j) => n - 1 - j); // слева направо — от старшей лампы
  const [before, after] = splitMark(t("explore.signals", { n: MARK }));

  const commit = (next: boolean[]) => {
    setBits(next);
    onChange({ lamps: next.length, sum: lampsValue(next) });
  };
  const toggle = (power: number) => {
    feedback("tap");
    commit(toggleLamp(bits, power));
  };
  const add = () => {
    if (n >= MAX_LAMPS) return;
    feedback("pop");
    commit(addLamp(bits));
  };
  const remove = () => {
    if (n <= MIN_LAMPS) return;
    feedback("tap");
    commit(removeLamp(bits));
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="rounded-full border-2 border-border bg-surface px-4 py-1 text-sm font-extrabold" aria-live="polite">
        {t("explore.lamps", { n })}
      </p>

      <ColumnRow
        keys={keys}
        max={mt.max + 8}
        gap={6}
        presence
        render={(power) => (
          <m.button
            type="button"
            onClick={() => toggle(power)}
            aria-pressed={bits[power]}
            aria-label={String(n - power)}
            whileTap={{ scale: 0.92 }}
            className="flex w-full cursor-pointer justify-center rounded-2xl py-2 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-primary"
          >
            <LampColumn on={bits[power]} size={mt.lamp} digitFont={Math.round(mt.font * 0.65)} />
          </m.button>
        )}
      />

      <div className="grid w-full grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" icon={<Minus size={20} strokeWidth={3} />} onClick={remove} disabled={n <= MIN_LAMPS} className="h-14 px-3 text-[15px] leading-tight">
          {t("explore.removeLamp")}
        </Button>
        <Button variant="primary" size="lg" icon={<Plus size={20} strokeWidth={3} />} onClick={add} disabled={n >= MAX_LAMPS} className="h-14 px-3 text-[15px] leading-tight">
          {t("explore.addLamp")}
        </Button>
      </div>

      <div className="flex flex-col items-center gap-3 pt-1">
        <span className="sr-only" aria-live="polite">
          {t("explore.signals", { n: signals })}
        </span>
        <div aria-hidden>
          <NumberLabel before={before} after={after} value={signals} numberClassName="text-primary-strong" />
        </div>
        <SignalGrid n={n} current={value} />
      </div>
    </div>
  );
}
