// Клиентский поиск: по урокам, теории, конспектам, навыкам, темам ЕНТ и записям ученика.
// Чистая логика без React. Индекс строится для одного языка; тексты нормализуются заранее,
// поиск идёт по инвертированному индексу «слово → документы» (без регулярных выражений в цикле).

import type { EntTopicId, Lang, Lesson, Skill, Unit, L } from "./types";

export type SearchKind = "lesson" | "theory" | "conspect" | "skill" | "topic" | "note";

export interface SearchDoc {
  id: string;
  kind: SearchKind;
  title: string;
  text: string;
  href: string;
  lessonId?: string;
  unitId?: string;
}

export interface SearchResult {
  doc: SearchDoc;
  score: number;
  snippet: { text: string; ranges: [number, number][] };
}

// ---------- Нормализация ----------

/** «Мягкие» пары: ученик пишет казахский без казахской раскладки (қ → к, ү → у …). */
const SOFT: Record<string, string> = {
  і: "и",
  ү: "у",
  ұ: "у",
  қ: "к",
  ғ: "г",
  ң: "н",
  ө: "о",
  ә: "а",
  һ: "х",
};

/** Убирает markdown-символы и схлопывает пробелы; регистр и буквы не трогает. Длина «до/после» не гарантируется. */
function clean(s: string): string {
  return s.replace(/[*_#>`]/g, "").replace(/\s+/g, " ").trim();
}

/** Побуквенное приведение: нижний регистр, ё → е. Длина строки сохраняется (для позиций в сниппете). */
function foldChars(s: string, soft: boolean): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    let c = s.charAt(i).toLowerCase();
    if (c.length !== 1) c = c.charAt(0);
    if (c === "ё") c = "е";
    else if (soft) c = SOFT[c] ?? c;
    out += c;
  }
  return out;
}

/** Нижний регистр, ё → е, без markdown-символов `*_#>\``, пробелы схлопнуты. Казахские буквы остаются. */
export function normalize(s: string): string {
  return foldChars(clean(String(s ?? "").normalize("NFC")), false);
}

/** normalize + «мягкое» совпадение казахских букв с русскими (қ → к, і → и …) — для сравнения. */
export function fold(s: string): string {
  return foldChars(clean(String(s ?? "").normalize("NFC")), true);
}

/** Заглушка на месте `кода` (символ из области частного использования — не буква и не цифра). */
const CODE_MARK = "\uE000";

