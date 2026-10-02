// Казахские падежные окончания после чисел: «25-ті», «40-ты», «6-дан».
// Окончание зависит от последнего слова числительного (25 = жиырма бес → «бес»), а не от цифры:
// сингармонизм (твёрдые/мягкие гласные) и ассимиляция (глухие/звонкие/сонорные/гласные).

export type KkCase = "acc" | "dat" | "loc" | "abl" | "gen" | "ins";

const BACK_VOWELS = "аоұы";
const FRONT_VOWELS = "әөүіеи";
// б, в, г, д на конце слова оглушаются (миллиард → миллиардқа, миллиардты) — идут с глухими.
const VOICELESS = "қкпстшчфхһцщбвгд";
const NASAL = "мнң";
const SONORANT = "лрйу";

type Ending = "vowel" | "voiceless" | "nasal" | "sonorant" | "voiced";

/** Слово последнего разряда числа: 25 → «бес», 40 → «қырық», 1000 → «мың». */
export function kkLastWord(n: number | string): string {
  const raw = typeof n === "string" ? n.trim().replace(/^[−-]/, "") : String(Math.abs(n));
  if (!/^\d+$/.test(raw)) throw new Error(`kkSuffix: ожидалось целое число, получено «${String(n)}»`);
  const digits = raw.replace(/^0+(?=\d)/, "");
  if (digits === "0") return "нөл";
  const trailingZeros = digits.length - digits.replace(/0+$/, "").length;
  // Круглые тысячи, миллионы, миллиарды — последнее слово «мың / миллион / миллиард».
  if (trailingZeros >= 9) return "миллиард";
  if (trailingZeros >= 6) return "миллион";
  if (trailingZeros >= 3) return "мың";
  const last = digits.slice(-3).padStart(3, "0");
  const ones = Number(last[2]);
  const tens = Number(last[1]);
  const hundreds = Number(last[0]);
  if (ones) return ["", "бір", "екі", "үш", "төрт", "бес", "алты", "жеті", "сегіз", "тоғыз"][ones];
  if (tens) return ["", "он", "жиырма", "отыз", "қырық", "елу", "алпыс", "жетпіс", "сексен", "тоқсан"][tens];
  if (hundreds) return "жүз";
  return "нөл";
}

/** Твёрдое слово или мягкое — по последней гласной. */
function isBack(word: string): boolean {
  for (let i = word.length - 1; i >= 0; i--) {
    const c = word[i];
    if (BACK_VOWELS.includes(c)) return true;
    if (FRONT_VOWELS.includes(c)) return false;
  }
  return true;
}

function endingOf(word: string): Ending {
  const c = word[word.length - 1];
  if (VOICELESS.includes(c)) return "voiceless";
  if (NASAL.includes(c)) return "nasal";
  if (SONORANT.includes(c)) return "sonorant";
  if (BACK_VOWELS.includes(c) || FRONT_VOWELS.includes(c)) return "vowel";
  return "voiced";
}

/** Окончание (без числа и дефиса) для слова и падежа. */
export function kkEnding(word: string, kase: KkCase): string {
  const back = isBack(word);
  const end = endingOf(word);
  const pick = (a: string, e: string) => (back ? a : e);
  switch (kase) {
    case "acc":
      if (end === "vowel") return pick("ны", "ні");
      if (end === "voiceless") return pick("ты", "ті");
      return pick("ды", "ді");
    case "gen":
      if (end === "vowel" || end === "nasal") return pick("ның", "нің");
      if (end === "voiceless") return pick("тың", "тің");
      return pick("дың", "дің");
    case "dat":
      return end === "voiceless" ? pick("қа", "ке") : pick("ға", "ге");
    case "loc":
      return end === "voiceless" ? pick("та", "те") : pick("да", "де");
    case "abl":
      if (end === "voiceless") return pick("тан", "тен");
      if (end === "nasal") return pick("нан", "нен");
      return pick("дан", "ден");
    case "ins":
      // -мен/-бен/-пен не меняются по сингармонизму.
      if (end === "voiceless") return "пен";
      if (end === "voiced") return "бен";
      return "мен";
  }
}

/**
 * Число с падежным окончанием: kkSuffix(25, "acc") → «25-ті», kkSuffix(6, "abl") → «6-дан».
 * Падежи: acc — табыс (-ты/-ді…), dat — барыс (-ға/-ке…), loc — жатыс (-да/-те…),
 * abl — шығыс (-дан/-тен…), gen — ілік (-ның/-тің…), ins — көмектес (-мен/-бен/-пен).
 */
export function kkSuffix(n: number | string, kase: KkCase): string {
  const shown = typeof n === "string" ? n.trim() : String(n);
  return `${shown}-${kkEnding(kkLastWord(n), kase)}`;
}
