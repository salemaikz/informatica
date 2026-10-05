import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { REMINDER_POOL, pickReminder, pickSituation, type ReminderCtx } from "@/lib/reminder-texts";
import { buildIcs, icsEscape, icsFold, msUntilReminder, parseTime, reminderText, shouldRemind } from "@/lib/reminders";

const at = (h: number, m = 0, day = 2) => new Date(2026, 9, day, h, m, 0); // 2 октября 2026
const base = { reminder: { enabled: true, time: "19:00" }, lastActiveDay: "2026-10-01", lastRemindedDay: null as string | null };

describe("shouldRemind", () => {
  it("после времени напоминания в день без занятий — да", () => {
    expect(shouldRemind({ ...base, now: at(19, 0) })).toBe(true);
    expect(shouldRemind({ ...base, now: at(22, 30) })).toBe(true);
  });
  it("до времени — нет", () => {
    expect(shouldRemind({ ...base, now: at(18, 59) })).toBe(false);
  });
  it("уже занимался сегодня — нет", () => {
    expect(shouldRemind({ ...base, lastActiveDay: "2026-10-02", now: at(21) })).toBe(false);
  });
  it("не чаще раза в день", () => {
    expect(shouldRemind({ ...base, lastRemindedDay: "2026-10-02", now: at(21) })).toBe(false);
    expect(shouldRemind({ ...base, lastRemindedDay: "2026-10-01", now: at(21) })).toBe(true);
  });
  it("выключено или неверное время — нет", () => {
    expect(shouldRemind({ ...base, reminder: { enabled: false, time: "19:00" }, now: at(21) })).toBe(false);
    expect(shouldRemind({ ...base, reminder: { enabled: true, time: "25:00" }, now: at(21) })).toBe(false);
  });
  it("ещё ни разу не занимался — напоминаем", () => {
    expect(shouldRemind({ ...base, lastActiveDay: null, now: at(20) })).toBe(true);
  });
});

describe("время", () => {
  it("parseTime", () => {
    expect(parseTime("19:30")).toBe(1170);
    expect(parseTime("00:00")).toBe(0);
    expect(parseTime("7:30")).toBeNull();
    expect(parseTime("24:00")).toBeNull();
  });
  it("msUntilReminder: сегодня или завтра", () => {
    expect(msUntilReminder(at(18, 0), "19:00")).toBe(3_600_000);
    expect(msUntilReminder(at(19, 0), "19:00")).toBe(24 * 3_600_000);
    expect(msUntilReminder(at(20, 0), "19:00")).toBe(23 * 3_600_000);
  });
});

describe("reminderText", () => {
  it("серия без заморозки", () => {
    const x = reminderText({ streak: 5, freezes: 0, lang: "ru" });
    expect(x.title).toBe("Серия 5 дней под угрозой");
    expect(x.body).toBe("5 минут, и она сохранится");
  });
  it("склонение", () => {
    expect(reminderText({ streak: 1, freezes: 0, lang: "ru" }).title).toBe("Серия 1 день под угрозой");
    expect(reminderText({ streak: 22, freezes: 0, lang: "ru" }).title).toBe("Серия 22 дня под угрозой");
  });
  it("заморозка упоминается", () => {
    expect(reminderText({ streak: 5, freezes: 1, lang: "ru" }).body).toMatch(/Заморозка/);
    expect(reminderText({ streak: 5, freezes: 1, lang: "kk" }).body).toMatch(/Мұздату/);
  });
  it("серии нет — начать новую", () => {
    expect(reminderText({ streak: 0, freezes: 0, lang: "ru" }).title).toBe("Начни новую серию");
    expect(reminderText({ streak: 0, freezes: 2, lang: "kk" }).title).toBe("Жаңа серия баста");
  });
  it("без рода в обращении", () => {
    for (const lang of ["ru", "kk"] as const) {
      for (const [streak, freezes] of [[5, 0], [5, 1], [0, 0]]) {
        const x = reminderText({ streak, freezes, lang });
        expect(`${x.title} ${x.body}`).not.toMatch(/сделал|смог|получилось/);
      }
    }
  });
});

