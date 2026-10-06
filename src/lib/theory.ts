// Раздел «Теория»: чтение уроков без заданий, группировка результатов поиска, подсветка, недавние запросы.
// Чистая логика без React (тесты — tests/theory.test.ts).

import type { TaskContext } from "./ai-types";
import { fold, queryTokens, search, type SearchIndex, type SearchKind, type SearchResult } from "./search";
import { plain, tx } from "./text";
import { CARD_PARAM, CONSPECT_ID } from "./theory-href";
import type { EntTopicId, InfoStep, Lang, Lesson, Step, Unit } from "./types";

export { CONSPECT_ID };

// ---------- Чтение урока ----------

/** Шаги без проверки ответа — то, что показывает «Теория». */
export function isInfoStep(step: Step): step is InfoStep {
  return step.type === "theory" || step.type === "story" || step.type === "worked" || step.type === "explore" || step.type === "video";
}

/** Информационные шаги урока по порядку. */
export function infoSteps(lesson: Lesson): InfoStep[] {
  return lesson.steps.filter(isInfoStep);
}

/** Слов в тексте (для оценки времени чтения). */
export function countWords(text: string): number {
  return plain(text).split(/\s+/).filter(Boolean).length;
}

/** Текст шага на языке ученика: всё, что читают (заголовок, текст, подшаги). */
export function stepText(step: InfoStep, lang: Lang): string {
  switch (step.type) {
    case "theory":
      return `${tx(step.title, lang)}. ${tx(step.body, lang)}`;
    case "story":
      return `${step.title ? tx(step.title, lang) + ". " : ""}${tx(step.body, lang)}`;
    case "worked":
      return [tx(step.title, lang), ...step.steps.map((s) => tx(s.text, lang)), step.result ? tx(step.result, lang) : ""].join(". ");
    case "explore":
      return `${tx(step.title, lang)}. ${step.body ? tx(step.body, lang) : ""}`;
    case "video":
      return tx(step.title, lang);
  }
}

/** Скорость чтения учебного текста, слов в минуту. */
const WORDS_PER_MIN = 140;

export interface ReadingStats {
  /** Блоков теории: текст, ситуации, разборы, песочницы, видео. */
  cards: number;
  /** Минут на чтение вместе с конспектом (не меньше 1). */
  minutes: number;
}

/** «N карточек теории · M мин чтения». Песочница — +30 с, видео — +1 мин. */
export function readingStats(lesson: Lesson, lang: Lang): ReadingStats {
  const steps = infoSteps(lesson);
  let words = countWords(tx(lesson.conspect, lang));
  let extra = 0;
  for (const s of steps) {
    words += countWords(stepText(s, lang));
    if (s.type === "explore") extra += 0.5;
    if (s.type === "video") extra += 1;
  }
  return { cards: steps.length, minutes: Math.max(1, Math.ceil(words / WORDS_PER_MIN + extra)) };
}

/** Id готовых уроков в порядке курса. */
export function readableLessonIds(units: Unit[]): string[] {
  const ids: string[] = [];
  for (const u of units) for (const l of u.lessons) if (l.status === "available" && !ids.includes(l.id)) ids.push(l.id);
  return ids;
}

/** Соседние уроки в порядке курса (null — край списка или урока нет). */
export function adjacentLessons(order: string[], id: string): { prev: string | null; next: string | null } {
  const i = order.indexOf(id);
  if (i < 0) return { prev: null, next: null };
  return { prev: order[i - 1] ?? null, next: order[i + 1] ?? null };
}

// ---------- Теория 2.0 (этап 16В, P6): порядок, разделы, карточки, «Продолжить» ----------

/** Id готовых уроков раздела по порядку курса (без повторов). */
export function unitReadableIds(unit: Unit): string[] {
  const ids: string[] = [];
  for (const l of unit.lessons) if (l.status === "available" && !ids.includes(l.id)) ids.push(l.id);
  return ids;
}

export interface LessonPlace {
  /** Номер раздела в курсе с нуля («Раздел N» = unitIndex + 1, как на карте). */
  unitIndex: number;
  unit: Unit;
  /** Номер урока в разделе (с 1) среди готовых уроков — «Урок K из M». */
  number: number;
  /** Сколько готовых уроков в разделе (M). */
  total: number;
  /** Готовые уроки раздела по порядку. */
  ids: string[];
}

