import { hasSkeletonWord, skeleton, skeletonSet } from "./skeleton";

// Формат имени игрока (docs/specs/duels.md §7, 3-safety.md §2): общий для клиента (мгновенная подсказка) и сервера.
// Без списка грубых слов — он только на сервере (src/server/moderation/blocklist.ts), сервер всегда проверяет заново.
// Причину-слово ученику не называем: интерфейс показывает общий текст по коду.

export type NameFail = "short" | "long" | "chars" | "script_mix" | "digits" | "contact" | "reserved" | "blocked";

export type NameCheck = { ok: true; name: string } | { ok: false; code: NameFail };

export const NAME_MIN = 2;
export const NAME_MAX = 16;
export const NAME_MAX_DIGITS = 4;

/** Разрешённые знаки (после нижнего регистра): латиница, русская и казахская кириллица, цифры, пробел, дефис. */
const ALLOWED = /^[a-zа-яёәғқңөұүһі0-9 -]+$/u;
const LATIN = /[a-z]/;
const CYRILLIC = /[а-яёәғқңөұүһі]/;
const LETTER = /[a-zа-яёәғқңөұүһі]/g;

/** Ссылки, почта, ники мессенджеров. */
const CONTACT_RAW = /@|https?|www|:\/\/|t\.me|\.(com|kz|ru|org|net|me|io|su|uz)\b/i;
/** Телефон: «+7…» или длинная цепочка цифр с разделителями. */
const PHONE = /\+\s*\d|\d(?:[\s().-]*\d){6,}/;

/** Слова-контакты целиком (по скелету): tg, inst, wa, vk, tiktok, домены, «тел», «номер»; «t me» — парой слов. */
const CONTACT_LAT = skeletonSet(["tme", "tg", "inst", "insta", "instagram", "wa", "whatsapp", "vk", "tiktok", "telegram", "snap", "kz", "ru", "com", "tel"], "lat");
const CONTACT_CYR = skeletonSet(["тг", "инст", "инста", "инстаграм", "ватсап", "вотсап", "вк", "тикток", "телеграм", "тел", "номер", "нөмір"], "cyr");

/** Зарезервированные слова (по скелету): бот, бит, админ, поддержка, информатика, учитель… */
const RESERVED_CYR = skeletonSet(
  ["бот", "бит", "админ", "администратор", "модератор", "поддержка", "информатика", "учитель", "әкімші", "қолдау", "мұғалім", "жүйе"],
  "cyr",
);
const RESERVED_LAT = skeletonSet(["bot", "bit", "admin", "administrator", "moderator", "support", "informatica", "system", "owner", "teacher"], "lat");
/** «Игрок 4821» и подобные — так подписаны игроки без имени. */
const PLAYER_TAG = /^(игрок|ойыншы|оқушы|ученик|player|gamer|user)[\s-]*\d+$/u;

/** NFC, пробелы схлопнуты, без пробелов по краям и вокруг дефиса. */
export function cleanName(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/ ?- ?/g, "-");
}

/** Число графем (как видит человек). */
export function graphemeCount(s: string): number {
  const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) return Array.from(new Seg(undefined, { granularity: "grapheme" }).segment(s)).length;
  return Array.from(s).length;
}

/** Два соседних слова вместе дают pair («t me»). */
function hasPair(words: readonly string[], pair: string): boolean {
  for (let k = 0; k + 1 < words.length; k++) if (words[k] + words[k + 1] === pair) return true;
  return false;
}

/** Проверка формата имени. ok → name — очищенное имя для сохранения и показа. */
export function checkNameFormat(raw: unknown): NameCheck {
  if (typeof raw !== "string") return { ok: false, code: "short" };
  if (raw.length > 200) return { ok: false, code: "long" };
  const name = cleanName(raw);
  if (!name) return { ok: false, code: "short" };
  const lower = name.toLowerCase();

  if (CONTACT_RAW.test(lower) || PHONE.test(lower)) return { ok: false, code: "contact" };
  if (!ALLOWED.test(lower) || /--/.test(lower) || /^-|-$/.test(lower)) return { ok: false, code: "chars" };

  const n = graphemeCount(name);
  if (n < NAME_MIN || (lower.match(LETTER)?.length ?? 0) < 2) return { ok: false, code: "short" };
  if (n > NAME_MAX) return { ok: false, code: "long" };
  if ((lower.match(/\d/g)?.length ?? 0) > NAME_MAX_DIGITS) return { ok: false, code: "digits" };

  // В одном слове — одна письменность: «Сaша» с латинской «a» — подмена.
  for (const word of lower.split(/[ -]/)) {
    if (LATIN.test(word) && CYRILLIC.test(word)) return { ok: false, code: "script_mix" };
  }

  // Латинские корни сверяем только со словами без кириллицы: иначе «Вит» по латинскому скелету стал бы «bit».
  const latWords = lower.split(/[ -]/).filter((w) => LATIN.test(w) || !CYRILLIC.test(w));
  const skAll = skeleton(name);
  const skLat = skeleton(latWords.join(" "));
  if (hasSkeletonWord(skAll, CONTACT_CYR, "cyr") || hasSkeletonWord(skLat, CONTACT_LAT, "lat") || hasPair(skLat.lat.words, "tme")) {
    return { ok: false, code: "contact" };
  }
  if (PLAYER_TAG.test(lower) || hasSkeletonWord(skAll, RESERVED_CYR, "cyr") || hasSkeletonWord(skLat, RESERVED_LAT, "lat")) {
    return { ok: false, code: "reserved" };
  }
  return { ok: true, name };
}
