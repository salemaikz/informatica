"use client";

import { useEffect, useState } from "react";
import { sameRect, unionRect, type Rect } from "@/lib/tour";

/** Первый видимый элемент `[data-tour=name]` (на телефоне и компьютере бывают две копии, одна скрыта). */
export function findTour(name: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

const rectOf = (el: HTMLElement): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

const inView = (r: Rect) => r.y >= 0 && r.y + r.h <= window.innerHeight && r.x >= 0 && r.x + r.w <= window.innerWidth;

/**
 * Рамка вокруг видимых элементов `[data-tour]` из списка (объединение) в координатах окна; null — ни одного нет на экране.
 * Пересчёт на resize, scroll, а также раз в полсекунды: страница могла дорисоваться. `scrollTo` — один раз прокрутить
 * первый найденный элемент в середину окна, если он не виден целиком. Состояние меняется только из обратных вызовов.
 */
export function useTargetRect(names: readonly string[], active: boolean, scrollTo = false): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  const key = names.join("|");

  useEffect(() => {
    if (!active) return;
    const list = key ? key.split("|") : [];
    let raf = 0;
    let scrolled = false;
    const measure = () => {
      const els = list.map(findTour).filter((e): e is HTMLElement => !!e);
      if (scrollTo && !scrolled && els[0]) {
        scrolled = true;
        if (!inView(rectOf(els[0]))) els[0].scrollIntoView({ block: "center", inline: "nearest" });
      }
      const next = unionRect(els.map(rectOf));
      setRect((prev) => (sameRect(prev, next) ? prev : next));
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    // Первый замер — сразу после эффекта (до кадра), чтобы подсказка не мигала в центре, а потом прыгала к элементу.
    queueMicrotask(measure);
    schedule();
    const timer = window.setInterval(measure, 500);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [key, active, scrollTo]);

  return active ? rect : null;
}
