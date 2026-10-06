// «Скелет» строки для проверки имён (3-safety.md §2): один и тот же для имени ученика и для корней списка на сервере.
// Ловит l33t (б0т, 6от), похожие латинские и кириллические буквы, разделители (б.о.т, б-о-т, б о т), невидимые знаки
// и повторы (бооот). Списка слов здесь нет: он только на сервере (src/server/moderation/blocklist.ts), чтобы не попасть
// в JS-бандл детей.

export interface SkeletonForm {
  /** Слова по разделителям. */
  words: string[];
  /** Всё вместе, без разделителей. */
  squashed: string;
}

export interface Skeleton extends SkeletonForm {
  /** Кириллический скелет (= words/squashed): латиница и l33t → кириллица, казахские буквы → русские. */
  cyr: SkeletonForm;
  /** Латинский скелет для английских корней: кириллические двойники и l33t → латиница. */
  lat: SkeletonForm;
  /** Те же формы со схлопнутыми повторами букв («бооот» → «бот»). */
  cyrDedup: SkeletonForm;
  latDedup: SkeletonForm;
}

/** Казахские буквы → ближайшие русские (для сравнения, как в safety.ts). */
const KK_TO_RU: Record<string, string> = { ә: "а", ғ: "г", қ: "к", ң: "н", ө: "о", ұ: "у", ү: "у", һ: "х", і: "и" };

/** Латиница и l33t → кириллица. */
const TO_CYR: Record<string, string> = {
  a: "а",
  e: "е",
  o: "о",
  p: "р",
  c: "с",
  x: "х",
  y: "у",
  k: "к",
  m: "м",
  t: "т",
  h: "н",
  b: "в",
  "3": "з",
  "0": "о",
  "4": "ч",
  "6": "б",
  "@": "а",
  $: "с",
  "1": "и",
  "!": "и",
  "|": "и",
};

/** Кириллические двойники и l33t → латиница. */
const TO_LAT: Record<string, string> = {
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  х: "x",
  у: "y",
  к: "k",
  м: "m",
  т: "t",
  н: "h",
  в: "b",
  и: "i",
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "l",
};

/** Невидимые и управляющие знаки: zero-width, мягкий перенос, RTL-метки, BOM. */
const INVISIBLE = /[\p{Cf}\p{Cc}͏ᅟᅠㅤﾠ]/gu;

/** NFKC, нижний регистр, без невидимых и диакритики (й → и, ё → е), казахские → русские. */
export function baseNormalize(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(INVISIBLE, "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .normalize("NFC")
    .replace(/[әғқңөұүһі]/g, (c) => KK_TO_RU[c] ?? c);
}

function form(mapped: string): SkeletonForm {
  const words = mapped.split(/[^\p{L}]+/u).filter(Boolean);
  return { words, squashed: words.join("") };
}

const dedup = (s: string) => s.replace(/(\p{L})\1+/gu, "$1");

function dedupForm(f: SkeletonForm): SkeletonForm {
  const words = f.words.map(dedup);
  return { words, squashed: dedup(f.squashed) };
}

/** Скелет строки во всех формах. */
export function skeleton(s: string): Skeleton {
  const base = baseNormalize(typeof s === "string" ? s.slice(0, 256) : "");
  const cyr = form([...base].map((c) => TO_CYR[c] ?? c).join(""));
  const lat = form([...base].map((c) => TO_LAT[c] ?? c).join(""));
  return { ...cyr, cyr, lat, cyrDedup: dedupForm(cyr), latDedup: dedupForm(lat) };
}

/** Все формы скелета (для перебора корней на сервере). */
export function skeletonForms(sk: Skeleton): SkeletonForm[] {
  return [sk.cyr, sk.cyrDedup, sk.lat, sk.latDedup];
}

/** Формы одной письменности: кириллический скелет (для русских и казахских корней) или латинский (английских). */
export function scriptForms(sk: Skeleton, script: "cyr" | "lat"): SkeletonForm[] {
  return script === "cyr" ? [sk.cyr, sk.cyrDedup] : [sk.lat, sk.latDedup];
}

/**
 * Набор корней в форме скелета: каждое слово прогоняется через skeleton() той же письменности (с повторами и без).
 * Так «поддержка» совпадёт и с «поддержка», и с «поддддержка».
 */
export function skeletonSet(words: readonly string[], script: "cyr" | "lat"): Set<string> {
  const out = new Set<string>();
  for (const w of words) for (const f of scriptForms(skeleton(w), script)) if (f.squashed) out.add(f.squashed);
  return out;
}

/** Есть ли в строке слово (или вся строка без разделителей), совпадающее со скелетом из набора. */
export function hasSkeletonWord(sk: Skeleton, set: ReadonlySet<string>, script: "cyr" | "lat"): boolean {
  return scriptForms(sk, script).some((f) => f.words.some((w) => set.has(w)) || set.has(f.squashed));
}
