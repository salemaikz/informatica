"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { detectLang } from "./logic";

const KEY = "informatica-lang-auto";

/**
 * Гость без онбординга: язык интерфейса — из navigator.language (kk* → kk, иначе ru).
 * Срабатывает один раз на устройстве и только пока человек не прошёл онбординг,
 * поэтому выбор языка вручную потом не перетирается.
 */
export function useGuestLang() {
  useEffect(() => {
    try {
      if (useApp.getState().onboarded || localStorage.getItem(KEY)) return;
      localStorage.setItem(KEY, "1");
    } catch {
      return;
    }
    const lang = detectLang(navigator.language);
    if (useApp.getState().profile.lang !== lang) useApp.getState().updateProfile({ lang });
  }, []);
}
