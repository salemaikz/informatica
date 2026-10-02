"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { Mascot } from "@/components/mascot/Mascot";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { Toolbox } from "@/components/tools/Toolbox";

function useHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useApp.persist.onFinishHydration(cb),
    () => useApp.persist.hasHydrated(),
    () => false,
  );
}

/**
 * Прогресс хранится в localStorage, поэтому интерфейс рисуем только после гидратации стора.
 * Здесь же: тема, язык документа и редирект на онбординг.
 */
export function Providers({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const onboarded = useApp((s) => s.onboarded);
  const theme = useApp((s) => s.profile.theme);
  const lang = useApp((s) => s.profile.lang);
  const reduceMotion = useApp((s) => s.profile.reduceMotion);
  const pathname = usePathname();
  const router = useRouter();

  const needsOnboarding = hydrated && !onboarded && pathname !== "/onboarding";

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
      {children}
      {/* Инструменты (калькулятор, черновик) — одна панель на всё приложение. */}
      <Toolbox />
    </MotionProvider>
  );
}
