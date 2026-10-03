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

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  client ??= new OpenAI({ apiKey, maxRetries: 1, timeout: 60_000 });
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
