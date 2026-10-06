"use client";

import { Cpu, Heart, Infinity as InfinityIcon } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { formatHearts } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import { CountUp } from "@/components/motion/CountUp";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { HeartLossPop, useHeartDelta } from "./HeartLoss";
import { useChips, useHearts } from "./useEconomy";
import { formatCompact } from "./shop-helpers";
import { ChipBurst } from "./ChipBurst";

// Компактные значки для шапки приложения: сердечки и чипы. Оба ведут в магазин.

const BUMP_DELAY = 0.3;
/** Фокус как у примитивов (RULES 2.10), а не стандартная обводка браузера. */
const FOCUS = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";

// Что ученик уже «видел» в шапке: урок идёт вне оболочки, и, вернувшись, он увидит рост чипов.
let seenChips: number | null = null;

/** Сердечки: иконка и число (∞ при безлимите). Когда сердечек нет — иконка пульсирует. */
export function HeartsChip({ className }: { className?: string }) {
  const { t } = useT();
  const v = useHearts();
  const reduce = useReduceMotion();
  const delta = useHeartDelta(v.count);
  const lost = delta.id > 0 && delta.dir === "down" && !reduce;
  const empty = !v.unlimited && v.count <= 0;
  const label = v.unlimited ? t("shop.chip.heartsUnlimited") : t("shop.chip.hearts", { n: formatHearts(v.count) });

  return (
    <Link
      data-tour="hdr-hearts"
      href="/shop"
      aria-label={label}
      title={label}
      className={cn(
        "relative flex h-10 shrink-0 items-center gap-1 rounded-xl px-1 font-extrabold hover:bg-surface-2",
        "text-heart",
        FOCUS,
        className,
      )}
    >
      {/* Пульс пустого сердца — внешний элемент, не зависит от одноразового вздрагивания при списании. */}
      <m.span
        className="flex"
        animate={empty && !reduce ? { scale: [1, 1.22, 1] } : { scale: 1 }}
        transition={empty && !reduce ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
      >
        <m.span
          key={delta.id}
          className="flex"
          animate={lost ? { rotate: [0, -16, 14, -9, 6, 0], scale: [1, 1.3, 0.88, 1.06, 1] } : { rotate: 0, scale: 1 }}
          transition={lost ? { duration: 0.55, ease: "easeInOut" } : { duration: 0.2 }}
        >
          <Heart size={20} fill={empty ? "none" : "currentColor"} />
        </m.span>
      </m.span>
      {v.unlimited ? <InfinityIcon size={20} strokeWidth={3} aria-hidden /> : <span className="tabular-nums">{formatHearts(v.count)}</span>}
      <HeartLossPop delta={delta} reduce={reduce} />
    </Link>
  );
}

/** Чипы: иконка и число; при росте число «подпрыгивает», над ним всплывает «+N». */
export function ChipsChip({ className }: { className?: string }) {
  const { t } = useT();
  const { chips } = useChips();
  const [start] = useState(() => seenChips ?? chips);
  const [prev, setPrev] = useState(start);
  const [burst, setBurst] = useState({ id: 0, amount: 0 });
  const [bumping, setBumping] = useState(false);

  // Рост замечаем при рендере (приём «предыдущее значение»), без эффектов с setState.
  if (chips !== prev) {
    setPrev(chips);
    if (chips > prev) {
      setBurst((b) => ({ id: b.id + 1, amount: chips - prev }));
      setBumping(true);
    }
  }
  useEffect(() => {
    seenChips = chips;
  }, [chips]);

  const label = t("shop.chip.chips", { n: chips });
  return (
    <Link
      data-tour="hdr-chips"
      href="/shop"
      aria-label={label}
      title={label}
      className={cn("relative flex h-10 shrink-0 items-center gap-1 rounded-xl px-1 font-extrabold text-warning-strong hover:bg-surface-2", FOCUS, className)}
    >
      <Cpu size={20} className="text-gold" />
      <m.span
        className="inline-block tabular-nums"
        animate={bumping ? { scale: [1, 1.4, 1] } : { scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: bumping ? BUMP_DELAY : 0 }}
        onAnimationComplete={() => setBumping(false)}
      >
        <CountUp value={chips} from={start} format={(n) => formatCompact(n)} delay={BUMP_DELAY} />
      </m.span>
      <ChipBurst id={burst.id} amount={burst.amount} delay={BUMP_DELAY} className="right-0 top-8" />
    </Link>
  );
}
