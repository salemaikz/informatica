import type { TaskContext, TutorMode } from "./ai-types";
import type { Lang } from "./types";
import { dict } from "@/i18n/dict";
import { hashString } from "./text";

// Кэш ответов ИИ: общая чистая часть (ключ, «кэшируемость», защита подсказки от утечки ответа)
// и клиентский LRU в localStorage. Серверная часть (sha256, Data Cache) — в src/server/ai-cache.ts.
// Кэшируем только НЕперсональные ответы: подсказку/разбор на первый запрос и быстрые вопросы-кнопки.

/** Версия промпта в ключе кэша: меняем при любой правке промптов — старые ответы перестают подходить. */
export const PROMPT_VERSION = 1;

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

function containsAnswer(textTokens: string, answer: string, minLen: number): boolean {
  const a = tokens(answer).trim();
  if (a.length < minLen) return false;
  return textTokens.includes(` ${a} `);
}

/**
 * Утёк ли верный ответ в подсказку. Совпадение — только целыми «словами» (токенами):
 * «10» не находится в «1010», «101» — в «1011₂».
 * Ответы короче 2 символов не проверяем; текстовый вариант choice — от 3 символов.
 */
export function leaksAnswer(text: string, correct: string, opts: { isOption?: boolean } = {}): boolean {
  const answer = normText(correct);
  if (!answer) return false;
  const tt = tokens(text);
  const minFor = (s: string) => (opts.isOption && !NUMERIC.test(normText(s)) ? 3 : 2);
  if (containsAnswer(tt, answer, minFor(answer))) return true;
  // Составные ответы («a, b», «1011₂ = 11»): проверяем и части — по отдельности они тоже ответ.
  if (answer.length <= 40 && /[,;=]/.test(answer)) {
    return answer.split(/[,;=]/).some((p) => containsAnswer(tt, p, minFor(p)));
  }
  return false;
}

// ---------- Клиентский кэш (localStorage, LRU) ----------

export const CLIENT_CACHE_KEY = "informatica:ai-cache:v1";
export const CLIENT_CACHE_MAX = 150;

/** Минимальный интерфейс хранилища (Storage в браузере, заглушка в тестах). */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
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
    store.setItem(CLIENT_CACHE_KEY, JSON.stringify(items));
  } catch {
    // приватный режим / переполнение хранилища — кэш просто не работает
  }
}
