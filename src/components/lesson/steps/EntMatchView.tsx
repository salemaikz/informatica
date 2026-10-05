"use client";

import { Check, Minus, X } from "lucide-react";
import { m, type Variants } from "motion/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { EntMatchStep } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { matchPoints } from "@/lib/ent";
import { feedback } from "@/lib/feedback";
import { ignoreKey } from "@/lib/keys";
import { plainText } from "@/lib/text";
import { InlineMarkdown } from "@/components/Markdown";
import { springBouncy, springSoft } from "@/components/motion/presets";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { Pill } from "@/components/ui/Pill";
import type { StepProps } from "./types";

const LETTERS = ["A", "B", "C", "D"] as const;
/** Описание — число или выражение из цифр: моноширинный шрифт (как варианты в ChoiceView). */
const NUMERIC = /^[0-9₀-₉\s,.+=−-]+$/u;

type BtnState = "idle" | "selected" | "correct" | "wrong" | "dim";

const BTN: Record<BtnState, string> = {
  idle: "border-border bg-surface shadow-[0_3px_0_var(--border)] hover:bg-surface-2",
  selected: "border-primary bg-primary-soft text-primary shadow-[0_3px_0_var(--primary)]",
  correct: "border-success bg-success-soft text-success-strong shadow-[0_3px_0_var(--success)]",
  wrong: "border-danger bg-danger-soft text-danger shadow-[0_3px_0_var(--danger)]",
  dim: "border-border bg-surface opacity-50",
};

/** Движение кнопок-номеров: выбор — «поп», верный — всплеск, неверный — одно встряхивание (≤ 400 мс). */
const MOTION: Variants = {
  idle: { scale: 1, x: 0, transition: { type: "spring", stiffness: 520, damping: 30 } },
  dim: { scale: 1, x: 0 },
  selected: { scale: [1, 1.06, 1], x: 0, transition: { duration: 0.22, ease: "easeOut" } },
  correct: { scale: [1, 1.07, 1], x: 0, transition: { duration: 0.3, ease: "easeOut" } },
  wrong: { scale: 1, x: [0, -6, 6, -3, 3, 0], transition: { duration: 0.36, ease: "easeInOut" } },
};

/** Цифры 1–4 — выбор описания для активного пункта (цифры из калькулятора и полей ввода не считаются). */
function useDigitKeys(count: number, onPick: (c: number) => void, disabled: boolean) {
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (ignoreKey(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= count) onPick(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, onPick, disabled]);
}

/**
 * «Соответствие» как на ЕНТ (бланк на телефоне): описания 1–4 списком, под ним пункты A и B, у каждого —
 * четыре кнопки-номера. Один номер можно выбрать у обоих пунктов. Проверяет плеер («Проверить»):
 * после проверки верный номер зелёный, выбранный неверный красный; итог — 2 / 1 / 0 балла (один пункт — янтарным).
 */
