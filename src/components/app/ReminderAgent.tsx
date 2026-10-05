"use client";

import { useEffect } from "react";
import { pickReminder } from "@/lib/reminder-texts";
import { msUntilReminder, shouldRemind } from "@/lib/reminders";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import { badgeCount } from "@/components/app/badge";
import { mirrorFrom, pushSupport, readReminded, registerWorker, reminderCtxFrom, showNotification, writeMirror, writeReminded } from "@/components/goals/push";

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
  const text = pickReminder(reminderCtxFrom(s, now));
  if (await showNotification(text.title, text.body)) await writeReminded(today);
}

/**
 * Клиентский агент напоминаний без интерфейса (монтируется в Providers):
 * - зеркалит настройки и серию в IndexedDB — их читает public/sw.js, когда приложение закрыто;
 * - пока приложение открыто — таймер до времени напоминания;
 * - обновляет значок на иконке (setAppBadge);
 * - регистрирует сервис-воркер и периодическую проверку (Android, установленное приложение).
 */
export function ReminderAgent() {
  const { enabled, push, time } = useApp((s) => s.profile.reminder);
  const lang = useApp((s) => s.profile.lang);
  const streak = useApp((s) => s.streak.current);
  const lastDay = useApp((s) => s.streak.lastDay);
  const freezes = useApp((s) => s.streak.freezes ?? 0);
  const name = useApp((s) => s.profile.name);
  const goalXp = useApp((s) => s.profile.dailyGoalXp);
  const days = useApp((s) => s.days);
  const lessons = useApp((s) => s.lessons);

  // Зеркало для воркера: настройки, серия и всё для дружеских текстов (имя, повторения, следующий урок, цель дня).
  useEffect(() => {
    void writeMirror(mirrorFrom(useApp.getState(), new Date()));
  }, [enabled, push, time, lang, streak, lastDay, freezes, name, goalXp, days, lessons]);

  // Значок на иконке установленного приложения: уроки «пора повторить» + серия под угрозой.
  const streakState = useApp((s) => s.streak);
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (!nav.setAppBadge) return;
    const update = () => {
      const n = badgeCount(lessons, streakState, todayKey(new Date()), Date.now());
      void (n > 0 ? nav.setAppBadge?.(n) : nav.clearAppBadge?.())?.catch(() => {});
    };
    update();
    // Срок повторения и «серия под угрозой» зависят от времени: пересчитываем, когда приложение снова на экране.
    const onVisible = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [lessons, streakState]);

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
