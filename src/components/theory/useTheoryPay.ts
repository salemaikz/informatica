"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { THEORY_READ_MS, THEORY_SCROLL_SCREENS, theoryPayState, type TheoryPayState } from "@/lib/theory-pay";
import { useNow, usePlanTier } from "@/components/economy/useEconomy";

/**
 * Плата за чтение конспекта урока (этап 15, lib/theory-pay.ts): 0,5 сердечка, когда ученик пролистал дальше первого экрана
 * или читает THEORY_READ_MS (учитываем только время, пока вкладка видна) — что раньше. Правила (пройден, «Безлимит», сутки) — в
 * `theoryPayState`; списывает действие стора `payTheory` (из обработчиков — не из тела эффекта, двойной вызов не спишет дважды).
 * Не хватает сердечек — `blocked` и шторка «Сердечки закончились» (`sheetOpen`); после покупки или восстановления — `resume`.
 */
export function useTheoryPay(lessonId: string) {
  const paidAt = useApp((s) => s.theoryPaid[lessonId]);
  const done = useApp((s) => (s.lessons[lessonId]?.completions ?? 0) > 0);
  const tier = usePlanTier();
  const now = useNow();
  const state: TheoryPayState = theoryPayState({ done, unlimited: tier === "unlimited", paidAt, now });

  const [blocked, setBlocked] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Списать, если нужно (стор сам решает: пройден, безлимит, уже оплачено — бесплатно). Не хватает — блок и шторка.
  const pay = useCallback((): boolean => {
    const res = useApp.getState().payTheory(lessonId);
    setBlocked(!res.ok);
    if (!res.ok) setSheetOpen(true);
    return res.ok;
  }, [lessonId]);

  // Сердечки вернулись или куплены: списываем и открываем чтение (не получилось — шторка откроется снова).
  const resume = useCallback(() => {
    setSheetOpen(false);
    pay();
  }, [pay]);

  useEffect(() => {
    if (state !== "pay" || blocked) return;
    // Видимое время чтения — по секундам: свёрнутая вкладка не «читает».
    let seenMs = 0;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      seenMs += 1000;
      if (seenMs >= THEORY_READ_MS) pay();
    }, 1000);
    // Листает дальше первого экрана (в том числе доскролл к якорю из поиска).
    const onScroll = () => {
      if (window.scrollY >= window.innerHeight * THEORY_SCROLL_SCREENS) pay();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // Страница уже прокручена к моменту подписки (восстановленная позиция, якорь из поиска) — проверяем один раз после кадра.
    const raf = requestAnimationFrame(onScroll);
    return () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [state, blocked, pay]);

  return { state, paidAt, blocked: blocked && state === "pay", sheetOpen, setSheetOpen, resume };
}
