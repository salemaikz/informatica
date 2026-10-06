"use client";

import clsx from "clsx";
import { ArrowRight, ArrowUp, Laptop, Lightbulb, Router, Server } from "lucide-react";
import type { VisualId } from "@/lib/types";
import { divisionLadder } from "@/lib/check";
import { useT } from "@/i18n/useT";

// Иллюстрации к теории — лёгкие React-компоненты вместо картинок.

const delay = (i: number) => ({ animationDelay: `${i * 120}ms`, animationFillMode: "both" as const });

function Digit({ d, accent, i }: { d: string; accent?: boolean; i: number }) {
  return (
    <span
      style={delay(i)}
      className={clsx(
        "flex h-14 w-12 items-center justify-center rounded-2xl border-2 font-mono text-3xl font-bold animate-pop",
        accent ? "border-gold bg-gold-soft text-warning-strong" : "border-border bg-surface",
      )}
    >
      {d}
    </span>
  );
}

function PlaceValues() {
  const digits = ["3", "4", "5"];
  const weights = ["100", "10", "1"];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        {digits.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Digit d={d} i={i} />
            <span className="rounded-md bg-primary-soft px-2 font-mono text-sm font-bold text-primary">×{weights[i]}</span>
          </div>
        ))}
      </div>
      <p className="font-mono text-lg font-bold">
        300 + 40 + 5 = <span className="text-primary">345</span>
      </p>
    </div>
  );
}

function BinaryWeights() {
  const bits = "1011".split("");
  const weights = [8, 4, 2, 1];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        {bits.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Digit d={d} i={i} accent={d === "1"} />
            <span className={clsx("rounded-md px-2 font-mono text-sm font-bold", d === "1" ? "bg-gold-soft text-warning-strong" : "bg-surface-2 text-muted line-through")}>
              {weights[i]}
            </span>
          </div>
        ))}
      </div>
      <p className="font-mono text-lg font-bold">
        8 + 2 + 1 = <span className="text-primary">11</span>
      </p>
    </div>
  );
}

function Ladder() {
  const { t } = useT();
  const rows = divisionLadder(13);
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={i} style={delay(i)} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-1.5 font-mono text-base font-bold animate-fade-in">
            <span className="w-7 text-right">{r.value}</span>
            <span className="text-muted">: 2 = {r.quotient}</span>
            <span className="ml-1 rounded-md bg-gold-soft px-2 text-warning-strong">
              {r.remainder}
            </span>
            <span className="hidden text-xs font-sans text-muted sm:inline">{t("ladder.remainder")}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-1 text-primary">
        <ArrowUp size={22} strokeWidth={3} />
        <span className="font-mono text-2xl font-bold">
          1101<sub className="text-sm">2</sub>
        </span>
      </div>
    </div>
  );
}

function Lamps() {
  return (
    <div className="flex items-center justify-center gap-8">
      {[true, false].map((on, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <span
            className={clsx(
              "flex h-16 w-16 items-center justify-center rounded-full border-2",
              on ? "border-gold bg-gold text-white shadow-[0_0_24px_var(--gold)]" : "border-border bg-surface-2 text-muted",
            )}
          >
            <Lightbulb size={30} />
          </span>
          <span className="font-mono text-3xl font-bold">{on ? 1 : 0}</span>
        </div>
      ))}
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return <div className="overflow-x-auto"><table className="w-full text-center font-mono text-sm"><thead><tr>{columns.map((column) => <th key={column} className="border-b-2 border-primary/30 p-2 text-primary">{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell} className={clsx("border-b border-border p-2", cell === row.length - 1 && "font-extrabold text-success-strong")}>{value}</td>)}</tr>)}</tbody></table></div>;
}

function InformationUnits() {
  const { l } = useT();
  return <div className="flex flex-col gap-2 font-mono text-center text-lg font-bold">{[
    { ru: "8 бит = 1 байт", kk: "8 бит = 1 байт" },
    { ru: "1024 байта = 1 Кбайт", kk: "1024 байт = 1 Кбайт" },
    { ru: "1024 Кбайта = 1 Мбайт", kk: "1024 Кбайт = 1 Мбайт" },
  ].map((line) => <div key={line.ru} className="rounded-xl bg-primary-soft px-3 py-2 text-primary">{l(line)}</div>)}</div>;
}

