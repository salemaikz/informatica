"use client";

import { Flag, X } from "lucide-react";
import { useState } from "react";
import { duelFetch, hideName } from "@/lib/duel/live";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

// «Пожаловаться» на живого соперника (docs/specs/duels.md §7, 3-safety §4): причина без свободного текста — имя, нечестная
// игра, другое. Нажатие сразу скрывает имя соперника у себя (локально, «Игрок 4821»). Отправка — POST /api/social/report
// {matchId, reason, where:"result"} с местом в матче (x-duel-seat): адресата сервер находит по матчу и месту — код друга
// случайного соперника клиенту не приходит; в комнате с другом добавляется и его код. «Спасибо» — только на ответ 2xx.
// У бота кнопки нет.
// TODO(слияние с Ф3): маршрут /api/social/report и компонент жалобы с «Заблокировать» — в пакете друзей; при слиянии
// взять его компонент, сохранив адресацию по матчу (matchId + место) для случайных соперников.

type Reason = "name" | "cheat" | "other";
const REASONS: { id: Reason; key: "duel.report.name" | "duel.report.cheat" | "duel.report.other" }[] = [
  { id: "name", key: "duel.report.name" },
  { id: "cheat", key: "duel.report.cheat" },
  { id: "other", key: "duel.report.other" },
];

export function ReportPlayerButton({
  matchId,
  seat,
  code,
  onHidden,
}: {
  matchId: string;
  seat: string | null;
  /** Метка соперника из карточки: код друга (комната) или «~метка» (случайный матч). */
  code: string;
  /** Имя скрыто у себя — экран перерисует карточку. */
  onHidden?: () => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "busy" | "sent" | "fail">("idle");

  const send = async (reason: Reason) => {
    setStatus("busy");
    hideName(code);
    onHidden?.();
    const friendCode = code && !code.startsWith("~") ? { code } : {};
    const res = await duelFetch("POST", "/api/social/report", { body: { matchId, reason, where: "result", ...friendCode }, seat });
    setStatus(res.status >= 200 && res.status < 300 ? "sent" : "fail");
    setOpen(false);
  };

  if (status === "sent")
    return (
      <p role="status" className="text-center text-xs font-bold text-muted">
        {t("duel.report.done")}
      </p>
    );
  return (
    <>
      {status === "fail" && (
        <p role="status" className="text-center text-xs font-bold text-muted">
          {t("duel.report.fail")}
        </p>
      )}
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
          <p className="text-sm font-semibold text-muted">{t("duel.report.hidden")}</p>
          {REASONS.map((r) => (
            <Button key={r.id} variant="secondary" block disabled={status === "busy"} onClick={() => void send(r.id)}>
              {t(r.key)}
            </Button>
          ))}
        </div>
      </Modal>
    </>
  );
}
