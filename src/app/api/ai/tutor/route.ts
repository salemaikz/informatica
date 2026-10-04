import type OpenAI from "openai";
import type { StudentContext, TaskContext, TutorMode } from "@/lib/ai-types";
import { aiDict } from "@/i18n/parts/ai";
import { cacheableRequest, cacheKeyPayload, cacheStyle, cacheTask, leaksAnswer } from "@/lib/ai-cache";
import { STREAM_CUT_MARK, STREAM_ERROR_MARK, STREAM_OK_MARK, stripStreamMark, withStreamEnd } from "@/lib/ai-stream";
import { AI_UNITS } from "@/lib/economy";
import { crisisLang, crisisReply, detectCrisis } from "@/lib/safety";
import { callTimeoutMs, getOpenAI, jsonError, logUsage, MAX_TOKENS, MODELS, openAiRejected } from "@/server/openai";
import { guardAi, preCheckAi, withGuardHeaders, type GuardOk } from "@/server/ai-guard";
import { sameOrigin, sanitizeContext, sanitizeHistory, sanitizeImage, sanitizeTask } from "@/server/context";
import { tutorSystemPrompt } from "@/server/prompts";
import { cachedAnswer, logCache, SkipCache, sha256 } from "@/server/ai-cache";
import { CHAT_MODES, type ChatMode } from "@/lib/chats";
import { ENT_TOPICS, entTopicById } from "@/content/ent-topics";
import type { EntTopicId } from "@/lib/types";

// Чат с ИИ-наставником: свободный диалог, подсказка к заданию, разбор ошибки. Ответ — потоковый текст.
// Защиты по порядку: origin → размер тела → дешёвый счётчик по IP (до разбора тела) → разбор тела → кризисная тема
// (ответ без модели, без лимитов) → ключ ИИ → страж лимитов (server/ai-guard.ts: устройство, IP, сайт, всплеск;
// обращение списывается до вызова модели; возвращается, только если модель точно не получила запрос).
// Конец ответа: каждый текстовый ответ заканчивается маркером (lib/ai-stream.ts): OK — дошёл целиком, ERR — сбой потока,
// CUT — обрезка по длине. Ответ без маркера OK клиент покажет как «оборвалось». Маркер ученику не виден.

export const maxDuration = 60;

const MODES: TutorMode[] = ["chat", "hint", "explain", "ask"];

type Msg = OpenAI.Chat.ChatCompletionMessageParam;

/** Тело запроса: фото до ~4 МБ (sanitizeImage) + контекст и история; всё, что заведомо больше, не читаем. */
const MAX_BODY_BYTES = 5_000_000;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "forbidden_origin");
  const declared = Number(req.headers.get("content-length") ?? NaN);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return jsonError(413, "too_large");
  // Дешёвый счётчик по IP до чтения тела: крупные мусорные запросы и кризисный путь (он без стража) тоже под лимитом.
  if (!(await preCheckAi(req, "tutor"))) return jsonError(429, "rate_limited");

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
    return new Response(withStreamEnd(crisisReply(crisis, crisisLang(last.content, ctx.lang))), {
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
    return withGuardHeaders(
      await cachedTutor(client, { mode, ctx, task, question: cacheReq.question, turns: userTurns() }, g, req.signal),
      g,
    );
  }

  const route = `tutor:${mode}`;
  const model = image ? MODELS.vision : MODELS.tutor;
  // Фото: модель размышляет (reasoning low), и часть лимита уходит на размышление — запас больше.
  const maxTokens = image
    ? MAX_TOKENS.chatPhoto
    : mode === "hint"
      ? MAX_TOKENS.hint
      : chatMode === "explain" || chatMode === "ent"
        ? MAX_TOKENS.chatLong
        : MAX_TOKENS.chat;

  // true — запрос мог дойти до модели: с этого момента обращение возвращается только при HTTP-ошибке OpenAI.
  let sent = false;
  try {
    const topic = topicId ? entTopicById(topicId).title[ctx.lang] : undefined;
    const messages: Msg[] = [{ role: "system", content: tutorSystemPrompt(ctx, mode, task, { chatMode, topic }) }, ...userTurns()];
    // Тело потока SDK таймаутом не покрывает (только ожидание заголовков): общий срок — свой сигнал, чтобы сами
    // закрыть ответ маркером ERR до того, как платформа оборвёт функцию по maxDuration.
    const timeoutMs = callTimeoutMs(maxDuration);
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(timeoutMs)]);
    sent = true;
    const stream = await client.chat.completions.create(
      {
        model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        reasoning_effort: image ? "low" : "none",
        max_completion_tokens: maxTokens,
      },
      // maxRetries 0: повтор потока после обрыва — второй платный вызов за одно обращение, да и время на него вышло бы.
      { signal, timeout: timeoutMs, maxRetries: 0 },
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
          } else {
            mark = STREAM_OK_MARK;
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
    console.error("[tutor] openai error", e instanceof Error ? e.message : e);
    // Возврат — только если модель точно не получила запрос: сбой до вызова или HTTP-ошибка OpenAI.
    // Обрыв клиентом, таймаут и сетевой сбой после начала вызова не возвращают обращение.
    if (!sent || openAiRejected(e, req.signal)) await g.release();
    return withGuardHeaders(jsonError(502, "ai_failed"), g);
  }
}

