"use client";

import { CircleAlert, Crosshair, RotateCw } from "lucide-react";
import { explainError } from "@/lib/python/errors";
import type { PyError } from "@/lib/python/types";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";

/** Ошибка Python с понятным объяснением, номером строки и исходным сообщением. */
export function ErrorCard({
  error,
  stderr,
  onShowLine,
  onRetryLoad,
}: {
  error: PyError;
  stderr?: string;
  onShowLine?: (line: number) => void;
  onRetryLoad?: () => void;
}) {
  const { t, lang } = useT();
  const ex = explainError(error, lang);
  // У служебных ошибок (загрузка, сбой воркера) нет traceback — показываем их сообщение.
  const raw = stderr || (error.type === "LoadError" || error.type === "InternalError" ? error.message : "");
  return (
    <div role="alert" className="rounded-2xl border-2 border-danger/40 bg-danger-soft p-3.5">
      <div className="flex items-start gap-2.5">
        <CircleAlert size={22} className="mt-0.5 shrink-0 text-danger" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-extrabold text-danger">{ex.title}</span>
            {ex.line != null && <span className="text-sm font-bold text-muted">{t("python.error.line", { line: ex.line })}</span>}
          </div>
          <p className="mt-1 text-[15px] font-semibold leading-snug">{ex.hint}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 empty:hidden">
        {ex.line != null && onShowLine && (
          <Button size="sm" variant="secondary" className="h-11" icon={<Crosshair size={16} aria-hidden />} onClick={() => onShowLine(ex.line!)}>
            {t("python.error.showLine", { line: ex.line })}
          </Button>
        )}
        {ex.kind === "load" && onRetryLoad && (
          <Button size="sm" variant="secondary" className="h-11" icon={<RotateCw size={16} aria-hidden />} onClick={onRetryLoad}>
            {t("python.load.retry")}
          </Button>
        )}
      </div>
      {raw && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-bold text-muted">{t("python.error.raw")}</summary>
          <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-surface p-2.5 font-mono text-[13px] leading-5 [font-variant-ligatures:none]">{raw}</pre>
        </details>
      )}
    </div>
  );
}
