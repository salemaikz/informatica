"use client";

import { useEffect } from "react";

/** Подсвечивает блок, к которому привела ссылка (с учётом «меньше анимаций»). */
function flash(el: HTMLElement) {
  const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduceMotion === "true";
  if (calm || typeof el.animate !== "function") return;
  el.animate([{ boxShadow: "0 0 0 4px var(--warning)" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 1800, easing: "ease-out" });
}

/**
 * Доскролл к блоку из адреса после монтирования. Адрес — `target` (параметр `?card=` / `?unit=`, его передаёт страница:
 * при переходе внутри приложения `window.location.hash` ещё старый), а при полной загрузке со старой ссылкой — якорь `#…`.
 * Страницы появляются только после гидратации стора (Providers), поэтому браузер сам до якоря уже не доходит.
 * key — перезапуск при смене страницы (id урока).
 */
export function useHashScroll(key: string, highlight = true, target: string | null = null) {
  useEffect(() => {
    let id = target ?? "";
    if (!id) {
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return; // битая %-последовательность в адресе
      }
    }
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: "start" });
    if (highlight) flash(el);
  }, [key, highlight, target]);
}
