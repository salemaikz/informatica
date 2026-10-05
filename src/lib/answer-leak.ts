// Проверка кодом (#53, #100): не назвал ли ИИ верный ответ к ещё нерешённому заданию.
// Чистая логика без сервера и React: ею пользуются маршрут /api/ai/tutor и тесты.
// Ответы приходят с клиента (недоверенные данные) и служат только стоп-словами — в инструкцию модели они не превращаются.

/** Один ответ задания: запись или её допустимые формы (все варианты пропуска, «12.5» и «12,5»). */
export type Secret = string | string[];

const SUBSCRIPTS = /[₀-₉]/g;

/** Запись → слова: нижний регистр, ё → е, основание системы (1011₂, 1011(2), 1011_2) срезано, прочее — разделители. */
export function leakTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/(\d)\(\d{1,2}\)/g, "$1")
    .replace(/(\d)_\d{1,2}(?!\d)/g, "$1")
    .replace(SUBSCRIPTS, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean);
}

const LETTERS = /^\p{L}+$/u;

/** Слово из ответа и слово из текста — одно и то же (с учётом падежных окончаний: «двоичная» ~ «двоичной», «ввод» ~ «ввода»). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (!LETTERS.test(a) || !LETTERS.test(b)) return false;
  const min = Math.min(a.length, b.length);
  if (min < 4 || Math.abs(a.length - b.length) > 3) return false;
  let p = 0;
  while (p < min && a[p] === b[p]) p++;
  return p >= Math.max(4, min - 2);
}

function containsPhrase(text: string[], phrase: string[]): boolean {
  if (phrase.length === 0) return false;
  for (let i = 0; i + phrase.length <= text.length; i++) {
    let ok = true;
    for (let j = 0; j < phrase.length; j++) {
      if (!sameWord(text[i + j], phrase[j])) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/** Ответ достаточно «весомый», чтобы искать его в тексте: короче — слишком частое слово или цифра. */
function searchable(tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const compact = tokens.join("");
  if (tokens.length > 1) return compact.length >= 3;
  const [w] = tokens;
  if (/^\d+$/.test(w)) return w.length >= 2;
  if (LETTERS.test(w)) return w.length >= 4;
  return w.length >= 3;
}

/** Однозначная цифра-ответ («= 7», «ответ: 7»): ищем только рядом со словами-«ответами», иначе ловили бы нумерацию списка. */
function singleDigitHit(text: string, d: string): boolean {
  const t = text.toLowerCase().replace(/ё/g, "е");
  const re = new RegExp(`(?:=|→|ответ[^\\d\\n]{0,14}|жауап[^\\d\\n]{0,14}|получится|получаетс\\p{L}*|будет|равно|равен|итого)\\s*${d}(?!\\d)`, "u");
  return re.test(t);
}

/**
 * Назвал ли текст верный ответ. Совпадение — целыми «словами»: «10» не находится в «100» и «1010», «101» — в «1011₂».
 * Регистр, ё/е, нижние индексы и падежные окончания не мешают. Ответы короче 2 цифр / 4 букв (слишком частые слова)
 * не ищем; однозначную цифру — только после «=», «ответ», «получится».
 * Несколько ответов (пропуски «решаем вместе», несколько верных): утечка — когда названо больше половины
 * (для двух — оба): «ввод» в общем объяснении понятия — не ответ, а полный список пропусков — ответ.
 * `known` — текст, который ученик и так видит на экране (условие): слова из него утечкой не считаются.
 */
export function answerLeaks(text: string, answers: readonly Secret[], opts: { known?: string } = {}): boolean {
  if (!text.trim() || answers.length === 0) return false;
  const tt = leakTokens(text);
  const known = leakTokens(opts.known ?? "");
  let active = 0;
  let hits = 0;
  for (const secret of answers) {
    const forms = (Array.isArray(secret) ? secret : [secret]).map((f) => f.trim()).filter(Boolean);
    let counted = false;
    let hit = false;
    for (const form of forms) {
      let toks = leakTokens(form);
      // «1 011» → «1011»: числа с пробелами в ответе сравниваем слитно (как check.ts убирает пробелы).
      if (toks.length > 1 && /^[\d\s]+$/.test(form)) toks = [toks.join("")];
      const single = toks.length === 1 && /^\d$/.test(toks[0]);
      if (!single && !searchable(toks)) continue;
      if (!single && containsPhrase(known, toks)) continue; // ученик и так это видит
      counted = true;
      if (single ? singleDigitHit(text, toks[0]) : containsPhrase(tt, toks)) hit = true;
    }
    if (counted) active++;
    if (hit) hits++;
  }
  if (active === 0) return false;
  return active === 1 ? hits === 1 : hits > active / 2;
}

const MAX_SECRETS = 12;
const MAX_FORMS = 6;
const MAX_LEN = 120;

/** Укладывает ответы в потолки (число, формы, длина) и выбрасывает пустое. Сервер делает то же с присланным. */
export function clampSecrets(raw: unknown): string[][] {
  if (!Array.isArray(raw)) return [];
  const res: string[][] = [];
  for (const s of raw.slice(0, MAX_SECRETS)) {
    const forms = (Array.isArray(s) ? s : [s])
      .slice(0, MAX_FORMS)
      .map((f) => (typeof f === "string" ? f.trim().slice(0, MAX_LEN) : ""))
      .filter(Boolean);
    if (forms.length) res.push(forms);
  }
  return res;
}
