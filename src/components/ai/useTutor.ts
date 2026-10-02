"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TaskContext, TutorMode } from "@/lib/ai-types";
import { AiError, streamTutor } from "@/lib/ai";
import { cacheableRequest, cacheKeyPayload, clientCacheGet, clientCacheKey, clientCachePut } from "@/lib/ai-cache";
import { useApp } from "@/lib/store";
import { buildStudentContext } from "@/lib/student-context";
import type { DictKey } from "@/i18n/dict";

export interface TutorTurn {
  role: "user" | "assistant";
  content: string;
}

/** Общий хук потокового ответа наставника: лимиты, контекст ученика, отмена. */
export function useTutor() {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<DictKey | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const ask = useCallback(
    async (
      args: { mode: TutorMode; messages: TutorTurn[]; task?: TaskContext; image?: string },
      onText: (text: string) => void,
    ): Promise<string | null> => {
      const app = useApp.getState();
      const context = buildStudentContext(app);
      // Неперсональные запросы: сначала клиентский кэш — без обращения к серверу и без траты дневного лимита.
      const cacheReq = cacheableRequest(args.mode, args.messages, args.task, !!args.image);
      const cacheKey =
        cacheReq && args.task
          ? clientCacheKey(cacheKeyPayload({ mode: args.mode, lang: context.lang, style: context.style, task: args.task, question: cacheReq.question }))
          : null;
      if (cacheKey) {
        const hit = clientCacheGet(cacheKey);
        if (hit) {
          // Новый ответ заменяет текущий: прерываем идущий запрос, как и при обычном вызове.
          abort.current?.abort();
          abort.current = null;
          // Отдаём не синхронно: ask вызывают и из эффекта при открытии панели.
          await Promise.resolve();
          setStreaming(false);
          setError(null);
          onText(hit);
          useApp.getState().unlock("ai_friend");
          return hit;
        }
      }
      // Чат с фото стоит как проверка фото; остальные режимы — по своему виду (lib/economy.ts → AI_COST).
      const receipt = app.spendAi(args.image ? "photo" : args.mode);
      if (!receipt.ok) {
        setError(receipt.reason === "chips" ? "economy.noChips" : "tutor.limit");
        return null;
      }
      let refunded = false;
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setError(null);
      setStreaming(true);
      try {
        const meta: { status: string | null } = { status: null };
        const text = await streamTutor(
          { ...args, context },
          onText,
          ctrl.signal,
          (st) => {
            meta.status = st;
            // Ответ взят из серверного кэша — модель не вызывалась, возвращаем потраченное обращение.
            if (st === "hit") {
              useApp.getState().refundAi(receipt);
              refunded = true;
            }
          },
        );
        // «skip» — заглушка вместо подсказки, её не запоминаем.
        if (cacheKey && (meta.status === "hit" || meta.status === "miss")) clientCachePut(cacheKey, text);
        useApp.getState().unlock("ai_friend");
        return text;
      } catch (e) {
        if (ctrl.signal.aborted) return null;
        if (!refunded) useApp.getState().refundAi(receipt);
        setError(e instanceof AiError && e.code === "rate_limited" ? "tutor.limit" : "tutor.error");
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
