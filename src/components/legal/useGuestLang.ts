"use client";

import { useEffect } from "react";
import { GUEST_LANG_KEY, guestLangToApply, markLangChosen } from "@/lib/guest-lang";
import { useApp } from "@/lib/store";

/**
 * Гость без онбординга: язык страницы — из navigator.language (kk* → kk, иначе ru).
 * Срабатывает один раз на устройстве, только пока человек не прошёл онбординг и не выбрал язык сам
 * (выбор на шаге 0 онбординга ставит тот же флаг — иначе ссылка из согласия, открытая в новой вкладке,
 * перетёрла бы выбранный язык языком браузера).
 */
export function useGuestLang() {
  useEffect(() => {
    let chosen: boolean;
    try {
      chosen = !!localStorage.getItem(GUEST_LANG_KEY);
    } catch {
      return; // хранилище недоступно — язык не трогаем
    }
    const s = useApp.getState();
    const lang = guestLangToApply({ onboarded: s.onboarded, chosen, navLang: navigator.language, current: s.profile.lang });
    // Определение — один раз на устройстве: флаг ставим, даже если язык уже совпал.
    if (!s.onboarded && !chosen) markLangChosen(localStorage);
    if (lang) s.updateProfile({ lang });
  }, []);
}