/** Где урок в курсе: раздел и номер среди готовых уроков раздела. null — урока нет на карте (школьный, неизвестный). */
export function lessonPlace(units: Unit[], id: string): LessonPlace | null {
  for (let unitIndex = 0; unitIndex < units.length; unitIndex++) {
    const ids = unitReadableIds(units[unitIndex]);
    const i = ids.indexOf(id);
    if (i >= 0) return { unitIndex, unit: units[unitIndex], number: i + 1, total: ids.length, ids };
  }
  return null;
}

/** Статус урока в «Теории»: пройден (уроком), прочитан (конспект дочитан до конца) или не начат. */
export type LessonReadStatus = "done" | "read" | "new";

export function lessonReadStatus(input: { done: boolean; read: boolean }): LessonReadStatus {
  return input.done ? "done" : input.read ? "read" : "new";
}

export interface UnitSummary {
  /** Готовых уроков в разделе. */
  total: number;
  /** Прочитано: прочитан конспект или пройден урок. */
  read: number;
  /** Пройдено уроков. */
  done: number;
}

/** Сводка раздела для списка: «прочитано N из M» (пройденный урок считается прочитанным). */
export function unitSummary(ids: readonly string[], isDone: (id: string) => boolean, isRead: (id: string) => boolean): UnitSummary {
  let read = 0;
  let done = 0;
  for (const id of ids) {
    const d = isDone(id);
    if (d) done++;
    if (d || isRead(id)) read++;
  }
  return { total: ids.length, read, done };
}

/**
 * Какой раздел раскрыть при входе: из адреса (`?unit=u3`, затем старый якорь `#u3` при полной загрузке),
 * иначе раздел текущего урока, иначе ничего. Неизвестный раздел в адресе пропускается.
 */
