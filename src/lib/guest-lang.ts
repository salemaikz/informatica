import type { Lang } from "./types";

// Язык для гостя без онбординга (родитель или друг открыл ссылку на документ): по языку браузера.
// Но не поверх выбора: если язык уже выбран вручную (шаг 0 онбординга) или определялся раньше, он остаётся.

/** Ключ localStorage: язык на этом устройстве уже выбран (вручную или автоопределением) — по браузеру больше не угадываем. */
export const GUEST_LANG_KEY = "informatica-lang-auto";

/** kk* → казахский, всё остальное → русский. */
export function detectLang(navLang: string | undefined | null): Lang {
  return (navLang ?? "").trim().toLowerCase().startsWith("kk") ? "kk" : "ru";
}

/**
 * Какой язык подставить гостю по языку браузера; null — ничего не менять.
 * Подставляем только пока человек не прошёл онбординг и язык ещё не выбран (флаг GUEST_LANG_KEY не стоит).
 */
export function guestLangToApply(input: {
  onboarded: boolean;
  /** Флаг GUEST_LANG_KEY уже стоит: язык выбран вручную или уже определялся. */
  chosen: boolean;
  navLang: string | undefined | null;
  current: Lang;
}): Lang | null {
  if (input.onboarded || input.chosen) return null;
  const lang = detectLang(input.navLang);
  return lang === input.current ? null : lang;
}

/** Отметить, что язык выбран (вручную в онбординге или автоопределением). Хранилище недоступно — молча, false. */
export function markLangChosen(storage: Pick<Storage, "setItem"> | null | undefined): boolean {
  try {
    storage?.setItem(GUEST_LANG_KEY, "1");
    return !!storage;
  } catch {
    return false;
  }
}
