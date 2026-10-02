"use client";

import { ArrowDown, ArrowLeftRight, ArrowUp, ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useT } from "@/i18n/useT";
import {
  arith,
  BASES,
  convert,
  subscript,
  superscript,
  type ArithOp,
  type Base,
  type Conversion,
  type Group,
  type LadderRow,
  type PowerTerm,
} from "@/lib/calc";
import { cn } from "@/lib/cn";
import type { L } from "@/lib/types";

type Ok = Extract<Conversion, { ok: true }>;

const OPS: { op: ArithOp; label: string }[] = [
  { op: "+", label: "+" },
  { op: "-", label: "−" },
  { op: "*", label: "×" },
  { op: "/", label: "÷" },
];

const fieldClass =
  "h-12 w-full rounded-xl border-2 border-border bg-surface-2 px-3 font-mono text-xl font-bold uppercase text-text outline-none placeholder:font-sans placeholder:text-base placeholder:font-semibold placeholder:normal-case placeholder:text-muted focus:border-primary";

/** Нижний индекс основания: не моноширинный, иначе «₁₆» растягивается. */
function Sub({ base }: { base: number }) {
  return <span className="font-sans">{subscript(base)}</span>;
}

/** Ряд кнопок-«чипов» для выбора основания. */
function BaseChips({ label, value, onChange }: { label: string; value: Base; onChange: (b: Base) => void }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-muted">{label}</div>
      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={label}>
        {BASES.map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={value === b}
            onClick={() => onChange(b)}
            className={cn(
              "h-11 rounded-xl border-2 font-mono text-base font-bold transition-colors",
              "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
              value === b ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted hover:text-text",
            )}
          >
            {b}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Поле с подписью-основанием справа (₂, ₈, ₁₀, ₁₆). */
function NumberField({
  value,
  onChange,
  base,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  base: Base;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative min-w-0">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={64}
        placeholder={placeholder}
        aria-label={label}
        className={cn(fieldClass, "pr-10")}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-muted">
        <Sub base={base} />
      </span>
    </div>
  );
}

// ---------- Визуализация шагов ----------

function Cell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("break-all px-1.5 py-1.5", className)}>{children}</td>;
}

function Ladder({ rows, base }: { rows: LadderRow[]; base: Base }) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1 overflow-x-auto rounded-xl border-2 border-border">
          <table className="w-full text-center font-mono text-sm">
            <thead className="bg-surface-2 font-sans text-[11px] font-extrabold text-muted">
              <tr>
                <th className="px-1.5 py-1.5">{t("tools.dividend")}</th>
                <th className="px-1.5 py-1.5">÷{base}</th>
                <th className="px-1.5 py-1.5">{t("tools.quotient")}</th>
                <th className="px-1.5 py-1.5 text-primary">{t("tools.remainder")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <Cell>{r.dividend}</Cell>
                  <Cell className="text-muted">÷{base}</Cell>
                  <Cell>{r.quotient}</Cell>
                  <Cell className="bg-primary-soft font-bold text-primary">
                    {r.remainder}
                    {r.digit !== String(r.remainder) && ` → ${r.digit}`}
                  </Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Стрелка «читаем снизу вверх» */}
        <div className="flex w-5 shrink-0 flex-col items-center text-primary" aria-hidden>
          <ArrowUp size={18} strokeWidth={3} />
          <div className="w-0.5 flex-1 rounded-full bg-primary/40" />
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-sm font-bold text-primary">
        <ArrowUp size={16} aria-hidden /> {t("tools.readUp")}
      </p>
    </div>
  );
}

function Terms({ terms, base, decimal }: { terms: PowerTerm[]; base: Base; decimal: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 font-mono text-sm">
      {terms.map((t, i) => (
        <span key={i} className="contents">
          {i > 0 && <span className="text-muted">+</span>}
          <span className={cn("flex flex-col items-center rounded-xl bg-surface-2 px-2 py-1", t.value === 0 && "opacity-50")}>
            {/^[A-F]$/.test(t.digit) && <span className="text-[11px] text-muted">{t.digit} = {t.value}</span>}
            <span>
              {t.value}·{base}
              {superscript(t.power)}
            </span>
            <span className="font-bold text-primary">{t.product}</span>
          </span>
        </span>
      ))}
      <span className="text-muted">=</span>
      <span className="rounded-xl bg-primary-soft px-2 py-1 font-bold text-primary">
        {decimal}
        <Sub base={10} />
      </span>
    </div>
  );
}

