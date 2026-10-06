"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TaskContext, TutorMode } from "@/lib/ai-types";
import { aiErrorKey, streamTutor, type TutorMeta } from "@/lib/ai";
import { cacheableRequest, cacheKeyPayload, clientCacheGet, clientCacheKey, clientCachePut } from "@/lib/ai-cache";
import { useApp } from "@/lib/store";
import { detectCrisis } from "@/lib/safety";
import { buildStudentContext } from "@/lib/student-context";
import type { DictKey } from "@/i18n/dict";
import type { ChatMode } from "@/lib/chats";

export interface TutorTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Общий хук потокового ответа наставника: учёт обращений, контекст ученика, отмена.
 *
 * Учёт (#118): каждый ответ, который ученик получил, — одно обращение (бесплатное по тарифу или чипы): свежий ответ,
 * ответ из общего кэша сервера, из кэша устройства, безопасный текст «ответ не назову» и обрезанный по длине (CUT).
 * Возврат — только если ответа не было: ошибка HTTP, нет тела, обрыв без маркера OK или с маркером сбоя, пустой ответ,
 * размонтирование/отмена до первого текста. Кризисный ответ — бесплатно.
 *
 * Компонент размонтировали посреди ответа (ушли со страницы, «Все чаты» в панели Бита) — запрос обрывается; если ответа
 * ещё не было видно, обращение возвращается, а уже показанная часть отдаётся вызывающему как ответ (чат сохранит её в
 * переписку, хотя экрана уже нет). `detach` (шторка ИИ в уроке, теории, практикуме) — запрос при размонтировании
 * не обрывается: ответ дойдёт целиком и вызывающий сохранит его в нить (ai-threads.ts).
 */
export function useTutor(opts: { detach?: boolean } = {}) {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<DictKey | null>(null);
  const abort = useRef<AbortController | null>(null);
  const unmounted = useRef(false);
  const detach = !!opts.detach;

  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      if (!detach) abort.current?.abort();
    };
  }, [detach]);

  const ask = useCallback(
    async (
      args: { mode: TutorMode; messages: TutorTurn[]; task?: TaskContext; image?: string; chatMode?: ChatMode; topic?: string; lessonId?: string },
      onText: (text: string) => void,
    ): Promise<string | null> => {
      const app = useApp.getState();
      const context = buildStudentContext(app);
      // Кризисный вопрос («хочу умереть» и т. п.) уходит всегда и бесплатно: сервер отвечает готовым текстом с телефонами
      // доверия, модель не вызывается. Даже при исчерпанном лимите ученик должен получить этот ответ.
      const last = args.messages[args.messages.length - 1];
      const crisis = last?.role === "user" && detectCrisis(last.content) !== null;
      // Чат с фото стоит как проверка фото; остальные режимы — по своему виду (lib/economy.ts → AI_COST, AI_UNITS).
      const kind = args.image ? "photo" : args.mode;
      // Неперсональные запросы: сначала кэш устройства — без обращения к серверу, но ответ всё равно списывается (#118).
      const cacheReq = crisis ? null : cacheableRequest(args.mode, args.messages, args.task, !!args.image);
      const cacheKey =
        cacheReq && args.task
          ? clientCacheKey(cacheKeyPayload({ mode: args.mode, lang: context.lang, style: context.style, task: args.task, question: cacheReq.question }))
          : null;
      const hit = cacheKey ? clientCacheGet(cacheKey) : null;
      if (hit) {
        // Новый ответ заменяет текущий: прерываем идущий запрос, как и при обычном вызове.
        abort.current?.abort();
        abort.current = null;
        // Отдаём не синхронно: ask вызывают и из эффекта при открытии панели.
        await Promise.resolve();
        setStreaming(false);
        const paid = useApp.getState().spendAi(kind);
        if (!paid.ok) {
          setError(paid.reason === "chips" ? "economy.noChips" : "tutor.limit");
          return null;
        }
        setError(null);
        onText(hit);
        useApp.getState().unlock("ai_friend");
        return hit;
      }
      const receipt = crisis ? null : app.spendAi(kind);
      if (receipt && !receipt.ok) {
        setError(receipt.reason === "chips" ? "economy.noChips" : "tutor.limit");
        return null;
      }
      // Возврат по квитанции — один раз: только когда ответа не было (сбой, обрыв без текста) или он кризисный.
      let refunded = false;
      const refund = () => {
        if (!receipt || refunded) return;
        refunded = true;
        useApp.getState().refundAi(receipt);
      };
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setError(null);
      setStreaming(true);
      // Сколько ответа ученик уже увидел (на случай обрыва при размонтировании).
      let shown = "";
      try {
        let meta: TutorMeta | null = null;
        const text = await streamTutor(
          { ...args, context },
          (full) => {
            shown = full;
            onText(full);
          },
          ctrl.signal,
          (m) => {
            meta = m;
            // Кризисный ответ бесплатен; клиент списал, потому что его detectCrisis не узнал вопрос, — возвращаем.
            // Ответ из общего кэша сервера и безопасный текст — это ответы: обращение не возвращается (#118).
            if (m.crisis) refund();
          },
        );
        // В кэш устройства — только целые ответы, которые сервер кэширует сам (hit/miss); «skip», заглушка и кризис — нет.
        const m = meta as TutorMeta | null;
        if (cacheKey && m && !m.fallback && !m.crisis && (m.cache === "hit" || m.cache === "miss")) clientCachePut(cacheKey, text);
        if (!crisis && !m?.crisis) useApp.getState().unlock("ai_friend");
        return text;
      } catch (e) {
        if (ctrl.signal.aborted) {
          // Ушли с экрана посреди ответа: ничего не показано — обращение возвращается; часть показана — она и есть ответ.
          if (unmounted.current) {
            if (shown.trim()) return shown;
            refund();
            return null;
          }
          // Остановил ученик (или пришёл новый запрос): что-то показано — это ответ, обращение не возвращается;
          // ничего не показано — ответа не было, возврат.
          if (!shown.trim()) refund();
          return null;
        }
        // Сбой, обрыв потока (stream_cut), отказ сервера: ответ не получен — возвращаем обращение, ответ не сохраняем.
        refund();
        setError(aiErrorKey(e));
        return null;
      } finally {
        if (abort.current === ctrl) setStreaming(false);
      }
    },
    [],
  );

  const stop = useCallback(() => {
    abort.current?.abort();
    setStreaming(false);
  }, []);

  return { ask, stop, streaming, error };
}
