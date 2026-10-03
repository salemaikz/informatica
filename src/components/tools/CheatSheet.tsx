"use client";

import { Binary, ChevronDown, Code, HardDrive, Sigma, Split, Superscript, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import {
  CHEAT_OPEN_FIRST,
  CHEAT_SECTIONS,
  CHEAT_TITLE,
  FORMULA_ROWS,
  LOGIC_COLUMNS,
  LOGIC_ROWS,
  NS_ROWS,
  nsRows,
  powerCells,
  PYTHON_ROWS,
  toggleSection,
  triads,
  truthTable,
  UNITS_ROWS,
  type CheatRow,
  type CheatSectionId,
} from "./cheat-data";

const ICONS: Record<CheatSectionId, LucideIcon> = {
  units: HardDrive,
  powers: Superscript,
  formulas: Sigma,
  ns: Binary,
  logic: Split,
  python: Code,
};

// Таблицы не зависят от языка и состояния — считаем один раз.
const POWERS = powerCells();
const NS_TABLE = nsRows();
const TRIADS = triads();
const TRUTH = truthTable();

function Rows({ rows }: { rows: CheatRow[] }) {
  const { t } = useT();
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.f} className={cn("rounded-xl px-3 py-2", r.warn ? "bg-warning-soft" : "bg-surface-2")}>
          <div className={cn("break-words font-mono text-base font-bold", r.warn ? "text-warning-strong" : "text-text")}>
            {t(r.f)}
          </div>
          {r.note && <div className="mt-0.5 text-sm leading-snug text-muted">{t(r.note)}</div>}
        </li>
      ))}
    </ul>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 mt-3 text-xs font-extrabold uppercase tracking-wide text-muted first:mt-0">{children}</p>;
}

function Powers() {
  const { t } = useT();
  return (
    <>
      <ul className="grid grid-cols-3 gap-2">
        {POWERS.map((p) => (
          <li
            key={p.exp}
            className={cn(
              "flex min-w-0 flex-col rounded-xl border-2 px-2 py-1.5 font-mono",
              p.mark ? "border-primary bg-primary-soft" : "border-border bg-surface",
            )}
          >
            <span className={cn("text-sm", p.mark ? "font-bold text-primary" : "text-muted")}>{p.label}</span>
            <span className="truncate text-lg font-bold text-text">{p.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm leading-snug text-muted">{t("cheat.powers.hint")}</p>
    </>
  );
}

const cellClass = "px-1 py-1.5 text-center font-mono text-base";

function NumberSystems() {
  const { t } = useT();
  return (
    <>
      <Caption>{t("cheat.ns.base")}</Caption>
      <div className="overflow-hidden rounded-xl">
        <table className="w-full table-fixed border-collapse text-text">
          <thead>
            <tr className="bg-primary-soft text-primary">
              {["10", "2", "8", "16"].map((b) => (
                <th key={b} scope="col" className={cn(cellClass, "font-extrabold")}>
                  {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NS_TABLE.map((r, i) => (
              <tr key={r.dec} className={i % 2 === 0 ? "bg-surface-2" : undefined}>
                <th scope="row" className={cn(cellClass, "font-extrabold")}>
                  {r.dec}
                </th>
                <td className={cellClass}>{r.bin}</td>
                <td className={cellClass}>{r.oct}</td>
                <td className={cellClass}>{r.hex}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Caption>{t("cheat.ns.triads")}</Caption>
      <ul className="grid grid-cols-4 gap-2">
        {TRIADS.map((x) => (
          <li
            key={x.digit}
            className="flex flex-col items-center rounded-xl bg-surface-2 px-1 py-1.5 font-mono text-base leading-tight"
          >
            <span className="font-extrabold text-text">{x.digit}</span>
            <span className="font-bold text-primary">{x.bits}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm leading-snug text-muted">{t("cheat.ns.tetrads")}</p>
      <div className="mt-3">
        <Rows rows={NS_ROWS} />
      </div>
    </>
  );
}

function Logic() {
  const { t } = useT();
  return (
    <>
      <p className="mb-2 font-mono text-sm font-bold text-text">{t("cheat.logic.legend")}</p>
      <Caption>{t("cheat.logic.table")}</Caption>
      <div className="overflow-hidden rounded-xl">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="bg-primary-soft text-primary">
              {LOGIC_COLUMNS.map((c) => (
                <th key={c} scope="col" className="px-0.5 py-1.5 text-center font-mono text-[13px] font-extrabold leading-tight">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRUTH.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-surface-2" : undefined}>
                {row.map((v, j) => (
                  <td
                    key={j}
                    className={cn("py-1.5 text-center font-mono text-base", v ? "font-extrabold text-primary" : "text-muted")}
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-3 mt-1.5 text-sm text-muted">{t("cheat.logic.values")}</p>
      <Rows rows={LOGIC_ROWS} />
    </>
  );
}

function SectionBody({ id }: { id: CheatSectionId }) {
  switch (id) {
    case "units":
      return <Rows rows={UNITS_ROWS} />;
    case "powers":
      return <Powers />;
    case "formulas":
      return <Rows rows={FORMULA_ROWS} />;
    case "ns":
      return <NumberSystems />;
    case "logic":
      return <Logic />;
    case "python":
      return <Rows rows={PYTHON_ROWS} />;
  }
}

/** Шпаргалка: аккордеон из шести секций (единицы, степени двойки, формулы, системы счисления, логика, Python). Первая раскрыта. */
export function CheatSheet() {
  const { t } = useT();
  const [open, setOpen] = useState<ReadonlySet<CheatSectionId>>(() => new Set([CHEAT_OPEN_FIRST]));

  return (
    <div role="group" aria-label={t("cheat.sections")} className="flex flex-col gap-2">
      {CHEAT_SECTIONS.map((id) => {
        const Icon = ICONS[id];
        const expanded = open.has(id);
        return (
          <section key={id} className="rounded-2xl border-2 border-border bg-surface">
            <h3>
              <button
                type="button"
                id={`cheat-head-${id}`}
                aria-expanded={expanded}
                aria-controls={`cheat-body-${id}`}
                onClick={() => setOpen((s) => toggleSection(s, id))}
                className="flex min-h-12 w-full items-center gap-2 rounded-2xl px-3 text-left text-base font-extrabold text-text transition-colors hover:bg-surface-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Icon size={20} className="shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1">{t(CHEAT_TITLE[id])}</span>
                <ChevronDown
                  size={20}
                  className={cn("shrink-0 text-muted transition-transform", expanded && "rotate-180")}
                  aria-hidden
                />
              </button>
            </h3>
            <div
              id={`cheat-body-${id}`}
              role="region"
              aria-labelledby={`cheat-head-${id}`}
              hidden={!expanded}
              className="px-3 pb-3"
            >
              {expanded && <SectionBody id={id} />}
            </div>
          </section>
        );
      })}
    </div>
  );
}