/** Символы строки; первые `dim` символов приглушены (дописанные или отброшенные нули). */
function Dimmed({ text, dim }: { text: string; dim: number }) {
  return (
    <>
      <span className="opacity-35">{text.slice(0, dim)}</span>
      {text.slice(dim)}
    </>
  );
}

/**
 * Блоки «группа → цифра».
 * pack: сверху двоичная группа (слева дописанные нули приглушены), снизу цифра результата.
 * unpack: сверху цифра исходного числа, снизу её двоичная запись (отбрасываемые нули слева приглушены).
 */
function GroupBoxes({ groups, mode, dim }: { groups: Group[]; mode: "pack" | "unpack"; dim: number }) {
  // dim считается по всей строке: раздаём группам по очереди.
  const dims: number[] = [];
  let left = dim;
  for (const g of groups) {
    const d = Math.min(left, g.chunk.length);
    dims.push(d);
    left -= d;
  }
  return (
    <div className="flex flex-wrap gap-2 font-mono">
      {groups.map((g, i) => {
        const bits = (
          <span className="rounded-lg border-2 border-border px-2 py-1 text-base tracking-wider">
            <Dimmed text={g.chunk} dim={dims[i]} />
          </span>
        );
        const digit = (
          <span className="min-w-9 rounded-lg bg-primary-soft px-2 py-1 text-center text-base font-bold text-primary">{g.digit}</span>
        );
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            {mode === "pack" ? bits : digit}
            <ArrowDown size={14} className="text-muted" aria-hidden />
            {mode === "pack" ? digit : bits}
          </div>
        );
      })}
    </div>
  );
}

function Steps({ conv, from, to }: { conv: Ok; from: Base; to: Base }) {
  const { l } = useT();
  const joinedLen = (gs: Group[] | undefined) => (gs ?? []).reduce((s, g) => s + g.chunk.length, 0);
  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <ol className="flex flex-col gap-1.5">
        {conv.explain.map((line: L, i: number) => (
          <li key={i} className="flex gap-2 text-sm leading-snug text-text">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-extrabold text-primary">
              {i + 1}
            </span>
            <span>{l(line)}</span>
          </li>
        ))}
      </ol>
      {conv.method === "ladder" && conv.ladder && <Ladder rows={conv.ladder} base={to} />}
      {conv.method === "powers" && conv.terms && <Terms terms={conv.terms} base={from} decimal={conv.decimal} />}
      {conv.method === "groups" && conv.groups && <GroupBoxes groups={conv.groups} mode="pack" dim={conv.pad ?? 0} />}
      {conv.method === "ungroup" && conv.groups && (
        <GroupBoxes groups={conv.groups} mode="unpack" dim={joinedLen(conv.groups) - conv.result.length} />
      )}
      {conv.method === "via2" && conv.groupsIn && conv.groups && (
        <div className="flex flex-col gap-2">
          <GroupBoxes groups={conv.groupsIn} mode="unpack" dim={joinedLen(conv.groupsIn) - (conv.binary?.length ?? 0)} />
          <div className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-sm font-bold">
            {conv.binary}
            <Sub base={2} />
          </div>
          <GroupBoxes groups={conv.groups} mode="pack" dim={conv.pad ?? 0} />
        </div>
      )}
    </div>
  );
}

// ---------- Действие в системе ----------

