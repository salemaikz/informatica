// Мелкая чистая логика экрана восстановления и баннера хранилища (без React — чтобы тестировать в node).

import type { Lang } from "./types";

/**
 * Язык экрана восстановления: стор не открылся, профиля нет. Смотрим на сырое сохранение
 * (в нём обычно видно "lang":"kk"), иначе — на язык браузера.
 */
export function guessLang(raw: string | null, browserLang: string | undefined): Lang {
  const m = raw ? /"lang"\s*:\s*"(kk|ru)"/.exec(raw) : null;
  if (m) return m[1] as Lang;
  return browserLang && /^kk/i.test(browserLang) ? "kk" : "ru";
}

/** Полноэкранные режимы со своими кнопками внизу: баннер хранилища там не показываем, чтобы не сдвигать и не перекрывать их. */
export function isFocusPath(pathname: string): boolean {
  return (
    pathname.startsWith("/lesson/") ||
    pathname === "/drill" ||
    pathname === "/exam/run" ||
    pathname.startsWith("/game/") ||
    // Знакомство и окно тарифов: баннер сдвигал кнопку «Далее».
    pathname === "/onboarding" ||
    pathname === "/plans"
  );
}
