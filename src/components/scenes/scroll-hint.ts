// Подсказка горизонтальной прокрутки у широких рисунков (схема, таблица): чистая логика без React.

/** Допуск в пикселях: меньшая «прокрутка» — это округление, а не скрытое содержимое. */
export const SCROLL_EPS = 2;
/** Ширина затухающего края у подсказки, px. */
export const FADE_PX = 36;

export interface ScrollEdges {
  /** Слева есть скрытое содержимое. */
  left: boolean;
  /** Справа есть скрытое содержимое. */
  right: boolean;
}

/** Где ещё есть что прокручивать: по scrollLeft, видимой и полной ширине блока. */
export function scrollEdges(m: { scrollLeft: number; clientWidth: number; scrollWidth: number }): ScrollEdges {
  const max = m.scrollWidth - m.clientWidth;
  if (max <= SCROLL_EPS) return { left: false, right: false };
  return { left: m.scrollLeft > SCROLL_EPS, right: m.scrollLeft < max - SCROLL_EPS };
}

/** Ширина затухающего края с каждой стороны, px: 0 — края нет. */
export interface FadeWidths {
  left: number;
  right: number;
}

/**
 * Ширина затухания у каждого края: не больше FADE_PX и не больше того, что реально скрыто за краем. Если скрыто всего несколько
 * пикселей, гаснут они, а не 36 px видимого содержимого (иначе затухание съедает выход схемы или последнюю ячейку).
 */
export function fadeWidths(m: { scrollLeft: number; clientWidth: number; scrollWidth: number }): FadeWidths {
  const max = m.scrollWidth - m.clientWidth;
  if (max <= SCROLL_EPS) return { left: 0, right: 0 };
  const left = m.scrollLeft > SCROLL_EPS ? Math.min(FADE_PX, m.scrollLeft) : 0;
  const hiddenRight = max - m.scrollLeft;
  const right = hiddenRight > SCROLL_EPS ? Math.min(FADE_PX, hiddenRight) : 0;
  return { left: Math.round(left), right: Math.round(right) };
}

/**
 * Маска-градиент для прокручиваемого блока: край, за которым есть скрытое содержимое, плавно гаснет.
 * Работает на любом фоне (гаснет само содержимое, а не рисуется поверх цвет). null — подсказка не нужна.
 * `widths` — ширина затухания по краям (fadeWidths); без неё — полные FADE_PX.
 */
export function fadeMask(e: ScrollEdges, widths?: FadeWidths): string | null {
  if (!e.left && !e.right) return null;
  const lw = Math.max(1, widths?.left ?? FADE_PX);
  const rw = Math.max(1, widths?.right ?? FADE_PX);
  const a = e.left ? `transparent 0, black ${lw}px` : "black 0";
  const b = e.right ? `black calc(100% - ${rw}px), transparent 100%` : "black 100%";
  return `linear-gradient(to right, ${a}, ${b})`;
}
