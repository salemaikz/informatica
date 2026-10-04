import type OpenAI from "openai";
import type { StudentContext, TaskContext, TutorMode } from "@/lib/ai-types";
import { aiDict } from "@/i18n/parts/ai";
import { cacheableRequest, cacheKeyPayload, cacheStyle, cacheTask, leaksAnswer } from "@/lib/ai-cache";
import { STREAM_CUT_MARK, STREAM_ERROR_MARK, stripStreamMark } from "@/lib/ai-stream";
import { AI_UNITS } from "@/lib/economy";
import { crisisLang, crisisReply, detectCrisis } from "@/lib/safety";
import { getOpenAI, jsonError, logUsage, MAX_TOKENS, MODELS } from "@/server/openai";
import { guardAi, withGuardHeaders, type GuardOk } from "@/server/ai-guard";
import { sameOrigin, sanitizeContext, sanitizeHistory, sanitizeImage, sanitizeTask } from "@/server/context";
import { tutorSystemPrompt } from "@/server/prompts";
import { cachedAnswer, logCache, SkipCache, sha256 } from "@/server/ai-cache";
import { CHAT_MODES, type ChatMode } from "@/lib/chats";
import { ENT_TOPICS, entTopicById } from "@/content/ent-topics";
import type { EntTopicId } from "@/lib/types";

// Чат с ИИ-наставником: свободный диалог, подсказка к заданию, разбор ошибки. Ответ — потоковый текст.
// Защиты по порядку: origin → разбор тела → кризисная тема (ответ без модели, без лимитов) → ключ ИИ → страж лимитов
// (server/ai-guard.ts: устройство, IP, сайт, всплеск; обращение списывается до вызова модели).
// Конец потока: при сбое или обрезке по длине последним куском идёт маркер (lib/ai-stream.ts), клиент покажет «оборвалось».

export const maxDuration = 60;

const MODES: TutorMode[] = ["chat", "hint", "explain", "ask"];

type Msg = OpenAI.Chat.ChatCompletionMessageParam;

/** Тело запроса: фото до ~4 МБ (sanitizeImage) + контекст и история; всё, что заведомо больше, не читаем. */
const MAX_BODY_BYTES = 5_000_000;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "forbidden_origin");
  const declared = Number(req.headers.get("content-length") ?? NaN);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return jsonError(413, "too_large");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError(400, "bad_json");

  const mode = MODES.includes(body.mode as TutorMode) ? (body.mode as TutorMode) : "chat";
  // ИИ-чат 2.0: режим и тема — недоверенные данные, только из списка.
  const chatMode = CHAT_MODES.includes(body.chatMode as ChatMode) ? (body.chatMode as ChatMode) : undefined;
  const topicId = typeof body.topic === "string" && ENT_TOPICS.some((t) => t.id === body.topic) ? (body.topic as EntTopicId) : undefined;
  const ctx = sanitizeContext(body.context);
  const task = sanitizeTask(body.task);
  const image = sanitizeImage(body.image);
  // Последние сообщения: каждое до 2000 символов, всего до 8000 (старые отбрасываются).
  const history = sanitizeHistory(body.messages);

  if ((mode === "chat" || mode === "ask") && history.length === 0) return jsonError(400, "empty");

  // Кризисная тема в последнем сообщении ученика (в любом режиме: в уроке тоже можно дописать вопрос):
  // модель не вызываем, ответ работает и без ключа ИИ и при исчерпанных лимитах — ничего не стоит и ничего не списывает.
  // X-AI-Cache: hit — если клиент всё же оплатил обращение, он вернёт его (useTutor кризис не оплачивает).
  const last = history[history.length - 1];
  const crisis = last?.role === "user" ? detectCrisis(last.content) : null;
  if (last && crisis) {
    console.info(`[ai] route=tutor crisis=${crisis}`);
    return new Response(crisisReply(crisis, crisisLang(last.content, ctx.lang)), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-AI-Cache": "hit",
        "X-AI-Crisis": crisis,
      },
    });
  }

  const client = getOpenAI();
  if (!client) return jsonError(503, "ai_not_configured");
  // Вес обращения — из lib/economy.ts (AI_UNITS): чат с фото стоит как проверка фото (2), остальные режимы — 1.
  const g = await guardAi(req, { route: "tutor", units: AI_UNITS[image ? "photo" : mode] });
  if (!g.ok) return g.response;

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
  if (cacheReq && task) {
    return withGuardHeaders(await cachedTutor(client, { mode, ctx, task, question: cacheReq.question, turns: userTurns() }, g), g);
  }

  const topic = topicId ? entTopicById(topicId).title[ctx.lang] : undefined;
  const messages: Msg[] = [{ role: "system", content: tutorSystemPrompt(ctx, mode, task, { chatMode, topic }) }, ...userTurns()];
  const route = `tutor:${mode}`;
  const model = image ? MODELS.vision : MODELS.tutor;
  const maxTokens = mode === "hint" ? MAX_TOKENS.hint : chatMode === "explain" || chatMode === "ent" ? MAX_TOKENS.chatLong : MAX_TOKENS.chat;

  try {
    const stream = await client.chat.completions.create(
      {
        model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        reasoning_effort: image ? "low" : "none",
        max_completion_tokens: maxTokens,
      },
      { signal: req.signal },
    );
    const encoder = new TextEncoder();
    const out = new ReadableStream<Uint8Array>({
      async start(controller) {
        let finish: string | null = null;
        let failed = false;
        try {
          for await (const chunk of stream) {
            const choice = chunk.choices[0];
            // Служебный символ маркера из текста модели вырезаем: маркер нельзя подделать содержимым ответа.
            const delta = choice?.delta?.content ? stripStreamMark(choice.delta.content) : "";
            if (delta) controller.enqueue(encoder.encode(delta));
            if (choice?.finish_reason) finish = choice.finish_reason;
            if (chunk.usage) logUsage(route, model, chunk.usage);
          }
        } catch (e) {
          failed = !req.signal.aborted;
          if (failed) console.error("[tutor] stream error", e instanceof Error ? e.message : e);
        }
        // Ученик ушёл (отмена) — писать некому. Иначе: сбой потока или поток без завершения — ERR, обрезка по длине — CUT.
        let mark = "";
        if (!req.signal.aborted) {
          if (failed || finish === null || (finish !== "stop" && finish !== "length")) {
            mark = STREAM_ERROR_MARK;
            console.info(`[ai] route=${route} stream_error=1`);
          } else if (finish === "length") {
            mark = STREAM_CUT_MARK;
            console.info(`[ai] route=${route} cut=1`);
          }
        }
        try {
          if (mark) controller.enqueue(encoder.encode(mark));
          controller.close();
        } catch {
          // поток уже закрыт отменой
        }
      },
      cancel() {
        stream.controller.abort();
      },
    });
    return withGuardHeaders(
      new Response(out, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }),
      g,
    );
  } catch (e) {
    // Модель не ответила — обращение возвращаем.
    console.error("[tutor] openai error", e instanceof Error ? e.message : e);
    await g.release();
    return withGuardHeaders(jsonError(502, "ai_failed"), g);
  }
}

