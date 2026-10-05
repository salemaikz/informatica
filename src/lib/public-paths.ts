// Страницы, которые открываются без онбординга (по ссылке от учителя, родителя, друга; правовые страницы).
// Онбординг не навязываем: человек пришёл посмотреть конкретную вещь.

/** Точные адреса. */
// /owner — страница владельца (#69): своя защита секретом, онбординг ученика не нужен.
const EXACT = new Set(["/onboarding", "/privacy", "/terms", "/exam/print", "/offline", "/owner"]);

/** Префиксы (адрес совпадает или продолжается через «/»). */
const PREFIXES: string[] = [];

export function isPublicPath(pathname: string): boolean {
  if (EXACT.has(pathname)) return true;
  return PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
