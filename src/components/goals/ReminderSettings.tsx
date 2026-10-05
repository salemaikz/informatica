"use client";

import { BellRing, CalendarPlus } from "lucide-react";
import { useState } from "react";
import { liveStreak } from "@/lib/gamification";
import { buildIcs, reminderText } from "@/lib/reminders";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Button } from "@/components/ui/Button";
import { downloadBlob } from "@/lib/download";
import { Row, Switch } from "./controls";
import { disablePush, enablePush, pushSupport, showNotification } from "./push";

type Problem = "denied" | "unsupported" | "failed" | null;

/** Настройки напоминаний в профиле: баннер, время, уведомления, файл календаря. */
export function ReminderSettings() {
  const { t, lang } = useT();
  const reminder = useApp((s) => s.profile.reminder);
  const streak = useApp((s) => s.streak);
  const update = useApp((s) => s.updateProfile);
  const [problem, setProblem] = useState<Problem>(null);
  const [busy, setBusy] = useState(false);

  const support = pushSupport();
  const permitted = support === "ok" && Notification.permission === "granted";
  const pushOn = reminder.push && permitted;
  const shownProblem: Problem = problem ?? (support === "unsupported" ? "unsupported" : support === "denied" ? "denied" : null);

  const set = (patch: Partial<typeof reminder>) => update({ reminder: { ...reminder, ...patch } });

  const togglePush = async (on: boolean) => {
    if (!on) {
      set({ push: false });
      setProblem(null);
      void disablePush();
      return;
    }
    setBusy(true);
    const r = await enablePush();
    setBusy(false);
    if (r === "ok") {
      setProblem(null);
      set({ push: true, enabled: true });
    } else {
      setProblem(r);
    }
  };

  const testText = () => reminderText({ streak: liveStreak(streak, todayKey()), freezes: streak.freezes ?? 0, lang });

  const downloadIcs = () => {
    const ics = buildIcs({ time: reminder.time, lang, title: t("remind.ics.summary"), body: t("remind.ics.body") });
    downloadBlob(new Blob([ics], { type: "text/calendar;charset=utf-8" }), "informatica-reminder.ics");
  };

  return (
    <div className="divide-y-2 divide-border">
      <Row label={t("remind.enabled")} hint={t("remind.enabled.desc")}>
        <Switch checked={reminder.enabled} onChange={(enabled) => set({ enabled })} label={t("remind.enabled")} />
      </Row>
      <Row label={t("remind.time")}>
        <input
          type="time"
          value={reminder.time}
          onChange={(e) => e.target.value && set({ time: e.target.value })}
          aria-label={t("remind.time")}
          className="h-11 min-w-36 rounded-xl border-2 border-border bg-surface px-3 text-lg font-extrabold outline-none focus:border-primary"
        />
      </Row>
      <Row label={t("remind.push")} hint={t("remind.push.desc")}>
        <Switch checked={pushOn} onChange={togglePush} label={t("remind.push")} disabled={busy || support === "unsupported"} />
      </Row>
      {shownProblem && (
        <p role="alert" className="rounded-xl bg-warning-soft px-3 py-2 text-sm font-bold text-warning-strong">
          {t(`remind.push.${shownProblem}` as DictKey)}
        </p>
      )}
      {pushOn && (
        <div className="py-3">
          <Button variant="secondary" size="sm" className="h-10" icon={<BellRing size={16} />} onClick={() => void showNotification(testText().title, testText().body)}>
            {t("remind.push.test")}
          </Button>
        </div>
      )}
      <p className="py-3 text-sm font-semibold text-muted">{t("remind.honest")}</p>
      <div className="flex flex-col gap-1 py-3">
        <Button variant="secondary" onClick={downloadIcs} icon={<CalendarPlus size={18} />} className="h-auto min-h-11 self-stretch py-2 text-center sm:self-start">
          {t("remind.ics")}
        </Button>
        <p className="text-sm font-semibold text-muted">{t("remind.ics.desc")}</p>
      </div>
    </div>
  );
}
