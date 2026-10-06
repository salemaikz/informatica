// Отметка «просмотрено» для входящих итогов вызовов (этап 16Д, Ф3): время самого нового итога, который ученик уже открыл.
// Удобство одного устройства — localStorage (может быть недоступен: тогда все итоги считаются новыми, ничего не ломается).

const KEY = "informatica-duel-inbox-seen";

/** Сколько итогов новее отметки. */
export function unseenCount(items: readonly { at: number }[], seenAt: number): number {
  return items.filter((it) => it.at > seenAt).length;
}

/** Новая отметка после просмотра: самый новый итог (не уменьшается). */
export function seenAfter(items: readonly { at: number }[], seenAt: number): number {
  return items.reduce((m, it) => Math.max(m, it.at), seenAt);
}

export function readInboxSeen(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function writeInboxSeen(at: number): void {
  try {
    localStorage.setItem(KEY, String(at));
  } catch {
    // хранилище недоступно — отметка живёт до перезагрузки
  }
}
