"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, Pencil } from "lucide-react";
import { useEffect, useMemo } from "react";
import { CodeBlock } from "@/components/scenes/CodeScene";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { PyError, PyStep } from "@/lib/python/types";
import { useT } from "@/i18n/useT";
import { ErrorCard } from "./ErrorCard";

/** Имена переменных, которые появились или изменились по сравнению с прошлым шагом. */
function changed(prev: PyStep | undefined, cur: PyStep): Set<string> {
  if (!prev || prev.scope !== cur.scope) return new Set();
  const before = new Map(prev.vars.map((v) => [v.name, v.value]));
  return new Set(cur.vars.filter((v) => before.get(v.name) !== v.value).map((v) => v.name));
}

/** Пошаговое выполнение: код с текущей строкой, переменные, вывод на этот момент, навигация по шагам. */
export function StepView({
  code,
  steps,
  index,
  onIndex,
  error,
  stderr,
  onExit,
}: {
  code: string;
  steps: PyStep[];
  index: number;
  onIndex: (i: number) => void;
  error: PyError | null;
  stderr: string;
  onExit: () => void;
}) {
  const { t } = useT();
  const step = steps[index];
  const last = steps.length - 1;
  const isLast = index === last;
  const fresh = useMemo(() => changed(steps[index - 1], step), [steps, index, step]);
  const lines = code.replace(/\n+$/, "").split("\n");
  // На последнем шаге (программа завершена) показываем строку ошибки, если она была.
  const active = step.line > 0 ? step.line - 1 : error?.line ? error.line - 1 : undefined;

  // Стрелки ← → листают шаги.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Alt+← — «назад» в браузере, Ctrl/Cmd+стрелки — свои действия: такие нажатия не трогаем.
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight" && index < last) onIndex(index + 1);
      else if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, last, onIndex]);

  const status =
    step.line > 0
      ? t("python.steps.line", { line: step.line }) + (step.scope ? ` · ${t("python.steps.inFunc", { name: step.scope })}` : "")
      : error
        ? t("python.steps.stopped")
        : t("python.steps.done");

  return (
    <section aria-label={t("python.steps.title")} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 text-lg font-extrabold leading-tight">{t("python.steps.title")}</h2>
        <Button size="sm" variant="secondary" className="h-11 shrink-0 whitespace-nowrap" icon={<Pencil size={16} aria-hidden />} onClick={onExit}>
          {t("python.steps.exit")}
        </Button>
      </div>

      <CodeBlock lines={lines} lang="python" active={active} marks={step.line === 0 && error?.line ? [error.line - 1] : undefined} className="text-[14px] [font-variant-ligatures:none]" />

      <div
        aria-live="polite"
        className={cn(
          "rounded-xl px-3 py-2 text-[15px] font-bold",
          step.line > 0 ? "bg-primary-soft text-primary" : error ? "bg-danger-soft text-danger" : "bg-success-soft text-success",
        )}
      >
        {status}
      </div>

      <div className="flex items-center gap-2">
        <Button size="md" variant="secondary" aria-label={t("python.steps.first")} title={t("python.steps.first")} disabled={index === 0} onClick={() => onIndex(0)} className="px-3">
          <ChevronsLeft size={20} aria-hidden />
        </Button>
        <Button size="md" variant="secondary" disabled={index === 0} onClick={() => onIndex(index - 1)} icon={<ChevronLeft size={20} aria-hidden />} className="flex-1 px-2">
          {t("python.steps.prev")}
        </Button>
        <Button size="md" variant="primary" disabled={isLast} onClick={() => onIndex(index + 1)} className="flex-1 px-2">
          {t("python.steps.next")}
          <ChevronRight size={20} aria-hidden />
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={last}
          value={index}
          onChange={(e) => onIndex(Number(e.target.value))}
          aria-label={t("python.steps.counter", { n: index + 1, total: steps.length })}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-[var(--primary)]"
        />
        <span className="shrink-0 text-sm font-bold tabular-nums text-muted">{t("python.steps.counter", { n: index + 1, total: steps.length })}</span>
      </div>

      <div>
        <h3 className="mb-1 text-[13px] font-extrabold text-muted">{t("python.steps.vars")}</h3>
        {step.vars.length === 0 ? (
          <p className="text-sm font-semibold text-muted">{t("python.steps.varsEmpty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse font-mono text-[14px] [font-variant-ligatures:none]">
              <thead>
                <tr className="bg-surface-2 text-left font-sans text-[12px] font-extrabold text-muted">
                  <th className="px-3 py-1.5">{t("python.steps.col.name")}</th>
                  <th className="px-3 py-1.5">{t("python.steps.col.value")}</th>
                  <th className="px-3 py-1.5">{t("python.steps.col.type")}</th>
                </tr>
              </thead>
              <tbody>
                {step.vars.map((v) => (
                  <tr key={v.name} className={cn("border-t border-border transition-colors", fresh.has(v.name) && "bg-primary-soft")}>
                    <td className="px-3 py-1.5 font-bold">{v.name}</td>
                    <td className="break-all px-3 py-1.5">{v.value}</td>
                    <td className="px-3 py-1.5 text-muted">{v.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-[13px] font-extrabold text-muted">{t("python.output")}</h3>
        <pre className="min-h-10 overflow-x-auto rounded-xl border border-border bg-surface px-3 py-2 font-mono text-[14px] leading-6 [font-variant-ligatures:none]">
          {step.stdout || <span className="font-sans text-muted">{t("python.steps.outEmpty")}</span>}
        </pre>
      </div>

      {isLast && error && <ErrorCard error={error} stderr={stderr} />}
    </section>
  );
}
