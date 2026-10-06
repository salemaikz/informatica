import "server-only";

// «Скелет» строки для сравнения со стоп-корнями (docs/specs/duels-design/3-safety.md §2): против l33t, двойников
// латиница/кириллица, казахских букв вместо русских, повторов, разделителей и невидимых символов.
// TODO(слияние с пакетом duel-core): там общий src/lib/moderation/skeleton.ts — свести к одному модулю.
//
// Два скелета каждого слова:
// - кириллический (для корней ru/kk): латинские двойники → кириллица (c→с, y→у, x→х …), цифры l33t (0→о, 3→з, 4→ч, 6→б),
//   казахские буквы → русские (ә→а, қ→к, ұ/ү→у, і→и …), й→и, ё→е, ъ/ь выбрасываются;
// - латинский (для корней en и транслита): кириллические двойники → латиница (а→a, с→c, р→p …), l33t (0→o, 1→i, 3→e, 4→a, 5→s, 7→t).

/** Невидимые и управляющие знаки (zero-width, RTL, мягкий перенос, вариационные селекторы). */
const INVISIBLE = /[\p{Cc}\p{Cf}\u00AD\u034F\u115F\u1160\u17B4\u17B5\u180E\u2000-\u200F\u2028-\u202F\u205F-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0]/gu;

const TO_CYR: Record<string, string> = {
  // латинские двойники
  // (i → и: «Xyi» = «хуи»; u → у нет: «Xue», «Xurshid» и узбекская латиница дали бы ложные срабатывания)
  a: "а", b: "в", c: "с", e: "е", h: "н", i: "и", k: "к", m: "м", o: "о", p: "р", t: "т", x: "х", y: "у",
  // l33t
  "0": "о", "3": "з", "4": "ч", "6": "б", "1": "и", "!": "и", "|": "и", "@": "а", $: "с",
  // казахские буквы → ближайшие русские
  ә: "а", ғ: "г", қ: "к", ң: "н", ө: "о", ұ: "у", ү: "у", һ: "х", і: "и",
  // й и ё уже сведены к и/е снятием диакритики; твёрдый и мягкий знак не значат для корня
  ъ: "", ь: "",
};

const TO_LAT: Record<string, string> = {
  // кириллические двойники
  а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x", і: "i",
  // l33t
  "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", $: "s",
};

/** NFKC, нижний регистр, без невидимых знаков и диакритики (й→и, ё→е, é→e). Казахские буквы без диакритики остаются. */
export function baseForm(raw: string): string {
  return raw.normalize("NFKC").toLowerCase().replace(INVISIBLE, "").normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
}

const mapChars = (s: string, table: Record<string, string>) => Array.from(s, (ch) => table[ch] ?? ch).join("");

/** Схлопнуть повторы букв: «хууууй» → «хуй», «assss» → «as». */
export const collapseRepeats = (s: string): string => s.replace(/(.)\1+/gu, "$1");

/** Слова: всё, что не буква и не цифра, — разделитель. */
const words = (s: string): string[] => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

export interface Skeleton {
  /** Варианты слов для корней ru/kk (кириллица): каждое слово как есть и со схлопнутыми повторами, плюс склейки коротких кусков. */
  cyr: string[];
  /** То же для корней en и транслита (латиница). */
  lat: string[];
  /**
   * Склейки соседних слов через «короткий шов» (оба скелета, с повторами и без): ловит «х у й», «х-у-й», «ху йло».
   * Два обычных слова (оба ≥ 3 знаков) НЕ склеиваются: «Alex Yerlanov» (→ «…х уе…»), «Ade Bilal» (→ «…debil…»),
   * «Marko Takhirov» (→ «…kotak…») — иначе стоп-корень находился бы на стыке имени и фамилии.
   */
  squashed: string[];
}

/** Склейки подряд идущих коротких кусков (≤ 2 знаков): «с у к а» → «сука», «су ка» → «сука». */
function shortRuns(ws: string[]): string[] {
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 2) out.push(run.join(""));
    run = [];
  };
  for (const w of ws) {
    if (Array.from(w).length <= 2) run.push(w);
    else flush();
  }
  flush();
  return out;
}

/**
 * Цепочки соседних слов, где каждый шов касается короткого куска (≤ 2 знаков): «х у й» → «хуй», «ху йло» → «хуйло».
 * Отдельные слова не возвращаются (они уже в cyr/lat), только склейки из ≥ 2 кусков.
 */
function shortSeamChains(ws: string[]): string[] {
  const out: string[] = [];
  const short = (w: string) => Array.from(w).length <= 2;
  let chain: string[] = [];
  const flush = () => {
    if (chain.length >= 2) out.push(chain.join(""));
    chain = [];
  };
  for (const w of ws) {
    const prev = chain[chain.length - 1];
    if (prev !== undefined && !(short(prev) || short(w))) flush();
    chain.push(w);
  }
  flush();
  return out;
}

function variants(ws: string[]): string[] {
  const all = [...ws, ...shortRuns(ws)];
  return [...new Set(all.flatMap((w) => [w, collapseRepeats(w)]))];
}

/**
 * Скелет строки. Символы-заменители (@, $, !, |) переводятся ДО разбиения на слова — иначе «х@й» распался бы на «х» и «й».
 */
export function skeleton(raw: string): Skeleton {
  const base = baseForm(raw);
  const cyrWords = words(mapChars(base, TO_CYR));
  const latWords = words(mapChars(base, TO_LAT));
  const squashed = [...shortSeamChains(cyrWords), ...shortSeamChains(latWords)];
  return {
    cyr: variants(cyrWords),
    lat: variants(latWords),
    squashed: [...new Set(squashed.flatMap((s) => [s, collapseRepeats(s)]))].filter(Boolean),
  };
}

/** Кириллический скелет одного корня (корни в списке пишем как удобно, сравниваем — в скелете). */
export const cyrStem = (s: string): string => mapChars(baseForm(s), TO_CYR);
/** Латинский скелет одного корня. */
export const latStem = (s: string): string => mapChars(baseForm(s), TO_LAT);
