"use client";

import { Check, Flag } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { blockPlayer, reportPlayer, type ReportReason, type ReportWhere } from "@/lib/social/client";
import type { PublicCard } from "@/lib/duel/types";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useShowName } from "./PlayerCard";

// «Пожаловаться» на игрока (docs/specs/duels.md §7; 3-safety.md §4): иконка Flag приглушённым цветом (не danger — это не ошибка
// ученика), шторка с готовыми причинами, без свободного текста. Имя у пожаловавшегося скрывается сразу (стор hiddenNames),
// затем предлагается «Заблокировать». У бота кнопки нет.

const REASONS: { id: ReportReason; key: "social.report.name" | "social.report.cheat" | "social.report.other" }[] = [
  { id: "name", key: "social.report.name" },
  { id: "cheat", key: "social.report.cheat" },
  { id: "other", key: "social.report.other" },
];

export function ReportPlayerButton({
  card,
  where,
  matchId,
  label,
  className,
  onBlocked,
}: {
  card: PublicCard;
  where: ReportWhere;
  matchId?: string;
  /** Подпись рядом с иконкой (по умолчанию — только иконка). */
  label?: boolean;
  className?: string;
  onBlocked?: () => void;
}) {
  const { t } = useT();
  const show = useShowName();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const name = show(card);

  const send = (reason: ReportReason) => {
    // Сразу у себя — без ожидания сервера (ответ сервера ничего не меняет для ученика).
    useApp.getState().hidePlayerName(card.code);
    setDone(true);
    void reportPlayer(card.code, reason, where, matchId);
  };

  const block = async () => {
    const r = await blockPlayer(card.code);
    if (r.ok) {
      setBlocked(true);
      onBlocked?.();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDone(false);
          setBlocked(false);
          setOpen(true);
        }}
        aria-label={t("social.report.aria", { name })}
        data-testid="report-player"
        className={cn(
          "relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-extrabold text-muted hover:bg-surface-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
          className,
        )}
      >
        <Flag size={16} aria-hidden />
        {label && t("social.report")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} label={t("social.report.title")}>
        <div className="flex flex-col gap-3 pb-[max(8px,env(safe-area-inset-bottom))]">
          <h2 className="text-xl font-extrabold">{t("social.report.title")}</h2>
          {done ? (
            <>
              <p className="flex items-start gap-2 rounded-2xl bg-success-soft px-3 py-2 text-sm font-bold text-ink-success" role="status">
                <Check size={18} className="mt-0.5 shrink-0" aria-hidden />
                {t("social.report.done")}
              </p>
              {!blocked ? (
                <Button variant="secondary" block onClick={block}>
                  {t("social.friend.block")}
                </Button>
              ) : (
                <p className="text-center text-sm font-extrabold text-muted">{t("social.blocked")}</p>
              )}
              <Button variant="ghost" block onClick={() => setOpen(false)}>
                {t("common.close")}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-muted">{name}</p>
              {REASONS.map((r) => (
                <Button key={r.id} variant="secondary" block onClick={() => send(r.id)} data-reason={r.id}>
                  {t(r.key)}
                </Button>
              ))}
              <Button variant="ghost" block onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
