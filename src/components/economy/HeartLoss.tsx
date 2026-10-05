"use client";

import { Heart } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatHearts } from "@/lib/economy";

// Заметное списание сердечек (#95): при уменьшении запаса рядом со счётчиком всплывает «−N», сердце вздрагивает.
// Общее для шапки (HeartsChip) и плеера (HeartsBar). С «Меньше анимаций» — без движения, «−N» просто видно около секунды.

export type HeartDelta = { id: number; dir: "down" | "up"; diff: number };

/**
 * Изменение запаса замечаем при рендере (приём «предыдущее значение»), без эффектов с setState.
 * id растёт при каждом изменении — по нему перезапускаются анимации. Бесконечный запас (безлимит) изменений не даёт.
 */
export function useHeartDelta(count: number, initialLoss = 0): HeartDelta {
  const [prev, setPrev] = useState(count);
  // initialLoss — сердечки списаны до показа счётчика (экран «Начать» → плеер): «−N» появляется сразу при показе.
  const [delta, setDelta] = useState<HeartDelta>(() => (initialLoss > 0 ? { id: 1, dir: "down", diff: initialLoss } : { id: 0, dir: "down", diff: 0 }));
  if (count !== prev) {
    setPrev(count);
    if (Number.isFinite(count) && Number.isFinite(prev)) {
      setDelta((d) => ({ id: d.id + 1, dir: count < prev ? "down" : "up", diff: Math.abs(count - prev) }));
    }
  }
  return delta;
}

/** Всплывающая плашка «−N» (цвет heart): падает вниз и гаснет; при reduce — на месте, только прозрачность, ~1 с. */
export function HeartLossPop({ delta, reduce, className }: { delta: HeartDelta; reduce: boolean; className?: string }) {
  if (delta.id === 0 || delta.dir !== "down") return null;
  return (
    <m.span
      key={`lost-${delta.id}`}
      aria-hidden
      className={cn(
        "pointer-events-none absolute right-0 top-9 z-40 inline-flex items-center rounded-full border-2 border-heart bg-heart-soft px-2 py-0.5 text-sm font-extrabold text-heart-strong shadow-sm",
        className,
      )}
      initial={{ opacity: 0 }}
      animate={reduce ? { opacity: [1, 1, 0] } : { opacity: [0, 1, 1, 0], y: [-4, 4, 14, 26], scale: [0.6, 1.12, 1, 1] }}
      transition={reduce ? { duration: 1, times: [0, 0.8, 1] } : { duration: 1, times: [0, 0.2, 0.7, 1], ease: "easeOut" }}
    >
      −{formatHearts(delta.diff)}
    </m.span>
  );
}

/**
 * «−N» под шапкой экрана без счётчика сердечек (тест по разделу): сердечки списаны на «Начать», ученик должен это увидеть.
 * Висит ~2,5 с и гаснет; с «Меньше анимаций» — без движения.
 */
export function HeartPaidPop({ amount, reduce }: { amount: number; reduce: boolean }) {
  if (!(amount > 0)) return null;
  return (
    <m.div
      aria-hidden
      className="pointer-events-none fixed right-3 top-[calc(env(safe-area-inset-top)+4rem)] z-40 inline-flex items-center gap-1 rounded-full border-2 border-heart bg-heart-soft px-2.5 py-1 text-sm font-extrabold text-heart-strong shadow-sm"
      initial={{ opacity: 0 }}
      animate={reduce ? { opacity: [1, 1, 0] } : { opacity: [0, 1, 1, 0], y: [-6, 0, 0, 10], scale: [0.7, 1.08, 1, 1] }}
      transition={{ duration: 2.5, times: reduce ? [0, 0.8, 1] : [0, 0.1, 0.8, 1], ease: "easeOut" }}
    >
      <Heart size={16} fill="currentColor" />−{formatHearts(amount)}
    </m.div>
  );
}
