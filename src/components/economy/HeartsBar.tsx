"use client";

import { Heart, HeartCrack, Infinity as InfinityIcon } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import { cn } from "@/lib/cn";
import { effectiveTier, heartsView, type HeartsView } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { useHearts } from "./useEconomy";

/** Сердечки прямо сейчас — для обработчиков (не для рендера): читает стор и считает восстановление. */
export function readHearts(): HeartsView {
  const s = useApp.getState();
  const now = Date.now();
  return heartsView(s.hearts, effectiveTier(s.plan, now), now, todayKey());
}

type Anim = { id: number; dir: "down" | "up" };

/**
 * Сердечки в шапке урока: иконка и число (∞ при безлимите), без ссылки — чтобы случайным касанием не уйти из урока.
 * Потеря: сердечко трескается и вздрагивает, вниз «падает» «−1». Покупка/возврат: сердечко «подпрыгивает».
 * Нет сердечек — иконка пустая и пульсирует.
 */
export function HeartsBar({ className }: { className?: string }) {
  const { t } = useT();
  const v = useHearts();
  const reduce = useReduceMotion();
  const [prev, setPrev] = useState(v.count);
  const [anim, setAnim] = useState<Anim>({ id: 0, dir: "down" });

  // Изменение замечаем при рендере (приём «предыдущее значение»), без эффектов с setState.
  if (v.count !== prev) {
    setPrev(v.count);
    if (Number.isFinite(v.count) && Number.isFinite(prev)) {
      setAnim((a) => ({ id: a.id + 1, dir: v.count < prev ? "down" : "up" }));
    }
  }

  const empty = !v.unlimited && v.count <= 0;
  const label = v.unlimited ? t("hearts.bar.ariaUnlimited") : t("hearts.bar.aria", { n: v.count });
  const lost = anim.id > 0 && anim.dir === "down" && !reduce;
  const gained = anim.id > 0 && anim.dir === "up" && !reduce;

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={cn("relative flex h-10 shrink-0 items-center gap-1 rounded-xl px-1.5 font-extrabold text-heart", className)}
    >
      <m.span
        key={anim.id}
        aria-hidden
        className="relative flex h-5 w-5 items-center justify-center"
        animate={
          lost
            ? { rotate: [0, -16, 14, -9, 6, 0], scale: [1, 1.3, 0.88, 1.06, 1] }
            : gained
              ? { scale: [1, 1.35, 1] }
              : empty && !reduce
                ? { scale: [1, 1.18, 1] }
                : { scale: 1 }
        }
        transition={
          lost
            ? { duration: 0.55, ease: "easeInOut" }
            : gained
              ? { duration: 0.35, ease: "easeOut" }
              : empty && !reduce
                ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.2 }
        }
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
      {v.unlimited ? <InfinityIcon size={20} strokeWidth={3} aria-hidden /> : <span className="min-w-[1ch] tabular-nums">{v.count}</span>}
      {lost && (
        <m.span
          key={`lost-${anim.id}`}
          aria-hidden
          className="pointer-events-none absolute right-0 top-9 z-40 inline-flex items-center rounded-full border-2 border-heart bg-heart-soft px-2 py-0.5 text-sm font-extrabold text-heart-strong shadow-sm"
          initial={{ opacity: 0, y: -4, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1, 0], y: [-4, 4, 14, 26], scale: [0.6, 1.12, 1, 1] }}
          transition={{ duration: 1, times: [0, 0.2, 0.7, 1], ease: "easeOut" }}
        >
          −1
        </m.span>
      )}
    </div>
  );
}
