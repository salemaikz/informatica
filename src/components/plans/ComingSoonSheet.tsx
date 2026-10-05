"use client";

import { Clock, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { track, type PaywallFrom } from "@/lib/analytics";
import { useApp } from "@/lib/store";
import { canStartTrial, TRIAL_DAYS } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import { feedback } from "@/lib/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { MascotSays } from "@/components/mascot/Mascot";
import { useNow } from "@/components/economy/useEconomy";

/**
 * «Оплата скоро»: оплата деньгами (тарифы, наборы чипов, бустеры за ₸) пока не подключена.
 * Никакой имитации платежа и сбора контактов — честно говорим, что будет, и предлагаем пробный период.
 * what — что выбрал ученик (название товара и цена), показывается подзаголовком.
 * from — откуда пришли (для статистики пробного периода, #69).
 */
export function ComingSoonSheet({ open, onClose, what, from = "other" }: { open: boolean; onClose: () => void; what?: string; from?: PaywallFrom }) {
  const { t } = useT();
  const router = useRouter();
  const plan = useApp((s) => s.plan);
  const startTrial = useApp((s) => s.startTrial);
  const now = useNow();
  const trial = canStartTrial(plan, now);

  const onTrial = () => {
    if (startTrial()) {
      track({ e: "trial_start", from });
      feedback("levelUp");
      onClose();
      router.push("/learn");
    }
  };

  return (
    <Modal open={open} onClose={onClose} label={t("soon.title")}>
      <div className="flex flex-col gap-4">
        <MascotSays mood="happy" size={64}>
          <span className="block text-lg font-extrabold">{t("soon.title")}</span>
          {what && <span className="block text-sm font-bold text-muted">{what}</span>}
        </MascotSays>
        <p className="flex items-start gap-2 font-semibold text-muted">
          <Clock size={18} className="mt-0.5 shrink-0" /> {t("soon.text")}
        </p>
        {trial && (
          <Button variant="primary" size="lg" block icon={<Sparkles size={20} />} onClick={onTrial}>
            {t("soon.trial", { n: TRIAL_DAYS })}
          </Button>
        )}
        <Button variant="secondary" block onClick={onClose}>
          {t("soon.ok")}
        </Button>
      </div>
    </Modal>
  );
}
