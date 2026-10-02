"use client";

import { X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { Fragment, type ReactNode } from "react";
import { CountUp } from "@/components/motion/CountUp";
import { springBouncy, springSnappy, springSoft } from "@/components/motion/presets";
import { cn } from "@/lib/cn";

// Общие «кирпичики» сцен и песочниц: плитка с цифрой, чип с весом, лампочка, монета, строка суммы.
// Все цвета — токены (светлая и тёмная тема), все анимации — пружины ≤ 400 мс на элемент.

/** Ширина колонки под подстрочный знак «₂» — резервируется во всех рядах, чтобы столбцы совпадали. */
export const SUB_W = 16;

/** Тёмный текст на золотой заливке (монета, лампочка): производное от токена, читается в обеих темах. */
export const ON_GOLD = "text-[color-mix(in_srgb,var(--warning-strong)_45%,#000)]";

// ---------- Ряд столбцов ----------

/**
 * Ряд одинаковых столбцов: flex-1 с потолком ширины — на телефоне 8 цифр сжимаются, на широком экране не растут.
 * Несколько рядов с одним `max`/`gap`/`reserve` выстраиваются в общие столбцы. Ключ столбца — степень двойки
 * (а не позиция), поэтому при смене длины числа существующие столбцы не пересоздаются.
 */
export function ColumnRow({
  keys,
  max,
  gap = 6,
  trailing,
  reserve = false,
  presence = false,
  className,
  render,
}: {
  keys: number[];
  max: number;
  gap?: number;
  /** Содержимое колонки справа (подстрочный знак). */
  trailing?: ReactNode;
  /** Зарезервировать колонку справа, даже если она пустая. */
  reserve?: boolean;
  /** Столбцы появляются и исчезают с анимацией (песочница с добавлением ламп). */
  presence?: boolean;
  className?: string;
  render: (key: number, index: number) => ReactNode;
}) {
  const cols = keys.map((k, i) => (
    <m.div
      key={k}
      layout={presence ? "position" : false}
      initial={presence ? { opacity: 0, scale: 0.5 } : false}
      animate={{ opacity: 1, scale: 1 }}
      exit={presence ? { opacity: 0, scale: 0.5, transition: { duration: 0.14 } } : undefined}
      transition={springSoft}
      className="flex min-w-0 flex-1 justify-center"
      style={{ maxWidth: max }}
    >
      {render(k, i)}
    </m.div>
  ));
  return (
    <div className={cn("relative flex w-full justify-center", className)} style={{ gap }}>
      {presence ? (
        <AnimatePresence initial={false} mode="popLayout">
          {cols}
        </AnimatePresence>
      ) : (
        cols
      )}
      {reserve || trailing ? (
        <div className="flex shrink-0 items-end" style={{ width: SUB_W }}>
          {trailing}
        </div>
      ) : null}
    </div>
  );
}

// ---------- Плитка с цифрой ----------

export type TileTone = "default" | "one" | "zero" | "highlight" | "danger";

const TILE_TONE: Record<TileTone, string> = {
  default: "border-border bg-surface text-text",
  one: "border-gold bg-gold-soft text-warning-strong",
  zero: "border-border bg-surface text-muted",
  highlight: "border-primary bg-primary-soft text-primary-strong ring-4 ring-primary/25",
  danger: "border-danger bg-danger-soft text-danger-strong",
};

/** Крупная цифра в рамке. Смена цифры — лёгкий «поп»; смена тона — плавная перекраска. */
export function DigitTile({
  digit,
  tone = "default",
  height = 56,
  fontSize = 36,
  delay = 0,
  className,
}: {
  digit: string;
  tone?: TileTone;
  height?: number;
  fontSize?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...springBouncy, delay }}
      style={{ height, fontSize }}
      className={cn(
        "flex w-full items-center justify-center rounded-2xl border-2 font-mono font-bold leading-none transition-colors duration-300",
        TILE_TONE[tone],
        className,
      )}
    >
      <span key={digit} className="animate-pop">
        {digit}
      </span>
    </m.div>
  );
}

// ---------- Чип с весом ----------

export type ChipTone = "primary" | "gold" | "muted" | "danger" | "plain";

const CHIP_TONE: Record<ChipTone, string> = {
  primary: "bg-primary-soft text-primary-strong",
  gold: "bg-gold-soft text-warning-strong",
  muted: "bg-surface-2 text-muted",
  danger: "bg-danger-soft text-danger-strong",
  plain: "bg-surface text-text border border-border",
};

/**
 * Чип «вес разряда». `delay` — порядок появления (справа налево — главный учебный акцент).
 * `crossed` — линия-зачёркивание «прорисовывается» слева направо и вес тускнеет.
 */