export function initialOpenUnit(units: Unit[], hash: string, currentLessonId: string | undefined, unitParam?: string | null): string | null {
  if (unitParam && units.some((u) => u.id === unitParam)) return unitParam;
  const h = hash.replace(/^#/, "");
  if (h && units.some((u) => u.id === h)) return h;
  if (currentLessonId) {
    const place = lessonPlace(units, currentLessonId);
    if (place) return place.unit.id;
  }
  return null;
}

/** Тема ЕНТ урока: своя (entTopics урока), иначе первая тема его раздела; нет ни там ни там — undefined. */
export function lessonEntTopic(lesson: { unitId: string; entTopics?: EntTopicId[] }, units: readonly Unit[]): EntTopicId | undefined {
  return lesson.entTopics?.[0] ?? units.find((u) => u.id === lesson.unitId)?.entTopics?.[0];
}

// Карточки урока: информационные шаги, последняя карточка — конспект.
// Адрес карточки — `/theory/<урок>?card=<id шага>` (lib/theory-href.ts); старый якорь `#<id шага>` при полной загрузке тоже понимаем.

/** Id карточек урока по порядку: информационные шаги и в конце конспект. */
export function theoryCardIds(steps: readonly InfoStep[]): string[] {
  return [...steps.map((s) => s.id), CONSPECT_ID];
}

/** Номер карточки по её id; null — id пустой или карточки с таким id в этом уроке нет. */
function cardIndexOf(id: string | null | undefined, cardIds: readonly string[]): number | null {
  if (!id) return null;
  const i = cardIds.indexOf(id);
  return i >= 0 ? i : null;
}

/** Номер карточки по якорю адреса (`#<id шага>`, `#conspect`); null — якоря нет или он не от этого урока. */
export function cardIndexFromHash(hash: string, cardIds: readonly string[]): number | null {
  let h = hash.replace(/^#/, "");
  try {
    h = decodeURIComponent(h);
  } catch {
    return null; // битая %-последовательность
  }
  return cardIndexOf(h, cardIds);
}

/** Номер карточки по параметру `?card=` (уже разобранному Next: без %-кодов); null — параметра нет или он не от этого урока. */
export function cardIndexFromParam(card: string | null | undefined, cardIds: readonly string[]): number | null {
  return cardIndexOf(card, cardIds);
}

/**
 * Параметр `?card=`, который ещё действует. Страница получает его с сервера, а читалка после первого листания убирает
 * `?card=` из адреса (withoutCardAnchor). При «Назад» к такой записи истории Next поднимает прежние пропсы (initialCard —
 * карточка из поиска), хотя в адресе её уже нет: параметр устарел, и урок открывается там, где ученик остановился (theoryLast).
 * urlCard — `?card=` из useSearchParams (адрес роутера: в отличие от window.location он уже новый в первом рендере
 * и при переходе по ссылке, и при «Назад»). Совпали — параметр действует; иначе null.
 */
export function liveCardParam(serverCard: string | null | undefined, urlCard: string | null | undefined): string | null {
  return serverCard && serverCard === urlCard ? serverCard : null;
}

/** Номер карточки в пределах 0..total-1 (мусор — 0). */
export function clampCard(i: number, total: number): number {
  if (!Number.isFinite(i) || total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, Math.trunc(i)));
}

/**
 * С какой карточки открыть урок: адрес важнее всего (`?card=`, затем старый якорь `#…` при полной загрузке);
 * иначе — где ученик остановился (theoryLast этого урока, если конспект ещё не дочитан); иначе с первой.
 */
export function initialCard(input: {
  /** Параметр `?card=` (страница читает его на сервере: при переходе внутри приложения `window.location.hash` ещё старый). */
  card?: string | null;
  hash: string;
  cardIds: readonly string[];
  lessonId: string;
  last: TheoryLast | null;
}): number {
  const fromParam = cardIndexFromParam(input.card, input.cardIds);
  if (fromParam !== null) return fromParam;
  const fromHash = cardIndexFromHash(input.hash, input.cardIds);
  if (fromHash !== null) return fromHash;
  const { last, cardIds } = input;
  if (last && last.id === input.lessonId && last.card < cardIds.length - 1) return clampCard(last.card, cardIds.length);
  return 0;
}

/**
 * Адрес страницы без якоря карточки: убирает `?card=` (остальные параметры остаются) и `#…`.
 * Якорь сработал при входе; дальше он только мешал бы (обновление страницы вернуло бы к нему, а не к месту, где остановились).
 * null — убирать нечего.
 */
export function withoutCardAnchor(pathname: string, search: string, hash: string): string | null {
  const params = new URLSearchParams(search);
  if (!params.has(CARD_PARAM) && !hash) return null;
  params.delete(CARD_PARAM);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

// Свайп по карточке: влево — дальше, вправо — назад.

/** Минимальная длина горизонтального жеста, px. */
export const SWIPE_MIN_PX = 56;

/** Куда листать по жесту (dx, dy — смещение пальца, px): только достаточно длинный и заметно горизонтальный жест, иначе null. */
export function swipeDirection(dx: number, dy: number, min = SWIPE_MIN_PX): "next" | "prev" | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? "next" : "prev";
}

// Что читал ученик: последний открытый урок («Продолжить чтение»), прочитанные уроки, как показывать карточки.

/** Режим чтения: по одной карточке или всё сразу (для повторения). */
export type TheoryMode = "cards" | "all";

export const THEORY_MODES: readonly TheoryMode[] = ["cards", "all"];

/** Режим из сохранения (недоверенные данные): по умолчанию — по карточкам. */
export function sanitizeTheoryMode(raw: unknown): TheoryMode {
  return raw === "all" ? "all" : "cards";
}

/** Последний открытый конспект: урок, номер карточки с нуля (конспект — последняя) и когда. */
export interface TheoryLast {
  id: string;
  card: number;
  at: number;
}

const ID_MAX = 80;
export const THEORY_CARD_MAX = 60;

export function sanitizeTheoryLast(raw: unknown): TheoryLast | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Partial<Record<keyof TheoryLast, unknown>>;
  if (typeof r.id !== "string" || !r.id || r.id.length > ID_MAX) return null;
  if (typeof r.card !== "number" || !Number.isFinite(r.card) || typeof r.at !== "number" || !Number.isFinite(r.at) || r.at < 0) return null;
  return { id: r.id, card: Math.min(THEORY_CARD_MAX, Math.max(0, Math.trunc(r.card))), at: r.at };
}

/** Прочитанные конспекты: id урока → когда дочитан (мс). */
export type TheoryRead = Record<string, number>;

/** Записей о прочитанном храним не больше (с запасом на рост курса). */
export const THEORY_READ_MAX = 500;

export function sanitizeTheoryRead(raw: unknown): TheoryRead {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const rows: [string, number][] = [];
  for (const [id, at] of Object.entries(raw as Record<string, unknown>)) {
    if (!id || id.length > ID_MAX || typeof at !== "number" || !Number.isFinite(at) || at <= 0) continue;
    rows.push([id, at]);
  }
  rows.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(rows.slice(0, THEORY_READ_MAX));
}

