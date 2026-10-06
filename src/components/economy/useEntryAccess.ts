"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track, type HeartOutWhere } from "@/lib/analytics";
import { useApp } from "@/lib/store";

export type EntryAccess = "wait" | "open" | "locked";

/** Итог оплаты входа: сколько списано сейчас (0 — уже оплачено или «Безлимит») и когда оплачен вход (null — бесплатно). */
export interface EntryPayment {
  paid: number;
  paidAt: number | null;
}

/**
 * Доступ к занятию при открытии экрана (этап 16Г, решение #120): сердечко списывается сразу при входе — урок, «Проверить себя»,
 * тренировка. По образцу теории (components/theory/useTheoryAccess.ts).
 *
 * Списание — из колбэка следующего кадра, а не из тела эффекта (правило React 19: setState синхронно в эффекте нельзя).
 * Двойной оплаты нет: StrictMode и быстрый уход отменяют колбэк в cleanup, а `payEntryOnce` по ключу занятия 20 минут
 * повторно не списывает (перезагрузка, «Назад» и снова вход — бесплатно).
 * Не хватило сердечек — `locked` (экран показывает «Сердечки закончились», событие `hearts_out` — один раз за показ);
 * после покупки или восстановления `resume` (из обработчика) списывает и открывает занятие.
 * enabled = false — ничего не списываем (`wait`): экран решает сам (например, выбор «Продолжить / Начать заново»).
 */
export function useEntryAccess(
  key: string,
  cost: number,
  enabled: boolean,
  where: HeartOutWhere,
): { access: EntryAccess; payment: EntryPayment | null; resume: () => void } {
  // Итог оплаты помним вместе с ключом: другое занятие в том же компоненте платится заново.
  const [state, setState] = useState<{ key: string; payment: EntryPayment | null; locked: boolean } | null>(null);
  const mine = state?.key === key ? state : null;
  const outSent = useRef<string | null>(null);

  const pay = useCallback((): boolean => {
    const app = useApp.getState();
    const res = app.payEntryOnce(key, cost);
    if (!res.ok) {
      setState({ key, payment: null, locked: true });
      if (outSent.current !== key) {
        outSent.current = key;
        track({ e: "hearts_out", where });
      }
      return false;
    }
    setState({ key, payment: { paid: res.paid, paidAt: useApp.getState().entryPaid[key] ?? null }, locked: false });
    return true;
  }, [key, cost, where]);

  const pending = enabled && !mine;
  useEffect(() => {
    if (!pending) return;
    const id = requestAnimationFrame(() => {
      pay();
    });
    return () => cancelAnimationFrame(id);
  }, [pending, pay]);

  /** Сердечки вернулись или куплены: списываем и открываем (не получилось — окно остаётся). Вызывать из обработчика. */
  const resume = useCallback(() => {
    pay();
  }, [pay]);

  const access: EntryAccess = !enabled || !mine ? "wait" : mine.locked ? "locked" : "open";
  return { access, payment: mine && !mine.locked ? mine.payment : null, resume };
}
