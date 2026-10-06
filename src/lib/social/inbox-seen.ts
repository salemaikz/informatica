// Отметка «просмотрено» для входящих итогов вызовов (этап 16Д, Ф3): время самого нового итога, который ученик уже открыл.
// Удобство одного устройства — localStorage (может быть недоступен: тогда все итоги считаются новыми, ничего не ломается).
// Отметка — своя у каждого игрока (по коду друга): другой профиль на том же устройстве или новый профиль после «Удалить
// мой профиль соревнований» не наследует чужую отметку.

const KEY = "informatica-duel-inbox-seen";
const keyOf = (code: string) => `${KEY}:${code}`;

/** Сколько итогов новее отметки. */
export function unseenCount(items: readonly { at: number }[], seenAt: number): number {
  return items.filter((it) => it.at > seenAt).length;
}

/** Новая отметка после просмотра: самый новый итог (не уменьшается). */
export function seenAfter(items: readonly { at: number }[], seenAt: number): number {
  return items.reduce((m, it) => Math.max(m, it.at), seenAt);
}

export function readInboxSeen(code: string): number {
  if (!code) return 0;
  try {
    const v = Number(localStorage.getItem(keyOf(code)));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function writeInboxSeen(code: string, at: number): void {
  if (!code) return;
  try {
    localStorage.setItem(keyOf(code), String(at));
  } catch {
    // хранилище недоступно — отметка живёт до перезагрузки
  }
}
