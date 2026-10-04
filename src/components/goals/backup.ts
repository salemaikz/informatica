// Резервная копия прогресса: проверка файла и сборка — в lib/backup.ts (чистая логика), IndexedDB — lib/backup-idb.ts.
// Здесь — то, что нужно экранам: проверка файла перед импортом и скачивание файлов.

export { cleanBackup, parseBackup, summarizeBackup, BACKUP_LIMITS, type ParsedBackup } from "@/lib/backup";

/** Скачать файл. Ссылку отзываем с задержкой: Safari и Firefox иначе иногда отменяют загрузку. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
