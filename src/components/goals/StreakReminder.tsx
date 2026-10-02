"use client";

import { Dumbbell, Flame, Play, X } from "lucide-react";
import { useState } from "react";
import { UNITS } from "@/content/course";
import { liveStreak, streakAtRisk } from "@/lib/gamification";
import { nextLessonId } from "@/lib/goals";
import { parseTime, reminderText } from "@/lib/reminders";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import { useT } from "@/i18n/useT";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useMinuteClock } from "./useClock";

/**
 * Плашка «серия под угрозой»: показывается после времени напоминания, пока сегодня не было занятий.
 * Главная вставляет её над картой курса.
 */
export function StreakReminder({ className }: { className?: string }) {
  const { t, lang } = useT();
  const reminder = useApp((s) => s.profile.reminder);
  const streak = useApp((s) => s.streak);
  const lessons = useApp((s) => s.lessons);
  const now = useMinuteClock();
  const [hiddenDay, setHiddenDay] = useState<string | null>(null);

  if (!now) return null;
  const date = new Date(now);
  const today = todayKey(date);
  const at = parseTime(reminder.time);
  const late = at !== null && date.getHours() * 60 + date.getMinutes() >= at;
  if (!reminder.enabled || !late || !streakAtRisk(streak, today) || hiddenDay === today) return null;

  const text = reminderText({ streak: liveStreak(streak, today), freezes: streak.freezes ?? 0, lang });
  const next = nextLessonId(UNITS, lessons);

  return (
    <div role="status" className={cn("relative rounded-3xl border-2 border-streak/40 bg-streak-soft p-4", className)}>
      <button
        type="button"
        onClick={() => setHiddenDay(today)}
        aria-label={t("remind.banner.close")}
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface/60 hover:text-text"
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
