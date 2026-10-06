"use client";

import { useEffect, useRef, useState } from "react";
import { Footprints, Loader2, Play, Square, SquareCheckBig } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CodeEditor } from "@/components/ide/CodeEditor";
import { OutputPanel, type RunPhase } from "./OutputPanel";
import { Tracer } from "./Tracer";
import { useT } from "@/i18n/useT";
import type { CheckResult, WorkspaceProps } from "@/lib/ide/types";
import { checkPython } from "@/lib/ide/python/check";
import { PY_FORBID } from "@/lib/ide/python/tasks";
import { runPython, stopPython, type PyRunResult, type RunStatus } from "@/lib/ide/python/runner";
import { highlightFor, type TraceData } from "@/lib/ide/python/trace";

// Рабочая область Python: редактор, «Входные данные», запуск, пошаговое выполнение, проверка задачи.
// Python — Pyodide в Web Worker (грузится при первом запуске), таймаут 5 с; пока идёт запуск, проверка или трассировка,
// кнопка «Запустить» становится «Стоп» (этап 14).

type Phase = RunPhase;

export function Workspace({ task, code, onCodeChange, onCheck, onRunError, beforeRun }: WorkspaceProps) {
  const { t } = useT();
  const taskId = task?.id ?? "sandbox";
  const pyCheck = task?.check.kind === "python" ? task.check : null;
  // В песочнице пример кода просит имя — подставляем его, чтобы первый запуск не падал с EOFError.
  const defaultStdin = pyCheck ? (pyCheck.tests[0]?.stdin ?? "") : "Aru\n";

  // Ввод: пока ученик не менял — берём ввод первого теста задачи (без эффектов).
  const [stdinState, setStdinState] = useState<{ key: string; value: string } | null>(null);
  const stdin = stdinState && stdinState.key === taskId ? stdinState.value : defaultStdin;

  const [phase, setPhase] = useState<Phase>("idle");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<PyRunResult | null>(null);
  const [trace, setTrace] = useState<{ data: TraceData; code: string } | null>(null);
  const [step, setStep] = useState(0);

  const mounted = useRef(true);
  // Идёт ли запуск — для остановки при уходе со страницы: воркер один, иначе следующая проверка (например, в уроке) ждала бы.
  const busyRef = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (busyRef.current) stopPython();
    };
  }, []);

  const busy = phase !== "idle";
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
  const onStatus = (s: RunStatus) => {
    if (mounted.current) setPhase(s);
  };

  /** Ошибка программы одной строкой: «строка 3: NameError: …» — для вывода и для ИИ-объяснения. */
  const errorLine = (e: { line: number | null; text: string }) => (e.line ? `${t("idepy.err.line", { n: e.line })}: ${e.text}` : e.text);

  async function run(withTrace: boolean) {
    if (busy) return;
    if (beforeRun && !beforeRun()) return;
    setPhase("running");
    setTrace(null);
    const r = await runPython({ code, stdin, trace: withTrace, onStatus });
    if (!mounted.current) return;
    setPhase("idle");
    setResult(r);
    onRunError?.(r.error ? errorLine(r.error) : r.timedOut ? t("idepy.timeout") : null);
    if (withTrace && r.trace && r.trace.steps.length > 0) {
      setTrace({ data: r.trace, code });
      setStep(0);
    }
  }

  async function check() {
    if (busy || !pyCheck) return;
    if (beforeRun && !beforeRun()) return;
    setChecking(true);
    setPhase("running");
    setTrace(null);
    let firstError: string | null = null;
    const flags = { stopped: false };
    const res: CheckResult = await checkPython(
      pyCheck,
      code,
      async (c, s) => {
        const r = await runPython({ code: c, stdin: s, quiet: true, onStatus });
        if (r.stopped) flags.stopped = true;
        if (firstError === null && r.error) firstError = errorLine(r.error);
        if (firstError === null && r.timedOut) firstError = t("idepy.timeout");
        return r;
      },
      task ? PY_FORBID[task.id] : undefined,
    );
    if (!mounted.current) return;
    setPhase("idle");
    setChecking(false);
    // «Стоп» — не попытка: итог проверки не показываем и в статистику не пишем.
    if (flags.stopped) {
      setResult({ stdout: "", stopped: true, ms: 0 });
      onRunError?.(null);
      return;
    }
    onRunError?.(firstError);
    onCheck(res);
  }

  // Трассировка относится к коду, на котором она снята: если код изменили снаружи (например, «Сбросить») — она неактуальна.
  const activeTrace = trace && trace.code === code ? trace : null;
  const tracing = activeTrace !== null;

  return (
    <div className="@container grid gap-4 @3xl:grid-cols-2 @3xl:items-start">
      <div className="min-w-0 space-y-3">
        <CodeEditor
          value={code}
          onChange={onCodeChange}
          language="python"
          ariaLabel={t("idepy.editor.aria")}
          minHeight={240}
          readOnly={tracing}
          highlightLine={activeTrace ? highlightFor(activeTrace.data, step) : undefined}
        />

        <div>
          <label htmlFor={`idepy-stdin-${taskId}`} className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-muted">
            {t("idepy.input.title")}
          </label>
          <textarea
            id={`idepy-stdin-${taskId}`}
            value={stdin}
            onChange={(e) => setStdinState({ key: taskId, value: e.target.value })}
            aria-label={t("idepy.input.aria")}
            rows={2}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="min-h-16 w-full resize-y rounded-2xl border-2 border-border bg-surface px-3 py-2 font-mono text-[15px] outline-none focus:border-primary"
          />
          <p className="mt-1 text-xs text-muted">{pyCheck ? t("idepy.input.checkNote") : t("idepy.input.hint")}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {busy ? (
            <Button variant="secondary" size="md" onClick={stopPython} icon={<Square size={18} fill="currentColor" aria-hidden />}>
              {t("iderun.stop")}
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={() => run(false)} icon={<Play size={20} aria-hidden />}>
              {t("idepy.run")}
            </Button>
          )}
          <Button variant="secondary" size="md" disabled={busy} onClick={() => run(true)} icon={<Footprints size={20} aria-hidden />}>
            {t("idepy.step")}
          </Button>
          {pyCheck && (
            <Button
              variant="success"
              size="lg"
              block
              className="col-span-2"
              disabled={busy}
              onClick={check}
              icon={checking ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <SquareCheckBig size={20} aria-hidden />}
            >
              {checking ? t("idepy.checking") : t("idepy.check")}
            </Button>
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-3">
        {activeTrace && !busy ? (
          <Tracer trace={activeTrace.data} code={activeTrace.code} index={step} onIndex={setStep} onClose={() => setTrace(null)} />
        ) : (
          <OutputPanel phase={phase} result={result} errorLine={errorLine} />
        )}
      </div>
    </div>
  );
}
