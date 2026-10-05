import type { TaskContext, TutorMode } from "./ai-types";
import type { Lang } from "./types";
import { dict } from "@/i18n/dict";
import { hashString } from "./text";

// Кэш ответов ИИ: общая чистая часть (ключ, «кэшируемость», защита подсказки от утечки ответа)
// и клиентский LRU в localStorage. Серверная часть (sha256, Data Cache) — в src/server/ai-cache.ts.
// Кэшируем только НЕперсональные ответы: подсказку/разбор на первый запрос и быстрые вопросы-кнопки.

/**
 * Версия в ключе кэша ответов (серверный Data Cache и клиент): меняем при любой правке промптов или потолков токенов —
 * старые ответы перестают подходить. 2 — этап 10: ответы, обрезанные потолком токенов и закэшированные раньше, больше не выдаются;
 * 3 — v0.9.1: в общей части промпта правила «не раскрывать стек, не говорить лишнего»;
 * 4 — этап 16Б: к нерешённому заданию ответ не называется (новые правила промпта, ответы-стоп-слова входят в ключ).
 * Клиентский ключ хранилища (CLIENT_CACHE_KEY) меняется вместе с ней.
 */
export const PROMPT_VERSION = 4;

const STYLE_KEYS = ["short", "examples", "steps"] as const;

/** Стиль объяснений в ключе: только известные значения, иначе «short». */
export function cacheStyle(style: string | undefined): string {
  return (STYLE_KEYS as readonly string[]).includes(style ?? "") ? (style as string) : "short";
}

