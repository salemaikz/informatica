"use client";

import { Download, Loader2, Share2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { track, type ShareWhat } from "@/lib/analytics";
import { downloadBlob } from "@/lib/download";
import { canShareFile, absoluteUrl } from "@/lib/share";
import { cardFileName, renderShareCard, type CardTopic } from "@/lib/share-card";
import { sharePath, type ShareResult } from "@/lib/share-code";
import { APP_NAME } from "@/lib/site-meta";
import { cardModelOf, messageText } from "./labels";
import { ShareTargets } from "./ShareTargets";

/** Результат для ссылки: готовый или тот, что считается по нажатию (например, тег банка заданий подгружается лениво). */
export type ShareSource = ShareResult | null | (() => Promise<ShareResult | null>);

type Card = { status: "none" } | { status: "loading" } | { status: "ready"; url: string; file: File } | { status: "failed" };


/**
 * Кнопка + лист «Поделиться» (#72, #73). Нажатие открывает окно и ЗАПУСКАЕТ рисование карточки (promise, setState — в then),
 * не эффект: картинка нужна только тем, кто нажал. Внутри — превью, «Отправить / WhatsApp / Telegram / Скопировать ссылку»
 * (`ShareTargets` с файлом) и, где системное меню не принимает картинки (десктоп), «Сохранить картинку».
 * `what: "challenge"` — без картинки (вызов другу — только ссылка и текст-вызов).
 */
export function ShareSheet({
  source,
  what,
  topics,
  label,
  icon,
  variant = "secondary",
  size,
  block,
  className,
}: {
  source: ShareSource;
  what: Exclude<ShareWhat, "report">;
  /** Темы пробника для карточки (подписи на языке ученика); отбирает сильные сама карточка. */
  topics?: readonly CardTopic[];
  /** Подпись кнопки. */
  label: ReactNode;
  icon?: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  block?: boolean;
  className?: string;
}) {
  const { t } = useT();
  const withCard = what !== "challenge";
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ShareResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [card, setCard] = useState<Card>({ status: "none" });
  // Номер запуска: закрыли окно, пока рисовалось, — поздний ответ выбрасываем (и не оставляем object URL).
  const run = useRef(0);
  const urlRef = useRef<string | null>(null);

  const release = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  // Отмена рисования: поздний ответ выбрасываем (номер запуска) и освобождаем картинку. Нужна и при закрытии окна,
  // и при уходе со страницы: без этого картинка дорисуется уже после размонтирования и её object URL останется навсегда.
  const cancel = useCallback(() => {
    run.current++;
    release();
  }, [release]);
  useEffect(() => cancel, [cancel]);

  const onOpen = () => {
    const id = ++run.current;
    release();
    setOpen(true);
    setFailed(false);
    setCard(withCard ? { status: "loading" } : { status: "none" });
    const resolved = typeof source === "function" ? source() : Promise.resolve(source);
    // Рисование — из обработчика: цепочка promise, состояние ставится в then.
    void resolved
      .then(async (r) => {
        if (id !== run.current) return;
        if (!r) {
          setFailed(true);
          setCard({ status: "none" });
          return;
        }
        setResult(r);
        if (!withCard) return;
        try {
          const model = cardModelOf(r, topics);
          const blob = await renderShareCard(model);
          if (id !== run.current) return;
          const url = URL.createObjectURL(blob);
          urlRef.current = url;
          const file = new File([blob], cardFileName(model), { type: "image/png" });
          setCard({ status: "ready", url, file });
        } catch {
          if (id === run.current) setCard({ status: "failed" });
        }
      })
      .catch(() => {
        if (id !== run.current) return;
        setFailed(true);
        setCard({ status: "none" });
      });
  };

  const onClose = () => {
    cancel();
    setOpen(false);
    setCard({ status: "none" });
  };

  const path = result ? sharePath(result) : null;
  const url = path ? absoluteUrl(path) : null;
  const file = card.status === "ready" ? card.file : null;
  const preparing = withCard && card.status === "loading";
  const title = what === "lesson" ? t("progress16c.share.title") : t(`share.sheet.title.${what}` as DictKey);

  const onSave = () => {
    if (card.status !== "ready") return;
    downloadBlob(card.file, card.file.name);
    track({ e: "share", what, how: "save" });
  };

  return (
    <>
      <Button variant={variant} size={size} block={block} icon={icon ?? <Share2 size={18} aria-hidden />} className={className} onClick={onOpen}>
        {label}
      </Button>
      <Modal open={open} onClose={onClose} label={title}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="min-w-0 text-xl font-extrabold">{title}</h2>
            <Button variant="ghost" size="sm" aria-label={t("common.close")} onClick={onClose} className="h-11 w-11 shrink-0 px-0">
              <X size={20} aria-hidden />
            </Button>
          </div>

          {what === "challenge" && <p className="text-sm font-bold text-muted">{t("share.sheet.challengeNote")}</p>}

          {withCard && (
            <div className="flex flex-col items-center gap-2">
              {card.status === "ready" ? (
                // eslint-disable-next-line @next/next/no-img-element -- object URL из canvas, оптимизировать нечего
                <img src={card.url} alt={t("share.sheet.previewAlt")} className="max-h-[46dvh] w-auto max-w-full rounded-2xl border-2 border-border" />
              ) : (
                <div role="status" className="flex aspect-[9/16] max-h-[46dvh] w-auto items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface-2 px-8 text-center text-sm font-bold text-muted">
                  {card.status === "failed" ? (
                    t("share.sheet.renderFailed")
                  ) : (
                    <>
                      <Loader2 size={28} className="animate-spin text-primary" aria-hidden />
                      <span className="sr-only">{t("share.sheet.preparing")}</span>
                    </>
                  )}
                </div>
              )}
              {card.status === "ready" && <p className="text-center text-xs font-bold text-muted">{t("share.sheet.hint")}</p>}
            </div>
          )}

          {failed && <p className="rounded-xl bg-danger-soft p-3 text-center text-sm font-bold text-danger-strong">{t("share.sheet.linkFailed")}</p>}

          {url && result && (
            <>
              {/* Пока картинка рисуется, кнопка системного меню ждёт: так в меню уйдёт и картинка. */}
              <ShareTargets
                url={url}
                title={APP_NAME}
                text={messageText(result, what === "challenge" ? "challenge" : "result")}
                what={what}
                file={file}
                nativePending={preparing ? t("share.sheet.preparing") : undefined}
              />
              {file && !canShareFile(file) && (
                <Button variant="secondary" block icon={<Download size={18} aria-hidden />} onClick={onSave}>
                  {t("share.sheet.save")}
                </Button>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
