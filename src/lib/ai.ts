"use client";

import type { DictKey } from "@/i18n/dict";
import { aiCodeKey } from "./ai-errors";
import { splitStreamTail } from "./ai-stream";
import type {
  CheckSolutionRequest,
  CheckSolutionResponse,
  LessonFeedbackRequest,
  LessonFeedbackResponse,
  TutorRequest,
} from "./ai-types";

export class AiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Ключ текста ошибки для любого исключения, пойманного после вызова ИИ (коды → ключи: lib/ai-errors.ts). */
export function aiErrorKey(e: unknown): DictKey {
  return aiCodeKey(e instanceof AiError ? e.code : undefined);
}

async function ensureOk(res: Response) {
  if (res.ok) return;
  let code = `http_${res.status}`;
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) code = data.error;
  } catch {
    // тело не JSON
  }
  throw new AiError(code);
}

/**
 * Потоковый ответ наставника: onText получает накопленный текст без служебного маркера конца.
 * Сервер дописывает маркер, если поток оборвался или упёрся в лимит длины (lib/ai-stream.ts), — тогда AiError("stream_cut").
 * Обрыв сети посреди чтения — тоже stream_cut. Отмена (signal) пробрасывается как есть.
 */
export async function streamTutor(
  req: TutorRequest,
  onText: (full: string) => void,
  signal?: AbortSignal,
  /** Вызывается сразу после заголовков: значение X-AI-Cache (hit | miss | skip) или null. */
  onCache?: (status: string | null) => void,
): Promise<string> {
  const res = await fetch("/api/ai/tutor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  await ensureOk(res);
  onCache?.(res.headers.get("X-AI-Cache"));
  if (!res.body) throw new AiError("no_body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (e) {
      if (signal?.aborted) throw e;
      throw new AiError("stream_cut");
    }
    if (chunk.done) break;
    raw += decoder.decode(chunk.value, { stream: true });
    onText(splitStreamTail(raw).text);
  }
  raw += decoder.decode();
  const { text, end } = splitStreamTail(raw);
  if (end !== "ok") throw new AiError("stream_cut");
  if (!text.trim()) throw new AiError("empty_answer");
  onText(text);
  return text;
}

export async function checkSolution(req: CheckSolutionRequest, signal?: AbortSignal): Promise<CheckSolutionResponse> {
  const res = await fetch("/api/ai/check-solution", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  await ensureOk(res);
  return res.json();
}

export async function lessonFeedback(req: LessonFeedbackRequest, signal?: AbortSignal): Promise<LessonFeedbackResponse> {
  const res = await fetch("/api/ai/lesson-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  await ensureOk(res);
  return res.json();
}
