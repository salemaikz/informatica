"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 30_000);
  return () => clearInterval(id);
};
// Снимок меняется раз в минуту: компоненты перерисовываются, когда наступает время напоминания или новый день.
const snapshot = () => Math.floor(Date.now() / 60_000) * 60_000;

/** Текущее время (мс), округлённое до минуты. Для рендера «чистыми» функциями, без Date.now() в компоненте. */
export function useMinuteClock(): number {
  return useSyncExternalStore(subscribe, snapshot, () => 0);
}
