"use client";

import { Info, Timer } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n/useT";
import {
  convertUnits,
  formatNumber,
  INFO_UNITS,
  parseDecimal,
  transferTime,
  UNIT_LABEL,
  type InfoUnit,
} from "@/lib/calc";
import { cn } from "@/lib/cn";

const inputClass =
  "h-12 min-w-0 flex-1 rounded-xl border-2 border-border bg-surface-2 px-3 font-mono text-xl font-bold text-text outline-none placeholder:text-muted focus:border-primary";
const selectClass =
  "h-12 w-[7.5rem] shrink-0 rounded-xl border-2 border-border bg-surface-2 px-2 text-base font-bold text-text outline-none focus:border-primary";

function UnitSelect({
  value,
  onChange,
  label,
  suffix = "",
}: {
  value: InfoUnit;
  onChange: (u: InfoUnit) => void;
  label: string;
  suffix?: string;
}) {
  const { l } = useT();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as InfoUnit)} aria-label={label} className={selectClass}>
      {INFO_UNITS.map((u) => (
        <option key={u} value={u}>
          {l(UNIT_LABEL[u])}
          {suffix}
        </option>
      ))}
    </select>
  );
}

function Label({ children, htmlFor, hidden }: { children: string; htmlFor?: string; hidden?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={cn("text-xs font-extrabold uppercase tracking-wide text-muted", hidden && "sr-only")}>
      {children}
    </label>
  );
}

/** Единицы информации (бит, байт, Кбайт…) и время передачи файла. */
export function UnitsTool() {
  const { t, l } = useT();
  const [value, setValue] = useState("1");
  const [from, setFrom] = useState<InfoUnit>("KB");
  const [to, setTo] = useState<InfoUnit>("bit");
  const [size, setSize] = useState("");
  const [sizeUnit, setSizeUnit] = useState<InfoUnit>("MB");
  const [speed, setSpeed] = useState("");
  const [speedUnit, setSpeedUnit] = useState<InfoUnit>("KB");

  const v = parseDecimal(value);
  const converted = v === null ? null : convertUnits(v, from, to);

  const sz = parseDecimal(size);
  const sp = parseDecimal(speed);
  const time = sz !== null && sp !== null ? transferTime(sz, sizeUnit, sp, speedUnit) : null;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2.5">
        <Label htmlFor="tools-units-value" hidden>
          {t("tools.units")}
        </Label>
        <div className="flex gap-2">
          <input
            id="tools-units-value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder={t("tools.value")}
            aria-label={t("tools.value")}
            className={cn(inputClass, v === null && value.trim() !== "" && "border-danger focus:border-danger")}
          />
          <UnitSelect value={from} onChange={setFrom} label={t("tools.unitFrom")} />
        </div>
        <div className="flex gap-2">
          <output
            className="flex h-12 min-w-0 flex-1 items-center overflow-x-auto rounded-xl bg-primary-soft px-3 font-mono text-xl font-bold text-primary"
            aria-label={t("tools.result")}
          >
            {converted === null ? <span className="text-muted">—</span> : formatNumber(converted)}
          </output>
          <UnitSelect value={to} onChange={setTo} label={t("tools.unitTo")} />
        </div>
        <p className="flex items-start gap-1.5 text-sm text-muted">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
          {t("tools.unitsHint")}
        </p>
      </section>

      <section className="flex flex-col gap-2.5 rounded-2xl border-2 border-border p-3">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-text">
          <Timer size={18} className="text-primary" aria-hidden />
          {t("tools.time")}
        </h3>
        <Label htmlFor="tools-units-size">{t("tools.size")}</Label>
        <div className="flex gap-2">
          <input
            id="tools-units-size"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder="I"
            className={inputClass}
          />
          <UnitSelect value={sizeUnit} onChange={setSizeUnit} label={t("tools.size")} />
        </div>
        <Label htmlFor="tools-units-speed">{t("tools.speed")}</Label>
        <div className="flex gap-2">
          <input
            id="tools-units-speed"
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder="v"
            className={inputClass}
          />
          <UnitSelect value={speedUnit} onChange={setSpeedUnit} label={t("tools.speed")} suffix={t("tools.perSecond")} />
        </div>
        <div className="rounded-xl bg-primary-soft px-3 py-2">
          <div className="text-xs font-extrabold uppercase tracking-wide text-primary">{t("tools.result")}</div>
          <div className="font-mono text-2xl font-bold text-text">
            {time ? (
              <>
                t = {formatNumber(time.seconds)} {t("tools.seconds")}
              </>
            ) : (
              <span className="text-muted">—</span>
            )}
          </div>
        </div>
        {time && (
          <ol className="flex flex-col gap-1.5">
            {time.explain.map((line, i) => (
              <li key={i} className="flex gap-2 text-sm leading-snug text-text">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-extrabold text-primary">
                  {i + 1}
                </span>
                <span className="[overflow-wrap:anywhere]">{l(line)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
