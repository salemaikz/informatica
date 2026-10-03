import type { CheckSolutionResponse } from "@/lib/ai-types";
import { getOpenAI, jsonError, logUsage, MODELS } from "@/server/openai";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { lang as parseLang, sanitizeContext, sanitizeImage } from "@/server/context";
import { checkSolutionPrompt } from "@/server/prompts";

// Проверка развёрнутого решения по фото/рисунку. Ответ — строгий JSON по схеме.

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
  if (!rateLimit(`check:${clientIp(req)}`, 15, 10 * 60_000)) return jsonError(429, "rate_limited");
  const client = getOpenAI();
  if (!client) return jsonError(503, "ai_not_configured");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError(400, "bad_json");
  const lang = parseLang(body.lang);
  const ctx = sanitizeContext(body.context);
  const image = sanitizeImage(body.image);
  const t = (body.task ?? {}) as Record<string, unknown>;
  const task = { prompt: str(t.prompt, 600), reference: str(t.reference, 1200), answer: str(t.answer, 100) };
  const typed = str(body.typedAnswer, 100).trim();
  if (!task.prompt || (!image && !typed)) return jsonError(400, "empty");

  try {
    const res = await client.chat.completions.create(
      {
        model: MODELS.vision,
        reasoning_effort: "low",
        max_completion_tokens: 2500,
        response_format: { type: "json_schema", json_schema: { name: "solution_check", strict: true, schema: SCHEMA } },
        messages: [
          { role: "system", content: checkSolutionPrompt(ctx, lang, task, typed) },
          {
            role: "user",
            content: image
              ? [
                  { type: "text", text: lang === "kk" ? "Менің шешімім:" : "Моё решение:" },
                  { type: "image_url", image_url: { url: image, detail: "high" } },
                ]
              : typed,
          },
        ],
      },
      { signal: req.signal },
    );
    logUsage("check-solution", MODELS.vision, res.usage);
    const raw = res.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as CheckSolutionResponse;
    const out: CheckSolutionResponse = {
      verdict: parsed.verdict,
      score: Math.max(0, Math.min(1, Number(parsed.score) || 0)),
      feedback: str(parsed.feedback, 800),
      steps: (parsed.steps ?? []).slice(0, 8).map((s) => ({ text: str(s.text, 160), ok: !!s.ok })),
      tip: str(parsed.tip, 300),
    };
    return Response.json(out);
  } catch (e) {
    console.error("[check-solution] error", e);
    return jsonError(502, "ai_failed");
  }
}
