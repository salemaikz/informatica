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

/**
 * Маска-градиент для прокручиваемого блока: край, за которым есть скрытое содержимое, плавно гаснет.
 * Работает на любом фоне (гаснет само содержимое, а не рисуется поверх цвет). null — подсказка не нужна.
 */
export function fadeMask(e: ScrollEdges): string | null {
  if (!e.left && !e.right) return null;
  const a = e.left ? `transparent 0, black ${FADE_PX}px` : "black 0";
  const b = e.right ? `black calc(100% - ${FADE_PX}px), transparent 100%` : "black 100%";
  return `linear-gradient(to right, ${a}, ${b})`;
}
