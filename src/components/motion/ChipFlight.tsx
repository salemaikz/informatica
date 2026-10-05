"use client";

import { Cpu } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { feedback } from "@/lib/feedback";
import { useReduceMotion } from "./useReduceMotion";

const COUNT = 5;

/**
 * Чипы «летят» из места, где стоит компонент, в счётчик по `targetSelector` (по умолчанию шапка `[data-tour="hdr-chips"]`; на итогах урока шапки нет — ставим `data-chip-target` на число чипов и `targetSelector="[data-chip-target]"`).
 * Задержка 1.1 с — после фанфары и лесенки плиток.
 * Играет звук `chips`. Срабатывает один раз при показе, если `amount > 0`; без шапки на экране — только звук.
 * Родитель должен быть `relative`; элемент не ловит клики. При «Меньше анимаций» — только звук.
 */
export function ChipFlight({
  amount,
  delay = 1.1,
  targetSelector = '[data-tour="hdr-chips"]',
}: {
  amount: number;
  delay?: number;
  targetSelector?: string;
}) {
  const reduce = useReduceMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (amount <= 0) return;
    const id = setTimeout(() => {
      feedback("chips");
      const from = ref.current?.getBoundingClientRect();
      // Первый видимый элемент (скрытые копии счётчика, display:none, пропускаем).
      const el = Array.from(document.querySelectorAll<HTMLElement>(targetSelector)).find((e) => e.getClientRects().length > 0);
      const to = el?.getBoundingClientRect();
      if (!reduce && from && to && to.width + to.height > 0) {
        setTarget({ x: to.left + to.width / 2 - (from.left + from.width / 2), y: to.top + to.height / 2 - (from.top + from.height / 2) });
      }
    }, delay * 1000);
    return () => clearTimeout(id);
  }, [amount, delay, reduce, targetSelector]);

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
