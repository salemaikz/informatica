"use client";

import { useT } from "@/i18n/useT";
import { superscript } from "@/lib/calc";
import { cn } from "@/lib/cn";
import type { DictKey } from "@/i18n/dict";

const POWERS = Array.from({ length: 21 }, (_, k) => k);

// Степени, которые надо помнить: из них растут единицы информации.
const NOTES: Record<number, DictKey> = { 10: "tools.powKb", 20: "tools.powMb" };

/** Таблица 2⁰ … 2²⁰ — степени двойки, нужные в задачах на объём информации и системы счисления. */
export function PowersTable() {
  const { t } = useT();
  return (
    <ul className="grid grid-cols-2 gap-2">
      {POWERS.map((k) => {
        const note = NOTES[k];
        return (
          <li
            key={k}
            className={cn(
              "flex flex-col justify-center rounded-xl border-2 px-3 py-2",
              note ? "border-primary bg-primary-soft" : "border-border bg-surface",
            )}
          >
            <div className="flex items-baseline justify-between gap-2 font-mono">
              <span className={cn("text-sm", note ? "text-primary" : "text-muted")}>2{superscript(k)}</span>
              <span className="text-lg font-bold text-text">{2 ** k}</span>
            </div>
            {note && <div className="mt-0.5 text-xs font-bold text-primary">{t(note)}</div>}
          </li>
        );
      })}
    </ul>
  );
}
