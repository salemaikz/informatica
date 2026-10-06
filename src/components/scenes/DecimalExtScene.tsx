"use client";

import { Fragment } from "react";
import { m } from "motion/react";
import { CountUp } from "@/components/motion/CountUp";
import { springBouncy, springSoft } from "@/components/motion/presets";
import { subscript } from "@/lib/calc";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { Scene } from "@/lib/types";
import { ColumnRow, DigitTile, WeightChip } from "./primitives";
import { monoFit, tileMetrics } from "./logic";
import { baseColumnWidth, baseParts, baseSumTerms, peelSteps, placesFit, sup, valueInBase, type PeelStep } from "./numbers";

type DecimalData = Extract<Scene, { kind: "decimal" }>;

/** Строка суммы «7·256 + 14·16 + 3 = 2019»: слагаемые мягко выскакивают, итог «накручивается». */
function BaseSum({ terms, total, delay }: { terms: { id: string; text: string }[]; total: number; delay: number }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSoft, delay }}
      className="mx-auto mt-2 flex w-fit max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl border-2 border-border bg-surface px-4 py-2 font-mono text-lg font-bold"
    >
      {terms.map((term, i) => (
        <Fragment key={term.id}>
          {i > 0 && <span className="text-muted">+</span>}
          <m.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...springBouncy, delay: delay + 0.1 + i * 0.07 }}>
            {term.text}
          </m.span>
        </Fragment>
      ))}
      <span className="text-muted">=</span>
      <CountUp value={total} delay={delay + 0.2 + terms.length * 0.07} className="text-2xl font-extrabold text-ink-success" />
    </m.div>
  );
}

/** Шаг «отрываем цифру»: остаток n % q — это цифра, частное n // q — число без неё. */
function PeelRow({ step, font, index, wide }: { step: PeelStep; font: number; index: number; wide: boolean }) {
  const { t } = useT();
  const named = step.q > 10 && step.digit >= 10;
  return (
    <m.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSoft, delay: 0.05 + index * 0.12 }}
      className="flex items-center gap-3 rounded-2xl border-2 border-border bg-surface px-3 py-2"
    >
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-extrabold text-ink-primary" aria-label={t("scene.decimal.peelStep", { n: step.n })}>
        {step.n}
      </span>
      <div className={cn("min-w-0 flex-1 font-mono font-bold leading-snug", wide && "flex flex-col gap-0.5")} style={{ fontSize: font }}>
        <div className="whitespace-nowrap">
          <span>
            {step.cur} % {step.q} ={" "}
          </span>
          <span className="rounded-md bg-gold-soft px-1.5 py-0.5 text-ink-warning">
            {step.digit}
            {named ? ` (${step.ch})` : ""}
          </span>
        </div>
        <div className="whitespace-nowrap">
          <span>
            {step.cur} {"//"} {step.q} ={" "}
          </span>
          <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-ink-primary">{step.next}</span>
        </div>
      </div>
    </m.li>
  );
}

/** Десятичная запись с основанием (веса q³ q² q¹ q⁰ и сумма) или пошаговое «отрывание» цифр (% q, // q). */
export function DecimalExtScene({ scene }: { scene: DecimalData }) {
  const { t } = useT();
  const base = scene.base ?? 10;

  if (scene.peel !== undefined && scene.peel !== false) {
    const steps = peelSteps(scene.number, scene.base, scene.peel);
    const longest = Math.max(...steps.flatMap((s) => [`${s.cur} // ${s.q} = ${s.next}`.length, `${s.cur} % ${s.q} = ${s.digit}${s.q > 10 && s.digit >= 10 ? ` (${s.ch})` : ""}`.length]));
    // Ширина карточки: 328 − 24 (поля) − 28 (значок) − 12 (зазор) ≈ 260 px под текст.
    const font = Math.min(15, monoFit(longest + 2, 250, 15));
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-2" role="group" aria-label={t("scene.decimal.ariaPeel", { number: scene.number, base })}>
        {base !== 10 && (
          <p className="text-center font-mono text-base font-bold text-text">
            {scene.number}
            {subscript(base)} = {valueInBase(scene.number, base)}
          </p>
        )}
        <ol className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <PeelRow key={s.n} step={s} font={font} index={i} wide />
          ))}
        </ol>
        <div className="flex flex-col items-center gap-1.5 pt-1">
          <span className="text-sm font-extrabold text-muted">{t("scene.decimal.peelDigits")}</span>
          {/* Первая найденная цифра — справа: ряд читается как исходная запись */}
          <div className="flex flex-row-reverse flex-wrap items-center justify-center gap-1.5">
            {steps.map((s, i) => (
              <WeightChip key={s.n} label={s.ch} tone="gold" delay={0.3 + i * 0.12} fontSize={15} className="min-w-8" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const parts = baseParts(scene.number, base);
  const n = parts.length;
  const mt = tileMetrics(n);
  const keys = parts.map((_, i) => n - 1 - i);
  const colW = baseColumnWidth(n, mt.max);
  const chipFont = n <= 4 ? 14 : n <= 6 ? 13 : 11;
  const showPlaces = placesFit(parts, colW, chipFont);
  const total = valueInBase(scene.number, base);
  const chipsDone = 0.2 + n * 0.1;

  return (
    <div className="flex w-full flex-col gap-2" role="img" aria-label={`${t("scene.decimal.ariaBase", { number: scene.number, base })} = ${total}`}>
      <ColumnRow
        keys={keys}
        max={mt.max}
        gap={5}
        reserve
        trailing={<span className="pb-1 font-mono text-xl font-bold leading-none text-muted">{subscript(base)}</span>}
        render={(_, i) => <DigitTile digit={parts[i].ch} height={mt.h} fontSize={mt.font} delay={i * 0.04} />}
      />
      <ColumnRow
        keys={keys}
        max={mt.max}
        gap={5}
        reserve
        render={(_, i) => <WeightChip label={`${base}${sup(parts[i].exp)}`} tone="primary" delay={0.15 + (n - 1 - i) * 0.1} fontSize={chipFont} />}
      />
      {showPlaces && (
        <ColumnRow
          keys={keys}
          max={mt.max}
          gap={5}
          reserve
          render={(_, i) => <WeightChip label={parts[i].place} tone="plain" delay={0.25 + (n - 1 - i) * 0.1} fontSize={chipFont} />}
        />
      )}
      <BaseSum terms={baseSumTerms(parts)} total={total} delay={chipsDone} />
    </div>
  );
}
