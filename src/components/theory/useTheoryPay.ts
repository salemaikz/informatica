"use client";

import { useCallback, useState } from "react";
import { useApp } from "@/lib/store";
import { theoryPayState, type TheoryPayState } from "@/lib/theory-pay";
import { useNow, usePlanTier } from "@/components/economy/useEconomy";

/**
 * Плата за чтение конспекта урока (lib/theory-pay.ts): 0,5 сердечка, явно — по кнопке «Читать дальше» (этап 16В, P6).
 * Правила («Безлимит», сутки после оплаты) — в `theoryPayState`; списывает действие стора `payTheory`.
 * `unlock` вызывают только из обработчиков нажатия. Не хватает сердечек — шторка «Сердечки закончились» (`sheetOpen`);
 * после покупки или восстановления — `resume` списывает и открывает чтение.
 */
export function useTheoryPay(lessonId: string) {
  const paidAt = useApp((s) => s.theoryPaid[lessonId]);
  const tier = usePlanTier();
  const now = useNow();
  const state: TheoryPayState = theoryPayState({ unlimited: tier === "unlimited", paidAt, now });
  const [sheetOpen, setSheetOpen] = useState(false);

  /** Списать (если нужно) и открыть чтение. false — не хватает сердечек: открыта шторка. */
  const unlock = useCallback((): boolean => {
    const res = useApp.getState().payTheory(lessonId);
    if (!res.ok) setSheetOpen(true);
    return res.ok;
  }, [lessonId]);

  // Сердечки вернулись или куплены: списываем и открываем чтение (не получилось — шторка откроется снова).
  const resume = useCallback((): boolean => {
    setSheetOpen(false);
    return unlock();
  }, [unlock]);

  return { state, paidAt, unlock, sheetOpen, setSheetOpen, resume };
}
