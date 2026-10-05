"use client";

import { useEffect, useState } from "react";
import type { L } from "@/lib/types";

// Шпаргалки всех уроков (~0,5 МБ) нужны только для поиска в «Конспектах»: грузятся отдельным куском,
// когда ученик начал искать (этап 16). Загруженные держим в памяти до перезагрузки страницы.

let cache: Record<string, L> | null = null;
let loading: Promise<Record<string, L>> | null = null;

/** Шпаргалки уроков; null — ещё не нужны или грузятся. */
export function useConspects(enabled: boolean): Record<string, L> | null {
  const [data, setData] = useState<Record<string, L> | null>(cache);
  useEffect(() => {
    if (!enabled || data) return;
    let off = false;
    loading ??= import("@/content/conspects.generated").then((m) => (cache = m.CONSPECTS));
    loading.then((c) => {
      if (!off) setData(c);
    });
    return () => {
      off = true;
    };
  }, [enabled, data]);
  return data;
}
