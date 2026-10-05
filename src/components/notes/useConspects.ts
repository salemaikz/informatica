"use client";

import { lazySource, useLazy } from "@/components/app/useLazy";
import type { L } from "@/lib/types";

// Шпаргалки всех уроков (~0,5 МБ) нужны только для поиска в «Конспектах»: грузятся отдельным куском,
// когда ученик начал искать (этап 16).

const CONSPECTS = lazySource(() => import("@/content/conspects.generated").then((m) => m.CONSPECTS));

/** Шпаргалки уроков: value null — ещё не нужны или грузятся; failed — не загрузились (retry — ещё раз). */
export function useConspects(enabled: boolean): { value: Record<string, L> | null; failed: boolean; retry: () => void } {
  return useLazy(CONSPECTS, enabled);
}
