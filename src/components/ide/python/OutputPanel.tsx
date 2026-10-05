"use client";

import { CircleAlert, Clock, Loader2, Square, WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { PyRunResult } from "@/lib/ide/python/runner";

// Окно вывода программы Python: загрузка, выполнение, вывод, ошибка, таймаут, «остановлена».
// Общее для рабочей области практикума (Workspace) и запуска программы в сцене кода (RunPanel).

/** Сколько символов вывода показываем (остальное обрезаем — длинный вывод тормозит страницу). */
export const SHOW_LIMIT = 20000;

export type RunPhase = "idle" | "loading" | "running";

export function OutputPanel({
  phase,
  result,
  errorLine,
  idleText = true,
  eofText,
}: {
  phase: RunPhase;
  result: PyRunResult | null;
  errorLine: (e: { line: number | null; text: string }) => string;
  /** Показывать подсказку «Нажмите «Запустить»…», пока запусков не было. */
  idleText?: boolean;
  /** Подсказка при EOFError, если поле ввода называется не «Входные данные». */
  eofText?: string;
}) {
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
        idleText && <p className="rounded-xl bg-surface-2 px-3 py-3 text-sm text-muted">{t("idepy.out.idle")}</p>
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
              ) : !result.error && !result.timedOut && !result.stopped ? (
                <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">{t("idepy.out.empty")}</p>
              ) : null}
              {(result.cut || stdout.length > SHOW_LIMIT) && <p className="text-xs font-bold text-warning-strong">{t("idepy.out.cut")}</p>}
              {/* «Стоп»: нейтральный статус — не ошибка и не таймаут. */}
              {result.stopped && (
                <div className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-3 text-sm text-muted">
                  <Square size={16} fill="currentColor" className="mt-0.5 shrink-0" aria-hidden />
                  <div>
                    <p className="font-extrabold text-text">{t("iderun.stopped")}</p>
                    {shown && <p className="mt-0.5 font-semibold">{t("iderun.stopped.hint")}</p>}
                  </div>
                </div>
              )}
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
                  {result.error.text.startsWith("EOFError") && <p className="mt-1 text-sm font-semibold text-text">{eofText ?? t("idepy.err.eof")}</p>}
                </div>
              )}
              {!result.timedOut && !result.stopped && <p className="text-xs text-muted">{t("idepy.out.time", { ms: result.ms })}</p>}
            </>
          )}
        </>
      )}
    </section>
  );
}