function ArithTool({ base }: { base: Base }) {
  const { t } = useT();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [op, setOp] = useState<ArithOp>("+");
  const r = arith(a, b, op, base);
  const sym = OPS.find((o) => o.op === op)!.label;

  let body: ReactNode = <span className="text-muted">—</span>;
  let note: ReactNode = null;
  if (r.ok) {
    body = (
      <>
        {r.result}
        <Sub base={base} />
        {r.remainder !== undefined && r.remainder !== "0" && (
          <span className="ml-2 text-base text-muted">
            ({t("tools.rem")} {r.remainder}
            <Sub base={base} />)
          </span>
        )}
      </>
    );
    note = (
      <p className="text-xs text-muted">
        {t("tools.check")}: {r.decimal.a} {sym} {r.decimal.b} = {r.decimal.result}
        {r.decimal.remainder ? ` (${t("tools.rem")} ${r.decimal.remainder})` : ""}
      </p>
    );
  } else if (r.error === "digit") {
    note = <p className="text-sm font-bold text-danger">{t("tools.invalidDigit", { b: base, d: r.digit ?? "" })}</p>;
  } else if (r.error === "divZero") {
    note = <p className="text-sm font-bold text-danger">{t("tools.divZero")}</p>;
  } else if (r.error === "negative") {
    note = <p className="text-sm font-bold text-danger">{t("tools.negative")}</p>;
  } else if (r.error === "tooBig") {
    note = <p className="text-sm font-bold text-danger">{t("tools.tooBig")}</p>;
  }

  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border-2 border-border p-3">
      <h3 className="text-sm font-extrabold text-text">{t("tools.arith")}</h3>
      <div className="grid grid-cols-2 gap-2">
        <NumberField value={a} onChange={setA} base={base} placeholder="A" label={`${t("tools.number")} A`} />
        <NumberField value={b} onChange={setB} base={base} placeholder="B" label={`${t("tools.number")} B`} />
      </div>
      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={t("tools.arith")}>
        {OPS.map((o) => (
          <button
            key={o.op}
            type="button"
            role="radio"
            aria-checked={op === o.op}
            onClick={() => setOp(o.op)}
            className={cn(
              "h-11 rounded-xl border-2 font-sans text-2xl font-bold transition-colors",
              "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
              op === o.op ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted hover:text-text",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="flex min-h-12 items-center rounded-xl bg-surface-2 px-3 font-mono text-2xl font-bold break-all">{body}</div>
      {note}
    </section>
  );
}

// ---------- Конвертер ----------

/** Умный перевод между системами счисления: показывает не только ответ, но и как он получился. */
export function BaseConverter() {
  const { t } = useT();
  const [value, setValue] = useState("25");
  const [from, setFrom] = useState<Base>(10);
  const [to, setTo] = useState<Base>(2);
  const [stepsOpen, setStepsOpen] = useState(true);

  const conv = convert(value, from, to);

  const swap = () => {
    if (conv.ok) setValue(conv.result);
    setFrom(to);
    setTo(from);
  };

  let error: string | null = null;
  if (!conv.ok) {
    if (conv.error === "digit") error = t("tools.invalidDigit", { b: from, d: conv.digit ?? "" });
    else if (conv.error === "tooBig") error = t("tools.tooBig");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="tools-base-input" className="text-xs font-extrabold uppercase tracking-wide text-muted">
          {t("tools.number")}
        </label>
        <div className="relative">
          <input
            id="tools-base-input"
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={64}
            aria-invalid={error !== null}
            className={cn(fieldClass, "h-14 pr-12 text-2xl", error && "border-danger focus:border-danger")}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg text-muted">
            <Sub base={from} />
          </span>
        </div>
        {error && <p className="text-sm font-bold text-danger">{error}</p>}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <BaseChips label={t("tools.from")} value={from} onChange={setFrom} />
        <button
          type="button"
          onClick={swap}
          aria-label={t("tools.swap")}
          className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-muted transition-colors hover:text-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ArrowLeftRight size={20} aria-hidden />
        </button>
        <BaseChips label={t("tools.to")} value={to} onChange={setTo} />
      </div>

      <div className="rounded-2xl bg-primary-soft px-4 py-3">
        <div className="text-xs font-extrabold uppercase tracking-wide text-primary">{t("tools.result")}</div>
        <div className="mt-1 break-all font-mono text-3xl font-bold text-text">
          {conv.ok ? (
            <>
              {conv.result}
              <Sub base={to} />
            </>
          ) : (
            <span className="text-muted">—</span>
          )}
        </div>
      </div>

      {conv.ok && (
        <section className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setStepsOpen((o) => !o)}
            aria-expanded={stepsOpen}
            className="flex h-10 items-center justify-between rounded-xl text-left text-sm font-extrabold text-text focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t("tools.steps")}
            <ChevronDown size={20} className={cn("text-muted transition-transform", stepsOpen && "rotate-180")} aria-hidden />
          </button>
          {stepsOpen && <Steps conv={conv} from={from} to={to} />}
        </section>
      )}

      <ArithTool base={from} />
    </div>
  );
}
