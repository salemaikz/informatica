import type { Lang } from "./types";

// Язык для гостя без онбординга (родитель или друг открыл ссылку на документ): по языку браузера.

/** kk* → казахский, всё остальное → русский. */
export function detectLang(navLang: string | undefined | null): Lang {
  return (navLang ?? "").trim().toLowerCase().startsWith("kk") ? "kk" : "ru";
}
