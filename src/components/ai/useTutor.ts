"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TaskContext, TutorMode } from "@/lib/ai-types";
import { AiError, standardGuidance, streamTutor } from "@/lib/ai";
import { useApp } from "@/lib/store";
import { buildStudentContext } from "@/lib/student-context";
import type { StandardIntent } from "@/lib/standard-guidance";
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
      args: { mode: TutorMode; messages: TutorTurn[]; task?: TaskContext; image?: string; standard?: StandardIntent },
      onText: (text: string) => void,
    ): Promise<string | null> => {
      const app = useApp.getState();
      const reusable = !!args.standard && !!args.task?.stepId;
      if (!reusable && !app.spendAi()) {
        setError("tutor.limit");
        return null;
      }
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setError(null);
      setStreaming(true);
      let receivedText = false;
      const receive = (text: string) => { if (text.trim()) receivedText = true; onText(text); };
      try {
        const text = reusable
          ? await standardGuidance({ stepId: args.task!.stepId!, lessonId: args.task!.lessonId, lang: app.profile.lang, intent: args.standard!, answered: args.task!.answered ?? false }, ctrl.signal)
          : await streamTutor({ mode: args.mode, messages: args.messages, task: args.task, image: args.image, context: buildStudentContext(useApp.getState()) }, receive, ctrl.signal);
        if (reusable) onText(text);
        useApp.getState().unlock("ai_friend");
        return text;
      } catch (e) {
        if (!reusable && !receivedText) useApp.getState().refundAi();
        if (ctrl.signal.aborted) return null;
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
