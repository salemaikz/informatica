"use client";

import { useEffect } from "react";
import { detectLang } from "@/lib/guest-lang";
import { useApp } from "@/lib/store";

const KEY = "informatica-lang-auto";

/**
 * Гость без онбординга: язык страницы — из navigator.language (kk* → kk, иначе ru).
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
