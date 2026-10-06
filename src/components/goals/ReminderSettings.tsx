"use client";

import { BellRing, CalendarPlus } from "lucide-react";
import { useState } from "react";
import { pickReminder } from "@/lib/reminder-texts";
import { buildIcs } from "@/lib/reminders";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Button } from "@/components/ui/Button";
import { downloadBlob } from "@/lib/download";
import { Row, Switch } from "./controls";
import { disablePush, enablePush, pushSupport, reminderCtxFrom, showNotification } from "./push";

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const SELECT_CLASS =
  "h-11 min-w-[4.25rem] rounded-xl border-2 border-border bg-surface px-3 text-center text-lg font-extrabold tabular-nums outline-none focus:border-primary";

/**
 * Время в 24-часовом формате «ЧЧ:ММ» двумя списками (родной type=time на многих телефонах показывает «07:00 PM»).
 * Минуты — шаг 5; если в профиле осталось «нестандартное» значение (например 19:07), оно тоже есть в списке.
 */
function TimePicker24({ value, onChange, label, hoursLabel, minutesLabel }: { value: string; onChange: (v: string) => void; label: string; hoursLabel: string; minutesLabel: string }) {
  const [hh, mm] = value.split(":").map((x) => Number.parseInt(x, 10));
  const h = Number.isFinite(hh) ? Math.min(23, Math.max(0, hh)) : 19;
  const m = Number.isFinite(mm) ? Math.min(59, Math.max(0, mm)) : 0;
  const minutes = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort((a, b) => a - b);
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5">
      <select value={h} onChange={(e) => onChange(`${pad(Number(e.target.value))}:${pad(m)}`)} aria-label={hoursLabel} className={SELECT_CLASS}>
        {HOURS.map((x) => (
          <option key={x} value={x}>
            {pad(x)}
          </option>
        ))}
      </select>
      <span aria-hidden className="text-lg font-extrabold">
        :
      </span>
      <select value={m} onChange={(e) => onChange(`${pad(h)}:${pad(Number(e.target.value))}`)} aria-label={minutesLabel} className={SELECT_CLASS}>
        {minutes.map((x) => (
          <option key={x} value={x}>
            {pad(x)}
          </option>
        ))}
      </select>
    </div>
  );
}

type Problem = "denied" | "unsupported" | "failed" | null;

/** Настройки напоминаний в профиле: баннер, время, уведомления, файл календаря. */
export function ReminderSettings() {
  const { t, lang } = useT();
  const reminder = useApp((s) => s.profile.reminder);
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

  const testText = () => pickReminder(reminderCtxFrom(useApp.getState(), new Date()));

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
        <TimePicker24 value={reminder.time} onChange={(time) => set({ time })} label={t("remind.time")} hoursLabel={t("remind.hours")} minutesLabel={t("remind.minutes")} />
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
      <div className="flex flex-col gap-1 py-3">
        <Button variant="secondary" onClick={downloadIcs} icon={<CalendarPlus size={18} />} className="self-start whitespace-nowrap">
          {t("remind.ics")}
        </Button>
        <p className="text-sm font-semibold text-muted">{t("remind.ics.desc")}</p>
      </div>
    </div>
  );
}
