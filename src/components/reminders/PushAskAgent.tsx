"use client";

import { BellRing, Share, SquarePlus, Smartphone } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { isPushAskScreen, shouldAskPush, type PushAskAction } from "@/lib/push-ask";
import { tourBlocking } from "@/lib/tour";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { enablePush, pushPermission } from "@/components/goals/push";
import { MascotSays } from "@/components/mascot/Mascot";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/** Пауза после прихода на главный экран: сначала виден сам экран, потом окно (и окно тарифов успевает уйти первым). */
export const PUSH_ASK_DELAY_MS = 1200;

/**
 * Окно «Включить напоминания» (этап 15, F3): с первого входа, дальше по ритму `shouldAskPush` (3 дня в первую неделю,
 * потом раз в 7). Только на главных экранах — не в уроке, тесте и игре. Системный запрос разрешения —
 * только по нажатию «Включить» (иначе браузеры его блокируют). Запретил браузер — короткая инструкция,
 * iPhone без экрана «Домой» — подсказка про установку. Монтируется в Providers.
 */
export function PushAskAgent() {
  const { t } = useT();
  const pathname = usePathname();
  const onboarded = useApp((s) => s.onboarded);
  // Пока идёт проводник первого входа (#104), окно ждёт; сразу после обзора панели появляется («напомнить завтра, чтобы серия не сгорела»).
  const touring = useApp((s) => tourBlocking(s.tips));
  // mode — что показываем; shown — открыто ли окно (mode остаётся на время анимации закрытия, чтобы текст не «прыгал»).
  const [mode, setMode] = useState<PushAskAction>("ask");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const fired = useRef(false);
  const screen = isPushAskScreen(pathname);

  useEffect(() => {
    if (fired.current || !screen || !onboarded || touring) return;
    const id = setTimeout(() => {
      const s = useApp.getState();
      // Ученик сам выключил напоминания — не уговариваем.
      if (!s.profile.reminder.enabled) return;
      const permission = pushPermission();
      const pushOn = s.profile.reminder.push && permission === "granted";
      const action = shouldAskPush(permission, s.pushAsk, s.profile.createdAt, Date.now(), pushOn);
      if (!action) return;
      fired.current = true;
      s.notePushAsked();
      setFailed(false);
      setMode(action);
      setShown(true);
    }, PUSH_ASK_DELAY_MS);
    return () => clearTimeout(id);
  }, [screen, onboarded, touring]);

  // Ушли с главного экрана (назад, ссылка) — окно прячется вместе с экраном.
  const open = shown && screen;
  const close = () => setShown(false);

  const enable = async () => {
    setBusy(true);
    setFailed(false);
    const r = await enablePush();
    setBusy(false);
    if (r === "ok") {
      const s = useApp.getState();
      s.updateProfile({ reminder: { ...s.profile.reminder, push: true, enabled: true } });
      setShown(false);
    } else if (r === "denied") {
      // Закрыл системный запрос — разрешение осталось «default»: не пугаем инструкцией, спросим позже по ритму.
      if (pushPermission() === "denied") setMode("blocked-help");
      else setShown(false);
    } else if (r === "failed") {
      setFailed(true);
    } else {
      setShown(false);
    }
  };

  const title = mode === "blocked-help" ? t("push15.blocked.title") : mode === "install-help" ? t("push15.install.title") : t("push15.title");

  return (
    <Modal open={open} onClose={close} label={title}>
      <div className="flex flex-col gap-4">
        <MascotSays mood={mode === "ask" ? "happy" : "thinking"} size={64}>
          <span className="block text-lg font-extrabold leading-snug">{title}</span>
          <span className="mt-1 block text-sm font-bold text-muted">
            {mode === "blocked-help" ? t("push15.blocked.text") : mode === "install-help" ? t("push15.install.text") : t("push15.text")}
          </span>
        </MascotSays>

        {mode === "install-help" && (
          <ol className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3 text-sm font-bold">
            <Step icon={<Share size={18} aria-hidden />}>{t("push15.install.step1")}</Step>
            <Step icon={<SquarePlus size={18} aria-hidden />}>{t("push15.install.step2")}</Step>
            <Step icon={<Smartphone size={18} aria-hidden />}>{t("push15.install.step3")}</Step>
          </ol>
        )}
        {mode === "blocked-help" && <p className="text-sm font-semibold text-muted">{t("push15.blocked.then")}</p>}
        {mode === "ask" && <p className="text-sm font-semibold text-muted">{t("push15.hint")}</p>}

        {failed && (
          <p role="alert" className="rounded-xl bg-warning-soft px-3 py-2 text-sm font-bold text-warning-strong">
            {t("remind.push.failed")}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {mode === "ask" ? (
            <>
              <Button size="lg" block icon={<BellRing size={20} aria-hidden />} onClick={() => void enable()} disabled={busy}>
                {t("push15.enable")}
              </Button>
              <Button variant="ghost" block onClick={close}>
                {t("push15.later")}
              </Button>
            </>
          ) : (
            <>
              <Button size="lg" block onClick={close}>
                {t("push15.ok")}
              </Button>
              {mode === "blocked-help" && (
                <ButtonLink href="/profile" variant="secondary" block onClick={close}>
                  {t("push15.blocked.profile")}
                </ButtonLink>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Step({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">{icon}</span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}
