"use client";

import { Dumbbell, Flame, Play, X } from "lucide-react";
import { useState } from "react";
import { UNITS } from "@/content/course-map";
import { streakAtRisk } from "@/lib/gamification";
import { nextLessonId } from "@/lib/goals";
import { pickReminder } from "@/lib/reminder-texts";
import { parseTime } from "@/lib/reminders";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import { useT } from "@/i18n/useT";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { reminderCtxFrom } from "./push";
import { useMinuteClock } from "./useClock";

const HIDDEN_KEY = "informatica:streak-banner-hidden";

function readHidden(): string | null {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(HIDDEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Плашка «серия под угрозой»: показывается после времени напоминания, пока сегодня не было занятий.
 * Главная вставляет её над картой курса.
 */
export function StreakReminder({ className }: { className?: string }) {
  const { t } = useT();
  const reminder = useApp((s) => s.profile.reminder);
  const streak = useApp((s) => s.streak);
  const lessons = useApp((s) => s.lessons);
  const now = useMinuteClock();
  // Скрытие запоминаем на день (localStorage в try/catch): иначе баннер возвращается при каждом переходе на главную.
  const [hiddenDay, setHiddenDay] = useState<string | null>(readHidden);
  const hide = (day: string) => {
    setHiddenDay(day);
    try {
      localStorage.setItem(HIDDEN_KEY, day);
    } catch {
      /* приватный режим — скроем до перехода */
    }
  };

  if (!now) return null;
  const date = new Date(now);
  const today = todayKey(date);
  const at = parseTime(reminder.time);
  const late = at !== null && date.getHours() * 60 + date.getMinutes() >= at;
  if (!reminder.enabled || !late || !streakAtRisk(streak, today) || hiddenDay === today) return null;

  const text = pickReminder(reminderCtxFrom(useApp.getState(), date));
  const next = nextLessonId(UNITS, lessons);

  return (
    <div role="status" className={cn("relative rounded-3xl border-2 border-streak/40 bg-streak-soft p-4", className)}>
      <button
        type="button"
        onClick={() => hide(today)}
        aria-label={t("remind.banner.close")}
        className="absolute right-1.5 top-1.5 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface/60 hover:text-text"
      >
        <X size={18} />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-streak text-white">
          <Flame size={22} fill="currentColor" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-extrabold leading-snug">{text.title}</p>
          <p className="text-sm font-semibold text-muted">{text.body}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {next && (
          <ButtonLink href={`/lesson/${next}`} size="md" block icon={<Play size={18} fill="currentColor" />}>
            {t("remind.banner.lesson")}
          </ButtonLink>
        )}
        <ButtonLink href="/drill?mode=review" variant="secondary" size="md" block className={next ? "" : "sm:col-span-2"} icon={<Dumbbell size={18} />}>
          {t("remind.banner.warmup")}
        </ButtonLink>
      </div>
    </div>
  );
}
