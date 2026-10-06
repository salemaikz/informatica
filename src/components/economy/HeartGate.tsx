"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Heart, Infinity, Timer } from "lucide-react";
import { useApp } from "@/lib/store";
import { heartStatus, type LearningRunKind } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function useHeartStatus() {
  const wallet = useApp((s) => s.hearts);
  const subscription = useApp((s) => s.subscription);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(interval);
  }, []);
  return { ...heartStatus(wallet, subscription, now), now };
}

export function HeartChip() {
  const { t } = useT();
  const { hearts, maxHearts, unlimited } = useHeartStatus();
  return (
    <span className="flex items-center gap-1 font-extrabold text-danger" title={unlimited ? t("economy.unlimited") : t("economy.heartsCount", { n: hearts, max: maxHearts })}>
      <Heart size={20} fill="currentColor" aria-hidden />
      {unlimited ? <Infinity size={18} aria-label={t("economy.unlimited")} /> : hearts}
    </span>
  );
}

/** Все учебные режимы допускают к заданиям через одну проверку и одно списание. */
export function HeartGate({ kind, runId, children }: { kind: LearningRunKind; runId: string; children: ReactNode }) {
  const { t } = useT();
  const admitted = useApp((s) => s.learningRuns[runId]?.kind === kind);
  const start = useApp((s) => s.startLearningRun);
  const status = useHeartStatus();
  const minutes = status.nextRefillAt ? Math.max(1, Math.ceil((status.nextRefillAt - status.now) / 60_000)) : 0;
  if (admitted) return children;
  return (
    <div className="mx-auto flex min-h-[65dvh] max-w-md items-center justify-center p-4">
      <Card className="flex w-full flex-col items-center gap-4 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-danger-soft text-danger"><Heart size={42} fill="currentColor" /></span>
        <h1 className="text-2xl font-extrabold">{status.hearts || status.unlimited ? t("economy.ready") : t("economy.empty")}</h1>
        <p className="font-semibold text-muted">{status.unlimited ? t("economy.unlimitedHint") : t("economy.runCost")}</p>
        <p className="font-extrabold text-danger">{status.unlimited ? t("economy.unlimited") : t("economy.heartsCount", { n: status.hearts, max: status.maxHearts })}</p>
        {!status.unlimited && !status.hearts && (
          <p className="flex items-center gap-2 text-sm font-semibold text-muted"><Timer size={18} />{t("economy.refillIn", { n: minutes })}</p>
        )}
        <Button block disabled={!status.unlimited && status.hearts === 0} onClick={() => start(kind, runId)}>{t("economy.start")}</Button>
        <ButtonLink href="/shop" variant="secondary" block>{t("economy.shop")}</ButtonLink>
        <ButtonLink href="/practice" variant="ghost" block>{t("common.back")}</ButtonLink>
      </Card>
    </div>
  );
}