const FALLBACK_HINT = aiDict["ai.hintFallback"];

/**
 * Ответ из кэша или одна генерация целиком (не потоком): короткие неперсональные ответы. Ответ из кэша — обращение
 * возвращается (g.release); при сбое — только если OpenAI ответил HTTP-ошибкой. Каждый ответ заканчивается маркером
 * конца (OK, а у обрезанного — CUT). Set-Cookie добавляет вызывающий (withGuardHeaders).
 */
async function cachedTutor(
  client: OpenAI,
  a: { mode: TutorMode; ctx: StudentContext; task: TaskContext; question?: string; turns: Msg[] },
  g: GuardOk,
  signal: AbortSignal,
): Promise<Response> {
  const { mode, ctx, question, turns } = a;
  const task = cacheTask(mode, a.task);
  const key = sha256(cacheKeyPayload({ mode, lang: ctx.lang, style: ctx.style, task, question }));
  const route = `tutor:${mode}`;
  const model = MODELS.tutor;
  const neutralCtx = { ...ctx, style: cacheStyle(ctx.style) };

  const generate = async (noLeak: boolean): Promise<{ text: string; cut: boolean }> => {
    // Генерация общая для одинаковых запросов и кладётся в кэш — к сигналу одного запроса не привязана.
    const res = await client.chat.completions.create(
      {
        model,
        messages: [{ role: "system", content: tutorSystemPrompt(neutralCtx, mode, task, { neutral: true, noLeak }) }, ...turns],
        reasoning_effort: "none",
        max_completion_tokens: mode === "hint" ? MAX_TOKENS.hint : MAX_TOKENS.cached,
      },
      { timeout: callTimeoutMs(maxDuration) },
    );
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
    // Из кэша и свежая генерация — без служебного символа (его вырезали до кэша), добавляем OK; обрезанный (CUT) и
    // заглушка не кэшируются: у обрезанного маркер уже есть, у заглушки — добавится OK.
    return new Response(r.cacheable ? stripStreamMark(r.text) + STREAM_OK_MARK : withStreamEnd(r.text), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-AI-Cache": r.hit ? "hit" : r.cacheable ? "miss" : "skip",
      },
    });
  } catch (e) {
    console.error("[tutor] cached answer error", e instanceof Error ? e.message : e);
    // Пустой ответ и прочие сбои после вызова модели обращение не возвращают; HTTP-ошибка OpenAI — возвращает.
    if (openAiRejected(e, signal)) await g.release();
    return jsonError(502, "ai_failed");
  }
}
