import type { LessonFeedbackResponse } from "@/lib/ai-types";
import { getOpenAI, jsonError, logUsage, MODELS } from "@/server/openai";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { sanitizeContext } from "@/server/context";
import { lessonFeedbackPrompt } from "@/server/prompts";

// Отзыв после урока + обновление «памяти наставника» об ученике. Дешёвая модель.

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
  if (!rateLimit(`feedback:${clientIp(req)}`, 20, 10 * 60_000)) return jsonError(429, "rate_limited");
  const client = getOpenAI();
  if (!client) return jsonError(503, "ai_not_configured");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError(400, "bad_json");
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

  try {
    const res = await client.chat.completions.create(
      {
        model: MODELS.fast,
        reasoning_effort: "none",
        max_completion_tokens: 700,
        response_format: { type: "json_schema", json_schema: { name: "lesson_feedback", strict: true, schema: SCHEMA } },
        messages: [
          { role: "system", content: lessonFeedbackPrompt(ctx) },
          { role: "user", content: summary },
        ],
      },
      { signal: req.signal },
    );
    logUsage("lesson-feedback", MODELS.fast, res.usage);
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as LessonFeedbackResponse;
    return Response.json({
      feedback: str(parsed.feedback, 700),
      memory: str(parsed.memory, 900),
      focus: (parsed.focus ?? []).slice(0, 3).map((f) => str(f, 80)),
    } satisfies LessonFeedbackResponse);
  } catch (e) {
    console.error("[lesson-feedback] error", e);
    return jsonError(502, "ai_failed");
  }
}
