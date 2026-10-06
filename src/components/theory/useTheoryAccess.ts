"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { effectiveTier } from "@/lib/economy";
import { theoryOpenStep } from "@/lib/theory-pay";
import { useNow } from "@/components/economy/useEconomy";

export type TheoryAccess = "wait" | "open" | "locked";

/**
 * Доступ к теме при открытии страницы `/theory/<id>` (lib/theory-pay.ts, решение #113): ½ сердечка списывается сразу, как вход
 * в урок, — без ворот и пояснений. «Безлимит» и повтор той же темы за сутки — бесплатно (`theoryOpenStep`).
 *
 * Решение «открыть / платить» принимается один раз при открытии темы по настоящему времени (`Date.now()` в момент открытия),
 * а не по часам интерфейса `useNow` (тик 15 с, кэш на модуль — после долгой паузы или «заморозки» вкладки они отстают, и платная
 * тема открылась бы бесплатно). `useNow` нужен только как признак «страница уже на клиенте» (на сервере 0 → `wait`).
 *
 * Списание — из колбэка следующего кадра, а не из тела эффекта (правило React 19: setState синхронно в эффекте нельзя).
 * Двойной оплаты нет: StrictMode и быстрый возврат отменяют колбэк в cleanup, а `payTheory` за сутки повторно не списывает.
 * Допуск (`admittedId`) ставит результат `payTheory` (он сам смотрит на настоящее время и тариф) или проверка при открытии.
 * Не хватило сердечек — `locked`: страница показывает «Сердечки закончились» и не показывает текст темы;
 * после покупки или восстановления `resume` списывает и открывает тему.
 */
export function useTheoryAccess(lessonId: string): { access: TheoryAccess; resume: () => void } {
  const plan = useApp((s) => s.plan);
  const paidAt = useApp((s) => s.theoryPaid[lessonId]);
  const clock = useNow();
  // Когда открыли эту тему (настоящее время). Страница перемонтируется по key (`theory/[id]/page.tsx`), но и без этого
  // другая тема получает свою метку (до неё — `wait`), а не чужую.
  const [opened, setOpened] = useState(() => ({ id: lessonId, at: Date.now() }));
  // Отказ и допуск помним вместе с id урока: другая тема платится заново.
  const [refusedId, setRefusedId] = useState<string | null>(null);
  const [admittedId, setAdmittedId] = useState<string | null>(null);
  const admitted = admittedId === lessonId;
  const at = clock > 0 && opened.id === lessonId ? opened.at : 0;

  const step = theoryOpenStep({ admitted, refused: refusedId === lessonId, unlimited: effectiveTier(plan, at) === "unlimited", paidAt, now: at });
  // «Предыдущее значение» при рендере (без эффекта с setState): раз открытая тема остаётся открытой, пока страница на экране.
  if (step === "open" && !admitted) setAdmittedId(lessonId);

  // Другая тема в том же компоненте (в приложении страница перемонтируется по key, сюда не доходит): метка из колбэка кадра.
  useEffect(() => {
    if (opened.id === lessonId) return;
    const id = requestAnimationFrame(() => setOpened({ id: lessonId, at: Date.now() }));
    return () => cancelAnimationFrame(id);
  }, [opened.id, lessonId]);

  useEffect(() => {
    if (step !== "pay") return;
    const id = requestAnimationFrame(() => {
      if (useApp.getState().payTheory(lessonId).ok) setAdmittedId(lessonId);
      else setRefusedId(lessonId);
    });
    return () => cancelAnimationFrame(id);
  }, [step, lessonId]);

  /** Сердечки вернулись или куплены: списываем и открываем тему (не получилось — окно остаётся). Вызывать из обработчика. */
  const resume = useCallback(() => {
    if (!useApp.getState().payTheory(lessonId).ok) return;
    setRefusedId(null);
    setAdmittedId(lessonId);
  }, [lessonId]);

  return { access: step === "open" ? "open" : step === "locked" ? "locked" : "wait", resume };
}
