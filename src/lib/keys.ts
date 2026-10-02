// Глобальные клавиатурные обработчики (урок, игры) не должны реагировать,
// когда ученик печатает в поле ввода или пользуется инструментами (калькулятор, черновик).

/** true — событие клавиатуры нужно проигнорировать. */
export function ignoreKey(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  if (el.closest("[data-toolbox]")) return true;
  const tag = el.tagName;
  return el.isContentEditable || tag === "TEXTAREA" || (tag === "INPUT" && (el as HTMLInputElement).type !== "checkbox");
}
