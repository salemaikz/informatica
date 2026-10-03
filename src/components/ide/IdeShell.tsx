"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { feedback } from "@/lib/feedback";
import { clearDraft, loadDraft, saveDraft, sandboxDraftId } from "@/lib/ide/drafts";
import type { CheckResult, IdeLang, IdeTask } from "@/lib/ide/types";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { IdeAiHelp } from "./IdeAiHelp";
import { IDE_REGISTRY } from "./registry";
import { ResultBanner, type ResultState } from "./ResultBanner";
import { canShowSolution, nextUnsolved, SANDBOX_CODE } from "./shell-helpers";
import { TaskPanel } from "./TaskPanel";

/**
 * Оболочка рабочей области: хранит код (черновик в localStorage), показывает условие, итог проверки и ИИ-помощь.
 * task = null — «песочница» (свободный режим, без проверки и XP). Родитель задаёт key по задаче/языку.
 */
export function IdeShell({ lang, task }: { lang: IdeLang; task: IdeTask | null }) {
  const { t } = useT();
  const info = IDE_REGISTRY[lang];
  const Workspace = info.Workspace;
  const draftId = task ? task.id : sandboxDraftId(lang);
  const defaultCode = task ? task.starter : SANDBOX_CODE[lang];

  const [code, setCode] = useState(() => loadDraft(draftId) ?? defaultCode);
  const [result, setResult] = useState<ResultState | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  const stat = useApp((s) => (task ? s.codeTasks[task.id] : undefined));
  const codeTasks = useApp((s) => s.codeTasks);

  const onCodeChange = useCallback(
    (c: string) => {
      setCode(c);
      saveDraft(draftId, c);
    },
    [draftId],
  );

  const onCheck = useCallback(
    (r: CheckResult) => {
      if (!task) return;
      const { xp, first } = useApp.getState().recordCodeTask(task, r.ok);
      setResult({ result: r, xp, first });
      feedback(r.ok ? "complete" : "wrong");
    },
    [task],
  );

  const onRunError = useCallback((m: string | null) => setRunError(m), []);

  // Итог проверки может оказаться ниже экрана (телефон) — подкручиваем к нему.
  useEffect(() => {
    if (result) bannerRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [result]);

  const reset = () => {
    if (code !== defaultCode && !confirmReset) {
      setConfirmReset(true);
      return;
    }
    clearDraft(draftId);
    setCode(defaultCode);
    setResult(null);
    setRunError(null);
    setConfirmReset(false);
  };

  const next = task ? nextUnsolved(info.tasks, task.id, codeTasks) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      {task ? (
        <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
          <TaskPanel task={task} editor={info.editor} solutionOpenable={canShowSolution(stat)} />
        </div>
      ) : (
        <p className="rounded-3xl border-2 border-border bg-surface px-4 py-3 font-semibold text-muted">{t("ide.sandbox.about")}</p>
      )}

      <div className="flex min-w-0 flex-col gap-3">
        <Workspace task={task} code={code} onCodeChange={onCodeChange} onCheck={onCheck} onRunError={onRunError} />

        {result && task && <ResultBanner ref={bannerRef} state={result} next={next ? { href: `/code/${lang}/${next.id}` } : null} listHref={`/code/${lang}`} />}

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="sm:flex-1">
            <IdeAiHelp lang={lang} task={task} code={code} error={runError} solved={stat?.solved} />
          </div>
          <Button
            variant="secondary"
            icon={<RotateCcw size={18} />}
            disabled={code === defaultCode}
            onClick={reset}
            onBlur={() => setConfirmReset(false)}
            className="sm:flex-1"
          >
            {t(confirmReset ? "ide.task.resetSure" : task ? "ide.task.reset" : "ide.sandbox.reset")}
          </Button>
        </div>
      </div>
    </div>
  );
}
