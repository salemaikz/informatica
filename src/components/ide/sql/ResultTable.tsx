"use client";

import { cn } from "@/lib/cn";
import { cellText, DISPLAY_ROWS, type Cell, type ResultSet } from "@/lib/ide/sql/db";
import { useT } from "@/i18n/useT";

/** Результат запроса: «Строк: N» и таблица (до 100 строк). Широкая таблица прокручивается внутри своей рамки. */
export function ResultTable({ set, title, hideCount, className }: { set: ResultSet; title?: string; /** Не показывать «Строк: N» (образец первых строк). */ hideCount?: boolean; className?: string }) {
  const { t } = useT();
  const shown = set.rows.slice(0, DISPLAY_ROWS);
  const truncated = set.total > shown.length;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {title && <p className="text-sm font-extrabold">{title}</p>}
        {!hideCount && (
          <span className="rounded-lg bg-primary-soft px-2 py-0.5 text-xs font-extrabold text-primary">
            {t("idesql.result.rows", { n: set.total })}
          </span>
        )}
        {truncated && <span className="text-xs font-bold text-muted">{t("idesql.result.shown", { n: shown.length })}</span>}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border-2 border-warning/40 bg-warning-soft px-4 py-3 text-sm font-bold">{t("idesql.result.empty")}</p>
      ) : (
        <div role="region" aria-label={t("idesql.result.table")} tabIndex={0} className="max-h-80 overflow-auto rounded-2xl border-2 border-border bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {set.columns.map((c, i) => (
                  <th key={i} scope="col" className="sticky top-0 whitespace-nowrap bg-surface-2 px-3 py-2 text-left font-mono text-xs font-extrabold text-muted">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row, r) => (
                <tr key={r} className="border-t border-border">
                  {row.map((v, c) => (
                    <td key={c} className={cn("whitespace-nowrap px-3 py-2 font-mono tabular-nums", cellTone(v))}>
                      {cellText(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const cellTone = (v: Cell) => (v === null ? "italic text-muted" : "");
