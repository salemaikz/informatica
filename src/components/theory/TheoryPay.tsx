"use client";

import { BadgeCheck, Heart, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { ENTRY_COST, MINUTE, formatHearts } from "@/lib/economy";
import { THEORY_READ_MS, THEORY_REPEAT_MS, theoryFreeUntil, type TheoryPayState } from "@/lib/theory-pay";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { useNow } from "@/components/economy/useEconomy";
import { formatRemaining } from "@/components/economy/shop-helpers";

/** Строка про плату за чтение конспекта: сколько стоит, оплачено ли, почему бесплатно. */
export function TheoryPayStatus({ state, paidAt }: { state: TheoryPayState; paidAt: number | undefined }) {
  const { t, lang } = useT();
  const now = useNow();
  // Часы интерфейса тикают раз в 15 секунд и могут отставать от оплаты: больше «суток без минуты» не показываем (иначе «ещё 2 дня»).
  const left = state === "paid" && paidAt !== undefined ? Math.min(Math.max(0, theoryFreeUntil(paidAt) - now), THEORY_REPEAT_MS - MINUTE) : 0;
  const text =
    state === "pay"
      ? t("hearts15.theory.pay", { cost: formatHearts(ENTRY_COST.theory), sec: Math.round(THEORY_READ_MS / 1000) })
      : state === "paid"
        ? t("hearts15.theory.paid", { time: formatRemaining(left, lang) })
        : state === "done"
          ? t("hearts15.theory.done")
          : t("hearts15.theory.unlimited");
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

/** Вместо продолжения конспекта, когда не хватает сердечек: что делать и кнопка «Вернуть сердечки». */
export function TheoryLock({ onOpen }: { onOpen: () => void }) {
  const { t } = useT();
  return (
    <section className="flex flex-col items-start gap-3 rounded-3xl border-2 border-heart/40 bg-heart-soft p-4 sm:p-5" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-heart" aria-hidden>
          <Lock size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold leading-tight text-heart-strong">{t("hearts15.theory.lockTitle", { cost: formatHearts(ENTRY_COST.theory) })}</h2>
          <p className="mt-1 text-sm font-semibold text-muted">{t("econ16c.theory.lockText")}</p>
        </div>
      </div>
      <Button block onClick={onOpen}>
        {t("hearts15.theory.lockButton")}
      </Button>
    </section>
  );
}
