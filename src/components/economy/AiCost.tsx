"use client";

import { Cpu, Infinity as InfinityIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AiKind } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import { useAiQuote } from "./useEconomy";

/**
 * Цена обращения к ИИ на кнопке:
 * «бесплатно · ещё N» (в пределах дневного бесплатного), «∞» при безлимите, чип и число, когда платится чипами.
 * soft — цветная плашка на светлом фоне; solid — полупрозрачная на насыщенной кнопке (например, фиолетовой «ai»).
 * short — без счётчика остатка («бесплатно») — для узких кнопок. Отзыв после урока бесплатен всегда — цену не показываем.
 */
export function AiCost({
  kind,
  variant = "soft",
  short,
  className,
}: {
  kind: AiKind;
  variant?: "soft" | "solid";
  short?: boolean;
  className?: string;
}) {
  const { t } = useT();
  const { quote, freeLeft } = useAiQuote(kind);
  if (kind === "feedback") return null;

  const solid = variant === "solid";
  const base = "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-extrabold leading-none";
  const tone = (soft: string) => (solid ? "bg-white/20 text-white" : soft);

  if (!quote.ok && quote.reason === "cap") {
    return <span className={cn(base, tone("bg-surface-2 text-muted"), className)}>{t("aicost.cap")}</span>;
  }

  if (quote.pay === "plan") {
    const label = t("aicost.aria.unlimited");
    return (
      <span role="img" aria-label={label} title={label} className={cn(base, tone("bg-gold-soft text-warning-strong"), className)}>
        <InfinityIcon size={14} strokeWidth={3} aria-hidden />
      </span>
    );
  }

  if (quote.pay === "free") {
    const showLeft = !short && Number.isFinite(freeLeft);
    const text = showLeft ? t("aicost.free", { n: freeLeft }) : t("aicost.freeShort");
    return (
      <span
        title={t("aicost.aria.free", { n: freeLeft })}
        className={cn(base, tone("bg-success-soft text-success-strong"), className)}
      >
        {text}
      </span>
    );
  }

  // Платно чипами; если чипов не хватает — красная плашка (на насыщенной кнопке — светлая с красным текстом).
  const enough = quote.ok;
  const label = t(enough ? "aicost.aria.chips" : "aicost.aria.need", { n: quote.cost });
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        base,
        enough ? tone("bg-gold-soft text-warning-strong") : solid ? "bg-white/90 text-danger" : "bg-danger-soft text-danger",
        className,
      )}
    >
      <Cpu size={14} className={cn(!solid && enough && "text-gold")} aria-hidden />
      <span className="tabular-nums" aria-hidden>
        {quote.cost}
      </span>
    </span>
  );
}
