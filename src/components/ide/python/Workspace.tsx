"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, Clock, Footprints, Loader2, Play, SquareCheckBig, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CodeEditor } from "@/components/ide/CodeEditor";
import { Tracer } from "./Tracer";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { CheckResult, WorkspaceProps } from "@/lib/ide/types";
import { checkPython } from "@/lib/ide/python/check";
import { runPython, type PyRunResult, type RunStatus } from "@/lib/ide/python/runner";
import { highlightFor, type TraceData } from "@/lib/ide/python/trace";

// Рабочая область Python: редактор, «Входные данные», запуск, пошаговое выполнение, проверка задачи.
// Python — Pyodide в Web Worker (грузится при первом запуске), таймаут 5 с.

/** Сколько символов вывода показываем (остальное обрезаем — длинный вывод тормозит страницу). */
const SHOW_LIMIT = 20000;

type Phase = "idle" | "loading" | "running";

export function Workspace({ task, code, onCodeChange, onCheck, onRunError }: WorkspaceProps) {
  const { t } = useT();
  const taskId = task?.id ?? "sandbox";
  const pyCheck = task?.check.kind === "python" ? task.check : null;
  const defaultStdin = pyCheck?.tests[0]?.stdin ?? "";

  // Ввод: пока ученик не менял — берём ввод первого теста задачи (без эффектов).
  const [stdinState, setStdinState] = useState<{ key: string; value: string } | null>(null);
  const stdin = stdinState && stdinState.key === taskId ? stdinState.value : defaultStdin;

  const [phase, setPhase] = useState<Phase>("idle");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<PyRunResult | null>(null);
  const [trace, setTrace] = useState<{ data: TraceData; code: string } | null>(null);
  const [step, setStep] = useState(0);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const busy = phase !== "idle";
  const onStatus = (s: RunStatus) => {
    if (mounted.current) setPhase(s);
  };

  /** Ошибка программы одной строкой: «строка 3: NameError: …» — для вывода и для ИИ-объяснения. */
  const errorLine = (e: { line: number | null; text: string }) => (e.line ? `${t("idepy.err.line", { n: e.line })}: ${e.text}` : e.text);

  async function run(withTrace: boolean) {
    if (busy) return;
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
    setChecking(true);
    setPhase("running");
    setTrace(null);
    let firstError: string | null = null;
    const res: CheckResult = await checkPython(pyCheck, code, async (c, s) => {
      const r = await runPython({ code: c, stdin: s, onStatus });
      if (firstError === null && r.error) firstError = errorLine(r.error);
      return r;
    });
    if (!mounted.current) return;
    setPhase("idle");
    setChecking(false);
    onRunError?.(firstError);
    onCheck(res);
  }

  const tracing = trace !== null;

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="min-w-0 space-y-3">
        <CodeEditor
          value={code}
          onChange={onCodeChange}
          language="python"
          ariaLabel={t("idepy.editor.aria")}
          minHeight={240}
          readOnly={tracing}
          highlightLine={trace ? highlightFor(trace.data, step) : undefined}
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
          <Button variant="primary" size="lg" disabled={busy} onClick={() => run(false)} icon={<Play size={20} aria-hidden />}>
            {t("idepy.run")}
          </Button>
          <Button variant="secondary" size="lg" disabled={busy} onClick={() => run(true)} icon={<Footprints size={20} aria-hidden />}>
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
        {trace && !busy ? (
          <Tracer trace={trace.data} code={trace.code} index={step} onIndex={setStep} onClose={() => setTrace(null)} />
        ) : (
          <OutputPanel phase={phase} result={result} errorLine={errorLine} />
        )}
      </div>
    </div>
  );
}

function OutputPanel({ phase, result, errorLine }: { phase: Phase; result: PyRunResult | null; errorLine: (e: { line: number | null; text: string }) => string }) {
  const { t } = useT();
  const stdout = result?.stdout ?? "";
  const shown = stdout.length > SHOW_LIMIT ? stdout.slice(0, SHOW_LIMIT) : stdout;

  return (
    <section aria-label={t("idepy.out.title")} aria-live="polite" className="space-y-2 rounded-2xl border-2 border-border bg-surface p-3">
      <h3 className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("idepy.out.title")}</h3>

      {phase === "loading" ? (
        <div className="flex items-start gap-3 rounded-xl bg-primary-soft px-3 py-3">
          <Loader2 size={20} className="mt-0.5 shrink-0 animate-spin text-primary" aria-hidden />
          <div>
            <p className="text-sm font-extrabold text-primary">{t("idepy.loading")}</p>
            <p className="mt-0.5 text-xs text-muted">{t("idepy.loading.hint")}</p>
          </div>
        </div>
      ) : phase !== "idle" ? (
        <p className="flex items-center gap-2 px-1 py-2 text-sm font-bold text-muted">
          <Loader2 size={18} className="animate-spin text-primary" aria-hidden />
          {t("idepy.running")}
        </p>
      ) : !result ? (
        <p className="rounded-xl bg-surface-2 px-3 py-3 text-sm text-muted">{t("idepy.out.idle")}</p>
      ) : (
        <>
          {result.loadFailed ? (
            <div className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-3 text-sm font-bold text-warning-strong">
              <WifiOff size={18} className="mt-0.5 shrink-0" aria-hidden />
              <p>{t("idepy.loadFail")}</p>
            </div>
          ) : (
            <>
              {shown ? (
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-surface-2 px-3 py-2 font-mono text-[15px]">{shown}</pre>
              ) : !result.error && !result.timedOut ? (
                <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">{t("idepy.out.empty")}</p>
              ) : null}
              {(result.cut || stdout.length > SHOW_LIMIT) && <p className="text-xs font-bold text-warning-strong">{t("idepy.out.cut")}</p>}
              {result.timedOut && (
                <div className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-3 text-sm text-warning-strong">
                  <Clock size={18} className="mt-0.5 shrink-0" aria-hidden />
                  <div>
                    <p className="font-extrabold">{t("idepy.timeout")}</p>
                    <p className="mt-0.5 font-semibold">{t("idepy.timeout.hint")}</p>
                  </div>
                </div>
              )}
              {result.error && (
                <div className={cn("rounded-xl border-2 border-danger/30 bg-danger-soft px-3 py-2 text-danger")}>
                  <p className="flex items-center gap-2 text-sm font-extrabold">
                    <CircleAlert size={18} className="shrink-0" aria-hidden />
                    {t("idepy.err.title")}
                  </p>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm font-semibold">{errorLine(result.error)}</pre>
                  {result.error.text.startsWith("EOFError") && <p className="mt-1 text-sm font-semibold text-text">{t("idepy.err.eof")}</p>}
                </div>
              )}
              {!result.timedOut && <p className="text-xs text-muted">{t("idepy.out.time", { ms: result.ms })}</p>}
            </>
          )}
        </>
      )}
    </section>
  );
}
