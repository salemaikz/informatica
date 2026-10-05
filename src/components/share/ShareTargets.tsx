"use client";

import { Check, Link2, Loader2, MessageCircle, Send, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useT } from "@/i18n/useT";
import { track, type ShareHow, type ShareWhat } from "@/lib/analytics";
import { canShareNative, copyText, shareNative, telegramUrl, whatsappUrl } from "@/lib/share";
import { cn } from "@/lib/cn";
import { Button, buttonClass } from "@/components/ui/Button";

type Status = { kind: "idle" } | { kind: "shared" } | { kind: "copied" } | { kind: "manual" } | { kind: "failed" };

const noop = () => () => {};

/**
 * Куда отправить ссылку (#72): системное меню телефона (если есть), WhatsApp, Telegram, «Скопировать ссылку».
 * Не вышло скопировать — поле со ссылкой, чтобы скопировать вручную. С `file` системное меню отправляет картинку
 * вместе с текстом и ссылкой (картинку готовят заранее: iOS требует, чтобы меню открывалось прямо по нажатию).
 * Общий для карточки результата, вызова другу и отчёта родителю. Каждый успешный способ — событие `share` (#69).
 */
export function ShareTargets({
  url,
  title,
  text,
  what,
  file,
  nativePending,
  className,
}: {
  /** Абсолютная ссылка. */
  url: string;
  /** Заголовок для системного меню. */
  title: string;
  /** Текст сообщения без ссылки. */
  text: string;
  what: ShareWhat;
  file?: File | null;
  /** Картинка ещё готовится: вместо кнопки системного меню — неактивная кнопка с этой подписью (в меню должна уйти и картинка). */
  nativePending?: string;
  className?: string;
}) {
  const { t } = useT();
  const native = useSyncExternalStore(noop, () => canShareNative(), () => false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const done = (how: ShareHow) => track({ e: "share", what, how });

  const onNative = async () => {
    const r = await shareNative({ title, text, url, file });
    if (r === "shared") {
      setStatus({ kind: "shared" });
      done("native");
    } else if (r === "failed") setStatus({ kind: "failed" });
  };

  const onCopy = async () => {
    if (await copyText(url)) {
      setStatus({ kind: "copied" });
      done("copy");
    } else setStatus({ kind: "manual" });
  };

  const link = (how: "wa" | "tg") => ({
    href: how === "wa" ? whatsappUrl(text, url) : telegramUrl(text, url),
    target: "_blank",
    rel: "noopener noreferrer",
    onClick: () => done(how),
    className: buttonClass({ variant: "secondary", block: true }),
  });

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {native &&
        (nativePending ? (
          <Button block disabled icon={<Loader2 size={18} className="animate-spin" aria-hidden />}>
            {nativePending}
          </Button>
        ) : (
          <Button block icon={<Share2 size={18} aria-hidden />} onClick={onNative}>
            {t("share.targets.native")}
          </Button>
        ))}
      <div className="grid grid-cols-2 gap-2.5">
        <a {...link("wa")}>
          <MessageCircle size={18} aria-hidden />
          WhatsApp
        </a>
        <a {...link("tg")}>
          <Send size={18} aria-hidden />
          Telegram
        </a>
      </div>
      <Button variant="secondary" block icon={status.kind === "copied" ? <Check size={18} aria-hidden /> : <Link2 size={18} aria-hidden />} onClick={onCopy}>
        {status.kind === "copied" ? t("share.targets.copied") : t("share.targets.copy")}
      </Button>
      <div role="status" className="min-h-5 text-center text-sm font-bold">
        {status.kind === "copied" && <span className="sr-only">{t("share.targets.copied")}</span>}
        {status.kind === "shared" && <span className="text-success-strong">{t("share.targets.shared")}</span>}
        {status.kind === "failed" && <span className="text-danger">{t("share.targets.failed")}</span>}
      </div>
      {status.kind === "manual" && (
        <label className="flex flex-col gap-1.5 text-sm font-bold text-muted">
          {t("share.targets.manual")}
          <input
            readOnly
            value={url}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onCopy={() => done("manual")}
            className="h-11 w-full rounded-xl border-2 border-border bg-surface-2 px-3 font-mono text-xs text-text"
          />
        </label>
      )}
    </div>
  );
}
