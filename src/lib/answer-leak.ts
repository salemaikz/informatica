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

/** Разделитель «предмет ~ ответ» в записи ответа: ответ назван, если он стоит рядом с предметом (см. pairHit). */
export const PAIR_SEP = " ~ ";
/** Насколько близко (в словах) предмет и ответ, чтобы считать их связкой «предмет — ответ». */
const PAIR_WINDOW = 5;

/** Где фраза встречается в тексте: индексы первых слов. */
function occurrences(text: string[], phrase: string[]): number[] {
  const res: number[] = [];
  if (phrase.length === 0) return res;
  for (let i = 0; i + phrase.length <= text.length; i++) {
    if (phrase.every((w, j) => sameWord(text[i + j], w))) res.push(i);
  }
  return res;
}

/** Разбор записи «предмет1|предмет2 ~ ответ»; null — запись не связка. */
function parsePair(form: string): { subjects: string[][]; answer: string[] } | null {
  const at = form.indexOf(PAIR_SEP);
  if (at < 0) return null;
  const subjects = form
    .slice(0, at)
    .split("|")
    .map(leakTokens)
    .filter((t) => t.length > 0);
  const answer = leakTokens(form.slice(at + PAIR_SEP.length));
  return subjects.length && answer.length ? { subjects, answer } : null;
}

/** Предмет и ответ стоят рядом в одном предложении или пункте списка («Клавиатура — ввод», «клавиатура — это устройство ввода»). */
function pairHit(text: string, pair: { subjects: string[][]; answer: string[] }): boolean {
  for (const seg of text.split(/[\n!?;]+|\.(?!\d)/)) {
    const t = leakTokens(seg);
    const answers = occurrences(t, pair.answer);
    if (answers.length === 0) continue;
    for (const subj of pair.subjects) {
      for (const s of occurrences(t, subj)) {
        for (const a of answers) {
          const gap = s < a ? a - (s + subj.length) : s - (a + pair.answer.length);
          if (gap >= 0 && gap <= PAIR_WINDOW) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Слова условия, рядом с которыми модель назовёт ответ, если его слово есть и в самом условии (сканер, картинка, …).
 * Слова, стоящие в условии вплотную к ответу («устройство ввода»), не берём: так модель пересказывает сам вопрос.
 */
export function contextWords(prompt: string, answer: string, max = 8): string[] {
  const toks = leakTokens(prompt);
  const ans = leakTokens(answer);
  const near = new Set<number>();
  for (const at of occurrences(toks, ans)) {
    for (let i = at - PAIR_WINDOW; i < at + ans.length + PAIR_WINDOW; i++) near.add(i);
  }
  const res: string[] = [];
  toks.forEach((w, i) => {
    if (near.has(i) || !/^\p{L}{5,}$/u.test(w) || res.includes(w)) return;
    if (ans.some((a) => sameWord(a, w))) return;
    res.push(w);
  });
  return res.slice(0, max);
}

/** Запись ответа целиком видна в условии задания (ученик и так её видит). */
export function formKnown(form: string, known: string): boolean {
  const toks = leakTokens(form);
  return toks.length > 0 && containsPhrase(leakTokens(known), toks);
}

/**
 * Назвал ли текст верный ответ. Совпадение — целыми «словами»: «10» не находится в «100» и «1010», «101» — в «1011₂».
 * Регистр, ё/е, нижние индексы и падежные окончания не мешают. Ответы короче 2 цифр / 4 букв (слишком частые слова)
 * не ищем; однозначную цифру — только после «=», «ответ», «получится».
 * Запись вида «предмет ~ ответ» (PAIR_SEP; предметы можно перечислить через «|») — связка: ответ назван, когда он стоит
 * рядом с предметом в одном предложении. Так ловим ответ, слово которого есть и в условии («Клавиатура — ввод»).
 * Секрет — один «ответ» с допустимыми записями: утечка, если названа любая активная запись. Несколько секретов (пропуски
 * «решаем вместе»): утечка — когда названо больше половины (для двух — оба): «ввод» в общем объяснении понятия — не ответ,
 * а полный список пропусков — ответ. Верные варианты choice / multi идут одним секретом: названа любая запись — утечка.
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
      const pair = parsePair(form);
      if (pair) {
        if (!searchable(pair.answer) || pair.subjects.every((s) => s.join("").length < 3)) continue;
        counted = true;
        if (pairHit(text, pair)) hit = true;
        continue;
      }
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
const MAX_FORMS = 8;
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
