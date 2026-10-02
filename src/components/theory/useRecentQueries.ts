"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { parseRecent, pushRecent, RECENT_KEY } from "@/lib/theory";

// Последние запросы поиска — в localStorage этого устройства (не в сторе прогресса).
// Если localStorage недоступен (приватное окно) — держим список в памяти до перезагрузки.

const listeners = new Set<() => void>();
let memory = "";

function read(): string {
  try {
    return localStorage.getItem(RECENT_KEY) ?? memory;
  } catch {
    return memory;
  }
}

function write(raw: string) {
  memory = raw;
  try {
    localStorage.setItem(RECENT_KEY, raw);
  } catch {
    // нет доступа к хранилищу — остаёмся в памяти
  }
  listeners.forEach((f) => f());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useRecentQueries() {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  const list = useMemo(() => parseRecent(raw), [raw]);
  const remember = useCallback((q: string) => write(JSON.stringify(pushRecent(parseRecent(read()), q))), []);
  const clear = useCallback(() => write("[]"), []);
  return { recent: list, remember, clear };
}
