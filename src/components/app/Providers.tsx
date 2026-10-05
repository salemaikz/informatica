"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { isPublicPath } from "@/lib/public-paths";
import { HYDRATION_TIMEOUT_MS, hydrationFailed, hydrationPhase, subscribeStorage, type HydrationPhase } from "@/lib/safe-storage";
import { Mascot } from "@/components/mascot/Mascot";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { Toolbox } from "@/components/tools/Toolbox";
import { SaveToNotesSheet } from "@/components/notes/SaveToNotesSheet";
import { ReminderAgent } from "@/components/app/ReminderAgent";
import { ActiveTimeAgent } from "@/components/app/ActiveTimeAgent";
import { SwRegister } from "@/components/app/SwRegister";
import { OfflineBanner } from "@/components/app/OfflineBanner";
import { StorageBanner } from "@/components/app/StorageBanner";
import { RecoveryScreen } from "@/components/app/RecoveryScreen";
import { PaywallAgent } from "@/components/plans/PaywallAgent";

function subscribeHydration(cb: () => void): () => void {
  const offs = [useApp.persist.onHydrate(cb), useApp.persist.onFinishHydration(cb), subscribeStorage(cb)];
  return () => offs.forEach((off) => off());
}

/**
 * Где мы в загрузке прогресса: ждём, готово или не открылось (ошибка чтения, миграции, слияния
 * либо не закончилось за HYDRATION_TIMEOUT_MS). retry — повторная попытка прочитать сохранение.
 */
function useHydration(): { phase: HydrationPhase; retry: () => void } {
  const hydrated = useSyncExternalStore(subscribeHydration, () => useApp.persist.hasHydrated(), () => false);
  const failed = useSyncExternalStore(subscribeHydration, hydrationFailed, () => false);
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (hydrated || failed) return;
    const id = window.setTimeout(() => setTimedOut(true), HYDRATION_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [hydrated, failed, attempt]);

  const retry = () => {
    setTimedOut(false);
    setAttempt((n) => n + 1);
    void useApp.persist.rehydrate();
  };
  return { phase: hydrationPhase(hydrated, failed, timedOut), retry };
}

/**
 * Прогресс хранится в localStorage, поэтому интерфейс рисуем только после гидратации стора.
 * Не открылось — экран восстановления (скачать копию, начать заново, повторить), а не вечный маскот.
 * Здесь же: тема, язык документа и редирект на онбординг.
 */
export function Providers({ children }: { children: ReactNode }) {
  const { phase, retry } = useHydration();
  const hydrated = phase === "ready";
  const onboarded = useApp((s) => s.onboarded);
  const theme = useApp((s) => s.profile.theme);
  const lang = useApp((s) => s.profile.lang);
  const reduceMotion = useApp((s) => s.profile.reduceMotion);
  const pathname = usePathname();
  const router = useRouter();

  const needsOnboarding = hydrated && !onboarded && !isPublicPath(pathname);

  useEffect(() => {
    const el = document.documentElement;
    if (theme === "system") delete el.dataset.theme;
    else el.dataset.theme = theme;
    el.lang = lang === "kk" ? "kk" : "ru";
  }, [theme, lang]);

  // «Меньше анимаций»: CSS-анимации гасим правилом в globals.css, JS-анимации — через MotionProvider.
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reduceMotion ? "true" : "false";
  }, [reduceMotion]);

  useEffect(() => {
    if (needsOnboarding) router.replace("/onboarding");
  }, [needsOnboarding, router]);

  if (phase === "failed") {
    return (
      <MotionProvider>
        <RecoveryScreen onRetry={retry} />
      </MotionProvider>
    );
  }
  if (!hydrated || needsOnboarding) {
    return (
      <MotionProvider>
        <div className="flex min-h-dvh items-center justify-center">
          <Mascot size={88} className="animate-pulse" />
        </div>
      </MotionProvider>
    );
  }
  return (
    <MotionProvider>
      {/* Офлайн: кэш сервис-воркера (только production) и полоса «Нет интернета». */}
      <SwRegister />
      <OfflineBanner />
      {/* Браузер не сохраняет прогресс (приватный режим, память заполнена) — полоса с крестиком. */}
      <StorageBanner />
      {children}
      {/* Инструменты (калькулятор, черновик) — одна панель на всё приложение. */}
      <Toolbox />
      {/* «Сохранить в конспект» из любого места (черновик, ответ ИИ, урок). */}
      <SaveToNotesSheet />
      {/* Напоминания о серии: таймер, пока приложение открыто, и зеркало для сервис-воркера. */}
      <ReminderAgent />
      {/* Активное время учёбы (#68): единственный писатель секунд дня. */}
      <ActiveTimeAgent />
      {/* Окно тарифов: бесплатным ученикам на главной не чаще раза в 3 дня. */}
      <PaywallAgent />
    </MotionProvider>
  );
}