/** Отметить конспект прочитанным: запись обновляется, лишние (самые старые) отбрасываются. Исходный объект не меняется. */
export function putTheoryRead(read: TheoryRead, id: string, now: number): TheoryRead {
  return sanitizeTheoryRead({ ...read, [id]: now });
}

/** Что показать в «Продолжить чтение». */
export interface ContinueTarget {
  id: string;
  /** Номер карточки с нуля, с которой продолжить. */
  card: number;
  /** Сколько в уроке карточек без конспекта. */
  cards: number;
  /** true — прошлый урок дочитан, предлагаем следующий по порядку (card = 0). */
  next: boolean;
}

/**
 * «Продолжить чтение»: последний открытый урок с того же места; если он дочитан до конспекта — следующий урок курса.
 * cardsOf(id) — число карточек урока без конспекта (null — урок неизвестен). null — продолжать нечего.
 */
export function continueTarget(last: TheoryLast | null, order: readonly string[], cardsOf: (id: string) => number | null): ContinueTarget | null {
  if (!last) return null;
  const cards = cardsOf(last.id);
  if (cards === null || !order.includes(last.id)) return null;
  if (last.card < cards) return { id: last.id, card: last.card, cards, next: false };
  const nextId = adjacentLessons([...order], last.id).next;
  const nextCards = nextId ? cardsOf(nextId) : null;
  if (nextId && nextCards !== null) return { id: nextId, card: 0, cards: nextCards, next: true };
  return { id: last.id, card: cards, cards, next: false };
}

/** Контекст для «Спросить Бита» по блоку теории. */
export function blockContext(step: InfoStep, lesson: Lesson, lang: Lang): TaskContext {
  const title = step.type === "story" ? tx(step.title ?? lesson.title, lang) : tx(step.title, lang);
  const text = step.type === "worked"
    ? [...step.steps.map((s, i) => `${i + 1}. ${plain(tx(s.text, lang))}`), step.result ? plain(tx(step.result, lang)) : ""].filter(Boolean).join(" ")
    : step.type === "theory"
      ? plain(tx(step.body, lang))
      : plain(stepText(step, lang));
  return { prompt: title, theory: text, stepKey: step.id };
}

/** Контекст для вопроса по конспекту урока. */
export function conspectContext(lesson: Lesson, lang: Lang): TaskContext {
  return { prompt: tx(lesson.title, lang), theory: plain(tx(lesson.conspect, lang)), stepKey: "conspect" };
}

// ---------- Результаты поиска ----------

export type SearchGroup = "lesson" | "theory" | "conspect" | "note" | "skill";

/** Порядок групп на экране. Темы ЕНТ идут вместе с навыками. */
export const GROUP_ORDER: SearchGroup[] = ["lesson", "theory", "conspect", "note", "skill"];

export function groupOf(kind: SearchKind): SearchGroup {
  return kind === "topic" ? "skill" : kind;
}

/** Результаты по группам (в каждой — порядок поиска). Пустые группы отсутствуют. */
export function groupResults(results: SearchResult[]): { group: SearchGroup; items: SearchResult[] }[] {
  const by = new Map<SearchGroup, SearchResult[]>();
  for (const r of results) {
    const g = groupOf(r.doc.kind);
    const list = by.get(g);
    if (list) list.push(r);
    else by.set(g, [r]);
  }
  return GROUP_ORDER.filter((g) => by.has(g)).map((g) => ({ group: g, items: by.get(g)! }));
}

// ---------- Мягкий запрос ----------

/** Служебные слова (уже «сложенные»: қ → к, ү → у …) — в мягком запросе не обязательны. */
const STOP_WORDS = new Set(["на", "по", "для", "как", "что", "это", "из", "от", "до", "при", "или", "про", "жане", "мен", "бен", "пен", "ушин", "калай", "деген", "не"]);

/** Срезает окончание длинного кириллического слова: «двоичную» → «двоич», «кестесі» → «кесте», «байты» → «байт». */
function stem(token: string): string {
  if (!/^\p{Script=Cyrillic}+$/u.test(token)) return token;
  const cut = token.length >= 8 ? 3 : token.length >= 6 ? 2 : token.length >= 4 ? 1 : 0;
  return token.slice(0, token.length - cut);
}