function NetworkFlow() {
  const { l } = useT();
  return <div className="flex items-center justify-center gap-2 sm:gap-4">{[
    { Icon: Laptop, title: { ru: "Устройство", kk: "Құрылғы" } },
    { Icon: Router, title: { ru: "Шлюз", kk: "Шлюз" } },
    { Icon: Server, title: { ru: "Сервер", kk: "Сервер" } },
  ].map(({ Icon, title }, index) => <div key={title.ru} className="flex items-center gap-2 sm:gap-4">{index > 0 && <ArrowRight size={18} className="shrink-0 text-primary" />}<div className="flex flex-col items-center gap-2 text-primary"><Icon size={30} /><span className="text-xs font-bold">{l(title)}</span></div></div>)}</div>;
}

function SqlPipeline() {
  const { l } = useT();
  return <div className="flex flex-col items-center gap-2">{[
    { label: "FROM", text: { ru: "4 строки", kk: "4 жол" } },
    { label: "WHERE score ≥ 80", text: { ru: "2 строки: 80 и 90", kk: "2 жол:80 және90" } },
    { label: "SELECT COUNT(*)", text: { ru: "Результат: 2", kk: "Нәтиже:2" } },
  ].map((step, index) => <div key={step.label} className="w-full max-w-sm">{index > 0 && <div className="py-1 text-center text-primary">↓</div>}<div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-surface p-3 text-sm"><code className="font-bold text-primary">{step.label}</code><span className="font-semibold">{l(step.text)}</span></div></div>)}</div>;
}

function SheetReferences() {
  const { l } = useT();
  return <div className="flex flex-col gap-3 text-center"><div className="rounded-xl bg-primary-soft p-3 font-mono font-bold text-primary">=A2 × $B$1</div><p className="text-sm font-semibold text-muted">{l({ ru: "Копируем на строку вниз", kk: "Бір жол төмен көшіреміз" })}</p><div className="rounded-xl bg-success-soft p-3 font-mono font-bold text-success-strong">=A3 × $B$1</div></div>;
}

function GraphPath() {
  const { l } = useT();
  return <svg viewBox="0 0 300 150" role="img" aria-label={l({ ru: "Граф: AB=2, BC=3, AC=8, CD=1. Путь через B короче.", kk: "Граф:AB=2,BC=3,AC=8,CD=1. B арқылы жол қысқа." })} className="mx-auto w-full max-w-sm text-primary"><g fill="none" stroke="currentColor" strokeWidth="3"><path d="M30 90 L120 30 L210 90 L270 90" /><path d="M30 90 L210 90" strokeDasharray="5 5" /></g><g fill="var(--surface)" stroke="currentColor" strokeWidth="2">{[[30,90],[120,30],[210,90],[270,90]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="15" />)}</g><g fill="currentColor" fontSize="14" fontWeight="700" textAnchor="middle">{[[30,95,"A"],[120,35,"B"],[210,95,"C"],[270,95,"D"],[68,45,"2"],[167,45,"3"],[120,115,"8"],[240,75,"1"]].map(([x,y,label],i) => <text key={i} x={x} y={y}>{label}</text>)}</g></svg>;
}

export function Visual({ id }: { id: VisualId }) {
  const content = {
    "place-values": <PlaceValues />, "binary-weights": <BinaryWeights />, "division-ladder": <Ladder />, lamps: <Lamps />,
    "truth-table": <DataTable columns={["A", "B", "A ∧ B", "A ∨ B"]} rows={[["0","0","0","0"],["0","1","0","1"],["1","0","0","1"],["1","1","1","1"]]} />,
    "code-trace": <DataTable columns={["i", "s = s + i"]} rows={[["1","1"],["2","3"],["3","6"]]} />,
    "information-units": <InformationUnits />, "network-flow": <NetworkFlow />, "sql-pipeline": <SqlPipeline />,
    "sheet-references": <SheetReferences />, "graph-path": <GraphPath />,
  }[id];
  return <div className="rounded-3xl bg-surface-2/60 px-4 py-5">{content}</div>;
}
