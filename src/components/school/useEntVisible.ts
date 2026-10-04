"use client";

import { entVisible } from "@/lib/school";
import { useApp } from "@/lib/store";

/**
 * Показывать ли ЕНТ-элементы (пробный ЕНТ, цели и прогноз, план, «до ЕНТ N дней»).
 * Решение — `entVisible` из lib/school.ts (#52): ученик школьного трека их не видит.
 */
export function useEntVisible(): boolean {
  return useApp((s) => entVisible(s.profile));
}