/**
 * Запасной запрос, когда точный ничего не нашёл: поиск идёт по префиксу и требует все слова,
 * поэтому «перевод в двоичную» не находит «двоичная система». Срезаем окончания и служебные слова.
 * Пустая строка — смягчать нечего (запрос не изменится).
 */
export function relaxQuery(query: string): string {
  const tokens = queryTokens(query);
  const meaningful = tokens.filter((t) => !STOP_WORDS.has(t));
  const relaxed = [...new Set((meaningful.length ? meaningful : tokens).map(stem))].filter((t) => t.length >= 2);
  return relaxed.join(" ") === tokens.join(" ") ? "" : relaxed.join(" ");
}

/** Склейка результатов двух индексов (уроки/теория и записи ученика): по убыванию очков, не больше limit. */
export function mergeResults(a: SearchResult[], b: SearchResult[], limit: number): SearchResult[] {
  return [...a, ...b].sort((x, y) => y.score - x.score).slice(0, limit);
}

/**
 * Поиск по нескольким индексам (курс и записи ученика) со склейкой по очкам.
 * Ничего не нашлось — повтор с мягким запросом (relaxQuery). query — запрос, по которому найдено (для подсветки заголовков).
 */
export function searchAll(
  sources: { index: SearchIndex; limit: number }[],
  query: string,
  limit: number,
): { results: SearchResult[]; query: string } {
  const run = (q: string) => sources.map((s) => search(s.index, q, s.limit)).reduce((a, b) => mergeResults(a, b, limit), []);
  const strict = run(query);
  if (strict.length) return { results: strict, query };
  const soft = relaxQuery(query);
  return soft ? { results: run(soft), query: soft } : { results: strict, query };
}

// ---------- Подсветка ----------

export interface TextPart {
  text: string;
  mark: boolean;
}

/** Режет текст на куски по диапазонам подсветки (диапазоны не пересекаются и отсортированы; лишнее отбрасывается). */
export function highlightParts(text: string, ranges: [number, number][]): TextPart[] {
  const parts: TextPart[] = [];
  let pos = 0;
  for (const [a, b] of ranges) {
    const s = Math.max(a, pos);
    const e = Math.min(b, text.length);
    if (e <= s) continue;
    if (s > pos) parts.push({ text: text.slice(pos, s), mark: false });
    parts.push({ text: text.slice(s, e), mark: true });
    pos = e;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), mark: false });
  return parts.length ? parts : [{ text, mark: false }];
}

/** Диапазоны совпадений слов запроса (по префиксу, с «мягкими» казахскими буквами) в произвольной строке — для заголовков. */
export function highlightRanges(text: string, query: string): [number, number][] {
  const tokens = queryTokens(query);
  if (!tokens.length) return [];
  const ranges: [number, number][] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const folded = fold(m[0]);
    let len = 0;
    for (const t of tokens) if (t.length > len && folded.startsWith(t)) len = t.length;
    if (len) ranges.push([m.index, m.index + len]);
  }
  return ranges;
}

// ---------- Недавние запросы ----------

export const RECENT_KEY = "informatica-search-recent";
export const RECENT_MAX = 6;

/** Добавляет запрос в начало списка: без повторов (без учёта регистра), не короче 2 символов, не больше max. */
export function pushRecent(list: string[], query: string, max = RECENT_MAX): string[] {
  const q = query.replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 2) return list;
  const key = q.toLowerCase();
  return [q, ...list.filter((x) => x.toLowerCase() !== key)].slice(0, max);
}

/** Разбор сохранённого списка (данные недоверенные). */
export function parseRecent(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    // Через pushRecent — те же правила (обрезка, без повторов): повтор дал бы одинаковые key у чипов.
    return v
      .filter((x): x is string => typeof x === "string")
      .reduceRight<string[]>((list, x) => pushRecent(list, x), [])
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/** Адрес поиска по запросу. */
export function searchHref(query: string): string {
  const q = query.trim();
  return q ? `/search?q=${encodeURIComponent(q)}` : "/search";
}

/** Форма русского числительного: 0 — «1 карточка», 1 — «2 карточки», 2 — «5 карточек». */
export function pluralIndex(n: number): 0 | 1 | 2 {
  const a = Math.abs(Math.trunc(n));
  const m10 = a % 10;
  const m100 = a % 100;
  if (m10 === 1 && m100 !== 11) return 0;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 1;
  return 2;
}
