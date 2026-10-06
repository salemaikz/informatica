// Код друга (docs/specs/duels.md §1, 3-safety.md §3): 8 знаков base32 Крокфорда, показывается как «K7QF-29XM».
// 32⁸ ≈ 1,1·10¹² — перебором живых детей не найти. Чистая логика: генерация из случайных байтов и разбор ввода
// (регистр, дефисы и пробелы, похожие буквы: O→0, I/L→1, кириллица с русской раскладки).

/** Алфавит Крокфорда: без I, L, O, U. */
export const FRIEND_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const FRIEND_CODE_LEN = 8;

/** Похожие знаки → знак алфавита. Кириллица — частая ошибка на русской или казахской раскладке. */
const LOOKALIKE: Record<string, string> = {
  O: "0",
  I: "1",
  L: "1",
  U: "V",
  // кириллица
  А: "A",
  В: "B",
  Е: "E",
  К: "K",
  М: "M",
  Н: "H",
  О: "0",
  Р: "P",
  С: "C",
  Т: "T",
  Х: "X",
  У: "Y",
  З: "3",
  Ч: "4",
  Б: "6",
};

/** Случайные байты по умолчанию — криптостойкие (браузер и Node 22). */
function cryptoBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/**
 * Новый код из 5 случайных байтов (40 бит = 8 знаков по 5 бит, без перекоса). Возвращает каноническую форму
 * без дефиса: «K7QF29XM». bytes — для тестов.
 */
export function generateFriendCode(bytes: (n: number) => Uint8Array = cryptoBytes): string {
  const b = bytes(5);
  if (b.length < 5) throw new Error("friend-code: need 5 random bytes");
  // 40 бит точно помещаются в число JS (< 2⁵³).
  let acc = 0;
  for (let k = 0; k < 5; k++) acc = acc * 256 + (b[k] & 0xff);
  let out = "";
  for (let k = FRIEND_CODE_LEN - 1; k >= 0; k--) out += FRIEND_CODE_ALPHABET[Math.floor(acc / 32 ** k) % 32];
  return out;
}

/** Для показа: «K7QF-29XM». */
export function formatFriendCode(code: string): string {
  return code.length === FRIEND_CODE_LEN ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/**
 * Разбор ввода ученика: верхний регистр, без пробелов, дефисов, точек и подчёркиваний, похожие знаки заменены.
 * Возвращает канонический код (8 знаков алфавита) или null.
 */
export function normalizeFriendCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 32) return null;
  let out = "";
  for (const ch of raw.normalize("NFKC").toUpperCase()) {
    if (/[\s\-_.·–—]/.test(ch) || /\p{Cf}/u.test(ch)) continue;
    const c = LOOKALIKE[ch] ?? ch;
    if (!FRIEND_CODE_ALPHABET.includes(c)) return null;
    out += c;
  }
  return out.length === FRIEND_CODE_LEN ? out : null;
}

/** Канонический ли код (как хранит сервер): ровно 8 знаков алфавита, без дефиса. */
export function isFriendCode(v: unknown): v is string {
  return typeof v === "string" && v.length === FRIEND_CODE_LEN && [...v].every((c) => FRIEND_CODE_ALPHABET.includes(c));
}
