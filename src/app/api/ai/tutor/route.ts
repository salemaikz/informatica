import type OpenAI from "openai";
import type { StudentContext, TaskContext, TutorMode } from "@/lib/ai-types";
import { aiDict } from "@/i18n/parts/ai";
import { cacheableRequest, cacheKeyPayload, cacheStyle, cacheTask, leaksAnswer } from "@/lib/ai-cache";
import { getOpenAI, jsonError, logUsage, MODELS } from "@/server/openai";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { sameOrigin, sanitizeContext, sanitizeImage, sanitizeTask } from "@/server/context";
import { tutorSystemPrompt } from "@/server/prompts";
import { cachedAnswer, logCache, SkipCache, sha256 } from "@/server/ai-cache";

// Чат с ИИ-наставником: свободный диалог, подсказка к заданию, разбор ошибки. Ответ — потоковый текст.

export const maxDuration = 60;

const MODES: TutorMode[] = ["chat", "hint", "explain", "ask"];

type Msg = OpenAI.Chat.ChatCompletionMessageParam;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "forbidden_origin");
  if (!rateLimit(`tutor:${clientIp(req)}`, 40, 10 * 60_000)) return jsonError(429, "rate_limited");
  const client = getOpenAI();
  if (!client) return jsonError(503, "ai_not_configured");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError(400, "bad_json");

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

  if ((mode === "chat" || mode === "ask") && history.length === 0) return jsonError(400, "empty");

  const userTurns = (): Msg[] => {
    const out: Msg[] = [];
    history.forEach((m, i) => {
      const isLast = i === history.length - 1;
      if (isLast && image && m.role === "user") {
        out.push({
          role: "user",
          content: [
            { type: "text", text: m.content },
            { type: "image_url", image_url: { url: image, detail: "auto" } },
          ],
        });
      } else {
        out.push(m);
      }
    });
    if (history.length === 0) {
      const ask =
        mode === "hint"
          ? ctx.lang === "kk" ? "Кеңес берші" : "Дай подсказку"
          : ctx.lang === "kk" ? "Қатемді түсіндірші" : "Объясни мою ошибку";
      out.push({ role: "user", content: ask });
    }
    return out;
  };

  // Неперсональные запросы (подсказка/разбор на первый запрос, быстрые вопросы) — через общий кэш.
  const cacheReq = cacheableRequest(mode, history, task, !!image);
  if (cacheReq && task) return cachedTutor(client, { mode, ctx, task, question: cacheReq.question, turns: userTurns() });

  const messages: Msg[] = [{ role: "system", content: tutorSystemPrompt(ctx, mode, task) }, ...userTurns()];

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

const FALLBACK_HINT = aiDict["ai.hintFallback"];

/** Ответ из кэша или одна генерация целиком (не потоком): короткие неперсональные ответы. */
async function cachedTutor(
  client: OpenAI,
  a: { mode: TutorMode; ctx: StudentContext; task: TaskContext; question?: string; turns: Msg[] },
): Promise<Response> {
  const { mode, ctx, question, turns } = a;
  const task = cacheTask(mode, a.task);
  const key = sha256(cacheKeyPayload({ mode, lang: ctx.lang, style: ctx.style, task, question }));
  const route = `tutor:${mode}`;
  const model = MODELS.tutor;
  const neutralCtx = { ...ctx, style: cacheStyle(ctx.style) };

  const generate = async (noLeak: boolean): Promise<string> => {
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: "system", content: tutorSystemPrompt(neutralCtx, mode, task, { neutral: true, noLeak }) }, ...turns],
      reasoning_effort: "none",
      max_completion_tokens: mode === "hint" ? 300 : 600,
    });
    logCache(route, "miss", model, res.usage);
    return res.choices[0]?.message?.content?.trim() ?? "";
  };

  const leaks = (text: string) =>
    mode === "hint" && !!task.correct && leaksAnswer(text, task.correct, { isOption: !!task.options?.includes(task.correct) });

  try {
    const r = await cachedAnswer(key, async () => {
      let text = await generate(false);
      if (leaks(text)) {
        // Подсказка выдала ответ: один повтор с припиской; если снова — статичный текст и без кэша.
        text = await generate(true);
        if (leaks(text)) throw new SkipCache(a.task.hint || FALLBACK_HINT[ctx.lang]);
      }
      return text;
    });
    if (r.hit) logCache(route, "hit");
    return new Response(r.text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-AI-Cache": r.hit ? "hit" : r.cacheable ? "miss" : "skip",
      },
    });
  } catch (e) {
    console.error("[tutor] cached answer error", e);
    return jsonError(502, "ai_failed");
  }
}
