// Страница для изолированного iframe сцены `web` (чистая логика).

/** Базовый стиль страницы в «браузере»: затем идёт css сцены. */
export const WEB_BASE_CSS = "body{font-family: system-ui, sans-serif; margin:12px; color:#1b2333; background:#fff}";

/** Запрещаем всё внешнее: ни скриптов, ни сети (img — только data:). */
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

/**
 * Документ для `<iframe sandbox="" srcDoc=…>`: базовый стиль + css сцены + html.
 * Любой «<» в css заменяется CSS-экранированием \3c — из блока <style> не вырваться никакой комбинацией
 * (одиночное вырезание «</style» обходится вложенным «</</stylestyle>»).
 */
export function buildWebDoc(html: string, css?: string): string {
  const safeCss = (css ?? "").replace(/</g, "\\3c ");
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
    `<style>${WEB_BASE_CSS}\n${safeCss}</style></head><body>${html}</body></html>`
  );
}

/** Высота окна «браузера» по размеру разметки: 140–260 px. */
export function webFrameHeight(html: string): number {
  const lines = html.split("\n").length;
  return Math.max(140, Math.min(260, 70 + lines * 28));
}

/** Разметка сцены на языке ученика: htmlKk — для казахского (если задана), иначе общий html. */
export function webHtml(scene: { html: string; htmlKk?: string }, lang: "ru" | "kk"): string {
  return lang === "kk" && scene.htmlKk !== undefined ? scene.htmlKk : scene.html;
}