/** Строчная разметка вне кода: картинки, ссылки, маркер ==…==, выделение **…**, *…*, _…_, ~~…~~, экранирование. */
function inlinePlain(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/==(\{[a-z]+\})?/g, "")
    .replace(/(^|[^\p{L}\p{N}])(\*\*|__|~~)(?=\S)(.+?)(?<=\S)\2(?![\p{L}\p{N}])/gu, "$1$3")
    .replace(/(^|[^\p{L}\p{N}*])\*(?=\S)(.+?)(?<=\S)\*(?![\p{L}\p{N}*])/gu, "$1$2")
    .replace(/(^|[^\p{L}\p{N}_])_(?=\S)(.+?)(?<=\S)_(?![\p{L}\p{N}_])/gu, "$1$2")
    .replace(/\\([\\`*_{}[\]()#+\-.!>~=|])/g, "$1")
    .replace(/`/g, "");
}

/**
 * Markdown → текст для сниппета и индекса. В отличие от normalize, НЕ трогает `*`, `>`, `_`, `#`
 * в коде и в обычном тексте (`'ab' * 3`, `x > 5`, `is_even` остаются как есть) —
 * убирается только разметка: ограды кода, заголовки, цитаты, маркеры списков и чек-листов, выделение.
 */
function plainText(md: string): string {
  const lines: string[] = [];
  let fence = false;
  for (const raw of String(md ?? "").normalize("NFC").replace(/\uE000/g, "").split("\n")) {
    if (/^\s*(```|~~~)/.test(raw)) {
      fence = !fence;
      continue;
    }
    if (fence) {
      lines.push(raw);
      continue;
    }
    const line = raw.replace(/^\s*(?:#{1,6}\s+|(?:>\s?)+|[-*+]\s+(?:\[[ xX]\]\s*)?)/, "");
    // Внутри `кода` разметку не трогаем: прячем код за символом-заглушкой, снимаем разметку, возвращаем код.
    const code: string[] = [];
    const masked = line.replace(/`([^`]*)`/g, (_, c: string) => (code.push(c), CODE_MARK));
    let k = 0;
    lines.push(inlinePlain(masked).replace(/\uE000/g, () => code[k++] ?? ""));
  }
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

const WORD_RE = /[\p{L}\p{N}]+/gu;

// ---------- Индекс ----------

interface Word {
  w: string;
  start: number;
  end: number;
}

interface IndexedDoc {
  doc: SearchDoc;
  /** Очищенный текст для сниппета (регистр сохранён, позиции совпадают со словами). */
  display: string;
  textWords: Word[];
  titleLen: number;
}

interface Posting {
  d: number;
  title: boolean;
  text: boolean;
}

export interface SearchIndex {
  docs: IndexedDoc[];
  /** Отсортированный список уникальных слов (для поиска по префиксу бинарным поиском). */
  words: string[];
  postings: Map<string, Posting[]>;
}

function splitWords(folded: string): Word[] {
  const out: Word[] = [];
  for (const m of folded.matchAll(WORD_RE)) out.push({ w: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

export function buildIndex(docs: SearchDoc[]): SearchIndex {
  const indexed: IndexedDoc[] = [];
  const postings = new Map<string, Posting[]>();
  const touch = (word: string, d: number, field: "title" | "text") => {
    let list = postings.get(word);
    if (!list) postings.set(word, (list = []));
    let p = list[list.length - 1];
    // Документы добавляются по возрастанию d — достаточно проверить последний элемент.
    if (!p || p.d !== d) list.push((p = { d, title: false, text: false }));
    p[field] = true;
  };
  docs.forEach((doc, d) => {
    // Данные могут прийти из localStorage (записи ученика) — не доверяем типам.
    const display = plainText(doc.text);
    const textWords = splitWords(foldChars(display, true));
    const titleWords = splitWords(foldChars(plainText(doc.title), true));
    for (const w of titleWords) touch(w.w, d, "title");
    for (const w of textWords) touch(w.w, d, "text");
    indexed.push({ doc, display, textWords, titleLen: titleWords.length });
  });
  return { docs: indexed, words: [...postings.keys()].sort(), postings };
}

// ---------- Поиск ----------

/** Вес вида документа: lesson > theory > conspect > note > skill (тема — рядом с уроком). */
const KIND_WEIGHT: Record<SearchKind, number> = {
  lesson: 1.25,
  topic: 1.2,
  theory: 1.15,
  conspect: 1.1,
  note: 1.05,
  skill: 1,
};
const KIND_RANK: Record<SearchKind, number> = { lesson: 0, topic: 1, theory: 2, conspect: 3, note: 4, skill: 5 };

/** Базовые очки совпадения слова: текст-префикс 1, текст-точно 2, заголовок ×3 (3 и 6). */
const S_TEXT_PREFIX = 1;
const S_TEXT_EXACT = 2;
const TITLE_MULT = 3;

const MIN_TOKEN = 2;
/** Защита от вставленного «простыни»-запроса. */
const MAX_QUERY = 200;
const MAX_TOKENS = 8;
const SNIPPET_RADIUS = 60;

/**
 * Токены запроса: нижний регистр, ё → е, мягкие пары; по словам (буквы и цифры), длиной ≥ 2, без повторов.
 * Знаки (`_`, `*`, `>` …) — разделители, как и в индексе: «is_even» → «is», «even».
 */
export function queryTokens(query: string): string[] {
  const tokens: string[] = [];
  const q = foldChars(String(query ?? "").slice(0, MAX_QUERY).normalize("NFC"), true);
  for (const m of q.matchAll(WORD_RE)) {
    if (m[0].length >= MIN_TOKEN && !tokens.includes(m[0])) tokens.push(m[0]);
    if (tokens.length >= MAX_TOKENS) break;
  }
  return tokens;
}

/** Первый индекс в отсортированном массиве, где слово >= prefix. */
function lowerBound(words: string[], prefix: string): number {
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Очки документов по одному токену: документ → лучшее совпадение. */
function scoreToken(index: SearchIndex, token: string): Map<number, number> {
  const best = new Map<number, number>();
  for (let i = lowerBound(index.words, token); i < index.words.length; i++) {
    const word = index.words[i];
    if (!word.startsWith(token)) break;
    const exact = word.length === token.length;
    const textScore = exact ? S_TEXT_EXACT : S_TEXT_PREFIX;
    for (const p of index.postings.get(word)!) {
      const s = p.title ? textScore * TITLE_MULT : textScore;
      if (s > (best.get(p.d) ?? 0)) best.set(p.d, s);
    }
  }
  return best;
}

function mergeRanges(ranges: [number, number][]): [number, number][] {
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: [number, number][] = [];
  for (const r of ranges) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

/** Сниппет ±60 символов вокруг первого совпадения в тексте; ranges — для подсветки (относительно snippet.text). */
function makeSnippet(d: IndexedDoc, tokens: string[]): SearchResult["snippet"] {
  const { display, textWords } = d;
  const hits: [number, number][] = [];
  for (const w of textWords) {
    let len = 0;
    for (const t of tokens) if (t.length > len && w.w.startsWith(t)) len = t.length;
    if (len) hits.push([w.start, w.start + len]);
  }
  if (!hits.length) {
    // Совпадение только в заголовке — показываем начало текста (не режем слово на конце).
    let end = Math.min(display.length, SNIPPET_RADIUS * 2);
    if (end < display.length && display[end] !== " ") {
      const space = display.lastIndexOf(" ", end);
      if (space > 0) end = space;
    }
    return { text: display.slice(0, end) + (end < display.length ? "…" : ""), ranges: [] };
  }
  const [first, firstEnd] = hits[0];
  let s = Math.max(0, first - SNIPPET_RADIUS);
  let e = Math.min(display.length, firstEnd + SNIPPET_RADIUS);
  // Не режем слова на краях окна.
  while (s > 0 && s < first && display[s - 1] !== " ") s++;
  while (e < display.length && e > firstEnd && display[e] !== " ") e--;
  const prefix = s > 0 ? "…" : "";
  const suffix = e < display.length ? "…" : "";
  const shift = prefix.length - s;
  const ranges = mergeRanges(hits.filter(([a, b]) => a >= s && b <= e).map(([a, b]): [number, number] => [a + shift, b + shift]));
  return { text: prefix + display.slice(s, e) + suffix, ranges };
}

/**
 * Поиск: токены запроса по префиксу (≥ 2 символа), все токены должны встретиться (AND).
 * Ранжирование: заголовок ×3, точное слово > префикс, вид документа (lesson > theory > conspect > note > skill).
 */
export function search(index: SearchIndex, query: string, limit = 30): SearchResult[] {
  const tokens = queryTokens(query);
  if (!tokens.length || limit <= 0) return [];
  // Сначала самый редкий токен (меньше всего документов) — пересечение быстрее.
  const perToken = tokens.map((t) => scoreToken(index, t)).sort((a, b) => a.size - b.size);
  const scored: { d: number; score: number }[] = [];
  for (const [d, first] of perToken[0]) {
    let score = first;
    let all = true;
    for (let i = 1; i < perToken.length; i++) {
      const s = perToken[i].get(d);
      if (s === undefined) {
        all = false;
        break;
      }
      score += s;
    }
    if (all) scored.push({ d, score: score * KIND_WEIGHT[index.docs[d].doc.kind] });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = index.docs[a.d];
    const db = index.docs[b.d];
    return KIND_RANK[da.doc.kind] - KIND_RANK[db.doc.kind] || da.titleLen - db.titleLen || a.d - b.d;
  });
  return scored.slice(0, limit).map(({ d, score }) => ({
    doc: index.docs[d].doc,
    score,
    snippet: makeSnippet(index.docs[d], tokens),
  }));
}

// ---------- Документы для индекса ----------

/** Склейка непустых фрагментов текста. */
function join(parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join("\n");
}

/**
 * Документы по урокам: урок (название, описание, раздел) + по документу на шаги theory/worked/story
 * (href `/theory/<lessonId>#<stepId>`) + конспект (`/theory/<lessonId>#conspect`).
 */
export function lessonDocs(lessons: Lesson[], units: Unit[], lang: Lang): SearchDoc[] {
  const unitTitle = new Map(units.map((u) => [u.id, u.title[lang]]));
  const docs: SearchDoc[] = [];
  for (const lesson of lessons) {
    const lessonTitle = lesson.title[lang];
    const base = { lessonId: lesson.id, unitId: lesson.unitId };
    docs.push({
      id: `lesson:${lesson.id}`,
      kind: "lesson",
      title: lessonTitle,
      text: join([lesson.description[lang], unitTitle.get(lesson.unitId)]),
      href: `/lesson/${lesson.id}`,
      ...base,
    });
    for (const step of lesson.steps) {
      let title: string;
      let text: string;
      if (step.type === "theory") {
        title = step.title[lang];
        text = step.body[lang];
      } else if (step.type === "story") {
        title = step.title?.[lang] ?? lessonTitle;
        text = step.body[lang];
      } else if (step.type === "worked") {
        title = step.title[lang];
        text = join([...step.steps.map((s) => s.text[lang]), step.result?.[lang]]);
      } else continue;
      docs.push({ id: `theory:${lesson.id}:${step.id}`, kind: "theory", title, text, href: `/theory/${lesson.id}#${step.id}`, ...base });
    }
    docs.push({
      id: `conspect:${lesson.id}`,
      kind: "conspect",
      title: lessonTitle,
      text: lesson.conspect[lang],
      href: `/theory/${lesson.id}#conspect`,
      ...base,
    });
  }
  return docs;
}

/** Документы по навыкам: название + тема. Ссылка — тренировка навыка. */
export function skillDocs(skills: Skill[], lang: Lang): SearchDoc[] {
  return skills.map((s) => ({
    id: `skill:${s.id}`,
    kind: "skill",
    title: s.title[lang],
    text: s.topic[lang],
    href: `/drill?mode=skill&skill=${encodeURIComponent(s.id)}`,
  }));
}

/** Документы по темам ЕНТ: полное и короткое название. */
export function topicDocs(topics: { id: EntTopicId; title: L; short: L }[], lang: Lang): SearchDoc[] {
  return topics.map((t) => ({
    id: `topic:${t.id}`,
    kind: "topic",
    title: t.title[lang],
    text: t.short[lang],
    href: `/practice#topic-${t.id}`,
  }));
}

/** Документы по конспектам ученика (передаются аргументом — они живут в сторе). */
export function noteDocs(notes: { id: string; title: string; body: string; lessonId?: string }[]): SearchDoc[] {
  // Записи живут в localStorage — приводим поля к строкам, id экранируем в ссылке.
  return notes.map((n) => ({
    id: `note:${n.id}`,
    kind: "note",
    title: typeof n.title === "string" ? n.title : "",
    text: typeof n.body === "string" ? n.body : "",
    href: `/notes/${encodeURIComponent(n.id)}`,
    ...(typeof n.lessonId === "string" && n.lessonId ? { lessonId: n.lessonId } : {}),
  }));
}
