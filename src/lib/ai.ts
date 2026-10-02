"use client";

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

/** Потоковый ответ наставника: onDelta получает накопленный текст. */
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
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    onText(full);
  }
  full += decoder.decode();
  if (!full.trim()) throw new AiError("empty_answer");
  onText(full);
  return full;
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
