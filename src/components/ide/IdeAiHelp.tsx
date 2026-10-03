"use client";

import { MessageCircleQuestion, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { AiPanel } from "@/components/ai/AiPanel";
import { AiCost } from "@/components/economy/AiCost";
import { Button } from "@/components/ui/Button";
import type { IdeLang, IdeTask } from "@/lib/ide/types";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { IDE_REGISTRY } from "./registry";
import { buildAiTask } from "./shell-helpers";

const SUGGESTIONS: DictKey[] = ["ide.ai.q1", "ide.ai.q2", "ide.ai.q3"];

/**
 * ИИ-помощь практикума: после запуска с ошибкой — «Объясни ошибку» (фиолетовая, с ценой), иначе — «Спросить Бита».
 * Запрос уходит, только когда ученик открыл панель (цену показывает AiCost); правильность задач ИИ не решает.
 */
export function IdeAiHelp({ lang, task, code, error, solved }: { lang: IdeLang; task: IdeTask | null; code: string; error: string | null; solved?: boolean }) {
  const { t, l } = useT();
  const [open, setOpen] = useState(false);
  const mode = error ? "explain" : "ask";
  const langTitle = IDE_REGISTRY[lang].title.ru;

  // Контекст собирается в момент открытия панели (код и ошибка на этот момент), а не на каждый ввод.
  const [snapshot, setSnapshot] = useState<{ code: string; error: string | null } | null>(null);
  const taskCtx = useMemo(
    () =>
      snapshot
        ? buildAiTask({
            langTitle,
            title: task ? l(task.title) : undefined,
            statement: task ? l(task.prompt) : undefined,
            code: snapshot.code,
            error: snapshot.error,
            solved,
            stepKey: task?.id ?? `sandbox-${lang}`,
          })
        : null,
    [snapshot, langTitle, task, l, solved, lang],
  );

  return (
    <>
      <Button
        variant="ai"
        block
        icon={mode === "explain" ? <Sparkles size={18} /> : <MessageCircleQuestion size={18} />}
        onClick={() => {
          setSnapshot({ code, error });
          setOpen(true);
        }}
      >
        {t(mode === "explain" ? "ide.ai.explain" : "ide.ai.ask")}
        <AiCost kind={mode} variant="solid" />
      </Button>
      {open && taskCtx && (
        <AiPanel
          key={mode}
          open
          onClose={() => setOpen(false)}
          mode={mode}
          task={taskCtx}
          noteKey="general"
          suggestions={mode === "ask" ? SUGGESTIONS : []}
        />
      )}
    </>
  );
}
