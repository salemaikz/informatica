"use client";

import { BadgeCheck, Heart, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { ENTRY_COST, formatHearts } from "@/lib/economy";
import { theoryUntilLabel, type TheoryPayState } from "@/lib/theory-pay";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { useHearts, useNow } from "@/components/economy/useEconomy";

/** Кнопка оплаты чтения: сердечко (heart), «Читать дальше — 0,5». Обычная `Button`, перекрашенная в цвет сердечек. */
export function TheoryPayButton({ onClick, className, ...rest }: { onClick: () => void; className?: string; "data-tour"?: string }) {
  const { t } = useT();
  return (
    <Button
      size="lg"
      block
      onClick={onClick}
      className={cn("whitespace-nowrap bg-heart px-3 shadow-[0_4px_0_var(--heart-strong)]", className)}
      icon={<Heart size={20} fill="currentColor" className="shrink-0" aria-hidden />}
      {...rest}
    >
      {t("theory16c.gate.button", { cost: formatHearts(ENTRY_COST.theory) })}
    </Button>
  );
}

/** Строка про плату за чтение: сколько стоит, до какого часа оплачено или «Безлимит — бесплатно». */
export function TheoryPayStatus({ state, paidAt }: { state: TheoryPayState; paidAt: number | undefined }) {
  const { t } = useT();
  const now = useNow();
  let text: string;
  if (state === "pay") text = t("theory16c.pay.free", { cost: formatHearts(ENTRY_COST.theory) });
  else if (state === "unlimited") text = t("theory16c.pay.unlimited");
  else {
    // Оплачено: до какого часа читать бесплатно (сегодня или завтра; сутки после оплаты).
    const at = paidAt ?? 0;
    const until = theoryUntilLabel(at, now > 0 ? now : at);
    text = t(until.day === "today" ? "theory16c.pay.paidToday" : "theory16c.pay.paidTomorrow", { time: until.time });
  }
  const paying = state === "pay";
  const Icon = paying ? Heart : BadgeCheck;
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
        paying ? "bg-heart-soft text-heart-strong" : "bg-success-soft text-success-strong",
      )}
    >
      <Icon size={16} className="mt-0.5 shrink-0" fill={paying ? "currentColor" : "none"} aria-hidden /> {text}
    </p>
  );
}

/** Ворота: вместо закрытой карточки или остатка конспекта — что платно, сколько и кнопка «Читать дальше — 0,5». */
export function TheoryGate({ onPay }: { onPay: () => void }) {
  const { t } = useT();
  const hearts = useHearts();
  const cost = formatHearts(ENTRY_COST.theory);
  return (
    <section className="flex flex-col gap-3 rounded-3xl border-2 border-heart/40 bg-heart-soft p-4 sm:p-5" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-heart" aria-hidden>
          <Lock size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold leading-tight text-heart-strong">{t("theory16c.gate.title", { cost })}</h2>
          <p className="mt-1 text-sm font-semibold text-muted">{t("theory16c.gate.text")}</p>
        </div>
      </div>
      <TheoryPayButton onClick={onPay} />
      <p className="text-center text-xs font-extrabold text-heart-strong">{t("theory16c.gate.have", { have: formatHearts(hearts.count) })}</p>
    </section>
  );
}
