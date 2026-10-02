import type OpenAI from "openai";
import type { TutorMode } from "@/lib/ai-types";
import { getOpenAI, jsonError, logUsage, MODELS } from "@/server/openai";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { sanitizeContext, sanitizeImage, sanitizeTask } from "@/server/context";
import { tutorSystemPrompt } from "@/server/prompts";

// Чат с ИИ-наставником: свободный диалог, подсказка к заданию, разбор ошибки. Ответ — потоковый текст.

export const maxDuration = 60;

const MODES: TutorMode[] = ["chat", "hint", "explain"];

type Msg = OpenAI.Chat.ChatCompletionMessageParam;

export async function POST(req: Request) {
  if (!rateLimit(`tutor:${clientIp(req)}`, 40, 10 * 60_000)) return jsonError(429, "rate_limited");
  const client = getOpenAI();
  if (!client) return jsonError(503, "ai_not_configured");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_json");
  }

  const mode = MODES.includes(body.mode as TutorMode) ? (body.mode as TutorMode) : "chat";
  const ctx = sanitizeContext(body.context);
  const task = sanitizeTask(body.task);
  const image = sanitizeImage(body.image);
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-12)
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (mode === "chat" && history.length === 0) return jsonError(400, "empty");

  const messages: Msg[] = [{ role: "system", content: tutorSystemPrompt(ctx, mode, task) }];
  history.forEach((m, i) => {
    const isLast = i === history.length - 1;
    if (isLast && image && m.role === "user") {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: m.content },
          { type: "image_url", image_url: { url: image, detail: "auto" } },
        ],
      });
    } else {
      messages.push(m);
    }
  });
  if (history.length === 0) {
    const ask =
      mode === "hint"
        ? ctx.lang === "kk" ? "Кеңес берші" : "Дай подсказку"
        : ctx.lang === "kk" ? "Қатемді түсіндірші" : "Объясни мою ошибку";
    messages.push({ role: "user", content: ask });
  }

  try {
    const model = image ? MODELS.vision : MODELS.tutor;
    const stream = await client.chat.completions.create(
      {
        model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        reasoning_effort: image ? "low" : "none",
        max_completion_tokens: mode === "hint" ? 300 : 1200,
      },
      { signal: req.signal },
    );
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
            if (chunk.usage) logUsage(`tutor:${mode}`, model, chunk.usage);
          }
        } catch (e) {
          console.error("[tutor] stream error", e);
        } finally {
          controller.close();
        }
      },
      cancel() {
        stream.controller.abort();
      },
    });
    return new Response(body, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[tutor] openai error", e);
    return jsonError(502, "ai_failed");
  }
}
