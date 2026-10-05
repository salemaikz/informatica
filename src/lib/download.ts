// Скачивание файла из браузера (файл календаря с напоминанием). Только из обработчика нажатия.

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
