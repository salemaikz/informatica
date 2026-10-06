"use client";

import { Flag, X } from "lucide-react";
import { useState } from "react";
import { duelFetch } from "@/lib/duel/live";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

// «Пожаловаться» на живого соперника (docs/specs/duels.md §7): причина без свободного текста — имя, нечестная игра,
// другое. Отправка — POST /api/social/report (маршрут и модерация — пакет друзей, Ф3). У бота кнопки нет.
// TODO(слияние с Ф3): если Ф3 принесла свой ReportPlayerButton (скрытие имени у себя, «Заблокировать») — взять его.

type Reason = "name" | "cheat" | "other";
const REASONS: { id: Reason; key: "duel.report.name" | "duel.report.cheat" | "duel.report.other" }[] = [
  { id: "name", key: "duel.report.name" },
  { id: "cheat", key: "duel.report.cheat" },
  { id: "other", key: "duel.report.other" },
];

export function ReportPlayerButton({ code, matchId }: { code: string; matchId?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!code) return null;

  const send = async (reason: Reason) => {
    setBusy(true);
    await duelFetch("POST", "/api/social/report", { body: { code, reason, where: "duel", ...(matchId ? { matchId } : {}) } });
    setBusy(false);
    setSent(true);
    setOpen(false);
  };

  if (sent)
    return (
      <p role="status" className="text-center text-xs font-bold text-muted">
        {t("duel.report.done")}
      </p>
    );
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-muted hover:bg-surface-2"
        data-testid="duel-report"
      >
        <Flag size={14} aria-hidden />
        {t("duel.report")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} label={t("duel.report.title")}>
        <div className="flex flex-col gap-3 pb-[max(8px,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <h2 className="flex-1 text-xl font-extrabold">{t("duel.report.title")}</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
              <X size={22} />
            </button>
          </div>
          {REASONS.map((r) => (
            <Button key={r.id} variant="secondary" block disabled={busy} onClick={() => void send(r.id)}>
              {t(r.key)}
            </Button>
          ))}
        </div>
      </Modal>
    </>
  );
}
