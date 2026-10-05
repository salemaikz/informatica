// Страницы, которые открываются без онбординга (по ссылке от учителя, родителя, друга; правовые страницы).
// Онбординг не навязываем: человек пришёл посмотреть конкретную вещь.

/** Точные адреса. */
const EXACT = new Set(["/onboarding", "/privacy", "/terms", "/report", "/restore", "/exam/print", "/offline"]);

/** Префиксы (адрес совпадает или продолжается через «/»). */
const PREFIXES: string[] = [];

export function isPublicPath(pathname: string): boolean {
  if (EXACT.has(pathname)) return true;
  return PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
