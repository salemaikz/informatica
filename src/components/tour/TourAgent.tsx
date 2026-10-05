"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_STEPS, completedLessonsCount, learnScene, unseenTips } from "@/lib/tour";
import { entVisible } from "@/lib/school";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Spotlight } from "./Spotlight";
import { findTour, useTargetRect } from "./useTargetRect";

/** Пауза после прихода на «Учиться»: сначала виден сам экран, потом подсказка. */
export const TOUR_DELAY_MS = 700;

/** Все подсказки проводника закрыть («Пропустить», Escape). */
function noteAll() {
  const s = useApp.getState();
  for (const id of unseenTips(s.tips)) s.noteTip(id);
}

/**
 * Обзор панели из трёх шагов. Отдельный компонент: шаг живёт, пока идёт обзор, и сам обнуляется при закрытии —
 * «Показать подсказки снова» начинает обзор с первого шага.
 */
function NavTour() {
  const { t } = useT();
  const ent = useApp((s) => entVisible(s.profile));
  const [navStep, setNavStep] = useState(0);
  const step = NAV_STEPS[navStep];
  const last = navStep >= NAV_STEPS.length - 1;
  const rect = useTargetRect(step.targets, true);
  // Ученику школьного трека пробный ЕНТ не виден (#52) — про него не говорим.
  const textKey = step.id === "header" ? "tour.nav.header" : step.id === "bar" ? (ent ? "tour.nav.bar" : "tour.nav.bar.school") : "tour.nav.done";
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

/** Приветствие: вырез вокруг кнопки «Продолжить»; кнопки нет (школа без урока) — пузырь по центру. */
function Welcome() {
  const { t } = useT();
  const router = useRouter();
  const name = useApp((s) => s.profile.name);
  const rect = useTargetRect(["continue"], true, true);
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
      text={hasLesson ? t("tour.welcome.text") : t("tour.welcome.textNoLesson")}
      primary={hasLesson ? { label: t("tour.welcome.start"), onClick: start } : { label: t("tour.ok"), onClick: finish }}
      onSkip={noteAll}
      onEscape={noteAll}
    />
  );
}

/**
 * Проводник первого входа (#104): на «Учиться» — приветствие с выделением кнопки первого урока, а после первого
 * пройденного урока — обзор шапки и нижней панели из трёх шагов. Всё один раз (`useApp.tips`). «Пропустить» и Escape
 * закрывают весь проводник. В уроке, тесте, пробном ЕНТ и игре не показывается (там другие пути). Монтируется в Providers.
 */
export function TourAgent() {
  const onboarded = useApp((s) => s.onboarded);
  const pathname = usePathname();
  const tips = useApp((s) => s.tips);
  const completed = useApp((s) => completedLessonsCount(s.lessons));
  // Путь, для которого пауза прошла. Ушли с «Учиться» — сбрасывается (в очистке эффекта), и по возвращении ждём заново.
  const [readyFor, setReadyFor] = useState<string | null>(null);

  useEffect(() => {
    if (!onboarded || pathname !== "/learn") return;
    const id = window.setTimeout(() => setReadyFor(pathname), TOUR_DELAY_MS);
    return () => {
      window.clearTimeout(id);
      setReadyFor(null);
    };
  }, [onboarded, pathname]);

  const scene = readyFor === pathname ? learnScene(tips, { completedLessons: completed, onboarded, pathname }) : null;
  if (scene === "welcome") return <Welcome />;
  if (scene === "nav") return <NavTour />;
  return null;
}
