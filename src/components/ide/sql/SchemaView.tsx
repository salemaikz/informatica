"use client";

import { ChevronDown, Database, KeyRound, Table2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { TableInfo } from "@/lib/ide/sql/db";
import { useT } from "@/i18n/useT";
import { ResultTable } from "./ResultTable";

/**
 * Справка по учебной базе: таблицы и столбцы. Сама панель сворачивается (по умолчанию закрыта — на телефоне место дорого),
 * каждая таблица раскрывается и показывает типы столбцов и первые строки.
 */
export function SchemaView({ tables }: { tables: TableInfo[] | null }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [openTable, setOpenTable] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border-2 border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t("idesql.schema.toggle")}
        className="flex min-h-12 w-full items-center gap-3 px-3 text-left"
      >
        <Database size={20} className="shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold">{t("idesql.schema.title")}</span>
          {!open && tables && <span className="block truncate font-mono text-xs text-muted">{tables.map((x) => x.name).join(" · ")}</span>}
        </span>
        <ChevronDown size={20} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t-2 border-border p-3">
          {!tables && <p className="text-sm text-muted">{t("idesql.schema.loading")}</p>}
          {tables?.map((tb) => {
            const isOpen = openTable === tb.name;
            return (
              <div key={tb.name} className="rounded-xl border-2 border-border">
                <button
                  type="button"
                  onClick={() => setOpenTable(isOpen ? null : tb.name)}
                  aria-expanded={isOpen}
                  aria-label={`${tb.name}: ${t("idesql.schema.expand")}`}
                  className="flex min-h-11 w-full items-start gap-2 px-3 py-2 text-left"
                >
                  <Table2 size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-sm font-extrabold">{tb.name}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {tb.columns.map((c) => (
                        <span key={c.name} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text">
                          {c.name}
                        </span>
                      ))}
                    </span>
                  </span>
                  <ChevronDown size={18} className={cn("mt-0.5 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} aria-hidden />
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-3 border-t-2 border-border px-3 py-3">
                    <p className="text-xs font-bold text-muted">
                      {t("idesql.schema.cols", { n: tb.columns.length })} · {t("idesql.schema.rowsCount", { n: tb.rowCount })}
                    </p>
                    <ul className="flex flex-col gap-1">
                      {tb.columns.map((c) => (
                        <li key={c.name} className="flex items-center gap-2 text-sm">
                          <span className="font-mono font-bold">{c.name}</span>
                          <span className="font-mono text-xs uppercase text-muted">{c.type}</span>
                          {c.pk && (
                            <span className="flex items-center gap-1 rounded-md bg-primary-soft px-1.5 py-0.5 text-xs font-extrabold text-primary">
                              <KeyRound size={12} aria-hidden /> {t("idesql.schema.key")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <ResultTable set={tb.sample} title={t("idesql.schema.sample")} hideCount />
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted">{t("idesql.schema.about")}</p>
        </div>
      )}
    </section>
  );
}
