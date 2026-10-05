"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { useHearts } from "./useEconomy";

/**
 * Цена входа в сердечках (#40): сердечко и число — на карточках режимов урока, пробного ЕНТ, игр и на кнопках «Начать».
 * При безлимите и нулевой цене не показывается (вход бесплатный). Не хватает сердечек — плашка тусклее (решает окно «Сердечки закончились»).
 * soft — плашка на светлом фоне; solid — полупрозрачная на насыщенной кнопке.
 */
export function HeartCost({ n, variant = "soft", className }: { n: number; variant?: "soft" | "solid"; className?: string }) {
  const { t } = useT();
  const v = useHearts();
  if (v.unlimited || n <= 0) return null;
  const label = t("hearts.cost.aria", { n });
  const short = v.count < n;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-sm font-extrabold leading-tight",
        variant === "solid" ? "bg-white/20 text-white" : "bg-heart-soft text-heart-strong",
        short && "opacity-70",
        className,
      )}
    >
      <Heart size={14} fill="currentColor" aria-hidden />
      <span className="tabular-nums" aria-hidden>
        {n}
      </span>
    </span>
  );
}
