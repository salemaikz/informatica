import type { LessonFeedbackResponse } from "@/lib/ai-types";
import { callTimeoutMs, getOpenAI, jsonError, logUsage, MAX_TOKENS, MODELS, openAiRejected } from "@/server/openai";
import { AI_UNITS } from "@/lib/economy";
import { guardAi, withGuardHeaders } from "@/server/ai-guard";
import { sanitizeContext } from "@/server/context";
import { lessonFeedbackPrompt } from "@/server/prompts";

// Отзыв после урока + обновление «памяти наставника» об ученике. Дешёвая модель.
// Страж лимитов (server/ai-guard.ts): для устройства бесплатно (AI_UNITS.feedback = 0, свой потолок в сутки), с сайта списывается 1.
// Возврат — только если модель точно не получила запрос (ошибка до вызова, HTTP-ошибка OpenAI); обрыв и таймаут не возвращают.

export const maxDuration = 30;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["feedback", "memory", "focus"],
  properties: {
    feedback: { type: "string" },
    memory: { type: "string" },
    focus: { type: "array", items: { type: "string" } },
  },
} as const;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function POST(req: Request) {
  const g = await guardAi(req, { route: "feedback", units: AI_UNITS.feedback });
  if (!g.ok) return g.response;
  // Ошибка до вызова модели: обращение возвращается.
  const reject = async (status: number, code: string) => {
    await g.release();
    return withGuardHeaders(jsonError(status, code), g);
  };
  const client = getOpenAI();
  if (!client) return reject(503, "ai_not_configured");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reject(400, "bad_json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reject(400, "bad_json");
  const ctx = sanitizeContext(body.context);
  const mistakes = (Array.isArray(body.mistakes) ? body.mistakes : []).slice(0, 10).map((m) => {
    const o = (m ?? {}) as Record<string, unknown>;
    return `- «${str(o.q, 200)}» — ответ «${str(o.given, 60)}», верно «${str(o.expected, 60)}»`;
  });
  const skills = (Array.isArray(body.skills) ? body.skills : []).slice(0, 10).map((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    return `- ${str(o.title, 60)}: ${Math.round((Number(o.mastery) || 0) * 100)}%`;
  });
  const summary = [
    `Урок: ${str(body.lesson, 120)}`,
    `Точность: ${Math.round((Number(body.accuracy) || 0) * 100)}%`,
    `Время: ${Math.round((Number(body.durationSec) || 0) / 60)} мин`,
    mistakes.length ? `Ошибки:\n${mistakes.join("\n")}` : "Ошибок не было.",
    skills.length ? `Освоение тем после урока:\n${skills.join("\n")}` : "",
  ].join("\n");

  let res;
  try {
    res = await client.chat.completions.create(
      {
        model: MODELS.fast,
        reasoning_effort: "none",
        max_completion_tokens: MAX_TOKENS.feedback,
        response_format: { type: "json_schema", json_schema: { name: "lesson_feedback", strict: true, schema: SCHEMA } },
        messages: [
          { role: "system", content: lessonFeedbackPrompt(ctx) },
          { role: "user", content: summary },
        ],
      },
      { signal: req.signal, timeout: callTimeoutMs(maxDuration) },
    );
  } catch (e) {
    console.error("[lesson-feedback] openai error", e instanceof Error ? e.message : e);
    if (openAiRejected(e, req.signal)) return reject(502, "ai_failed");
    return withGuardHeaders(jsonError(502, "ai_failed"), g);
  }

  // Модель ответила (токены потрачены): дальше обращение не возвращаем.
  try {
    logUsage("lesson-feedback", MODELS.fast, res.usage);
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as LessonFeedbackResponse;
    return withGuardHeaders(
      Response.json({
        feedback: str(parsed.feedback, 700),
        memory: str(parsed.memory, 900),
        focus: (parsed.focus ?? []).slice(0, 3).map((f) => str(f, 80)),
      } satisfies LessonFeedbackResponse),
      g,
    );
  } catch (e) {
    console.error("[lesson-feedback] bad answer", e instanceof Error ? e.message : e);
    return withGuardHeaders(jsonError(502, "ai_failed"), g);
  }
}
