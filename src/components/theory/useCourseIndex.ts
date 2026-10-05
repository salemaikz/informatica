"use client";

import { useMemo } from "react";
import { lazySource, useLazy } from "@/components/app/useLazy";
import type { SearchIndex } from "@/lib/search";
import type { Lang } from "@/lib/types";

// Индекс курса для поиска грузится отдельным куском, когда страница поиска уже показана (этап 16).

const INDEX_MODULE = lazySource(() => import("./course-search-index"));

/** Индекс поиска по курсу на языке ученика: index null — грузится или не загрузился (failed, retry). */
export function useCourseIndex(lang: Lang): { index: SearchIndex | null; failed: boolean; retry: () => void } {
  const { value: mod, failed, retry } = useLazy(INDEX_MODULE);
  const index = useMemo(() => (mod ? mod.buildCourseIndex(lang) : null), [mod, lang]);
  return { index, failed, retry };
}