export function EntMatchView({ step, answer, onAnswer, locked }: StepProps<EntMatchStep>) {
  const { t, l } = useT();
  const reduce = useReduceMotion();
  const uid = useId();
  const refs = useRef<(HTMLButtonElement | null)[][]>([]);
  const rowsRef = useRef<HTMLDivElement>(null);
  // Пункт, которому достанутся цифровые клавиши: первый без выбора, иначе тот, что выбирали последним.
  const [active, setActive] = useState(0);

  const rows = step.items.length;
  const count = step.choices.length;
  const picks: (number | null)[] =
    answer?.type === "entmatch" && answer.picks.length === rows ? answer.picks : step.items.map(() => null);
  const complete = picks.every((p) => p !== null);
  const points = locked && complete ? matchPoints(step.answer, picks) : null;

  const pick = (row: number, c: number) => {
    if (locked) return;
    feedback("tap");
    const next = picks.map((p, i) => (i === row ? c : p));
    onAnswer({ type: "entmatch", picks: next });
    const open = next.findIndex((p) => p === null);
    setActive(open >= 0 ? open : row);
  };
  useDigitKeys(count, (c) => pick(Math.min(active, rows - 1), c), locked);

  const stateOf = (row: number, c: number): BtnState => {
    const chosen = picks[row] === c;
    if (!locked) return chosen ? "selected" : "idle";
    if (c === step.answer[row]) return "correct";
    return chosen ? "wrong" : "dim";
  };

  // Стрелки внутри пункта — как у радиокнопок: фокус и выбор переходят к соседнему номеру.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, row: number, c: number) => {
    if (locked) return;
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (c + d + count) % count;
    pick(row, n);
    refs.current[row]?.[n]?.focus();
  };

  // Панель проверки закрывает низ экрана — после проверки прокручиваем страницу, чтобы пункты A и B были видны над панелью.
  // Высоту панели берём у самой панели (в плеере это единственный <footer>); сверху оставляем место под шапку.
  useEffect(() => {
    if (!locked) return;
    const id = window.setTimeout(() => {
      const el = rowsRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const limit = document.querySelector("footer")?.getBoundingClientRect().top ?? window.innerHeight;
      const need = rect.bottom + 12 - limit;
      const room = rect.top - 72;
      if (need > 0 && room > 0) window.scrollBy({ top: Math.min(need, room), behavior: reduce ? "auto" : "smooth" });
    }, 400);
    return () => window.clearTimeout(id);
  }, [locked, reduce]);

  const scoreTone = points === 2 ? "success" : points === 1 ? "warning" : "danger";

  return (
    <div className="flex flex-col gap-4" data-step-kind="entmatch">
      <p className="text-sm font-bold text-muted">{t("entfmt.match.hint")}</p>

      <ol aria-label={t("entfmt.match.descs")} className="flex flex-col gap-2 rounded-2xl bg-surface-2/60 p-3">
        {step.choices.map((c, i) => {
          const text = l(c);
          const rightFor = locked ? step.answer.flatMap((a, row) => (a === i ? [row] : [])) : [];
          return (
            <li key={i} className="flex items-start gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-surface text-sm font-extrabold text-muted">{i + 1}</span>
              <span className={cn("min-w-0 flex-1 pt-0.5 font-semibold", NUMERIC.test(plainText(text)) && "font-mono")}>
                <InlineMarkdown>{text}</InlineMarkdown>
              </span>
              {rightFor.map((row) => (
                <span key={row} className="mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-success-soft px-1.5 text-xs font-extrabold text-success-strong">
                  <span aria-hidden>{LETTERS[row]}</span>
                  <span className="sr-only">{t("entfmt.match.rightFor", { letter: LETTERS[row] })}</span>
                </span>
              ))}
            </li>
          );
        })}
      </ol>

      <div ref={rowsRef} className="flex flex-col gap-4">
        {step.items.map((item, row) => {
          const rowRight = locked && picks[row] === step.answer[row];
          const rowWrong = locked && !rowRight;
          return (
            <m.div
              key={row}
              role="radiogroup"
              aria-labelledby={`${uid}-row${row}`}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springSoft, delay: reduce ? 0 : 0.05 * row }}
              className={cn("rounded-2xl border-2 bg-surface p-3 transition-colors", rowRight ? "border-success/50" : rowWrong ? "border-danger/50" : "border-border")}
            >
              <p id={`${uid}-row${row}`} className="mb-2.5 flex items-start gap-2 font-extrabold">
                <span className="min-w-0 flex-1">
                  <span className="mr-2 text-primary">{LETTERS[row]} —</span>
                  <InlineMarkdown>{l(item)}</InlineMarkdown>
                </span>
                {locked && (
                  <span className={cn("mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white", rowRight ? "bg-success" : "bg-danger")}>
                    {rowRight ? <Check size={14} strokeWidth={3.5} aria-hidden /> : <X size={14} strokeWidth={3.5} aria-hidden />}
                    <span className="sr-only">{t(rowRight ? "entfmt.match.rowRight" : "entfmt.match.rowWrong")}</span>
                  </span>
                )}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {step.choices.map((_, c) => {
                  const state = stateOf(row, c);
                  const tabbable = picks[row] === c || (picks[row] === null && c === 0);
                  return (
                    <m.button
                      key={c}
                      ref={(el) => {
                        (refs.current[row] ??= [])[c] = el;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={picks[row] === c}
                      aria-label={t("entfmt.match.option", { n: c + 1 })}
                      tabIndex={tabbable ? 0 : -1}
                      disabled={locked}
                      onClick={() => pick(row, c)}
                      onFocus={() => !locked && setActive(row)}
                      onKeyDown={(e) => onKeyDown(e, row, c)}
                      initial={false}
                      animate={state}
                      variants={MOTION}
                      whileTap={locked ? undefined : { scale: 0.94 }}
                      className={cn(
                        "relative flex h-12 min-w-0 items-center justify-center gap-1 rounded-xl border-2 text-lg font-extrabold transition-[translate,background-color,border-color,box-shadow] duration-100 active:translate-y-[2px]",
                        BTN[state],
                        locked && "pointer-events-none",
                      )}
                    >
                      {state === "correct" && (
                        // Короткая вспышка-кольцо вокруг верного номера (как у вариантов ответа, один раз).
                        <span aria-hidden className="pointer-events-none absolute -inset-1 rounded-2xl border-4 border-success animate-ring-out" />
                      )}
                      <span aria-hidden>{c + 1}</span>
                      {state === "correct" && <Check size={14} strokeWidth={3.5} aria-hidden />}
                      {state === "wrong" && <X size={14} strokeWidth={3.5} aria-hidden />}
                    </m.button>
                  );
                })}
              </div>
            </m.div>
          );
        })}
        {/* Баллы как на ЕНТ — под пунктами: попадают в видимую область над панелью проверки и ничего не сдвигают выше. */}
        {points !== null && (
          <m.div className="flex" initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={springBouncy}>
            <Pill
              tone={scoreTone}
              className="px-3 py-1 text-sm"
              icon={points === 2 ? <Check size={14} strokeWidth={3.5} aria-hidden /> : points === 1 ? <Minus size={14} strokeWidth={3.5} aria-hidden /> : <X size={14} strokeWidth={3.5} aria-hidden />}
            >
              {t(`entfmt.score.${points}`)}
            </Pill>
          </m.div>
        )}
      </div>
    </div>
  );
}
