"use client";

import { ENTRY_COST } from "@/lib/economy";
import { theoryPaidRecently } from "@/lib/theory-pay";
import { useApp } from "@/lib/store";
import { HeartCost } from "@/components/economy/HeartCost";
import { useNow } from "@/components/economy/useEconomy";

/**
 * Цена открытия темы — обычный значок сердечка с числом ½, как у уроков и тренировок (решение #113): единственное место,
 * где цена видна. Тема уже оплачена за сутки — значка нет (спишется 0); на «Безлимите» его скрывает сам `HeartCost`.
 */
export function TheoryCost({ id, className }: { id: string; className?: string }) {
  const paidAt = useApp((s) => s.theoryPaid[id]);
  const now = useNow();
  return <HeartCost n={theoryPaidRecently(paidAt, now) ? 0 : ENTRY_COST.theory} className={className} />;
}
