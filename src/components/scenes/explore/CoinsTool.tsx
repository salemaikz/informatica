"use client";

import { useState } from "react";
import { feedback } from "@/lib/feedback";
import { CoinsPanel } from "../CoinsScene";
import { coinSum, coinValues } from "../logic";
import type { SandboxState } from "./LampsTool";

/** Песочница «Монеты»: бери монеты 16 8 4 2 1 — набранная сумма считается сама; в конце видно двоичный код набора. */
export function CoinsTool({ size, target, onChange }: { size: number; target?: number; onChange: (s: SandboxState) => void }) {
  const values = coinValues(size);
  const [picked, setPicked] = useState<number[]>([]);

  const toggle = (v: number) => {
    feedback("tap");
    const next = picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v];
    setPicked(next);
    onChange({ lamps: values.length, sum: coinSum(values, next) });
  };

  return <CoinsPanel values={values} picked={picked} target={target} onToggle={toggle} liveCode={target === undefined} />;
}
