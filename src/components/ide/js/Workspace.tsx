"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, Clock, Loader2, Play, Square, SquareCheckBig, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CodeEditor } from "@/components/ide/CodeEditor";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { CheckResult, WorkspaceProps } from "@/lib/ide/types";
import { checkJs } from "@/lib/ide/js/check";
import { runJs, stopJs, type JsRunResult } from "@/lib/ide/js/runner";

// Рабочая область JavaScript: редактор, запуск в Web Worker (таймаут 3 с), вывод console.log, проверка задачи.

/** Сколько символов вывода показываем (остальное обрезаем — длинный вывод тормозит страницу). */
const SHOW_LIMIT = 20000;

export function Workspace({ task, code, onCodeChange, onCheck, onRunError }: WorkspaceProps) {
  const { t } = useT();
  const jsCheck = task?.check.kind === "js" ? task.check : null;
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<JsRunResult | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopJs();
    };
  }, []);

  /** Ошибка программы одной строкой: «строка 3: ReferenceError: …» — для вывода и для ИИ-объяснения. */
  const errorLine = (e: { line: number | null; text: string }) => (e.line ? `${t("ideweb.js.err.line", { n: e.line })}: ${e.text}` : e.text);
  const problem = (r: JsRunResult) => (r.error ? errorLine(r.error) : r.timedOut ? t("ideweb.js.timeout") : null);

  async function run() {
    if (busy) return;
    setBusy(true);
    const r = await runJs(code);
    if (!mounted.current) return;
    setBusy(false);
    setResult(r);
    onRunError?.(problem(r));
  }

  // «Стоп»: прервать запуск или проверку (этап 14) — запуск завершится с результатом `stopped`.
  const stop = () => stopJs();

  async function check() {
    if (busy || !jsCheck) return;
    setBusy(true);
    setChecking(true);
    let last: JsRunResult | null = null;
    const res: CheckResult = await checkJs(jsCheck, code, async (c) => {
      last = await runJs(c);
      return last;
    });
    if (!mounted.current) return;
    setBusy(false);
    setChecking(false);
    // «Стоп» — не попытка: итог проверки не показываем и в статистику не пишем.
    if ((last as JsRunResult | null)?.stopped) {
      setResult(last);
      onRunError?.(null);
      return;
    }
    if (last) {
      setResult(last);
      onRunError?.(problem(last));
    }
    onCheck(res);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="min-w-0 space-y-3">
        <CodeEditor value={code} onChange={onCodeChange} language="javascript" ariaLabel={t("ideweb.js.editor.aria")} minHeight={240} />
        <div className="grid grid-cols-2 gap-2">
          {busy ? (
            <Button
              variant="secondary"
              size="lg"
              block
              className={jsCheck ? undefined : "col-span-2"}
              onClick={stop}
              icon={<Square size={18} fill="currentColor" aria-hidden />}
            >
              {t("iderun.stop")}
            </Button>
          ) : (
            <Button variant="primary" size="lg" block className={jsCheck ? undefined : "col-span-2"} onClick={run} icon={<Play size={20} aria-hidden />}>
              {t("ideweb.js.run")}
            </Button>
          )}
          {jsCheck && (
            <Button
              variant="success"
              size="lg"
              block
              disabled={busy}
              onClick={check}
              icon={checking ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <SquareCheckBig size={20} aria-hidden />}
            >
              {checking ? t("ideweb.checking") : t("ideweb.check")}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted">{t("ideweb.js.note")}</p>
      </div>

      <div className="min-w-0">
        <OutputPanel busy={busy} result={result} errorLine={errorLine} />
      </div>
    </div>
  );
}

function OutputPanel({ busy, result, errorLine }: { busy: boolean; result: JsRunResult | null; errorLine: (e: { line: number | null; text: string }) => string }) {
  const { t } = useT();

  return (
    <section aria-label={t("ideweb.js.out.title")} aria-live="polite" className="space-y-2 rounded-2xl border-2 border-border bg-surface p-3">
      <h3 className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("ideweb.js.out.title")}</h3>

      {busy ? (
        <p className="flex items-center gap-2 px-1 py-2 text-sm font-bold text-muted">
          <Loader2 size={18} className="animate-spin text-primary" aria-hidden />
          {t("ideweb.js.running")}
        </p>
      ) : !result ? (
        <p className="rounded-xl bg-surface-2 px-3 py-3 text-sm text-muted">{t("ideweb.js.out.idle")}</p>
      ) : result.loadFailed ? (
        <div className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-3 text-sm font-bold text-warning-strong">
          <WifiOff size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p>{t("ideweb.js.loadFail")}</p>
        </div>
      ) : (
        <>
          <Lines result={result} />
          {(result.cut || limitLines(result.lines).truncated) && <p className="text-xs font-bold text-warning-strong">{t("ideweb.js.out.cut")}</p>}
          {/* «Стоп»: нейтральный статус — не ошибка и не таймаут. */}
          {result.stopped && (
            <div className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-3 text-sm text-muted">
              <Square size={16} fill="currentColor" className="mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="font-extrabold text-text">{t("iderun.stopped")}</p>
                {result.lines.length > 0 && <p className="mt-0.5 font-semibold">{t("iderun.stopped.hint")}</p>}
              </div>
            </div>
          )}
          {result.timedOut && (
            <div className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-3 text-sm text-warning-strong">
              <Clock size={18} className="mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="font-extrabold">{t("ideweb.js.timeout")}</p>
                <p className="mt-0.5 font-semibold">{t("ideweb.js.timeout.hint")}</p>
              </div>
            </div>
          )}
          {result.error && (
            <div className="rounded-xl border-2 border-danger/30 bg-danger-soft px-3 py-2 text-danger">
              <p className="flex items-center gap-2 text-sm font-extrabold">
                <CircleAlert size={18} className="shrink-0" aria-hidden />
                {t("ideweb.js.err.title")}
              </p>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm font-semibold">{errorLine(result.error)}</pre>
            </div>
          )}
          {!result.timedOut && !result.stopped && <p className="text-xs text-muted">{t("ideweb.js.out.time", { ms: result.ms })}</p>}
        </>
      )}
    </section>
  );
}

/** Вывод построчно: warn — янтарным, error — красным. */
function Lines({ result }: { result: JsRunResult }) {
  const { t } = useT();
  if (result.lines.length === 0) {
    return result.error || result.timedOut || result.stopped ? null : <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">{t("ideweb.js.out.empty")}</p>;
  }
  const { shown } = limitLines(result.lines);
  return (
    <div className="max-h-72 overflow-auto rounded-xl bg-surface-2 px-3 py-2 font-mono text-[15px]">
      {shown.map((l, i) => (
        <pre key={i} className={cn("whitespace-pre-wrap break-words", l.level === "warn" && "text-warning-strong", l.level === "error" && "text-danger")}>
          {l.text || " "}
        </pre>
      ))}
    </div>
  );
}

/** Первые строки вывода, пока не набралось SHOW_LIMIT символов; последняя строка режется по остатку. */
function limitLines(lines: JsRunResult["lines"]): { shown: JsRunResult["lines"]; truncated: boolean } {
  const shown: JsRunResult["lines"] = [];
  let used = 0;
  for (const l of lines) {
    const room = SHOW_LIMIT - used;
    if (l.text.length + 1 > room) {
      if (room > 0) shown.push({ ...l, text: l.text.slice(0, room) });
      return { shown, truncated: true };
    }
    used += l.text.length + 1;
    shown.push(l);
  }
  return { shown, truncated: false };
}