/** Нормализация строки для ключа: trim и схлопнутые пробелы. */
export const normText = (s: string | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

const QUICK_KEYS = ["tutor.q.simpler", "tutor.q.example", "tutor.q.why", "tutor.q.start"] as const;

const quickSet = new Set(QUICK_KEYS.flatMap((k) => [normText(dict[k].ru).toLowerCase(), normText(dict[k].kk).toLowerCase()]));

/** Это текст одной из быстрых кнопок-вопросов («Объясни проще», «Приведи пример»…)? */
export function isQuickQuestion(text: string): boolean {
  return quickSet.has(normText(text).toLowerCase());
}

/**
 * Задание в «нейтральном» виде: ровно то, что попадает и в ключ кэша, и в промпт.
 * `given` — только для разбора ошибки; подсказка/разбор статики — как есть.
 */
export function cacheTask(mode: TutorMode, task: TaskContext): TaskContext {
  const out: TaskContext = { prompt: normText(task.prompt) };
  if (task.options?.length) out.options = task.options.map(normText);
  if (task.correct) out.correct = normText(task.correct);
  // Ответы-стоп-слова входят в ключ: общий ответ нельзя «отравить» запросом с теми же словами, но без стоп-слов.
  if (task.secrets?.length && !task.answered) out.secrets = task.secrets;
  if (mode === "explain" && task.given) out.given = normText(task.given);
  if (task.explanation && (mode === "explain" || (mode === "ask" && task.answered))) out.explanation = normText(task.explanation);
  if (task.theory) out.theory = normText(task.theory);
  if (task.hint && mode === "hint") out.hint = normText(task.hint);
  if (task.whyWrong && mode === "explain") out.whyWrong = normText(task.whyWrong);
  if (mode === "ask" && task.answered) out.answered = true;
  return out;
}

/** Можно ли ответить из кэша; если да — вопрос (для ask) нужен ключу. */
export function cacheableRequest(
  mode: TutorMode,
  messages: { role: string; content: string }[],
  task: TaskContext | undefined,
  hasImage = false,
): { question?: string } | null {
  if (hasImage || !task || !(task.prompt || task.theory)) return null;
  if (mode === "hint" || mode === "explain") return messages.length === 0 ? {} : null;
  if (mode === "ask") {
    const m = messages[0];
    if (messages.length !== 1 || m.role !== "user" || !isQuickQuestion(m.content)) return null;
    return { question: normText(m.content).toLowerCase() };
  }
  return null;
}

export interface CacheKeyInput {
  mode: TutorMode;
  lang: Lang;
  style: string;
  task: TaskContext;
  question?: string;
}

/** Канонический JSON ключа (порядок полей фиксирован); из него сервер берёт sha256, клиент — хеш. */
export function cacheKeyPayload(input: CacheKeyInput): string {
  const t = cacheTask(input.mode, input.task);
  return JSON.stringify({
    v: PROMPT_VERSION,
    mode: input.mode,
    lang: input.lang,
    style: cacheStyle(input.style),
    task: {
      prompt: t.prompt,
      options: t.options ?? null,
      correct: t.correct ?? null,
      secrets: t.secrets ?? null,
      given: t.given ?? null,
      explanation: t.explanation ?? null,
      theory: t.theory ?? null,
      hint: t.hint ?? null,
      whyWrong: t.whyWrong ?? null,
      answered: t.answered ?? false,
    },
    question: input.question ?? null,
  });
}

// ---------- Защита подсказки от утечки ответа ----------

const SUBSCRIPTS = /[₀-₉]/g;

/** Нижний регистр, ё → е, без нижних индексов (1011₂ → 1011), всё, что не буква и не цифра, — пробел. */
function tokens(s: string): string {
  return ` ${s.toLowerCase().replace(/ё/g, "е").replace(SUBSCRIPTS, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
}

const NUMERIC = /^[\d\s.,]+$/;

/**
 * Утёк ли верный ответ в подсказку. Совпадение — только целыми «словами» (токенами):
 * «10» не находится в «1010», «101» — в «1011₂».
 * Ответы короче 2 символов не проверяем; текстовый вариант choice — от 3 символов.
 * `known` — текст, который ученик и так видит (условие задания): части ответа, которые в нём есть
 * («Набери 11» → «1011₂ = 11»), утечкой не считаем — подсказка вправе их назвать.
 * `options` — варианты ответа: часть, совпавшая с текстовым вариантом, проверяется от 3 символов.
 */
export function leaksAnswer(
  text: string,
  correct: string,
  opts: { isOption?: boolean; options?: string[]; known?: string } = {},
): boolean {
  const answer = normText(correct);
  if (!answer) return false;
  const tt = tokens(text);
  const known = tokens(opts.known ?? "");
  const optionSet = new Set((opts.options ?? []).map((o) => normText(o).toLowerCase()));
  const isOpt = (s: string) => opts.isOption || optionSet.has(normText(s).toLowerCase());
  const hit = (part: string): boolean => {
    const p = normText(part);
    const a = tokens(p).trim();
    const min = isOpt(p) && !NUMERIC.test(p) ? 3 : 2;
    if (a.length < min || known.includes(` ${a} `)) return false;
    return tt.includes(` ${a} `);
  };
  if (hit(answer)) return true;
  // Сопоставление («a = b; c = d»): утечка — пара целиком; одна сторона пары видна ученику на экране.
  const pairs = answer.split(";").filter((p) => p.trim());
  if (pairs.length > 1) return pairs.some(hit);
  // Составные ответы («a, b», «1011₂ = 11»): проверяем и части — по отдельности они тоже ответ.
  if (answer.length <= 40 && /[,=]/.test(answer)) return answer.split(/[,=]/).some(hit);
  return false;
}

// ---------- Клиентский кэш (localStorage, LRU) ----------

export const CLIENT_CACHE_KEY = "informatica:ai-cache:v4";
/** Прежние ключи хранилища: записи в них больше не читаются, при записи в новый ключ их стираем (место в localStorage). */
const LEGACY_CLIENT_CACHE_KEYS = ["informatica:ai-cache:v1", "informatica:ai-cache:v2", "informatica:ai-cache:v3"];
export const CLIENT_CACHE_MAX = 150;

/** Минимальный интерфейс хранилища (Storage в браузере, заглушка в тестах). */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

/** Ключ клиентского кэша: хеш + длина канонического JSON (sha на клиенте не нужен). */
export function clientCacheKey(payload: string): string {
  return `${hashString(payload).toString(36)}-${payload.length}`;
}

function defaultStore(): KV | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Читает записи [ключ, текст], от старых к новым; повреждённые данные — пустой список. */
function load(store: KV): [string, string][] {
  try {
    const raw = store.getItem(CLIENT_CACHE_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (e): e is [string, string] => Array.isArray(e) && e.length === 2 && typeof e[0] === "string" && typeof e[1] === "string" && e[1] !== "",
    );
  } catch {
    return [];
  }
}

export function clientCacheGet(key: string, store: KV | null = defaultStore()): string | null {
  if (!store) return null;
  try {
    const items = load(store);
    const i = items.findIndex((e) => e[0] === key);
    if (i < 0) return null;
    const [hit] = items.splice(i, 1);
    items.push(hit); // свежесть: обращение переносит запись в конец
    store.setItem(CLIENT_CACHE_KEY, JSON.stringify(items));
    return hit[1];
  } catch {
    return null;
  }
}

export function clientCachePut(key: string, text: string, store: KV | null = defaultStore(), max = CLIENT_CACHE_MAX): void {
  if (!store || !text.trim()) return;
  try {
    const items = load(store).filter((e) => e[0] !== key);
    items.push([key, text]);
    while (items.length > max) items.shift();
    // Сначала освобождаем место, занятое прежними ключами, потом пишем в новый.
    for (const old of LEGACY_CLIENT_CACHE_KEYS) store.removeItem?.(old);
    store.setItem(CLIENT_CACHE_KEY, JSON.stringify(items));
  } catch {
    // приватный режим / переполнение хранилища — кэш просто не работает
  }
}
