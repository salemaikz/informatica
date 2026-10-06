// Синхронизация вкладок (#119): две вкладки (PWA и браузер, две вкладки сайта) пишут одно сохранение целиком — без
// синхронизации поздняя запись старой вкладки затирала свежие траты (обращения к ИИ, чипы, сердечки). Другая вкладка
// записала сохранение → эта перечитывает его (useApp.persist.rehydrate). Событие `storage` приходит только в ДРУГИЕ
// вкладки, а перечитывание само ничего не пишет — цикла нет. Чистая логика без React; тест — tests/storage-sync.test.ts.

/** Поля события `storage`, которые нам нужны (StorageEvent или подделка в тесте). */
export interface StorageEventLike {
  key: string | null;
  newValue: string | null;
  storageArea?: unknown;
}

/**
 * Это свежее сохранение другой вкладки, которое стоит перечитать? Только наш ключ, не удаление (newValue null —
 * «Начать заново» или очистка) и только та же версия формата: вкладка со старой или новой версией приложения после
 * перечитывания записала бы миграцию обратно, и вкладки перебрасывались бы сохранением.
 */
export function isPeerSave(e: StorageEventLike, key: string, version: number, area?: unknown): boolean {
  if (e.key !== key || e.newValue === null) return false;
  if (area !== undefined && e.storageArea !== undefined && e.storageArea !== area) return false;
  try {
    const parsed = JSON.parse(e.newValue) as { version?: unknown; state?: unknown } | null;
    return !!parsed && typeof parsed === "object" && parsed.version === version && !!parsed.state && typeof parsed.state === "object";
  } catch {
    return false;
  }
}

type EventTargetLike = {
  addEventListener(type: "storage", cb: (e: StorageEventLike) => void): void;
  removeEventListener(type: "storage", cb: (e: StorageEventLike) => void): void;
};

/** Слушает сохранения других вкладок; возвращает отписку. */
export function watchPeerSaves(
  target: EventTargetLike,
  opts: { key: string; version: number; area?: unknown; onPeerSave: () => void },
): () => void {
  const cb = (e: StorageEventLike) => {
    if (isPeerSave(e, opts.key, opts.version, opts.area)) opts.onPeerSave();
  };
  target.addEventListener("storage", cb);
  return () => target.removeEventListener("storage", cb);
}
