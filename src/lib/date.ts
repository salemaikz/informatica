import type { Lang } from "./types";

// Даты без Intl: в части браузеров (Chromium без полного ICU) локаль kk-KZ выдаёт английские месяцы.

const MONTHS_SHORT: Record<Lang, string[]> = {
  ru: ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."],
  kk: ["қаң.", "ақп.", "нау.", "сәу.", "мам.", "мау.", "шіл.", "там.", "қыр.", "қаз.", "қар.", "жел."],
};

/** «2 окт.» / «2 қаз.» */
export function shortDate(d: Date, lang: Lang): string {
  return `${d.getDate()} ${MONTHS_SHORT[lang][d.getMonth()]}`;
}
