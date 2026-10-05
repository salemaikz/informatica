"use client";

import { Cpu } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { feedback } from "@/lib/feedback";
import { useReduceMotion } from "./useReduceMotion";

const COUNT = 5;

/**
 * Чипы «летят» из места, где стоит компонент, в счётчик чипов шапки (`[data-tour="hdr-chips"]`).
 * Играет звук `chips`. Срабатывает один раз при показе, если `amount > 0`; без шапки на экране — только звук.
 * Родитель должен быть `relative`; элемент не ловит клики. При «Меньше анимаций» — только звук.
 */
export function ChipFlight({ amount, delay = 0.5 }: { amount: number; delay?: number }) {
  const reduce = useReduceMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (amount <= 0) return;
    const id = setTimeout(() => {
      feedback("chips");
      const from = ref.current?.getBoundingClientRect();
      const to = document.querySelector<HTMLElement>('[data-tour="hdr-chips"]')?.getBoundingClientRect();
      if (!reduce && from && to) {
        setTarget({ x: to.left + to.width / 2 - (from.left + from.width / 2), y: to.top + to.height / 2 - (from.top + from.height / 2) });
      }
    }, delay * 1000);
    return () => clearTimeout(id);
  }, [amount, delay, reduce]);

  if (amount <= 0) return null;
  return (
    <span ref={ref} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-50 h-0 w-0">
      {target &&
        Array.from({ length: Math.min(COUNT, amount) }, (_, i) => (
          <m.span
            key={i}
            className="absolute -ml-2.5 -mt-2.5 text-gold"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
            animate={{ x: [0, (i - 2) * 14, target.x], y: [0, -26 - (i % 2) * 10, target.y], opacity: [0, 1, 1, 0], scale: [0.5, 1.15, 0.8] }}
            transition={{ duration: 0.9, delay: i * 0.07, times: [0, 0.3, 1], ease: "easeInOut" }}
          >
            <Cpu size={20} />
          </m.span>
        ))}
    </span>
  );
}
