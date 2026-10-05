"use client";

import { useCallback, useEffect, useState } from "react";

// Тяжёлые куски по требованию (этап 16): индекс поиска по курсу, шпаргалки уроков.
// Загруженное держим в памяти до перезагрузки страницы. Сбой (нет сети, старая вкладка после выкладки) не залипает:
// следующая попытка грузит заново, у экрана есть failed и retry.

export interface LazySource<T> {
  /** Уже загружено или null. */
  get: () => T | null;
  /** Загрузить (один запрос на всех; после сбоя — заново). */
  load: () => Promise<T>;
}

export function lazySource<T>(loader: () => Promise<T>): LazySource<T> {
  let value: T | null = null;
  let pending: Promise<T> | null = null;
  return {
    get: () => value,
    load: () =>
      (pending ??= loader()
        .then((v) => (value = v))
        .catch((e: unknown) => {
          pending = null;
          throw e;
        })),
  };
}

/** Значение источника; enabled = false — пока не грузить. failed — не загрузилось, retry — ещё раз. */
export function useLazy<T>(source: LazySource<T>, enabled = true): { value: T | null; failed: boolean; retry: () => void } {
  const [value, setValue] = useState<T | null>(source.get);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled || value || failed) return;
    let off = false;
    source.load().then(
      (v) => {
        if (!off) setValue(v);
      },
      () => {
        if (!off) setFailed(true);
      },
    );
    return () => {
      off = true;
    };
  }, [source, enabled, value, failed]);
  // Сбросить сбой — эффект попробует загрузить снова.
  const retry = useCallback(() => setFailed(false), []);
  return { value, failed, retry };
}
