"use client";

import { useEffect } from "react";
import { installClientErrorReporter } from "@/lib/client-errors";
import { useApp } from "@/lib/store";

/** Невидимый сборщик ошибок с телефонов: window.onerror и unhandledrejection → /api/issue. Только в production. */
export function ClientErrorReporter() {
  useEffect(() => installClientErrorReporter(() => useApp.getState().profile.lang), []);
  return null;
}
