"use client";

import { useSyncExternalStore } from "react";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import {
  aiFreeLeft,
  boostActive,
  chipMultiplier,
  effectiveTier,
  heartsView,
  PLAN_FEATURES,
  planDaysLeft,
  quoteAi,
  type AiKind,
  type AiReceipt,
  type HeartsView,
  type PlanTier,
} from "@/lib/economy";

// Хуки экономики для интерфейса: сердечки и бустер зависят от времени, поэтому значения пересчитываются по «часам».

const TICK_MS = 15_000;
let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Текущее время, обновляется раз в 15 секунд (для таймеров сердечек и бустера). */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => now || (now = Date.now()),
    () => 0,
  );
}

// Секундные часы — только для обратных отсчётов («следующее через 4:12»); подписка живёт, пока такой компонент на экране.
const FAST_TICK_MS = 1000;
let fastNow = 0;
const fastListeners = new Set<() => void>();
let fastTimer: ReturnType<typeof setInterval> | null = null;

function subscribeFast(cb: () => void) {
  fastListeners.add(cb);
  if (!fastTimer) {
    fastNow = Date.now();
    fastTimer = setInterval(() => {
      fastNow = Date.now();
      fastListeners.forEach((l) => l());
    }, FAST_TICK_MS);
  }
  return () => {
    fastListeners.delete(cb);
    if (!fastListeners.size && fastTimer) {
      clearInterval(fastTimer);
      fastTimer = null;
    }
  };
}

/** Текущее время, обновляется раз в секунду (для обратного отсчёта). На сервере — 0. */
export function useNowSeconds(): number {
  return useSyncExternalStore(
    subscribeFast,
    () => fastNow || (fastNow = Date.now()),
    () => 0,
  );
}

/** Действующий тариф. */
export function usePlanTier(): PlanTier {
  const plan = useApp((s) => s.plan);
  const t = useNow();
  return effectiveTier(plan, t);
}

/** Тариф с подробностями: дни до конца, пробный ли. */
export function usePlan() {
  const plan = useApp((s) => s.plan);
  const t = useNow();
  const tier = effectiveTier(plan, t);
  return { plan, tier, features: PLAN_FEATURES[tier], daysLeft: planDaysLeft(plan, t), trial: tier !== "free" && !!plan.trial };
}

/** Сердечки сейчас (с учётом восстановления и нового дня). */
export function useHearts(): HeartsView {
  const hearts = useApp((s) => s.hearts);
  const tier = usePlanTier();
  const t = useNow();
  return heartsView(hearts, tier, t, todayKey());
}

/** Сердечки с секундным обновлением — для строки с обратным отсчётом до следующего. */
export function useHeartsLive(): { view: HeartsView; now: number } {
  const hearts = useApp((s) => s.hearts);
  const tier = usePlanTier();
  const t = useNowSeconds();
  return { view: heartsView(hearts, tier, t, todayKey()), now: t };
}

/** Чипы и множитель (тариф × бустер). */
export function useChips() {
  const wallet = useApp((s) => s.wallet);
  const boost = useApp((s) => s.boost);
  const tier = usePlanTier();
  const t = useNow();
  return {
    chips: wallet.chips,
    wallet,
    multiplier: chipMultiplier(tier, boost, t),
    boost: boostActive(boost, t) ? boost : null,
  };
}

/** Как будет оплачен запрос к ИИ этого вида прямо сейчас (без списания) и сколько бесплатных осталось. */
export function useAiQuote(kind: AiKind): { quote: AiReceipt; freeLeft: number; tier: PlanTier } {
  const usage = useApp((s) => s.aiUsage);
  const chips = useApp((s) => s.wallet.chips);
  const tier = usePlanTier();
  const today = todayKey();
  return { quote: quoteAi(kind, tier, usage, chips, today), freeLeft: aiFreeLeft(tier, usage, today), tier };
}
