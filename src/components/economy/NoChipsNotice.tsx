"use client";

import { Cpu, Crown, ShoppingBag } from "lucide-react";
import { m } from "motion/react";
import { cn } from "@/lib/cn";
import { AI_COST, type AiKind } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import { ButtonLink } from "@/components/ui/Button";
import { springSoft } from "@/components/motion/presets";
import { chipRate } from "./shop-helpers";
import { useChips } from "./useEconomy";

/**
 * Вместо текста ошибки «не хватает чипов» (receipt.reason === "chips"):
 * «Нужно N чипов, у тебя M» + пути: магазин и «Безлимит». Остаток читает из кошелька — обновляется сам.
 */
export function NoChipsNotice({ kind, className }: { kind: AiKind; className?: string }) {
  const { t } = useT();
  const { chips } = useChips();
  const need = AI_COST[kind];
  const rate = chipRate();

  return (
    <m.div
      role="alert"
      className={cn("flex flex-col gap-2.5 rounded-2xl border-2 border-gold/50 bg-gold-soft p-3 text-left", className)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
    >
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-gold" aria-hidden>
          <Cpu size={20} />
        </span>
        <div className="min-w-0">
          <p className="font-extrabold text-warning-strong">{t("aicost.need.title")}</p>
          <p className="font-bold text-text">{t("aicost.need.text", { need, have: chips })}</p>
        </div>
      </div>
      <p className="text-sm font-semibold text-muted">{t("aicost.need.earn", { xp: rate.xp, n: rate.n })}</p>
      <div className="grid grid-cols-2 gap-2">
        <ButtonLink href="/shop" size="md" block icon={<ShoppingBag size={18} />}>
          {t("aicost.need.shop")}
        </ButtonLink>
        <ButtonLink href="/plans?from=ai" size="md" variant="secondary" block icon={<Crown size={18} className="text-gold" />}>
          {t("aicost.need.plan")}
        </ButtonLink>
      </div>
    </m.div>
  );
}
