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

/**
 * Бюджет входа одного запроса к модели, в символах текста (v0.9.1): системные правила + данные ученика +
 * задание + история. Казахский ≈ 2,5–3 символа на токен, русский ≈ 3–4: tutor ≈ 5–6 тыс. токенов, остальное ≈ 2 тыс.
 * Картинка в бюджет не входит (отдельный предел ~4 МБ base64, sanitizeImage). Потолки полей (server/context.ts) заданы так,
 * что обычный запрос укладывается без обрезки; fitInput срабатывает только на тяжёлых случаях: сначала отбрасывает самые
 * старые сообщения истории, затем укорачивает необязательные части контекста (заметки, память, ошибки). Системные правила
 * и последний вопрос ученика не трогаются. Выход ограничен MAX_TOKENS.
 * tutor — чат, подсказки, разборы (поток и кэшируемый путь); check — проверка решения по фото; feedback — отзыв после урока.
 */
export const INPUT_BUDGET = { tutor: 16_000, check: 6_000, feedback: 6_000 } as const;

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

/**
 * Лог расхода токенов — основа для контроля затрат (видно в логах хостинга). chars — размер текстового входа в символах
 * (по нему видно, где бюджет INPUT_BUDGET жмёт); trimmed — вход пришлось укоротить.
 */
export function logUsage(
  route: string,
  model: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null,
  input?: { chars: number; trimmed?: boolean },
) {
  if (!usage) return;
  const size = input ? ` chars=${input.chars}${input.trimmed ? " trimmed=1" : ""}` : "";
  console.info(`[ai] route=${route} model=${model} in=${usage.prompt_tokens ?? 0} out=${usage.completion_tokens ?? 0}${size}`);
}

export function jsonError(status: number, code: string) {
  return Response.json({ error: code }, { status });
}
