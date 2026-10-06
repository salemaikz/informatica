import "server-only";
import { randomBytes } from "node:crypto";
import { generateFriendCode } from "@/lib/friend-code";
import { hasBlockedStem } from "@/server/moderation/check-name";

// Выдача кода друга на сервере. Формат, показ и разбор ввода — общие с клиентом (src/lib/friend-code.ts):
// 8 знаков base32 Крокфорда, «K7QF-29XM», хранится без дефиса: pl:code:{CODE} → pid. Здесь только выдача
// с проверкой стоп-корней (список — server-only): «код друга» видят дети.

export { FRIEND_CODE_ALPHABET, FRIEND_CODE_LEN, formatFriendCode, isFriendCode, normalizeFriendCode } from "@/lib/friend-code";

/** Новый случайный код без стоп-корней внутри (такой перевыпускается). rand — для тестов. */
export function newFriendCode(rand: (n: number) => Uint8Array = (n) => new Uint8Array(randomBytes(n))): string {
  for (;;) {
    const code = generateFriendCode(rand);
    if (!hasBlockedStem(code)) return code;
  }
}
