"use client";

import { useEffect } from "react";
import { liveStreak } from "@/lib/gamification";
import { msUntilReminder, reminderText, shouldRemind } from "@/lib/reminders";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import { pushSupport, readReminded, registerWorker, showNotification, writeMirror, writeReminded } from "@/components/goals/push";

const MAX_TIMEOUT = 2 ** 31 - 1;

/** Показать напоминание, если пора и приложение свёрнуто (на экране — своя плашка StreakReminder). */
async function fire() {
  const s = useApp.getState();
  const { enabled, push, time } = s.profile.reminder;
  if (!enabled || !push || pushSupport() !== "ok" || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;
  const now = new Date();
  const lastRemindedDay = await readReminded();
  if (!shouldRemind({ now, reminder: { enabled, time }, lastActiveDay: s.streak.lastDay, lastRemindedDay })) return;
  const today = todayKey(now);
  const text = reminderText({ streak: liveStreak(s.streak, today), freezes: s.streak.freezes ?? 0, lang: s.profile.lang });
  if (await showNotification(text.title, text.body)) await writeReminded(today);
}

/**
 * Клиентский агент напоминаний без интерфейса (монтируется в Providers):
 * - зеркалит настройки и серию в IndexedDB — их читает public/sw.js, когда приложение закрыто;
 * - пока приложение открыто — таймер до времени напоминания;
 * - регистрирует сервис-воркер и периодическую проверку (Android, установленное приложение).
 */
export function ReminderAgent() {
  const { enabled, push, time } = useApp((s) => s.profile.reminder);
  const lang = useApp((s) => s.profile.lang);
  const streak = useApp((s) => s.streak.current);
  const lastDay = useApp((s) => s.streak.lastDay);
  const freezes = useApp((s) => s.streak.freezes ?? 0);

  useEffect(() => {
    void writeMirror({ enabled, push, time, lang, streak, lastActiveDay: lastDay, freezes });
  }, [enabled, push, time, lang, streak, lastDay, freezes]);

  useEffect(() => {
    if (!enabled || !push || pushSupport() !== "ok") return;
    if (Notification.permission === "granted") void registerWorker();
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      timer = setTimeout(() => {
        void fire().finally(arm);
      }, Math.min(msUntilReminder(new Date(), time), MAX_TIMEOUT));
    };
    arm();
    return () => clearTimeout(timer);
  }, [enabled, push, time]);

  return null;
}
