import type { CheckSolutionResponse } from "@/lib/ai-types";
import { callTimeoutMs, getOpenAI, INPUT_BUDGET, jsonError, logUsage, MAX_TOKENS, MODELS, openAiRejected } from "@/server/openai";
import { AI_UNITS } from "@/lib/economy";
import { guardAi, withGuardHeaders } from "@/server/ai-guard";
import { clipEnd, lang as parseLang, messagesChars, sanitizeContext, sanitizeImage } from "@/server/context";
import { checkSolutionPrompt } from "@/server/prompts";

// Проверка развёрнутого решения по фото/рисунку. Ответ — строгий JSON по схеме.
// Страж лимитов (server/ai-guard.ts): вес как у фото (AI_UNITS.photo = 2). Обращения возвращаются, только если модель
// точно не получила запрос: ошибка до вызова или HTTP-ошибка OpenAI; обрыв клиентом, таймаут и сеть — не возвращают.
// Бюджет входа (INPUT_BUDGET.check, v0.9.1): потолки полей ниже держат вход около 4 тыс. символов; если когда-нибудь выйдут
// за бюджет, укорачивается эталонное решение (с конца) — условие, ответ и сама работа ученика не трогаются.

export const maxDuration = 60;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "score", "feedback", "steps", "tip"],
  properties: {
    verdict: { type: "string", enum: ["correct", "partial", "incorrect", "unreadable"] },
    score: { type: "number" },
    feedback: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "ok"],
        properties: { text: { type: "string" }, ok: { type: "boolean" } },
      },
    },
    tip: { type: "string" },
  },
} as const;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function POST(req: Request) {
  const g = await guardAi(req, { route: "check", units: AI_UNITS.photo });
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
  const lang = parseLang(body.lang);
  const ctx = sanitizeContext(body.context);
  const image = sanitizeImage(body.image);
  const t = (body.task ?? {}) as Record<string, unknown>;
  const task = { prompt: str(t.prompt, 600), reference: str(t.reference, 1200), answer: str(t.answer, 100) };
  const typed = str(body.typedAnswer, 100).trim();
  if (!task.prompt || (!image && !typed)) return reject(400, "empty");

  // Вход одним куском: системный промпт + текст (ответ) или подпись к фото. Картинка в бюджет не входит.
  const buildMessages = (reference: string) => [
    { role: "system" as const, content: checkSolutionPrompt(ctx, lang, { ...task, reference }, typed) },
    {
      role: "user" as const,
      content: image
        ? [
            { type: "text" as const, text: lang === "kk" ? "Менің шешімім:" : "Моё решение:" },
            { type: "image_url" as const, image_url: { url: image, detail: "high" as const } },
          ]
        : typed,
    },
  ];
  let messages: ReturnType<typeof buildMessages>;
  let chars: number;
  let trimmed = false;
  try {
    messages = buildMessages(task.reference);
    chars = messagesChars(messages);
    if (chars > INPUT_BUDGET.check) {
      trimmed = true;
      messages = buildMessages(clipEnd(task.reference, chars - INPUT_BUDGET.check));
      chars = messagesChars(messages);
    }
  } catch (e) {
    // Сбой при сборке запроса — до вызова модели: обращение возвращается.
    console.error("[check-solution] build error", e instanceof Error ? e.message : e);
    return reject(502, "ai_failed");
  }

  let res;
  try {
    res = await client.chat.completions.create(
      {
        model: MODELS.vision,
        reasoning_effort: "low",
        max_completion_tokens: MAX_TOKENS.check,
        response_format: { type: "json_schema", json_schema: { name: "solution_check", strict: true, schema: SCHEMA } },
        messages,
      },
      { signal: req.signal, timeout: callTimeoutMs(maxDuration) },
    );
  } catch (e) {
    console.error("[check-solution] openai error", e instanceof Error ? e.message : e);
    if (openAiRejected(e, req.signal)) return reject(502, "ai_failed");
    return withGuardHeaders(jsonError(502, "ai_failed"), g);
  }

  // Модель ответила (токены потрачены): дальше обращение не возвращаем, даже если разбор ответа не удался.
  try {
    logUsage("check-solution", MODELS.vision, res.usage, { chars, trimmed });
    const raw = res.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as CheckSolutionResponse;
    const out: CheckSolutionResponse = {
      verdict: parsed.verdict,
      score: Math.max(0, Math.min(1, Number(parsed.score) || 0)),
      feedback: str(parsed.feedback, 800),
      steps: (parsed.steps ?? []).slice(0, 8).map((s) => ({ text: str(s.text, 160), ok: !!s.ok })),
      tip: str(parsed.tip, 300),
    };
    return withGuardHeaders(Response.json(out), g);
  } catch (e) {
    console.error("[check-solution] bad answer", e instanceof Error ? e.message : e);
    return withGuardHeaders(jsonError(502, "ai_failed"), g);
  }
}
