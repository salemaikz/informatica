"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { QrCode } from "./QrCode";

/** Готовая ссылка: поле, «Скопировать», «Поделиться» (если есть в браузере) и, по желанию, QR-код. */
export function LinkBox({ link, qr, title }: { link: string; qr?: boolean; title: string }) {
  const { t } = useT();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setMsg({ ok: true, text: t("links.copied") });
    } catch {
      setMsg({ ok: false, text: t("links.copy.failed") });
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title, url: link });
    } catch {
      /* отмена — не ошибка */
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-3">
      <textarea
        readOnly
        value={link}
        rows={3}
        aria-label={t("links.link.label")}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full resize-none break-all rounded-xl border-2 border-border bg-surface-2 p-2.5 font-mono text-xs outline-none focus:border-primary"
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" onClick={() => void copy()} icon={msg?.ok ? <Check size={18} /> : <Copy size={18} />}>
          {t("links.copy")}
        </Button>
        {canShare && (
          <Button variant="secondary" onClick={() => void share()} icon={<Share2 size={18} />}>
            {t("links.share")}
          </Button>
        )}
      </div>
      {msg && (
        <p role="status" className={cn("rounded-xl px-3 py-2 text-sm font-bold", msg.ok ? "bg-success-soft text-success-strong" : "bg-danger-soft text-danger")}>
          {msg.text}
        </p>
      )}
      {qr && (
        <div className="flex flex-col items-center gap-2">
          <QrCode text={link} label={t("links.qr.label")} />
          <p className="text-center text-xs font-semibold text-muted">{t("links.transfer.qrHint")}</p>
        </div>
      )}
    </div>
  );
}