const FALLBACK_HINT = aiDict["ai.hintFallback"];

/**
 * Ответ из кэша или одна генерация целиком (не потоком): короткие неперсональные ответы. Ответ из кэша — обращение
 * возвращается (g.release). Set-Cookie добавляет вызывающий (withGuardHeaders).
 */
async function cachedTutor(
  client: OpenAI,
  a: { mode: TutorMode; ctx: StudentContext; task: TaskContext; question?: string; turns: Msg[] },
  g: GuardOk,
): Promise<Response> {
  const { mode, ctx, question, turns } = a;
  const task = cacheTask(mode, a.task);
  const key = sha256(cacheKeyPayload({ mode, lang: ctx.lang, style: ctx.style, task, question }));
  const route = `tutor:${mode}`;
  const model = MODELS.tutor;
  const neutralCtx = { ...ctx, style: cacheStyle(ctx.style) };

  const generate = async (noLeak: boolean): Promise<{ text: string; cut: boolean }> => {
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: "system", content: tutorSystemPrompt(neutralCtx, mode, task, { neutral: true, noLeak }) }, ...turns],
      reasoning_effort: "none",
      max_completion_tokens: mode === "hint" ? MAX_TOKENS.hint : MAX_TOKENS.cached,
    });
    logCache(route, "miss", model, res.usage);
    const choice = res.choices[0];
    return { text: stripStreamMark(choice?.message?.content?.trim() ?? ""), cut: choice?.finish_reason === "length" };
  };

  const leaks = (text: string) =>
    mode === "hint" &&
    !!task.correct &&
    leaksAnswer(text, task.correct, { isOption: !!task.options?.includes(task.correct), options: task.options, known: task.prompt });

  // Обрезанный по длине ответ в кэш не кладём (иначе оборванный текст жил бы 30 дней) и отдаём с маркером «оборвался».
  const cut = (text: string) => {
    console.info(`[ai] route=${route} cut=1`);
    return new SkipCache(text + STREAM_CUT_MARK);
  };

  try {
    const r = await cachedAnswer(key, async () => {
      let res = await generate(false);
      if (res.cut) throw cut(res.text);
      if (leaks(res.text)) {
        // Подсказка выдала ответ: один повтор с припиской; если снова — статичный текст и без кэша.
        // Подсказку автора ученик уже видел над кнопкой «Ещё подсказка» — повторять её нет смысла.
        res = await generate(true);
        if (res.cut) throw cut(res.text);
        if (leaks(res.text)) throw new SkipCache(FALLBACK_HINT[ctx.lang]);
      }
      return res.text;
    });
    if (r.hit) {
      logCache(route, "hit");
      await g.release(); // модель не вызывалась
    }
    return new Response(r.text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-AI-Cache": r.hit ? "hit" : r.cacheable ? "miss" : "skip",
      },
    });
  } catch (e) {
    console.error("[tutor] cached answer error", e instanceof Error ? e.message : e);
    await g.release();
    return jsonError(502, "ai_failed");
  }
}
