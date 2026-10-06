"use client";

import { useEffect } from "react";
import { Coins, Heart, Zap } from "lucide-react";
import { useApp } from "@/lib/store";
import { CHIP_REASONS, ECONOMY, recentChipHistory } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CaseVault } from "@/components/economy/CaseVault";
import { useHeartStatus } from "@/components/economy/HeartGate";

export default function ShopPage() {
  const { t, l, lang } = useT();
  const chips = useApp((s) => s.chips);
  const history = useApp((s) => s.chipHistory);
  const boostUntil = useApp((s) => s.xpBoostUntil);
  const buyBoost = useApp((s) => s.buyXpBoost);
  const pruneHistory = useApp((s) => s.pruneChipHistory);
  const status = useHeartStatus();
  const activeBoost = boostUntil > status.now;
  const boostMinutes = Math.max(0, Math.ceil((boostUntil - status.now) / 60_000));
  useEffect(() => { pruneHistory(); }, [pruneHistory]);
  const rewards = [
    { reason: "daily", amount: ECONOMY.dailyGoal },
    { reason: "lesson", amount: ECONOMY.firstLesson },
    { reason: "perfect", amount: ECONOMY.perfectLesson },
    { reason: "section-test", amount: ECONOMY.sectionTest },
    { reason: "ent", amount: ECONOMY.ent },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="text-2xl font-extrabold">{t("economy.title")}</h1><p className="font-semibold text-muted">{t("economy.subtitle")}</p></div>
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col gap-1 bg-gold-soft"><Coins className="text-warning-strong" size={26} /><p className="text-sm font-semibold text-muted">{t("economy.chips")}</p><p className="text-3xl font-black text-warning-strong">{chips}</p></Card>
        <Card className="flex flex-col gap-1 bg-danger-soft"><Heart className="text-danger" size={26} fill="currentColor" /><p className="text-sm font-semibold text-muted">{t("economy.hearts")}</p><p className="text-3xl font-black text-danger">{status.unlimited ? "∞" : `${status.hearts}/${status.maxHearts}`}</p></Card>
      </div>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3"><Heart className="text-danger" size={25} /><h2 className="text-lg font-extrabold">{t("economy.fullRefill")}</h2><span className="ml-auto font-black">{ECONOMY.refillPriceKzt} ₸</span></div>
        <p className="text-sm font-semibold text-muted">{t("economy.refillHint")}</p>
        <Button variant="secondary" block disabled>{t("economy.soon")}</Button>
      </Card>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3"><Zap className="text-gold" size={25} fill="currentColor" /><h2 className="text-lg font-extrabold">{t("economy.boost")}</h2></div>
        <p className="text-sm font-semibold text-muted">{t("economy.boostHint")}</p>
        <Button disabled={activeBoost || chips < ECONOMY.xpBoostCost} block onClick={buyBoost}>{activeBoost ? t("economy.boostActive", { n: boostMinutes }) : t("economy.boostBuy", { n: ECONOMY.xpBoostCost })}</Button>
      </Card>
      <CaseVault />
      <Card>
        <h2 className="mb-2 text-lg font-extrabold">{t("economy.earnTitle")}</h2><p className="mb-3 text-sm font-semibold text-muted">{t("economy.earnHint")}</p>
        <ul className="divide-y divide-border">
          {rewards.map(({ reason, amount }) => <li key={reason} className="flex items-center justify-between gap-3 py-2 text-sm font-bold"><span>{l(CHIP_REASONS[reason])}</span><span className="shrink-0 text-warning-strong">+{amount}</span></li>)}
          <li className="flex items-center justify-between gap-3 py-2 text-sm font-bold"><span>{t("economy.achievementReward")}</span><span className="shrink-0 text-warning-strong">+1–10</span></li>
        </ul>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-extrabold">{t("economy.history")}</h2>
        {recentChipHistory(history, status.now).length ? <ul className="divide-y divide-border">{recentChipHistory(history, status.now).map((entry) => <li key={entry.id} className="flex items-center justify-between gap-3 py-2"><div><p className="text-sm font-bold">{l(CHIP_REASONS[entry.reason] ?? CHIP_REASONS.achievement)}</p><p className="text-xs font-semibold text-muted">{new Intl.DateTimeFormat(lang === "kk" ? "kk-KZ" : "ru-KZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(entry.at)}</p></div><span className="font-extrabold text-warning-strong">{entry.amount > 0 ? "+" : ""}{entry.amount}</span></li>)}</ul> : <p className="text-sm font-semibold text-muted">{t("economy.noHistory")}</p>}
      </Card>
    </div>
  );
}
