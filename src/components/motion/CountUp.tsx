"use client";

import { m, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { useReduceMotion } from "./useReduceMotion";

/**
 * Число, которое плавно «накручивается» до значения (пружина, без перерисовок React).
 * Считает от `from` (по умолчанию 0); при смене `value` продолжает с текущего числа.
 */
export function CountUp({
  value,
  from = 0,
  delay = 0,
  format = (n) => String(Math.round(n)),
  className,
}: {
  value: number;
  from?: number;
  /** Задержка перед началом счёта, с. */
  delay?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduce = useReduceMotion();
  const spring = useSpring(from, { stiffness: 110, damping: 20, mass: 0.8, restDelta: 0.01 });
  const text = useTransform(spring, (v) => format(v));

  useEffect(() => {
    if (reduce) return;
    const id = setTimeout(() => spring.set(value), delay * 1000);
    return () => clearTimeout(id);
  }, [value, delay, reduce, spring]);

  // «Меньше анимаций»: сразу итоговое число, без пружины (jump() оставлял на экране 0).
  if (reduce) return <span className={className}>{format(value)}</span>;
  return <m.span className={className}>{text}</m.span>;
}
