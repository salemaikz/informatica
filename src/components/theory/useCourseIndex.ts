"use client";

import { useEffect, useMemo, useState } from "react";
import type { SearchIndex } from "@/lib/search";
import type { Lang } from "@/lib/types";

// Индекс курса для поиска грузится отдельным куском, когда страница поиска уже показана (этап 16).

type IndexModule = typeof import("./course-search-index");

let loaded: IndexModule | null = null;
let loading: Promise<IndexModule> | null = null;

/** Индекс поиска по курсу на языке ученика; null — ещё грузится. */
export function useCourseIndex(lang: Lang): SearchIndex | null {
  const [mod, setMod] = useState<IndexModule | null>(loaded);
  useEffect(() => {
    if (mod) return;
    let off = false;
    loading ??= import("./course-search-index").then((m) => (loaded = m));
    loading.then((m) => {
      if (!off) setMod(m);
    });
    return () => {
      off = true;
    };
  }, [mod]);
  return useMemo(() => (mod ? mod.buildCourseIndex(lang) : null), [mod, lang]);
}
