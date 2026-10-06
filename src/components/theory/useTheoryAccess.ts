"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { theoryOpenStep } from "@/lib/theory-pay";
import { useNow, usePlanTier } from "@/components/economy/useEconomy";

export type TheoryAccess = "wait" | "open" | "locked";

/**
 * Доступ к теме при открытии страницы `/theory/<id>` (lib/theory-pay.ts, решение #113): ½ сердечка списывается сразу, как вход
 * в урок, — без ворот и пояснений. «Безлимит» и повтор той же темы за сутки — бесплатно (`theoryOpenStep`).
 *
 * Списание — из колбэка следующего кадра, а не из тела эффекта (правило React 19: setState синхронно в эффекте нельзя).
 * Двойной оплаты нет: StrictMode и быстрый возврат отменяют колбэк в cleanup, а `payTheory` за сутки повторно не списывает.
 * Не хватило сердечек — `locked`: страница показывает «Сердечки закончились» и не показывает текст темы;
 * после покупки или восстановления `resume` списывает и открывает тему.
 */
export function useTheoryAccess(lessonId: string): { access: TheoryAccess; resume: () => void } {
  const paidAt = useApp((s) => s.theoryPaid[lessonId]);
  const tier = usePlanTier();
  const now = useNow();
  // Отказ и допуск помним вместе с id урока: страница обычно перемонтируется по key, но если нет — другая тема платится заново.
  const [refusedId, setRefusedId] = useState<string | null>(null);
  const [admittedId, setAdmittedId] = useState<string | null>(null);
  const admitted = admittedId === lessonId;

  const step = theoryOpenStep({ admitted, refused: refusedId === lessonId, unlimited: tier === "unlimited", paidAt, now });
  // «Предыдущее значение» при рендере (без эффекта с setState): раз открытая тема остаётся открытой, пока страница на экране.
  if (step === "open" && !admitted) setAdmittedId(lessonId);

  useEffect(() => {
    if (step !== "pay") return;
    const id = requestAnimationFrame(() => {
      if (!useApp.getState().payTheory(lessonId).ok) setRefusedId(lessonId);
    });
    return () => cancelAnimationFrame(id);
  }, [step, lessonId]);

  /** Сердечки вернулись или куплены: списываем и открываем тему (не получилось — окно остаётся). Вызывать из обработчика. */
  const resume = useCallback(() => {
    if (useApp.getState().payTheory(lessonId).ok) setRefusedId(null);
  }, [lessonId]);

  return { access: step === "open" ? "open" : step === "locked" ? "locked" : "wait", resume };
}
