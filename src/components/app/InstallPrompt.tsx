"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useT } from "@/i18n/useT";

const DISMISS_KEY = "informatica:install-dismissed";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

const noopSubscribe = () => () => {};

/** Один раз за сессию определяем платформу (на сервере — «ничего не показывать»). */
function useEnv(): { standalone: boolean; ios: boolean } | null {
  const raw = useSyncExternalStore(
    noopSubscribe,
    () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      const ua = navigator.userAgent;
      // iPadOS 13+ представляется как Mac — отличаем по сенсорному экрану.
      const apple = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
      const ios = apple && !/crios|fxios|edgios/i.test(ua) ? 1 : 0;
      return `${standalone ? 1 : 0}${ios}`;
    },
    () => "",
  );
  return raw ? { standalone: raw[0] === "1", ios: raw[1] === "1" } : null;
}

/** «Установить приложение»: Android/Chrome — системный запрос, iPhone — подсказка. Скрыто, если уже установлено или закрыто. */
export function InstallPrompt({ className }: { className?: string }) {
  const { t } = useT();
  const env = useEnv();
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(readDismissed);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!env || env.standalone || hidden) return null;
  if (!event && !env.ios) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* приватный режим */
    }
    setHidden(true);
  };
  const install = async () => {
    if (!event) return;
    setEvent(null); // событие одноразовое: второй prompt() бросит ошибку
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === "dismissed") dismiss();
    } catch {
      /* браузер отклонил запрос — карточка просто скроется до следующего beforeinstallprompt */
    }
  };

  return (
    <Card className={className} data-testid="install-prompt">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Download size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{t("offline.install.title")}</p>
          <p className="mt-0.5 text-sm text-muted">{t("offline.install.body")}</p>
          {event ? (
            <Button className="mt-3" onClick={() => void install()} icon={<Download size={16} aria-hidden />}>
              {t("offline.install.button")}
            </Button>
          ) : (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 p-2.5 text-sm font-bold">
              <Share size={16} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              {t("offline.install.ios")}
            </p>
          )}
        </div>
        <button type="button" onClick={dismiss} aria-label={t("offline.install.dismiss")} className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <X size={18} aria-hidden />
        </button>
      </div>
    </Card>
  );
}
