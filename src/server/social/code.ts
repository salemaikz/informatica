import "server-only";
import { randomBytes } from "node:crypto";
import { hasBlockedStem } from "@/server/moderation/check-name";

// Код друга: 8 знаков из алфавита без похожих символов (без 0/O, 1/I/L и U), показывается как «K7QF-29XM»
// (docs/specs/duels.md §1: 4 знака перебор находит быстро; 30⁸ ≈ 6,6·10¹¹). Хранится без дефиса: pl:code:{CODE} → pid.
// TODO(слияние с пакетом duel-core): там общий src/lib/friend-code.ts (формат и разбор для клиента) — здесь временная
// серверная копия; при слиянии оставить отсюда только выдачу (newFriendCode), формат и разбор брать оттуда.

export const FRIEND_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const FRIEND_CODE_LEN = 8;
const CODE_RE = new RegExp(`^[${FRIEND_CODE_ALPHABET}]{${FRIEND_CODE_LEN}}$`);
/** Байты ≥ этого порога отбрасываются: 256 не делится на 30, иначе первые знаки алфавита выпадали бы чаще. */
const UNBIASED = 256 - (256 % FRIEND_CODE_ALPHABET.length);

/** Новый случайный код (без смещения по алфавиту и без стоп-корней внутри: «код друга» видят дети). */
export function newFriendCode(rand: (n: number) => Uint8Array = randomBytes): string {
  for (;;) {
    let out = "";
    while (out.length < FRIEND_CODE_LEN) {
      for (const b of rand(16)) {
        if (b >= UNBIASED) continue;
        out += FRIEND_CODE_ALPHABET[b % FRIEND_CODE_ALPHABET.length];
        if (out.length === FRIEND_CODE_LEN) break;
      }
    }
    if (!hasBlockedStem(out)) return out;
  }
}

/** Ввод ученика → код в хранимом виде (без дефиса, заглавные) или null. Похожие знаки (O→0 и т. п.) не угадываем. */
export function normalizeFriendCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 32) return null;
  const s = raw.toUpperCase().replace(/[\s-]/g, "");
  return CODE_RE.test(s) ? s : null;
}

/** «K7QF29XM» → «K7QF-29XM». */
export function formatFriendCode(code: string): string {
  return code.length === FRIEND_CODE_LEN ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
