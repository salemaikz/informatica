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

/**
 * Скругление элемента (рамка повторяет его форму). Обёртка без скругления вокруг одной карточки — скругление карточки
 * (иначе вокруг rounded-3xl виден квадратный «ореол»); вокруг заголовка и нескольких блоков или не прочиталось — 16 px.
 */
export function radiusOf(el: Element | null, depth = 0): number {
  if (!el) return 16;
  const v = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  if (Number.isFinite(v) && v > 0) return v;
  if (depth < 3 && el.children.length === 1) return radiusOf(el.children[0], depth + 1);
  return 16;
}

/**
 * Окно действительно на экране: не внутри `[inert]` / `[hidden]` (закрытая, но смонтированная панель Бита) и не скрыто
 * стилями (`display: none` у него или предка, `visibility: hidden`).
 */
export function shownOnScreen(el: Element): boolean {
  if (el.closest("[inert], [hidden]")) return false;
  if (getComputedStyle(el).visibility === "hidden") return false;
  for (let n: Element | null = el; n; n = n.parentElement) if (getComputedStyle(n).display === "none") return false;
  return true;
}

/** Модальное окно поверх страницы — чужое: не сам проводник (`[data-guide]`) и действительно на экране. */
export const liveModal = (el: Element): boolean => !el.closest("[data-guide]") && shownOnScreen(el);

/** Открыто чужое модальное окно (шторка, кейс, тарифы): Бит ждёт, пока его закроют. */
export const foreignModal = (): boolean => Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).some(liveModal);

/** Высота safe-area снизу (полоска «домой» на iPhone): env() из JS не прочитать — меряем пробником. */
let safeProbe: HTMLDivElement | null = null;
export function safeBottom(): number {
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

/** Элемент приколот к экрану (шапка, нижняя панель, кнопка Бита, низ урока): прокрутка его не сдвинет. */
export function pinned(el: Element): boolean {
  for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
    const p = getComputedStyle(n).position;
    if (p === "fixed" || p === "sticky") return true;
  }
  return false;
}

/** Низ шапки, прилипшей к верху экрана (шапка приложения или урока); шапки нет — 0. */
export function topBar(): number {
  let top = 0;
  for (const h of document.querySelectorAll("header")) {
    const r = h.getBoundingClientRect();
    if (r.height > 0 && r.top <= 1 && r.bottom > 0) top = Math.max(top, r.bottom);
  }
  return top;
}

/** Прокрутить на `dy` px то, что прокручивает элемент: ближайший прокручиваемый предок или само окно. */
export function scrollPage(el: Element, dy: number, smooth: boolean): void {
  const opts: ScrollToOptions = { top: dy, behavior: smooth ? "smooth" : "auto" };
  for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) {
      n.scrollBy?.(opts);
      return;
    }
  }
  window.scrollBy?.(opts);
}

const CONTROLS = 'a[href], button, [role="button"], [role="radio"], [role="tab"], input, select, textarea';

/**
 * Кнопки и ссылки на экране, кроме целей и самого проводника: поднятый над целью Бит на них не садится, а пузырь шага
 * без цели их не режет.
 */
export function obstacles(targets: readonly Element[], vw: number, vh: number): Rect[] {
  const out: Rect[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(CONTROLS)) {
    if (el.closest("[data-guide]") || targets.some((t) => t.contains(el) || el.contains(t))) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
    out.push({ x: r.left, y: r.top, w: r.width, h: r.height });
  }
  return out;
}

/** Первый элемент, на который можно поставить фокус: сама цель или кнопка/ссылка внутри неё. */
export function focusableIn(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  const sel = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
  return el.matches(sel) ? el : el.querySelector<HTMLElement>(sel);
}
