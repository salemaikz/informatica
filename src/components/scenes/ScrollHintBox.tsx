"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { fadeMask, fadeWidths, scrollEdges, type FadeWidths, type ScrollEdges } from "./scroll-hint";

/**
 * Горизонтально прокручиваемый блок с видимой подсказкой: край, за которым есть скрытое содержимое, плавно гаснет,
 * а на нём стоит стрелка. Пока прокручивать нечего (или до гидратации), разметка — просто блок с прокруткой.
 * `frame` — рамка и фон ставятся на внешний блок (а не на прокручиваемый), чтобы маска не гасила рамку.
 */
export function ScrollHintBox({
  children,
  className,
  frameClassName,
  scrollerAttrs,
  arrow = "center",
}: {
  children: ReactNode;
  /** Классы внешнего блока (ширина, отступы). */
  className?: string;
  /** Классы рамки и фона: на внешнем блоке под скруглением. */
  frameClassName?: string;
  /** Атрибуты прокручиваемого блока (например, `data-clip` для измерения видимой части). */
  scrollerAttrs?: Record<string, string>;
  /** Где стоит стрелка: у верхнего края (высокие блоки), у нижнего (схемы: справа вверху и посередине выходы) или по центру высоты. */
  arrow?: "top" | "bottom" | "center";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<ScrollEdges>({ left: false, right: false });
  // Ширина затухания — по реальному остатку прокрутки: у блока, который «не влез» на пару пикселей, гаснут они, а не 36 px
  const [fade, setFade] = useState<FadeWidths>({ left: 0, right: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Подписка на размеры самого блока и его содержимого + на прокрутку; состояние меняется только в обработчиках.
    const update = () => {
      const next = scrollEdges(el);
      setEdges((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
      const w = fadeWidths(el);
      setFade((prev) => (prev.left === w.left && prev.right === w.right ? prev : w));
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    [...el.children].forEach((c) => ro.observe(c));
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, []);

  const mask = fadeMask(edges, fade);
  const pos = arrow === "top" ? "top-2" : arrow === "bottom" ? "bottom-2" : "top-1/2 -translate-y-1/2";
  return (
    <div className={cn("relative", className)}>
      <div className={cn("overflow-hidden", frameClassName)}>
        <div ref={ref} {...scrollerAttrs} className="overflow-x-auto" style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}>
          {children}
        </div>
      </div>
      {edges.right && (
        <span aria-hidden data-scroll-hint="right" className={cn("pointer-events-none absolute right-1.5 flex size-6 items-center justify-center rounded-full border border-border bg-surface text-muted", pos)}>
          <ChevronRight size={16} strokeWidth={3} />
        </span>
      )}
      {edges.left && (
        <span aria-hidden data-scroll-hint="left" className={cn("pointer-events-none absolute left-1.5 flex size-6 items-center justify-center rounded-full border border-border bg-surface text-muted", pos)}>
          <ChevronLeft size={16} strokeWidth={3} />
        </span>
      )}
    </div>
  );
}
