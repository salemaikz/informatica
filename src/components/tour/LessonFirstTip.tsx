"use client";

import { useEffect } from "react";
import { completedLessonsCount, showLessonFirst } from "@/lib/tour";
import { formatHearts } from "@/lib/economy";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Mascot } from "@/components/mascot/Mascot";
import { useTargetRect } from "./useTargetRect";

const WIDTH = 300;
const MARGIN = 12;

/**
 * Одна подсказка в первом уроке (#104): под сердечками — «вход стоит сердечко, ошибки не отнимают». Не перекрывает экран:
 * закрывается любым касанием или нажатием клавиши (оно проходит дальше, как обычно). Размещать из LessonScreen,
 * когда на экране плеер урока (режим «Учиться», не выбор «Продолжить / Заново»). `cost` — цена входа в сердечках.
 */
export function LessonFirstTip({ cost }: { cost: number }) {
  const { t } = useT();
  const tips = useApp((s) => s.tips);
  const completed = useApp((s) => completedLessonsCount(s.lessons));
  const active = showLessonFirst(tips, completed);
  const rect = useTargetRect(["lesson-hearts"], active);

  const visible = active && rect !== null;
  useEffect(() => {
    if (!visible) return;
    const close = () => useApp.getState().noteTip("lesson-first");
    // Пауза, чтобы нажатие, которым открыли урок, не закрыло подсказку сразу.
    const id = window.setTimeout(() => {
      window.addEventListener("pointerdown", close, { capture: true, once: true });
      window.addEventListener("keydown", close, { capture: true, once: true });
    }, 400);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", close, { capture: true });
      window.removeEventListener("keydown", close, { capture: true });
    };
  }, [visible]);

  if (!visible || !rect) return null;
  const width = Math.min(WIDTH, window.innerWidth - MARGIN * 2);
  const left = Math.max(MARGIN, Math.min(rect.x + rect.w - width, window.innerWidth - width - MARGIN));
  const arrow = Math.max(16, Math.min(rect.x + rect.w / 2 - left - 8, width - 32));
  const key = cost === 1 ? "tour.lesson.one" : "tour.lesson.many";

  return (
    <div role="note" className="pointer-events-none fixed z-40 animate-fade-in" style={{ top: rect.y + rect.h + 12, left, width }}>
      <span aria-hidden className="absolute -top-[9px] h-4 w-4 rotate-45 border-l-2 border-t-2 border-border bg-surface" style={{ left: arrow }} />
      <div className="relative flex items-center gap-2 rounded-2xl border-2 border-border bg-surface p-3 shadow-2xl">
        <Mascot mood="happy" size={40} className="shrink-0" />
        <p className="text-sm font-bold leading-snug">{t(key, { n: formatHearts(cost) })}</p>
      </div>
    </div>
  );
}
