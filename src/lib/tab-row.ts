// Горизонтальный ряд вкладок (строка подразделов SectionTabs): куда прокрутить его при показе. Чистая логика без DOM.

/** Вкладка ряда: левый край (от начала содержимого ряда, вместе с полем) и ширина, px. */
export interface TabBox {
  left: number;
  width: number;
}

/** Затухание у обрезанного края ряда, px (mask-image в SectionTabs). */
export const TAB_FADE = 24;
/** У вкладки до первой буквы: рамка 2 + поле 16 + иконка 18 + промежуток 8 px (SectionTabs). */
export const TAB_LEAD = 44;
/** У вкладки после последней буквы: поле 16 + рамка 2 px. */
export const TAB_TRAIL = 18;

/**
 * Прокрутка ряда при показе: `left` — scrollLeft, `extra` — сколько добавить полю справа, чтобы до `left` можно было
 * докрутить (иначе ряд упёрся бы в конец посреди слова).
 * Активная видна целиком и без прокрутки — ряд в начале (первая вкладка с первой буквы). Иначе — наименьшая прокрутка,
 * при которой активная видна целиком (у неё не затухает ни один край), а левый край ряда не режет буквы: он в
 * промежутке между вкладками или на их поле (иконку и поле затухание может прикрыть).
 * `view` — ширина ряда, `max` — наибольшая прокрутка (scrollWidth − clientWidth), `active` — номер активной (−1 — нет).
 */
export function tabRowScroll(tabs: readonly TabBox[], active: number, view: number, max: number, fade = TAB_FADE): { left: number; extra: number } {
  const a = tabs[active];
  if (!a) return { left: 0, extra: 0 };
  const right = a.left + a.width;
  // Без прокрутки: слева затухания нет, справа — если ряд длиннее экрана.
  if (right <= view - (max > 0 ? fade : 0)) return { left: 0, extra: 0 };
  // Левый край ряда (под затуханием) не режет буквы ни одной вкладки.
  const cleanLeft = (s: number) => tabs.every((t) => s <= t.left || s >= t.left + t.width || s <= t.left + TAB_LEAD - fade || s >= t.left + t.width - TAB_TRAIL);
  // Активная видна целиком: слева — за затуханием, справа — до затухания (докрутили до конца — его там нет).
  const shows = (s: number, end: number) => a.left - s >= fade && right - s <= view - (s >= end ? 0 : fade);
  const starts = tabs.slice(1, active + 1).map((t) => t.left - fade);
  for (const s of [...starts, max].filter((v) => v > 0 && v <= max).sort((x, y) => x - y)) {
    if (cleanLeft(s) && shows(s, max)) return { left: s, extra: 0 };
  }
  // До нужного места не докрутить — поле справа: ряд начинается с целой вкладки.
  for (const s of starts) if (s > max && shows(s, s)) return { left: s, extra: Math.ceil(s - max) };
  // Активная шире ряда — её начало сразу за затуханием.
  const s = Math.max(0, a.left - fade);
  return { left: s, extra: Math.max(0, Math.ceil(s - max)) };
}
