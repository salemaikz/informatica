// Код в адресе страницы: /python?code=<base64url(UTF-8)>.

/** Длина кода, который ещё кладём в ссылку (дальше адрес становится слишком длинным). */
export const MAX_URL_CODE = 4000;

export function encodeCode(code: string): string {
  const bytes = new TextEncoder().encode(code);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Предел длины параметра ?code= (с запасом на 4 байта UTF-8 на символ): адрес — недоверенные данные. */
export const MAX_URL_PARAM = Math.ceil((MAX_URL_CODE * 4 * 4) / 3) + 4;

/** Раскодирует base64url; битая или слишком длинная строка — null. */
export function decodeCode(s: string | null | undefined): string | null {
  if (!s || s.length > MAX_URL_PARAM) return null;
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(s)) return null;
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const code = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    // Нулевой символ и прочие управляющие (кроме табуляции и переводов строки) в коде ученика не нужны.
    return code.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  } catch {
    return null;
  }
}

/** Ссылка на песочницу с кодом. */
export function pythonHref(code: string): string {
  // Array.from — по символам, а не по UTF-16: не разрезаем суррогатную пару.
  return `/python?code=${encodeCode(Array.from(code).slice(0, MAX_URL_CODE).join(""))}`;
}
