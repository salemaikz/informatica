"use client";

import type { Rect } from "@/lib/guide";

// Поиск целей проводника на странице: элементы `[data-tour=…]`, их рамки, «занятый» низ экрана и чужие окна поверх.

/** Селектор цели по метке. */
export const tourSel = (name: string): string => `[data-tour="${name}"]`;

/** Первый видимый элемент `[data-tour=name]` (на телефоне и компьютере бывают две копии, одна скрыта). */
export function findTour(name: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(tourSel(name));
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

/** Скругление элемента (рамка повторяет его форму); не прочиталось — 16 px. */
export function radiusOf(el: Element | null): number {
  if (!el) return 16;
  const v = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(v) ? v : 16;
}

/** Открыто чужое модальное окно (шторка, кейс, тарифы): Бит ждёт, пока его закроют. */
export const foreignModal = (): boolean => !!document.querySelector('[role="dialog"][aria-modal="true"]:not([data-guide])');

/** Высота safe-area снизу (полоска «домой» на iPhone): env() из JS не прочитать — меряем пробником. */
let safeProbe: HTMLDivElement | null = null;
function safeBottom(): number {
  if (!safeProbe) {
    safeProbe = document.createElement("div");
    safeProbe.setAttribute("aria-hidden", "true");
    safeProbe.style.cssText = "position:fixed;left:0;bottom:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom)";
    document.body.appendChild(safeProbe);
  }
  return safeProbe.offsetHeight || 0;
}

/** Сколько занято снизу: нижняя панель телефона (с safe-area) или только safe-area (урок, итоги, компьютер). */
export function bottomInset(vh: number): number {
  let inset = 0;
  for (const el of document.querySelectorAll<HTMLElement>('[data-tour^="nav-"]')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.top > vh / 2) inset = Math.max(inset, vh - r.top);
  }
  return inset > 0 ? inset : safeBottom();
}

/** Цель видна целиком (не под шапкой и не за краем окна) — прокручивать не нужно. */
export function inView(el: Element, vh: number): boolean {
  const r = el.getBoundingClientRect();
  // Шапка закрывает верх страницы, кроме своих же элементов (сердечки, чипы).
  const top = el.closest("header") ? 0 : 64;
  return r.top >= top && r.bottom <= vh;
}

/** Первый элемент, на который можно поставить фокус: сама цель или кнопка/ссылка внутри неё. */
export function focusableIn(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  const sel = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
  return el.matches(sel) ? el : el.querySelector<HTMLElement>(sel);
}
