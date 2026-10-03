"use client";

import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Footprints, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { changedVars, codeLine, outputAt, TRACE_STEP_LIMIT, type TraceData } from "@/lib/ide/python/trace";

// Пошаговое выполнение: как в задачах ЕНТ «что выведет программа». Подсветку строки в редакторе делает Workspace
// (по номеру шага), здесь — управление шагами, текущая строка, таблица переменных и вывод к этому моменту.

export interface TracerProps {
  trace: TraceData;
  /** Код, с которым собрана трассировка. */
  code: string;
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}

export function Tracer({ trace, code, index, onIndex, onClose }: TracerProps) {
  const { t } = useT();
  const last = trace.steps.length - 1;
  const step = trace.steps[index];
  if (!step) return null;
  const changed = changedVars(trace, index);
  const out = outputAt(trace, index);
  const atEnd = step.line === null;
  const errorHere = atEnd && index === last && trace.error;
  const text = codeLine(code, step.line ?? trace.error?.line ?? null);

  return (
    <section aria-label={t("idepy.trace.title")} className="space-y-3 rounded-2xl border-2 border-border bg-surface p-3">
      <header className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-extrabold">
          <Footprints size={18} className="text-primary" aria-hidden />
          {t("idepy.trace.title")}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-sm font-bold text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-3 focus-visible:outline-primary"
        >
          <X size={16} aria-hidden />
          {t("idepy.trace.close")}
        </button>
      </header>

      {/* Текущая строка */}
      <div
        className={cn(
          "rounded-xl border-2 px-3 py-2",
          errorHere ? "border-danger/40 bg-danger-soft" : atEnd ? "border-success/40 bg-success-soft" : "border-primary/30 bg-primary-soft",
        )}
        aria-live="polite"
      >
        {atEnd ? (
          errorHere ? (
            <p className="flex items-start gap-2 text-sm font-bold text-danger">
              <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                {t("idepy.trace.errorHere")}
                {trace.error?.line ? ` (${t("idepy.trace.atLine", { n: trace.error.line })})` : ""}: <span className="font-mono">{trace.error?.text}</span>
              </span>
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm font-bold text-success">
              <CircleCheck size={18} aria-hidden />
              {t("idepy.trace.end")}
            </p>
          )
        ) : (
          <>
            <p className="text-xs font-bold text-muted">
              {t("idepy.trace.now")} · {t("idepy.trace.atLine", { n: step.line ?? 0 })}
              {step.fn ? ` · ${t("idepy.trace.inFn", { name: step.fn })}` : ""}
            </p>
            <pre className="overflow-x-auto font-mono text-[15px] font-semibold text-text">{text || " "}</pre>
          </>
        )}
      </div>

      {/* Управление шагами */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md" className="flex-1" disabled={index <= 0} onClick={() => onIndex(index - 1)} icon={<ChevronLeft size={20} aria-hidden />}>
            {t("idepy.trace.back")}
          </Button>
          <Button variant="primary" size="md" className="flex-1" disabled={index >= last} onClick={() => onIndex(index + 1)}>
            {t("idepy.trace.forward")}
            <ChevronRight size={20} aria-hidden />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={Math.max(last, 0)}
            value={index}
            onChange={(e) => onIndex(Number(e.target.value))}
            aria-label={t("idepy.trace.slider")}
            aria-valuetext={t("idepy.trace.step", { i: index + 1, n: trace.steps.length })}
            className="h-6 min-w-0 flex-1 accent-primary"
          />
          <span className="shrink-0 text-xs font-bold tabular-nums text-muted">{t("idepy.trace.step", { i: index + 1, n: trace.steps.length })}</span>
        </div>
      </div>

      {/* Переменные */}
      <div>
        <h4 className="mb-1 text-xs font-extrabold uppercase tracking-wide text-muted">{t("idepy.trace.vars")}</h4>
        {step.vars.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">{t("idepy.trace.noVars")}</p>
        ) : (
          <table className="w-full table-fixed border-separate border-spacing-y-1 text-sm">
            <tbody>
              {step.vars.map(([name, value]) => {
                const isChanged = changed.has(name);
                return (
                  <tr key={name}>
                    <th
                      scope="row"
                      className={cn("w-2/5 rounded-l-lg px-3 py-1.5 text-left font-mono font-bold", isChanged ? "bg-primary-soft text-primary" : "bg-surface-2")}
                    >
                      <span className="block truncate">{name}</span>
                    </th>
                    <td className={cn("rounded-r-lg px-3 py-1.5 font-mono", isChanged ? "bg-primary-soft font-bold text-primary" : "bg-surface-2")}>
                      <span className="block break-all">{value}</span>
                      {isChanged && <span className="sr-only"> ({t("idepy.trace.changed")})</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="mt-1 text-xs text-muted">{t("idepy.trace.hint")}</p>
      </div>

      {/* Вывод к этому моменту */}
      <div>
        <h4 className="mb-1 text-xs font-extrabold uppercase tracking-wide text-muted">{t("idepy.trace.out")}</h4>
        <pre className="max-h-40 min-h-10 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-surface-2 px-3 py-2 font-mono text-sm">
          {out || <span className="font-sans text-muted">{t("idepy.trace.outEmpty")}</span>}
        </pre>
      </div>

      {trace.truncated && <p className="text-xs font-bold text-warning-strong">{t("idepy.trace.truncated", { n: TRACE_STEP_LIMIT })}</p>}
    </section>
  );
}
