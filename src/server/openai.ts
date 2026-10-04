import "server-only";
import OpenAI from "openai";

// Ключ живёт только на сервере (env OPENAI_API_KEY). На клиент он не попадает никогда.

export const MODELS = {
  /** Чат-помощник, подсказки, разбор ошибок. */
  tutor: process.env.OPENAI_MODEL_TUTOR || "gpt-5.4-mini",
  /** Проверка решений по фото. */
  vision: process.env.OPENAI_MODEL_VISION || "gpt-5.4-mini",
  /** Дешёвые задачи: отзыв после урока, обновление памяти. */
  fast: process.env.OPENAI_MODEL_FAST || "gpt-5.4-nano",
  /** Расшифровка голоса (ИИ-чат 2.0). */
  stt: process.env.OPENAI_MODEL_STT || "gpt-4o-mini-transcribe",
};

/**
 * Потолок токенов ответа (max_completion_tokens; решение #48): типичный ответ — 40–160 слов (BASE в prompts.ts),
 * потолок даёт ему двойной запас, но не больше. chatLong — чаты «Объясни тему» (до 250 слов) и «Готовимся к ЕНТ» (план);
 * chatPhoto — чат с фото: модель с reasoning_effort "low", размышление съедает часть лимита, поэтому запас больше;
 * cached — кэшируемые разборы и быстрые вопросы целиком (без потока; казахский длиннее в токенах);
 * check — проверка решения (JSON + размышление low); feedback — отзыв и память наставника.
 * Обрыв по длине клиент видит как «ответ оборвался» (lib/ai-stream.ts).
 */
export const MAX_TOKENS = { hint: 250, chat: 800, chatLong: 1000, chatPhoto: 1200, cached: 600, check: 2000, feedback: 700 } as const;

/** Запас до maxDuration маршрута: ошибку по таймауту отдаём сами, а не получаем обрыв платформы. */
export const CALL_MARGIN_SEC = 5;

/**
 * Таймаут одного вызова OpenAI (мс) для маршрута с `export const maxDuration`: меньше его на CALL_MARGIN_SEC.
 * Передаётся в опциях вызова SDK (`{ timeout }`). Для потока SDK считает таймаут только до заголовков ответа —
 * тело потока ограничивает сам маршрут (tutor: AbortSignal.timeout).
 */
export function callTimeoutMs(maxDurationSec: number): number {
  return Math.max(1, maxDurationSec - CALL_MARGIN_SEC) * 1000;
}

/**
 * Модель точно НЕ получила запрос? Только тогда обращение возвращается (g.release). OpenAI ответил ошибкой с
 * HTTP-статусом (400/401/429/5xx) — запрос отклонён. Обрыв клиентом, таймаут, сеть и любые другие сбои после начала
 * вызова — модель могла получить запрос и потратить токены: обращение не возвращаем (иначе «оборвал связь — получил
 * бесплатный запрос» обходит потолок расходов).
 */
export function openAiRejected(e: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return false;
  return e instanceof OpenAI.APIError && typeof e.status === "number" && e.status >= 400;
}

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  // Таймаут по умолчанию — самый короткий maxDuration (30 с) минус запас; маршруты задают свой в опциях вызова.
  client ??= new OpenAI({ apiKey, maxRetries: 1, timeout: callTimeoutMs(30) });
  return client;
}

/** Лог расхода токенов — основа для контроля затрат (видно в логах Vercel/сервера). */
export function logUsage(route: string, model: string, usage?: { prompt_tokens?: number; completion_tokens?: number } | null) {
  if (!usage) return;
  console.info(`[ai] route=${route} model=${model} in=${usage.prompt_tokens ?? 0} out=${usage.completion_tokens ?? 0}`);
}

export function jsonError(status: number, code: string) {
  return Response.json({ error: code }, { status });
}
