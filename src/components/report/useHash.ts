"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

/** Фрагмент адреса («#d=…»); на сервере и до гидратации — пустая строка. */
export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash, () => "");
}
