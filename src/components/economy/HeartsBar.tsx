"use client";

import { Heart, HeartCrack, Infinity as InfinityIcon } from "lucide-react";
import { m } from "motion/react";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import { cn } from "@/lib/cn";
import { effectiveTier, formatHearts, heartsView, type HeartsView } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { HeartLossPop, useHeartDelta } from "./HeartLoss";
import { useHearts } from "./useEconomy";

/** Сердечки прямо сейчас — для обработчиков (не для рендера): читает стор и считает восстановление. */
export function readHearts(): HeartsView {
  const s = useApp.getState();
  const now = Date.now();
  return heartsView(s.hearts, effectiveTier(s.plan, now), now, todayKey());
}

/**
 * Сердечки в шапке урока: иконка и число (∞ при безлимите), без ссылки — чтобы случайным касанием не уйти из урока.
 * Плата за вход (#40): сердечко трескается и вздрагивает, вниз «падает» «−1» («−2» у входа за два). Покупка/возврат: сердечко «подпрыгивает».
 * Нет сердечек — иконка пустая и пульсирует.
 */
export function HeartsBar({ className, initialLoss }: { className?: string; /** Сердечки, списанные до показа счётчика: «−N» всплывает сразу. */ initialLoss?: number }) {
  const { t } = useT();
  const v = useHearts();
  const reduce = useReduceMotion();
  const anim = useHeartDelta(v.count, initialLoss);

  const empty = !v.unlimited && v.count <= 0;
  const label = v.unlimited ? t("hearts.bar.ariaUnlimited") : t("hearts.bar.aria", { n: formatHearts(v.count) });
  const lost = anim.id > 0 && anim.dir === "down" && !reduce;
  const gained = anim.id > 0 && anim.dir === "up" && !reduce;

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={cn("relative flex h-10 shrink-0 items-center gap-1 rounded-xl px-1.5 font-extrabold text-heart", className)}
    >
      {/* Пульс пустого сердца — внешний элемент, не зависит от одноразовой анимации списания/возврата. */}
      <m.span
        aria-hidden
        className="flex"
        animate={empty && !reduce ? { scale: [1, 1.18, 1] } : { scale: 1 }}
        transition={empty && !reduce ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
      >
        <m.span
          key={anim.id}
          className="relative flex h-5 w-5 items-center justify-center"
          animate={lost ? { rotate: [0, -16, 14, -9, 6, 0], scale: [1, 1.3, 0.88, 1.06, 1] } : gained ? { scale: [1, 1.35, 1] } : { scale: 1 }}
          transition={lost ? { duration: 0.55, ease: "easeInOut" } : gained ? { duration: 0.35, ease: "easeOut" } : { duration: 0.2 }}
        >
          <m.span
            className="absolute inset-0 flex items-center justify-center"
            animate={lost ? { opacity: [1, 0, 0, 1] } : { opacity: 1 }}
            transition={lost ? { duration: 1.1, times: [0, 0.12, 0.7, 1] } : { duration: 0 }}
          >
            <Heart size={20} fill={empty ? "none" : "currentColor"} />
          </m.span>
          {lost && (
            <m.span
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.1, times: [0, 0.12, 0.7, 1] }}
            >
              <HeartCrack size={20} />
            </m.span>
          )}
        </m.span>
      </m.span>
      {v.unlimited ? <InfinityIcon size={20} strokeWidth={3} aria-hidden /> : <span className="min-w-[1ch] tabular-nums">{formatHearts(v.count)}</span>}
      <HeartLossPop delta={anim} reduce={reduce} />
    </div>
  );
}
