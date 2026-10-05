import type { LessonFeedbackResponse } from "@/lib/ai-types";
import { callTimeoutMs, getOpenAI, INPUT_BUDGET, jsonError, logUsage, MAX_TOKENS, MODELS, openAiRejected } from "@/server/openai";
import { AI_UNITS } from "@/lib/economy";
import { guardAi, withGuardHeaders } from "@/server/ai-guard";
import { feedbackSummary, fitInput, messagesChars, sanitizeContext } from "@/server/context";
import { lessonFeedbackPrompt } from "@/server/prompts";

// Отзыв после урока (feedback + focus). Дешёвая модель. «Памяти наставника» больше нет (этап 16В, L): модель её не обновляет.
// Страж лимитов (server/ai-guard.ts): для устройства бесплатно (AI_UNITS.feedback = 0, свой потолок в сутки), с сайта списывается 1.
// Возврат — только если модель точно не получила запрос (ошибка до вызова, HTTP-ошибка OpenAI); обрыв и таймаут не возвращают.
// Бюджет входа (INPUT_BUDGET.feedback, v0.9.1): сводка по уроку не длиннее FEEDBACK_SUMMARY_MAX_CHARS, затем fitInput ужимает
// контекст ученика.

export const maxDuration = 30;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["feedback", "focus"],
  properties: {
    feedback: { type: "string" },
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
  const summary = feedbackSummary(body);
  let messages: { role: "system" | "user"; content: string }[];
  let input: { chars: number; trimmed: boolean };
  try {
    const fit = fitInput({ budget: INPUT_BUDGET.feedback, ctx, history: [], base: (c) => lessonFeedbackPrompt(c).length + summary.length });
    messages = [
      { role: "system", content: lessonFeedbackPrompt(fit.ctx) },
      { role: "user", content: summary },
    ];
    input = { chars: messagesChars(messages), trimmed: fit.trimmed };
  } catch (e) {
    // Сбой при сборке запроса — до вызова модели: обращение возвращается.
    console.error("[lesson-feedback] build error", e instanceof Error ? e.message : e);
    return reject(502, "ai_failed");
  }

  let res;
  try {
    res = await client.chat.completions.create(
      {
        model: MODELS.fast,
        reasoning_effort: "none",
        max_completion_tokens: MAX_TOKENS.feedback,
        response_format: { type: "json_schema", json_schema: { name: "lesson_feedback", strict: true, schema: SCHEMA } },
        messages,
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
    logUsage("lesson-feedback", MODELS.fast, res.usage, input);
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as LessonFeedbackResponse;
    return withGuardHeaders(
      Response.json({
        feedback: str(parsed.feedback, 700),
        focus: (parsed.focus ?? []).slice(0, 3).map((f) => str(f, 80)),
      } satisfies LessonFeedbackResponse),
      g,
    );
  } catch (e) {
    console.error("[lesson-feedback] bad answer", e instanceof Error ? e.message : e);
    return withGuardHeaders(jsonError(502, "ai_failed"), g);
  }
}
