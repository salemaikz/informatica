// Ссылка, ради которой человек пришёл (#73): вызов друга `/exam/run?kind&seed&ch=…`. Новый ученик сначала проходит онбординг —
// ссылку запоминаем на час и открываем сразу после него. Адрес из окна недоверенный: принимаем только вызов на пробник
// с валидными kind, seed и ch и пересобираем его из разобранных полей (защита от открытого редиректа и мусора в адресе).
// Чистая логика без React: tests/pending-link.test.ts.

import { examLink, parseRunParams } from "@/components/exam/logic";

/** Ключ в localStorage (отдельно от прогресса: сброс прогресса его не касается, срок жизни — час). */
export const PENDING_LINK_KEY = "informatica:pending-link";
/** Сколько живёт запомненная ссылка. */
export const PENDING_LINK_TTL_MS = 60 * 60 * 1000;

/** Каноничный адрес вызова или null, если это не вызов на пробник. */
export function pendingLinkOf(href: unknown): string | null {
  if (typeof href !== "string" || href.length > 300 || !href.startsWith("/exam/run?")) return null;
  let url: URL;
  try {
    url = new URL(href, "http://x.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "http://x.invalid" || url.pathname !== "/exam/run") return null;
  const sp: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    if (!(k in sp)) sp[k] = v;
  });
  const p = parseRunParams(sp);
  if (!p || p.seed === null || !p.challenge) return null;
  return examLink(p.kind, p.seed, p.topics, undefined, p.challenge);
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Запоминает ссылку-вызов; всё остальное молча игнорирует. */
export function savePendingLink(href: string, now: number): void {
  const link = pendingLinkOf(href);
  if (!link) return;
  try {
    storage()?.setItem(PENDING_LINK_KEY, JSON.stringify({ href: link, at: now }));
  } catch {
    // Хранилище недоступно — вызов откроется только по повторному переходу по ссылке.
  }
}

/** Возвращает запомненную ссылку и удаляет её; просрочена или испорчена — null. */
export function takePendingLink(now: number): string | null {
  const s = storage();
  if (!s) return null;
  let raw: string | null = null;
  try {
    raw = s.getItem(PENDING_LINK_KEY);
    s.removeItem(PENDING_LINK_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    const { href, at } = v as { href?: unknown; at?: unknown };
    if (typeof at !== "number" || !Number.isFinite(at) || Math.abs(now - at) > PENDING_LINK_TTL_MS) return null;
    return pendingLinkOf(href);
  } catch {
    return null;
  }
}
