"use client";

import { Delete } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useT } from "@/i18n/useT";
import {
  CALC_INIT,
  calcPress,
  displayExpr,
  displayResult,
  formatNumber,
  isPlainNumber,
  previewExpression,
  type CalcState,
} from "@/lib/calc";
import { cn } from "@/lib/cn";

type Kind = "num" | "op" | "fn" | "eq";
interface KeyDef {
  key: string;
  label: ReactNode;
  kind: Kind;
}

const KIND_CLASS: Record<Kind, string> = {
  num: "bg-surface-2 text-text",
  op: "bg-primary-soft text-primary font-sans text-3xl font-extrabold",
  fn: "bg-surface-2 text-muted",
  eq: "bg-action-primary text-white",
};

const ROWS: KeyDef[][] = [
  [
    { key: "C", label: "C", kind: "fn" },
    { key: "(", label: "(", kind: "fn" },
    { key: ")", label: ")", kind: "fn" },
    { key: "÷", label: "÷", kind: "op" },
  ],
  [
    { key: "7", label: "7", kind: "num" },
    { key: "8", label: "8", kind: "num" },
    { key: "9", label: "9", kind: "num" },
    { key: "×", label: "×", kind: "op" },
  ],
  [
    { key: "4", label: "4", kind: "num" },
    { key: "5", label: "5", kind: "num" },
    { key: "6", label: "6", kind: "num" },
    { key: "-", label: "−", kind: "op" },
  ],
  [
    { key: "1", label: "1", kind: "num" },
    { key: "2", label: "2", kind: "num" },
    { key: "3", label: "3", kind: "num" },
    { key: "+", label: "+", kind: "op" },
  ],
  [
    { key: "⌫", label: <Delete size={22} aria-hidden />, kind: "fn" },
    { key: "0", label: "0", kind: "num" },
    { key: ".", label: ",", kind: "num" },
    { key: "=", label: "=", kind: "eq" },
  ],
];

/** Обычный калькулятор, как на ЕНТ: четыре действия и скобки. Клавиатура работает, пока панель в фокусе. */
export function Calculator({ active }: { active: boolean }) {
  const { t } = useT();
  const [st, setSt] = useState<CalcState>(CALC_INIT);
  const press = useCallback((k: string) => setSt((s) => calcPress(s, k)), []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      // Только когда фокус в панели и не в поле ввода (иначе перехватим набор текста).
      if (!target?.closest("[data-toolbox]") || target.closest("input, textarea, select, [contenteditable]")) return;
      // На кнопке Enter/пробел — обычное нажатие кнопки.
      if (target.closest("button") && (e.key === "Enter" || e.key === " ")) return;
      const k = e.key;
      let key: string | null = null;
      if (/^[0-9]$/.test(k) || (k.length === 1 && "+-*/().,=xX:−".includes(k))) key = k;
      else if (k === "Enter") key = "=";
      else if (k === "Backspace") key = "⌫";
      else if (k === "Delete") key = "C";
      if (key === null) return;
      e.preventDefault();
      press(key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, press]);

  const { expr, fresh, prev } = st;
  const plain = isPlainNumber(expr);
  const preview = fresh || plain || expr === "" ? null : previewExpression(expr);
  // После «=» в состоянии полная точность, на дисплее — округлённый результат.
  const big =
    expr === ""
      ? "0"
      : fresh
        ? displayResult(expr)
        : plain
          ? displayExpr(expr)
          : preview !== null
            ? displayExpr(formatNumber(preview))
            : "—";
  const line = fresh ? (prev ? `${displayExpr(prev)} =` : "") : plain ? "" : displayExpr(expr);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-2xl bg-surface-2 px-4 py-3 text-right [@media(max-height:700px)]:py-2"
        role="group"
        aria-label={t("tools.calc")}
      >
        <div className="min-h-6 max-h-16 overflow-y-auto break-all font-mono text-base text-muted" aria-hidden={!line}>
          {line || " "}
        </div>
        <div
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            "mt-1 break-all font-mono font-bold text-text",
            big.length > 18 ? "text-xl" : big.length > 11 ? "text-2xl" : "text-4xl",
            big === "—" && "text-muted",
          )}
        >
          {big}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {ROWS.flat().map((k) => (
          <button
            key={k.key}
            type="button"
            // Не уводим фокус с панели — иначе Enter повторит нажатие кнопки, а не вычислит.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => press(k.key)}
            aria-label={k.key === "⌫" ? t("tools.backspace") : k.key === "=" ? t("tools.equals") : k.key === "C" ? t("tools.clear") : undefined}
            className={cn(
              // На низких экранах (360×640) клавиши ниже, чтобы весь нижний ряд помещался без прокрутки.
              "flex h-14 items-center justify-center rounded-2xl font-mono text-2xl font-bold transition-[transform,filter] duration-75 [@media(max-height:700px)]:h-12",
              "select-none hover:brightness-95 active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
              KIND_CLASS[k.kind],
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
