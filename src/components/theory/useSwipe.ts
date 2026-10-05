"use client";

import { useRef, type TouchEvent } from "react";
import { swipeDirection } from "@/lib/theory";

/** Жест нельзя начинать здесь: поля ввода, песочницы и всё, что прокручивается вбок (таблицы, код) — там палец занят своим делом. */
function ownsHorizontalGesture(target: EventTarget | null): boolean {
  let el = target instanceof HTMLElement ? target : null;
  while (el) {
    if (el.dataset.noSwipe !== undefined || /^(INPUT|TEXTAREA|SELECT|CANVAS)$/.test(el.tagName) || el.isContentEditable) return true;
    const overflowX = getComputedStyle(el).overflowX;
    if ((overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth) return true;
    el = el.parentElement;
  }
  return false;
}

/**
 * Свайп по карточкам теории: палец влево — дальше, вправо — назад (lib/theory.ts → swipeDirection).
 * Возвращает обработчики для контейнера; мышь не листает (выделение текста), вертикальная прокрутка не мешает.
 */
export function useSwipe({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: TouchEvent) => {
      const touch = e.touches[0];
      start.current = e.touches.length === 1 && touch && !ownsHorizontalGesture(e.target) ? { x: touch.clientX, y: touch.clientY } : null;
    },
    onTouchEnd: (e: TouchEvent) => {
      const from = start.current;
      start.current = null;
      const touch = e.changedTouches[0];
      if (!from || !touch) return;
      const dir = swipeDirection(touch.clientX - from.x, touch.clientY - from.y);
      if (dir === "next") onNext();
      else if (dir === "prev") onPrev();
    },
    onTouchCancel: () => {
      start.current = null;
    },
  };
}