export function WeightChip({
  label,
  tone = "primary",
  crossed = false,
  delay = 0,
  strikeDelay = 0,
  fontSize = 14,
  className,
}: {
  label: string | number;
  tone?: ChipTone;
  crossed?: boolean;
  delay?: number;
  strikeDelay?: number;
  fontSize?: number;
  className?: string;
}) {
  return (
    <m.span
      initial={{ opacity: 0, y: -10, scale: 0.6 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.12 } }}
      transition={{ ...springBouncy, delay }}
      style={{ fontSize }}
      className={cn(
        "relative inline-flex h-6 items-center justify-center rounded-lg font-mono font-bold leading-none tabular-nums transition-colors duration-300",
        fontSize <= 12 ? "px-1" : "px-1.5",
        CHIP_TONE[tone],
        className,
      )}
    >
      {label}
      <m.span
        aria-hidden
        className="absolute inset-x-0.5 top-1/2 h-[2.5px] origin-left rounded-full bg-current"
        initial={false}
        animate={{ scaleX: crossed ? 1 : 0 }}
        transition={{ duration: 0.22, delay: crossed ? strikeDelay : 0 }}
      />
    </m.span>
  );
}

// ---------- Лампочка ----------

const BULB =
  "M24 5 a17 17 0 0 1 10.5 30.4 c-1.6 1.3 -2.5 3.1 -2.5 5.1 v2.5 h-16 v-2.5 c0 -2 -.9 -3.8 -2.5 -5.1 A17 17 0 0 1 24 5 z";

/** Рисунок лампочки в координатах 48×58 (для вставки внутрь чужого <svg>). */
export function LampGlyph({ on, offFill }: { on: boolean; offFill?: string }) {
  return (
    <g>
      <circle
        cx="24"
        cy="22"
        r="27"
        className="fill-gold"
        style={{ fillOpacity: on ? 0.2 : 0, transition: "fill-opacity .3s ease" }}
      />
      <path
        d={BULB}
        strokeWidth="2"
        strokeLinejoin="round"
        className={cn("transition-colors duration-300", on ? "fill-gold stroke-warning" : "fill-surface-2 stroke-border")}
        style={!on && offFill ? { fill: offFill } : undefined}
      />
      <path
        d="M14.8 19 q1.2 -6.5 7.4 -9"
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        className="stroke-white"
        style={{ strokeOpacity: on ? 0.7 : 0.3, transition: "stroke-opacity .3s ease" }}
      />
      <path
        d="M20.5 41 V30 M27.5 41 V30 M20.5 30 q1.75 -6 3.5 0 t3.5 0"
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("transition-colors duration-300", on ? "stroke-warning-strong" : "stroke-muted")}
      />
      <rect x="16" y="43" width="16" height="5" rx="1.5" className="fill-muted/60" />
      <rect x="17.5" y="49" width="13" height="4" rx="1.5" className="fill-muted/60" />
      <path d="M19.5 53.5 h9 a4.5 3.6 0 0 1 -9 0 z" className="fill-muted/60" />
    </g>
  );
}

/** Лампочка: включённая тёплая и светится, выключенная серая. `size` — ширина, px. */
export function LampBulb({ on, size = 48, className, offFill }: { on: boolean; size?: number; className?: string; offFill?: string }) {
  return (
    <svg
      viewBox="0 0 48 58"
      width={size}
      height={Math.round((size * 58) / 48)}
      className={cn("overflow-visible transition-[filter] duration-300", className)}
      style={{ filter: on ? "drop-shadow(0 0 7px color-mix(in srgb, var(--gold) 75%, transparent))" : "drop-shadow(0 0 0 transparent)" }}
      aria-hidden
    >
      <LampGlyph on={on} offFill={offFill} />
    </svg>
  );
}

// ---------- Монета ----------

/**
 * Монета с номиналом. Взятая — золотая и приподнята (под ней остаётся тень), остальные приглушены.
 * С `onClick` — кнопка (aria-pressed), без — просто картинка.
 */
