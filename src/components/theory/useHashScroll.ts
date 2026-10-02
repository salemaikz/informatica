"use client";

import { useEffect } from "react";

/** Подсвечивает блок, к которому привела ссылка (с учётом «меньше анимаций»). */
function flash(el: HTMLElement) {
  const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduceMotion === "true";
  if (calm || typeof el.animate !== "function") return;
  el.animate([{ boxShadow: "0 0 0 4px var(--warning)" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 1800, easing: "ease-out" });
}

/**
 * Доскролл к якорю из адреса (`#conspect`, `#u3`) после монтирования.
 * Страницы появляются только после гидратации стора (Providers), поэтому браузер сам до якоря уже не доходит.
 * key — перезапуск при смене страницы (id урока).
 */
export function useHashScroll(key: string, highlight = true) {
  useEffect(() => {
    let hash = "";
    try {
      hash = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return; // битая %-последовательность в адресе
    }
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    el.scrollIntoView({ block: "start" });
    if (highlight) flash(el);
  }, [key, highlight]);
}