describe("buildIcs", () => {
  const ics = buildIcs({ time: "19:00", lang: "ru", title: "Серия, 5 дней; под угрозой", body: "5 минут\nи всё", now: new Date(2026, 9, 2, 12, 0, 0) });
  const lines = ics.split("\r\n");
  it("структура календаря", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("BEGIN:VEVENT");
    expect(lines).toContain("END:VEVENT");
    expect(lines.at(-2)).toBe("END:VCALENDAR");
    expect(ics.endsWith("\r\n")).toBe(true);
  });
  it("ежедневное повторение и напоминание за 0 минут", () => {
    expect(lines).toContain("RRULE:FREQ=DAILY");
    expect(lines).toContain("BEGIN:VALARM");
    expect(lines).toContain("TRIGGER:PT0M");
    expect(lines).toContain("ACTION:DISPLAY");
  });
  it("старт сегодня в 19:00, если время ещё не прошло, иначе завтра", () => {
    expect(lines).toContain("DTSTART:20261002T190000");
    const late = buildIcs({ time: "19:00", lang: "ru", title: "t", body: "b", now: new Date(2026, 9, 2, 20, 0, 0) });
    expect(late.split("\r\n")).toContain("DTSTART:20261003T190000");
  });
  it("запятые, точки с запятой и переводы строк экранируются", () => {
    expect(lines).toContain("SUMMARY:Серия\\, 5 дней\\; под угрозой");
    expect(lines).toContain("DESCRIPTION:5 минут\\nи всё");
    expect(icsEscape("a\\b")).toBe("a\\\\b");
    // «\;» в строке JS — просто «;»: проверяем, что обратная косая черта действительно есть.
    expect(icsEscape("a;b,c")).toBe("a" + "\\" + ";b" + "\\" + ",c");
  });
  it("длинные строки складываются, символы не рвутся", () => {
    const long = "я".repeat(200);
    const folded = icsFold("SUMMARY:" + long);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe("SUMMARY:" + long);
  });
});

// public/sw.js — простой JS без сборки: его тексты и правила должны совпадать с lib/reminders.ts.
describe("public/sw.js совпадает с lib/reminders.ts", () => {
  const code = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  const sandbox: Record<string, unknown> = { self: { addEventListener() {}, registration: {}, clients: {} } };
  runInNewContext(code, sandbox);
  const sw = sandbox as {
    reminderText: (lang: string, streak: number, freezes: number) => { title: string; body: string };
    shouldRemindNow: (m: unknown, now: Date, reminded: string | null) => boolean;
    liveStreak: (m: unknown, today: string) => number;
    pickReminder: (c: ReminderCtx, pool: unknown) => { title: string; body: string };
    pickSituation: (c: ReminderCtx) => string;
    textFromMirror: (m: unknown, now: Date) => { title: string; body: string };
  };

  it("тексты", () => {
    for (const lang of ["ru", "kk"] as const) {
      for (const streak of [0, 1, 2, 5, 11, 21, 100]) {
        for (const freezes of [0, 1, 2]) {
          expect(sw.reminderText(lang, streak, freezes)).toEqual(reminderText({ streak, freezes, lang }));
        }
      }
    }
  });

  it("решение «напомнить»", () => {
    const hours = [8, 18, 19, 22];
    for (const h of hours) {
      for (const lastActiveDay of [null, "2026-10-01", "2026-10-02"]) {
        for (const lastRemindedDay of [null, "2026-10-02"]) {
          const m = { enabled: true, push: true, time: "19:00", lang: "ru", streak: 3, lastActiveDay, freezes: 0 };
          expect(sw.shouldRemindNow(m, at(h), lastRemindedDay)).toBe(
            shouldRemind({ now: at(h), reminder: { enabled: true, time: "19:00" }, lastActiveDay, lastRemindedDay }),
          );
        }
      }
    }
    expect(sw.shouldRemindNow({ enabled: true, push: false, time: "19:00", lastActiveDay: null }, at(21), null)).toBe(false);
    expect(sw.shouldRemindNow({ enabled: false, push: true, time: "19:00", lastActiveDay: null }, at(21), null)).toBe(false);
  });

  it("живая серия с заморозками", () => {
    const m = (lastActiveDay: string, freezes: number) => ({ streak: 6, lastActiveDay, freezes });
    expect(sw.liveStreak(m("2026-10-01", 0), "2026-10-02")).toBe(6);
    expect(sw.liveStreak(m("2026-09-30", 0), "2026-10-02")).toBe(0);
    expect(sw.liveStreak(m("2026-09-30", 1), "2026-10-02")).toBe(6);
    expect(sw.liveStreak({ streak: 3, lastActiveDay: null, freezes: 2 }, "2026-10-02")).toBe(0);
  });
});

