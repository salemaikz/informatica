"use client";

import { BUBBLE_TEXT, type Rect } from "@/lib/guide";

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

/** У элемента своя «коробка»: фон, рамка или тень. */
function boxed(el: Element): boolean {
  const s = getComputedStyle(el);
  const bg = s.backgroundColor;
  const paint = !!bg && bg !== "transparent" && !/^rgba\(.*,\s*0\)$/.test(bg);
  const image = !!s.backgroundImage && s.backgroundImage !== "none";
  const shadow = !!s.boxShadow && s.boxShadow !== "none";
  return paint || image || shadow || parseFloat(s.borderTopWidth) > 0;
}

/**
 * Цель — «голый» заголовок: у неё нет своей карточки (фона, рамки, тени), а заголовок стоит у самого её левого края.
 * Рамке проводника тогда нужен зазор побольше, иначе она ложится вплотную к буквам («Мини-игры», «Сердечки»).
 */
export function bareHeading(el: Element): boolean {
  if (boxed(el)) return false;
  const h = el.matches("h1, h2, h3") ? el : el.querySelector("h1, h2, h3");
  if (!h) return false;
  return h.getBoundingClientRect().left - el.getBoundingClientRect().left < 8;
}

/** «Линейка» для реплики Бита: та же вёрстка текста, что в пузыре, вне экрана. */
let ruler: HTMLParagraphElement | null = null;
/** Замеры: «ширина|текст» → высота. Пока шрифт не загружен, не запоминаем — с запасным шрифтом высота другая. */
const textHeights = new Map<string, number>();

/** Высота текста реплики при ширине `w` (как в пузыре); null — замерить нельзя (нет вёрстки), берётся оценка. */
export function textHeight(text: string, w: number): number | null {
  if (!text || w <= 0) return null;
  const key = `${Math.round(w)}|${text}`;
  const known = textHeights.get(key);
  if (known !== undefined) return known;
  if (!ruler || !ruler.isConnected) {
    ruler = document.createElement("p");
    ruler.setAttribute("aria-hidden", "true");
    ruler.className = BUBBLE_TEXT;
    ruler.style.cssText = "position:fixed;left:-10000px;top:0;margin:0;visibility:hidden;pointer-events:none";
    document.body.appendChild(ruler);
  }
  ruler.style.width = `${Math.round(w)}px`;
  ruler.textContent = text;
  const h = ruler.offsetHeight;
  if (!h) return null;
  if (document.fonts?.status === "loaded") textHeights.set(key, h);
  return h;
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

/**
 * Прокрутить на `dy` px то, что прокручивает элемент: ближайший прокручиваемый предок или само окно. Возвращает, сколько
 * ещё осталось проехать (px): плавная прокрутка идёт несколько кадров, а у края страницы она проедет меньше `dy`.
 */
export function scrollPage(el: Element, dy: number, smooth: boolean): () => number {
  const opts: ScrollToOptions = { top: dy, behavior: smooth ? "smooth" : "auto" };
  let box: Element | null = null;
  for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) {
      box = n;
      break;
    }
  }
  const page = box ?? document.scrollingElement ?? document.documentElement;
  const at = () => (box ? box.scrollTop : window.scrollY);
  const to = Math.max(0, Math.min(page.scrollHeight - page.clientHeight, at() + dy));
  if (box) box.scrollBy?.(opts);
  else window.scrollBy?.(opts);
  return () => to - at();
}

const CONTROLS = 'a[href], button, [role="button"], [role="radio"], [role="tab"], input, select, textarea';

/**
 * Кнопки и ссылки на экране, кроме целей и самого проводника: край пузыря их не режет, поднятый над целью Бит на них
 * не садится (3D-грань кнопок добавляет lib/guide.ts). `ahead` — сколько ещё проедет плавная прокрутка: кнопки
 * страницы — там, где окажутся после неё (приколотые к экрану — где есть).
 */
export function obstacles(targets: readonly Element[], vw: number, vh: number, ahead = 0): Rect[] {
  const out: Rect[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(CONTROLS)) {
    if (el.closest("[data-guide]") || targets.some((t) => t.contains(el) || el.contains(t))) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.right <= 0 || r.left >= vw) continue;
    const y = ahead && !pinned(el) ? r.top - ahead : r.top;
    if (y + r.height <= 0 || y >= vh) continue;
    out.push({ x: r.left, y, w: r.width, h: r.height });
  }
  return out;
}

/** Первый элемент, на который можно поставить фокус: сама цель или кнопка/ссылка внутри неё. */
export function focusableIn(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  const sel = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
  return el.matches(sel) ? el : el.querySelector<HTMLElement>(sel);
}
