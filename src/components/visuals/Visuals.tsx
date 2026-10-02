"use client";

import clsx from "clsx";
import { ArrowUp, Lightbulb } from "lucide-react";
import type { VisualId } from "@/lib/types";
import { divisionLadder } from "@/lib/check";
import { useT } from "@/i18n/useT";

// Иллюстрации к теории — лёгкие React-компоненты вместо картинок.

const delay = (i: number) => ({ animationDelay: `${i * 120}ms`, animationFillMode: "both" as const });

function Digit({ d, accent, i }: { d: string; accent?: boolean; i: number }) {
  return (
    <span
      style={delay(i)}
      className={clsx(
        "flex h-14 w-12 items-center justify-center rounded-2xl border-2 font-mono text-3xl font-bold animate-pop",
        accent ? "border-gold bg-gold-soft text-warning-strong" : "border-border bg-surface",
      )}
    >
      {d}
    </span>
  );
}

function PlaceValues() {
  const digits = ["3", "4", "5"];
  const weights = ["100", "10", "1"];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        {digits.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Digit d={d} i={i} />
            <span className="rounded-md bg-primary-soft px-2 font-mono text-sm font-bold text-primary">×{weights[i]}</span>
          </div>
        ))}
      </div>
      <p className="font-mono text-lg font-bold">
        300 + 40 + 5 = <span className="text-primary">345</span>
      </p>
    </div>
  );
}

function BinaryWeights() {
  const bits = "1011".split("");
  const weights = [8, 4, 2, 1];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        {bits.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Digit d={d} i={i} accent={d === "1"} />
            <span className={clsx("rounded-md px-2 font-mono text-sm font-bold", d === "1" ? "bg-gold-soft text-warning-strong" : "bg-surface-2 text-muted line-through")}>
              {weights[i]}
            </span>
          </div>
        ))}
      </div>
      <p className="font-mono text-lg font-bold">
        8 + 2 + 1 = <span className="text-primary">11</span>
      </p>
    </div>
  );
}

function Ladder() {
  const { t } = useT();
  const rows = divisionLadder(13);
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={i} style={delay(i)} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-1.5 font-mono text-base font-bold animate-fade-in">
            <span className="w-7 text-right">{r.value}</span>
            <span className="text-muted">: 2 = {r.quotient}</span>
            <span className="ml-1 rounded-md bg-gold-soft px-2 text-warning-strong">
              {r.remainder}
            </span>
            <span className="hidden text-xs font-sans text-muted sm:inline">{t("ladder.remainder")}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-1 text-primary">
        <ArrowUp size={22} strokeWidth={3} />
        <span className="font-mono text-2xl font-bold">
          1101<sub className="text-sm">2</sub>
        </span>
      </div>
    </div>
  );
}

function Lamps() {
  return (
    <div className="flex items-center justify-center gap-8">
      {[true, false].map((on, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <span
            className={clsx(
              "flex h-16 w-16 items-center justify-center rounded-full border-2",
              on ? "border-gold bg-gold text-white shadow-[0_0_24px_var(--gold)]" : "border-border bg-surface-2 text-muted",
            )}
          >
            <Lightbulb size={30} />
          </span>
          <span className="font-mono text-3xl font-bold">{on ? 1 : 0}</span>
        </div>
      ))}
    </div>
  );
}

export function Visual({ id }: { id: VisualId }) {
  const content = { "place-values": <PlaceValues />, "binary-weights": <BinaryWeights />, "division-ladder": <Ladder />, lamps: <Lamps /> }[id];
  return <div className="rounded-3xl bg-surface-2/60 px-4 py-5">{content}</div>;
}
