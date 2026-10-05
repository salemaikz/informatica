// Страницы, которые открываются без онбординга (по ссылке от друга или ученика родителю; правовые страницы).
// Онбординг не навязываем: человек пришёл посмотреть конкретную вещь.

/** Точные адреса. */
// /owner — страница владельца (#69): своя защита секретом, онбординг ученика не нужен.
// /report — отчёт родителю (#74): данные целиком во фрагменте ссылки, стор не нужен.
// /dev/scenes — галерея рисунков для разработчика (этап 16Б, волна 3), открыта только при SCENES_GALLERY=1.
const EXACT = new Set(["/onboarding", "/privacy", "/terms", "/offline", "/owner", "/report", "/dev/scenes"]);

/** Префиксы (адрес совпадает или продолжается через «/»). /r/<код> — результат, которым поделились (#72). */
const PREFIXES: string[] = ["/r"];

export function isPublicPath(pathname: string): boolean {
  if (EXACT.has(pathname)) return true;
  return PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Страницы для получателя ссылки (друг, родитель): там не считаем «активный день» ученика (#69) —
 * иначе родитель или друг на чужом телефоне засчитался бы новым учеником.
 */
export function isRecipientPath(pathname: string): boolean {
  return pathname === "/report" || pathname === "/r" || pathname.startsWith("/r/");
}
