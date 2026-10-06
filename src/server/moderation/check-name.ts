import "server-only";
import { BLOCKLIST, type BlockEntry } from "@/server/moderation/blocklist";
import { baseForm, cyrStem, latStem, skeleton, type Skeleton } from "@/server/moderation/skeleton";

// Серверная проверка имени игрока (docs/specs/duels.md §7): формат → скелет → стоп-корни. Сервер проверяет всегда,
// даже если клиент уже проверил формат. Причину-слово ученику не называем: наружу уходит только код отказа.
//
// TODO(слияние с пакетом duel-core): формат — общий src/lib/moderation/name-format.ts (клиент и сервер). Пока его нет
// в этой ветке, ниже минимальная локальная проверка под тем же именем checkNameFormat и с тем же ответом; при слиянии
// заменить её импортом и удалить отсюда.

export type NameFail = "short" | "long" | "chars" | "script_mix" | "digits" | "contact" | "reserved" | "blocked";
export type NameCheck = { ok: true; name: string } | { ok: false; code: NameFail };

export const NAME_MIN = 2;
export const NAME_MAX = 16;
/** Сырой ввод длиннее — даже не разбираем. */
const RAW_MAX = 200;
const MAX_DIGITS = 4;

// ---------- формат (временная локальная копия) ----------

const LAT = /[a-z]/i;
const CYR = /[а-яёәғқңөұүһі]/i;
/** Разрешённые знаки: латиница, кириллица ru/kk, цифры, пробел и дефис. */
const ALLOWED = /^[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі0-9 -]+$/u;
/** Пробел или дефис — только по одному и только между словами. */
const SHAPE = /^[^ -]+(?:[ -][^ -]+)*$/u;

/** Контакты и площадки как отдельное слово (по нижнему регистру). */
const CONTACT_WORDS = new Set([
  "tg", "telegram", "inst", "insta", "instagram", "ig", "wa", "whatsapp", "vk", "tiktok", "tt", "youtube", "yt", "snap", "discord",
  "kz", "ru", "com", "org", "net", "http", "https", "www",
  "тг", "телеграм", "телега", "инст", "инста", "инстаграм", "вк", "вконтакте", "ватсап", "вотсап", "тикток", "ютуб", "дискорд",
  "тел", "телефон", "номер", "звони", "пиши",
]);

/** Служебные слова (по скелету слова): нельзя выдавать себя за бота, сервис или взрослого из школы. */
const RESERVED_CYR = new Set(
  ["бот", "бит", "админ", "администратор", "модератор", "поддержка", "учитель", "информатика", "система", "владелец", "оператор", "әкімші", "мұғалім"].map(cyrStem),
);
const RESERVED_LAT = new Set(["bot", "bit", "admin", "administrator", "moderator", "support", "informatica", "system", "owner", "teacher", "operator"].map(latStem));
/** «Игрок 4821» и подобное: служебное слово + цифры — подделка безымянного номера. */
const TAG_WORDS_CYR = new Set(["игрок", "ойыншы", "ученик", "оқушы"].map(cyrStem));
const TAG_WORDS_LAT = new Set(["player", "user", "guest"].map(latStem));

const graphemes = (s: string): number => {
  try {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)).length;
  } catch {
    return Array.from(s).length;
  }
};

/** Формат имени: 2–16 графем, одна письменность в слове, ≤ 4 цифр, без контактов и служебных слов. */
export function checkNameFormat(raw: unknown): NameCheck {
  if (typeof raw !== "string") return { ok: false, code: "short" };
  if (raw.length > RAW_MAX) return { ok: false, code: "long" };
  const name = raw.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (name.length === 0) return { ok: false, code: "short" };
  // Невидимые, комбинирующие, эмодзи, знаки препинания — всё, чего нет в разрешённом наборе.
  if (!ALLOWED.test(name) || !SHAPE.test(name)) return { ok: false, code: "chars" };
  const len = graphemes(name);
  if (len < NAME_MIN) return { ok: false, code: "short" };
  if (len > NAME_MAX) return { ok: false, code: "long" };
  const letters = Array.from(name).filter((c) => LAT.test(c) || CYR.test(c)).length;
  if (letters < 2) return { ok: false, code: "short" };
  if ((name.match(/\d/g) ?? []).length > MAX_DIGITS) return { ok: false, code: "digits" };
  const words = name.toLowerCase().split(/[ -]/u);
  if (words.some((w) => LAT.test(w) && CYR.test(w))) return { ok: false, code: "script_mix" };
  if (words.some((w) => CONTACT_WORDS.has(w)) || words.some((w, i) => w === "t" && words[i + 1] === "me")) return { ok: false, code: "contact" };
  const hasDigit = /\d/.test(name);
  for (const w of words) {
    const word = w.replace(/\d+/g, "");
    const c = cyrStem(word);
    const l = latStem(word);
    if (RESERVED_CYR.has(c) || RESERVED_LAT.has(l)) return { ok: false, code: "reserved" };
    if (hasDigit && (TAG_WORDS_CYR.has(c) || TAG_WORDS_LAT.has(l))) return { ok: false, code: "reserved" };
  }
  return { ok: true, name };
}

// ---------- стоп-корни ----------

interface Compiled {
  stem: string;
  mode: BlockEntry["mode"];
  /** Корень в кириллице — сравниваем с кириллическим скелетом, иначе с латинским. */
  cyr: boolean;
}

const COMPILED: Compiled[] = BLOCKLIST.map((e) => {
  const cyr = CYR.test(e.stem);
  return { stem: cyr ? cyrStem(e.stem) : latStem(e.stem), mode: e.mode, cyr };
});

function hit(c: Compiled, sk: Skeleton): boolean {
  const words = c.cyr ? sk.cyr : sk.lat;
  switch (c.mode) {
    case "any":
      return words.some((w) => w.includes(c.stem)) || sk.squashed.some((s) => s.includes(c.stem));
    case "start":
      return words.some((w) => w.startsWith(c.stem));
    case "word":
      return words.some((w) => w === c.stem);
  }
}

/** В строке есть стоп-корень (по скелету). Без проверки формата — годится и для кодов друзей. */
export function hasBlockedStem(raw: string): boolean {
  if (baseForm(raw).length === 0) return false;
  const sk = skeleton(raw);
  return COMPILED.some((c) => hit(c, sk));
}

/** Полная серверная проверка имени: формат → стоп-корни. */
export function checkName(raw: unknown): NameCheck {
  const f = checkNameFormat(raw);
  if (!f.ok) return f;
  if (hasBlockedStem(f.name)) return { ok: false, code: "blocked" };
  return f;
}