// ---------- дружеские тексты (#101) ----------

const ctx = (patch: Partial<ReminderCtx> = {}): ReminderCtx => ({
  lang: "ru",
  streak: 0,
  freezes: 0,
  due: 0,
  idle: 0,
  nextTitle: { ru: "Биты и байты", kk: "Биттер мен байттар" },
  goalXp: 50,
  xpToday: 0,
  name: "Аян",
  today: "2026-10-02",
  ...patch,
});

describe("пул дружеских текстов", () => {
  const all = Object.entries(REMINDER_POOL).flatMap(([sit, byLang]) => Object.entries(byLang).map(([lang, list]) => ({ sit, lang, list })));
  const texts = all.flatMap((x) => x.list.map((v) => `${v.title} ${v.body}`));

  it("у каждой ситуации 3–5 вариантов на каждом языке, минимум два без имени", () => {
    for (const { list } of all) {
      expect(list.length).toBeGreaterThanOrEqual(3);
      expect(list.length).toBeLessThanOrEqual(5);
      expect(list.filter((v) => !/\{name\}/.test(v.title + v.body)).length).toBeGreaterThanOrEqual(2);
    }
  });
  it("нет эмодзи", () => {
    for (const x of texts) expect(x).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it("нет глаголов с родом (ru) и обещаний потерять весь прогресс", () => {
    for (const x of all.filter((a) => a.lang === "ru").flatMap((a) => a.list.map((v) => `${v.title} ${v.body}`))) {
      expect(x).not.toMatch(/сделал|смог|получилось|пропал[аи]?|потерял|забросил|устал|ты \S+(ла|л)\b/i);
      expect(x).not.toMatch(/прогресс/i);
    }
  });
  it("казахские окончания после чисел — только фразы без окончаний (дефис после числа или подстановки запрещён)", () => {
    for (const x of all.filter((a) => a.lang === "kk").flatMap((a) => a.list.map((v) => `${v.title} ${v.body}`))) {
      expect(x).not.toMatch(/(\d|\})-\p{L}/u);
    }
  });
  it("все подстановки известны", () => {
    for (const x of texts) for (const m of x.matchAll(/\{(\w+)\}/g)) expect(["streak", "days", "n", "lessons", "idleDays", "lesson", "goal", "xp", "name"]).toContain(m[1]);
  });
});

describe("выбор по ситуации", () => {
  it("приоритет: серия > повторение > возвращение > следующий урок/мотивация", () => {
    expect(pickSituation(ctx({ streak: 5, due: 3, idle: 1 }))).toBe("streakRisk");
    expect(pickSituation(ctx({ streak: 5, freezes: 1, due: 3, idle: 1 }))).toBe("streakFreeze");
    // Заморозка ушла на вчерашний пропуск — на сегодня её нет.
    expect(pickSituation(ctx({ streak: 5, freezes: 1, idle: 2 }))).toBe("streakRisk");
    expect(pickSituation(ctx({ streak: 5, freezes: 2, idle: 2 }))).toBe("streakFreeze");
    // День уже засчитан (тестовое уведомление): серия не «под угрозой».
    expect(pickSituation(ctx({ streak: 6, idle: 0, goalXp: 50, xpToday: 20 }))).toBe("goal");
    expect(pickSituation(ctx({ due: 3, idle: 9 }))).toBe("review");
    expect(pickSituation(ctx({ idle: 2 }))).toBe("away2");
    expect(pickSituation(ctx({ idle: 5 }))).toBe("forgetting");
    expect(pickSituation(ctx({ idle: 7 }))).toBe("away7");
    expect(pickSituation(ctx({ idle: null, today: "2026-10-02" }))).toMatch(/nextLesson|goal|newStreak/);
  });
  it("без паузы и серии три ситуации чередуются по дням", () => {
    const set = new Set([0, 1, 2].map((i) => pickSituation(ctx({ idle: 1, today: `2026-10-0${i + 1}` }))));
    expect(set.size).toBe(3);
  });
  it("подстановки: серия, повторение, урок, имя", () => {
    expect(pickReminder(ctx({ streak: 5, idle: 1 })).title).toMatch(/5 дней/);
    const r = pickReminder(ctx({ due: 3 }));
    expect(`${r.title} ${r.body}`).toMatch(/3 урока/);
    expect(`${r.title} ${r.body}`).not.toMatch(/[{}]/);
    expect(pickReminder(ctx({ due: 1 })).title + pickReminder(ctx({ due: 1 })).body).toMatch(/1 урок(?!а)/);
  });
  it("детерминированность и разные дни подряд", () => {
    for (const lang of ["ru", "kk"] as const) {
      for (const base of [ctx({ streak: 4, lang }), ctx({ due: 2, lang }), ctx({ idle: 9, lang }), ctx({ idle: 1, lang })]) {
        const keys = Array.from({ length: 12 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
        const out = keys.map((today) => JSON.stringify(pickReminder({ ...base, today })));
        expect(out).toEqual(keys.map((today) => JSON.stringify(pickReminder({ ...base, today }))));
        for (let i = 1; i < out.length; i++) expect(out[i]).not.toBe(out[i - 1]);
      }
    }
  });
  it("без имени варианты с {name} не берутся", () => {
    for (let d = 1; d <= 9; d++) {
      const r = pickReminder(ctx({ streak: 3, name: "", today: `2026-10-0${d}` }));
      expect(`${r.title}${r.body}`).not.toMatch(/\{|, серия|^, /);
      expect(r.title.startsWith(",")).toBe(false);
    }
  });
  it("урок без названия на языке — «следующий урок» не выбирается", () => {
    for (let d = 1; d <= 6; d++) expect(pickSituation(ctx({ idle: 1, nextTitle: { ru: "", kk: "" }, today: `2026-10-0${d}` }))).not.toBe("nextLesson");
  });
});

describe("public/sw.js: дружеские тексты совпадают с lib/reminder-texts.ts", () => {
  const code = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  const sandbox: Record<string, unknown> = { self: { addEventListener() {}, registration: {}, clients: {} } };
  runInNewContext(code, sandbox);
  const sw = sandbox as unknown as {
    pickReminder: (c: ReminderCtx, pool: unknown) => { title: string; body: string };
    pickSituation: (c: ReminderCtx) => string;
    textFromMirror: (m: unknown, now: Date) => { title: string; body: string };
  };
  const pool = JSON.parse(JSON.stringify(REMINDER_POOL));

  it("ситуация и текст — на матрице входов", () => {
    for (const lang of ["ru", "kk"] as const)
      for (const streak of [0, 1, 7, 22])
        for (const freezes of [0, 1])
          for (const due of [0, 1, 3, 11])
            for (const idle of [null, 0, 1, 2, 4, 7, 20])
              for (const name of ["", "Аян"])
                for (const today of ["2026-10-01", "2026-10-02", "2026-10-03"]) {
                  const c = ctx({ lang, streak, freezes, due, idle, name, today, xpToday: 10 });
                  expect(sw.pickSituation(c)).toBe(pickSituation(c));
                  expect(sw.pickReminder(c, pool)).toEqual(pickReminder(c));
                }
  });

  it("зеркало: новое — дружеский текст, старое без pool — простой", () => {
    const now = at(20, 0, 2);
    const old = { enabled: true, push: true, time: "19:00", lang: "ru", streak: 5, lastActiveDay: "2026-10-01", freezes: 0 };
    expect(sw.textFromMirror(old, now)).toEqual(reminderText({ streak: 5, freezes: 0, lang: "ru" }));
    const fresh = { ...old, name: "Аян", due: 0, nextTitle: null, goalXp: 50, xpToday: 0, xpDay: "2026-10-02", pool };
    expect(sw.textFromMirror(fresh, now)).toEqual(pickReminder(ctx({ streak: 5, idle: 1, nextTitle: null, due: 0 })));
  });
});
