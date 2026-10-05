"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NAV_STEPS, completedLessonsCount, learnScene, unseenTips } from "@/lib/tour";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Spotlight } from "./Spotlight";
import { findTour, useTargetRect } from "./useTargetRect";

/** Пауза после прихода на «Учиться»: сначала виден сам экран, потом подсказка. */
export const TOUR_DELAY_MS = 700;

/**
 * Проводник первого входа (#104): на «Учиться» — приветствие с выделением кнопки первого урока, а после первого
 * пройденного урока — обзор шапки и нижней панели из трёх шагов. Всё один раз (`useApp.tips`). «Пропустить» и Escape
 * закрывают весь проводник. В уроке, тесте, пробном ЕНТ и игре не показывается (там другие пути). Монтируется в Providers.
 */
export function TourAgent() {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const onboarded = useApp((s) => s.onboarded);
  const tips = useApp((s) => s.tips);
  const name = useApp((s) => s.profile.name);
  const completed = useApp((s) => completedLessonsCount(s.lessons));
  // Путь, для которого пауза прошла: ушли и вернулись — ждём заново.
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [navStep, setNavStep] = useState(0);

  useEffect(() => {
    if (!onboarded || pathname !== "/learn") return;
    const id = window.setTimeout(() => setReadyFor(pathname), TOUR_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [onboarded, pathname]);

  const scene = onboarded && pathname === "/learn" && readyFor === pathname ? learnScene(tips, { completedLessons: completed }) : null;
  const targets: readonly string[] = scene === "welcome" ? ["continue"] : scene === "nav" ? NAV_STEPS[navStep].targets : [];
  const rect = useTargetRect(targets, scene !== null, scene === "welcome");

  const noteAll = useCallback(() => {
    const s = useApp.getState();
    for (const id of unseenTips(s.tips)) s.noteTip(id);
  }, []);

  if (!scene) return null;

  if (scene === "welcome") {
    const hasLesson = rect !== null;
    const finish = () => useApp.getState().noteTip("welcome");
    const start = () => {
      // Куда ведёт подсвеченная кнопка — туда и идём (первый урок или следующий урок класса).
      const href = findTour("continue")?.getAttribute("href");
      finish();
      if (href) router.push(href);
    };
    const trimmed = name.trim();
    return (
      <Spotlight
        rect={rect}
        title={trimmed ? t("tour.welcome.title", { name: trimmed }) : t("tour.welcome.title0")}
        text={t("tour.welcome.text")}
        primary={hasLesson ? { label: t("tour.welcome.start"), onClick: start } : { label: t("tour.ok"), onClick: finish }}
        onSkip={noteAll}
        onEscape={noteAll}
      />
    );
  }

  const step = NAV_STEPS[navStep];
  const last = navStep >= NAV_STEPS.length - 1;
  const textKey = step.id === "header" ? "tour.nav.header" : step.id === "bar" ? "tour.nav.bar" : "tour.nav.done";
  return (
    <Spotlight
      rect={rect}
      mood={last ? "celebrate" : "happy"}
      text={t(textKey)}
      step={{ n: navStep + 1, total: NAV_STEPS.length }}
      primary={last ? { label: t("tour.done"), onClick: () => useApp.getState().noteTip("nav") } : { label: t("tour.next"), onClick: () => setNavStep(navStep + 1) }}
      onSkip={last ? undefined : noteAll}
      onEscape={noteAll}
    />
  );
}
