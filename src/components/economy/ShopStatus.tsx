"use client";

import { Heart, Infinity as InfinityIcon, Rocket } from "lucide-react";
import { formatHearts } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import { useChips, useHeartsLive } from "./useEconomy";
import { formatCountdown, formatMult, heartWaitMs, showBoostLine } from "./shop-helpers";

/**
 * Компактная строка состояния вместо карточки баланса (чипы и так в шапке):
 * сердечки «3 из 5 · следующее через 4:12» (таймер тикает раз в секунду) и, пока идёт бустер, «Множитель ×2 · ещё 12:30».
 */
export function ShopStatus() {
  const { t } = useT();
  const { view, now } = useHeartsLive();
  const { xpMult, boost } = useChips();
  const boostLine = showBoostLine(boost, xpMult, now);

  return (
    <div role="group" aria-label={t("shop.status.aria")} className="flex flex-col gap-1.5 rounded-2xl border-2 border-border bg-surface px-3.5 py-2.5">
      <p className="flex min-h-6 items-center gap-2 text-[15px] font-bold">
        {view.unlimited ? (
          <>
            <InfinityIcon size={20} strokeWidth={3} className="shrink-0 text-heart" aria-hidden />
            <span className="min-w-0 font-extrabold text-heart-strong">{t("shop.status.unlimited")}</span>
          </>
        ) : (
          <>
            <Heart size={20} fill="currentColor" className="shrink-0 text-heart" aria-hidden />
            <span className="min-w-0">
              <span className="font-extrabold tabular-nums text-heart-strong">{t("shop.status.heartsOf", { n: formatHearts(view.count), max: view.max })}</span>
              <span className="text-muted">
                {" · "}
                {view.nextAt === null ? (
                  t("shop.status.full")
                ) : now > 0 ? (
                  <span className="tabular-nums">{t("shop.status.next", { time: formatCountdown(heartWaitMs(view, now)) })}</span>
                ) : (
                  "…"
                )}
              </span>
            </span>
          </>
        )}
      </p>
      {/* now = 0 — серверный рендер/гидратация: без отсчёта, иначе на миг покажется «ещё 490000:00». */}
      {boostLine && boost && (
        <p className="flex min-h-6 items-center gap-2 text-[15px] font-bold">
          <Rocket size={20} className="shrink-0 text-gold" aria-hidden />
          <span className="min-w-0 tabular-nums text-warning-strong">{t("shop.status.boost", { mult: formatMult(xpMult), time: formatCountdown(boost.until - now) })}</span>
        </p>
      )}
    </div>
  );
}
