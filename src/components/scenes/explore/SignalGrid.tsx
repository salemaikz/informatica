"use client";

import { cn } from "@/lib/cn";
import { signalGridColumns, signalsCount } from "../logic";

/**
 * Все возможные сигналы n ламп — по точке на каждый. Каждая новая лампа удваивает число точек;
 * золотая точка — тот сигнал, который сейчас показывают лампы.
 */
export function SignalGrid({ n, current }: { n: number; current: number }) {
  const total = signalsCount(n);
  const cols = signalGridColumns(n);
  const d = n >= 7 ? 9 : n >= 5 ? 12 : 18;
  const gap = n >= 7 ? 2 : 3;
  return (
    <div aria-hidden className="mx-auto grid w-fit" style={{ gridTemplateColumns: `repeat(${cols}, ${d}px)`, gap }}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "animate-pop rounded-[3px] transition-[background-color,scale] duration-200",
            i === current ? "z-10 scale-[1.3] bg-gold shadow-[0_0_6px_var(--gold)]" : "bg-primary/30",
          )}
          style={{ height: d, animationDelay: `${(i % 32) * 8}ms`, animationFillMode: "backwards" }}
        />
      ))}
    </div>
  );
}
