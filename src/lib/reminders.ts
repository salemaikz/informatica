import { daysText } from "./goals";
import { todayKey } from "./text";
import type { Lang } from "./types";

// Напоминания о серии: когда напомнить, что написать и файл календаря (.ics).
// Чистая логика без React. Те же правила продублированы в public/sw.js (сервис-воркер без сборки) —
// их совпадение проверяет tests/reminders.test.ts.

/** «ЧЧ:ММ» → минуты от полуночи; неверная строка → null. */
export function parseTime(time: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export interface RemindInput {
  now: Date;
  reminder: { enabled: boolean; time: string };
  /** Серия на сегодня (для будущих правил; решение о напоминании от неё не зависит — напоминаем и без серии). */
  streak?: number;
  /** Последний день с занятием «ГГГГ-ММ-ДД» или null. */
  lastActiveDay: string | null;
  /** День, когда уже напоминали, или null. */
  lastRemindedDay: string | null;
}

/** Напоминать сейчас: в день без занятий, после времени напоминания, не чаще раза в день. */
export function shouldRemind({ now, reminder, lastActiveDay, lastRemindedDay }: RemindInput): boolean {
  if (!reminder.enabled) return false;
  const at = parseTime(reminder.time);
  if (at === null) return false;
  const today = todayKey(now);
  if (lastActiveDay === today || lastRemindedDay === today) return false;
  return now.getHours() * 60 + now.getMinutes() >= at;
}

/** Через сколько мс наступит ближайшее время напоминания (сегодня, если ещё не прошло, иначе завтра). Не меньше секунды. */
export function msUntilReminder(now: Date, time: string): number {
  const at = parseTime(time);
  if (at === null) return 24 * 3_600_000;
  const target = new Date(now);
  target.setHours(Math.floor(at / 60), at % 60, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return Math.max(1000, target.getTime() - now.getTime());
}

export interface ReminderText {
  title: string;
  body: string;
}

/** Текст напоминания: серия под угрозой (с заморозкой или без) или призыв начать новую серию. */
export function reminderText({ streak, freezes, lang }: { streak: number; freezes: number; lang: Lang }): ReminderText {
  const kk = lang === "kk";
  if (streak > 0) {
    return {
      title: kk ? `${streak} күндік серия қауіп астында` : `Серия ${daysText(streak, "ru")} под угрозой`,
      body:
        freezes > 0
          ? kk
            ? "Мұздату көмектеседі, бірақ бүгін 5 минут оқыған жөн — серия сақталады"
            : "Заморозка выручит, но лучше 5 минут сегодня — и серия сохранится"
          : kk
            ? "Бар болғаны 5 минут — серия сақталады"
            : "5 минут, и она сохранится",
    };
  }
  return {
    title: kk ? "Жаңа серия баста" : "Начни новую серию",
    body: kk ? "Бүгін 5 минут — серияның бірінші күні есептеледі" : "5 минут сегодня — и первый день серии засчитан",
  };
}

// ---------- .ics ----------

/** Экранирование текстового значения iCalendar (RFC 5545, 3.3.11). */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Складывание длинных строк: не больше 75 октетов, продолжение начинается с пробела; многобайтовые символы не рвём. */
export function icsFold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      out.push(cur);
      cur = " ";
      bytes = 1;
      limit = 75;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n");
}

const p2 = (n: number) => String(n).padStart(2, "0");
const icsLocal = (d: Date) => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`;
const icsUtc = (d: Date) => `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;

/**
 * Файл календаря: ежедневное событие (RRULE:FREQ=DAILY) в локальное время `time` с напоминанием в момент начала.
 * Работает на любом телефоне без сервера. `now` — для проверки в тестах.
 */
export function buildIcs({ time, lang, title, body, now = new Date() }: { time: string; lang: Lang; title: string; body: string; now?: Date }): string {
  const at = parseTime(time) ?? 19 * 60;
  const start = new Date(now);
  start.setHours(Math.floor(at / 60), at % 60, 0, 0);
  if (start.getTime() <= now.getTime()) start.setDate(start.getDate() + 1);
  const end = new Date(start.getTime() + 5 * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Informatica//Streak reminder//" + (lang === "kk" ? "KK" : "RU"),
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:streak-reminder@informatica",
    `DTSTAMP:${icsUtc(now)}`,
    `DTSTART:${icsLocal(start)}`,
    `DTEND:${icsLocal(end)}`,
    "RRULE:FREQ=DAILY",
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(body)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:PT0M",
    `DESCRIPTION:${icsEscape(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(icsFold).join("\r\n") + "\r\n";
}