export function Coin({
  value,
  picked,
  size = 56,
  delay = 0,
  onClick,
}: {
  value: number;
  picked: boolean;
  size?: number;
  delay?: number;
  onClick?: () => void;
}) {
  const len = String(value).length;
  const face = (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute rounded-full border-2 border-current opacity-25"
        style={{ inset: Math.max(3, Math.round(size * 0.08)) }}
      />
      <span className="relative font-mono font-extrabold leading-none" style={{ fontSize: Math.round(size * (len > 2 ? 0.3 : len > 1 ? 0.38 : 0.44)) }}>
        {value}
      </span>
    </>
  );
  const cls = cn(
    "relative flex items-center justify-center rounded-full border-[3px] transition-colors duration-200",
    picked ? cn("border-warning-strong bg-gold", ON_GOLD) : "border-border bg-surface-2 text-muted",
    onClick && "cursor-pointer focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
  );
  const motionProps = {
    initial: { opacity: 0, scale: 0.6, y: 0 },
    animate: { opacity: 1, scale: 1, y: picked ? -10 : 0 },
    transition: { y: springSoft, scale: { ...springBouncy, delay }, opacity: { duration: 0.2, delay } },
    style: { width: size, height: size },
    className: cls,
  };
  return (
    <div className="relative" style={{ width: size, height: size + 8 }}>
      <span
        aria-hidden
        className="absolute bottom-0 left-1/2 h-1.5 -translate-x-1/2 rounded-full bg-text/10 blur-[1px] transition-[width,opacity] duration-200"
        style={{ width: picked ? size * 0.5 : size * 0.78, opacity: picked ? 0.55 : 1 }}
      />
      {onClick ? (
        <m.button type="button" onClick={onClick} aria-pressed={picked} aria-label={String(value)} whileTap={{ scale: 0.92, transition: springSnappy }} {...motionProps}>
          {face}
        </m.button>
      ) : (
        <m.div {...motionProps}>{face}</m.div>
      )}
    </div>
  );
}

// ---------- Строка суммы ----------

export interface SumTerm {
  id: string;
  value: number;
}

function XBadge({ delay }: { delay: number }) {
  return (
    <m.span
      aria-hidden
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ ...springBouncy, delay }}
      className="inline-flex size-6 items-center justify-center rounded-full bg-danger text-white"
    >
      <X size={14} strokeWidth={3.6} />
    </m.span>
  );
}

/**
 * «32 + 8 + 4 + 1 = 45». Слагаемые выскакивают по очереди, результат «накручивается» (зелёный).
 * tone="danger": неверная сумма — красная, зачёркнута, с красным крестом (ошибка-ловушка).
 * showTotal=false — только слагаемые (итог показывает соседний крупный счётчик).
 */
export function SumLine({
  terms,
  total,
  tone = "success",
  delay = 0,
  showTotal = true,
  quick = false,
  className,
}: {
  terms: SumTerm[];
  total: number;
  tone?: "success" | "danger";
  delay?: number;
  showTotal?: boolean;
  /** Без лесенки задержек — для интерактива, где слагаемые меняются по нажатию. */
  quick?: boolean;
  className?: string;
}) {
  const wrong = tone === "danger";
  const resultDelay = delay + 0.18 + terms.length * 0.07;
  const termDelay = (i: number) => (quick ? 0 : delay + 0.1 + i * 0.07);
  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
      transition={{ ...springSoft, delay: quick ? 0 : delay }}
      className={cn(
        "mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl border-2 px-4 py-2 font-mono text-lg font-bold",
        wrong ? "border-danger/40 bg-danger-soft" : "border-border bg-surface",
        className,
      )}
    >
      {terms.length === 0 ? (
        <span className="text-muted">0</span>
      ) : (
        terms.map((term, i) => (
          <Fragment key={term.id}>
            {i > 0 && <span className="text-muted">+</span>}
            <m.span
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...springBouncy, delay: termDelay(i) }}
              className={wrong ? "text-danger-strong" : "text-text"}
            >
              {term.value}
            </m.span>
          </Fragment>
        ))
      )}
      {showTotal && (
        <>
          <span className="text-muted">=</span>
          {wrong ? (
            <>
              <span className="text-danger-strong line-through decoration-[3px]">{total}</span>
              <XBadge delay={resultDelay} />
            </>
          ) : (
            <CountUp value={total} delay={resultDelay} className="text-2xl font-extrabold text-success-strong" />
          )}
        </>
      )}
    </m.div>
  );
}

// ---------- Подпись с крупным числом ----------

/** «Сумма: 13» — подпись мелко, число крупно и накручивается. `after` — например «/ 19». */
export function NumberLabel({
  before,
  after,
  value,
  className,
  numberClassName,
  extra,
}: {
  before: string;
  after?: string;
  value: number;
  className?: string;
  numberClassName?: string;
  extra?: ReactNode;
}) {
  const pre = before.trim();
  const post = (after ?? "").trim();
  return (
    <div className={cn("flex flex-wrap items-baseline justify-center gap-x-2", className)}>
      {pre && <span className="text-base font-extrabold text-muted">{pre}</span>}
      <CountUp value={value} className={cn("font-mono text-5xl font-extrabold leading-none tabular-nums", numberClassName)} />
      {post && <span className="text-base font-extrabold text-muted">{post}</span>}
      {extra}
    </div>
  );
}
