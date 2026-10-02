"use client";

import { Clock, Cpu, Heart, Infinity as InfinityIcon, Rocket } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { CountUp } from "@/components/motion/CountUp";
import { formatMult, formatNum, formatRemaining, heartWaitMs } from "./shop-helpers";
import { useChips, useHearts, useNow } from "./useEconomy";

/** Карточка баланса: чипы крупно, сердечки, таймер, бустер и итоговый множитель. */
export function ShopBalance() {
  const { t, lang } = useT();
  const { chips, multiplier, boost } = useChips();
  const hearts = useHearts();
  const now = useNow();
  // Число чипов «накручивается» от значения при открытии страницы.
  const [start] = useState(chips);
  const wait = heartWaitMs(hearts, now);

  return (
    <Card className="overflow-hidden border-gold/50 bg-gradient-to-br from-gold-soft via-surface to-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-muted">{t("shop.balance")}</p>
          <p className="mt-1 flex items-center gap-2.5 text-4xl font-extrabold leading-none text-warning-strong">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-2 border-gold/60 bg-surface text-gold shadow-sm">
              <Cpu size={26} />
            </span>
            <span className="tabular-nums" aria-label={`${formatNum(chips)} ${t("shop.balance.chips")}`}>
              <CountUp value={chips} from={start} format={(n) => formatNum(n)} />
            </span>
          </p>
          <p className="mt-1.5 text-sm font-bold text-muted">{t("shop.balance.chips")}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border-2 border-border bg-surface/80 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-extrabold text-muted">{t("shop.balance.hearts")}</p>
          {hearts.unlimited ? (
            <span className="flex items-center gap-1.5 font-extrabold text-heart">
              <InfinityIcon size={20} strokeWidth={3} /> {t("shop.balance.unlimited")}
            </span>
          ) : (
            <span className="font-extrabold tabular-nums text-heart">{t("shop.balance.heartsOf", { n: hearts.count, max: hearts.max })}</span>
          )}
        </div>
        {!hearts.unlimited && (
          <div className="mt-2 flex flex-wrap gap-1" aria-hidden>
            {Array.from({ length: hearts.max }, (_, i) => (
              <Heart key={i} size={22} fill={i < hearts.count ? "currentColor" : "none"} className={cn("transition-colors", i < hearts.count ? "text-heart" : "text-heart/35")} />
            ))}
          </div>
        )}
        {!hearts.unlimited && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-muted">
            <Clock size={15} className="shrink-0" />
            {hearts.nextAt === null ? t("shop.balance.full") : t("shop.balance.next", { time: formatRemaining(wait, lang) })}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {boost && (
          <Pill tone="gold" icon={<Rocket size={13} />} className="py-1 text-sm">
            {t("shop.balance.boost", { mult: formatMult(boost.mult), time: formatRemaining(boost.until - now, lang) })}
          </Pill>
        )}
        <Pill tone={multiplier > 1 ? "gold" : "muted"} className="py-1 text-sm">
          {t("shop.balance.mult", { mult: formatMult(multiplier) })}
        </Pill>
      </div>
    </Card>
  );
}
