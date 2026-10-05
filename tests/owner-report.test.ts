import { describe, expect, it } from "vitest";
import type { AnalyticsEvent } from "@/lib/analytics";
import { batchFields } from "@/lib/analytics-fields";
import {
  addDaysIso,
  buildOwnerReport,
  dayRows,
  funnelRows,
  hardTaskRows,
  HARD_MIN_N,
  reachOf,
  retention,
  share,
  sumFields,
  TOP_ROWS,
  type DayFields,
  type ReportNames,
} from "@/lib/owner-report";
import { formatAt, parseErrorRows, parseIssueRows } from "@/lib/owner-rows";

const names: ReportNames = {
  lesson: (id) => (id === "ns-1" ? "Двоичная система" : undefined),
  task: (key) => (key === "ns-1:q1" ? { title: "Переведи 1011₂", lesson: "Двоичная система" } : undefined),
};

const day = (d: string, fields: Record<string, number> = {}): DayFields => ({ day: d, fields });
const ev = (e: AnalyticsEvent, times = 1): AnalyticsEvent[] => Array.from({ length: times }, () => e);

describe("вспомогательное", () => {
  it("share: целый процент или null при нуле", () => {
    expect(share(1, 3)).toBe(33);
    expect(share(2, 3)).toBe(67);
    expect(share(0, 5)).toBe(0);
    expect(share(5, 0)).toBeNull();
  });

  it("sumFields: складывает суточные поля; мусор (не число) пропускается", () => {
    const sum = sumFields([day("2026-10-01", { a: 1, b: 2 }), day("2026-10-02", { a: 4, c: NaN }), day("2026-10-03")]);
    expect(sum).toEqual({ a: 5, b: 2 });
  });

  it("addDaysIso: календарные дни через границы месяцев и лет", () => {
    expect(addDaysIso("2026-10-05", 1)).toBe("2026-10-06");
    expect(addDaysIso("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysIso("2026-09-05", 30)).toBe("2026-10-05");
  });
});

describe("итоги по дням", () => {
  it("свежие сверху; события — сумма полей-событий, измерения не считаются", () => {
    const rows = dayRows([
      day("2026-10-01", { lesson_start: 3, "ls:a:learn": 3, task: 10, "tk:s:n": 10 }),
      day("2026-10-03", { lesson_start: 1, lesson_finish: 1, "lf:a": 1 }),
      day("2026-10-02"),
    ]);
    expect(rows.map((r) => r.day)).toEqual(["2026-10-03", "2026-10-02", "2026-10-01"]);
    expect(rows[0]).toEqual({ day: "2026-10-03", events: 2, lessonStarts: 1, lessonFinishes: 1 });
    expect(rows[1]).toEqual({ day: "2026-10-02", events: 0, lessonStarts: 0, lessonFinishes: 0 });
    expect(rows[2]).toEqual({ day: "2026-10-01", events: 13, lessonStarts: 3, lessonFinishes: 0 });
  });
});

describe("воронка уроков", () => {
  const sum = batchFields([
    ...ev({ e: "lesson_start", lesson: "ns-1", via: "learn", resume: 0 }, 8),
    ...ev({ e: "lesson_start", lesson: "ns-1", via: "check", resume: 0 }, 2),
    ...ev({ e: "lesson_start", lesson: "ns-1", via: "learn", resume: 1 }, 2),
    ...ev({ e: "lesson_finish", lesson: "ns-1", via: "learn", acc: 80, sec: 100 }, 3),
    ...ev({ e: "lesson_finish", lesson: "ns-1", via: "learn", acc: 60, sec: 100 }, 1),
    ...ev({ e: "lesson_quit", lesson: "ns-1", via: "learn", step: 4, of: 16 }, 5),
    ...ev({ e: "lesson_quit", lesson: "ns-1", via: "learn", step: 9, of: 16 }, 2),
    ...ev({ e: "lesson_start", lesson: "other", via: "learn", resume: 0 }, 1),
  ]);

  it("старты (оба режима, с продолжениями), конец, доля дошедших, средняя точность, шаг выхода", () => {
    const rows = funnelRows(sum, names);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      lesson: "ns-1",
      title: "Двоичная система",
      starts: 12,
      resumes: 2,
      finishes: 4,
      // 4 конца из 10 «свежих» стартов (12 стартов минус 2 продолжения)
      reach: 40,
      avgAcc: 75,
      quits: 7,
      quitStep: 4,
      quitOf: 16,
    });
  });

  it("C8: старт, уход, продолжение и конец — один ученик, а не два старта: дошли 100%, а не 50%", () => {
    const s = batchFields([
      { e: "lesson_start", lesson: "a", via: "learn", resume: 0 },
      { e: "lesson_start", lesson: "a", via: "learn", resume: 1 },
      { e: "lesson_finish", lesson: "a", via: "learn", acc: 90, sec: 60 },
    ]);
    expect(funnelRows(s, names)[0]).toMatchObject({ starts: 2, resumes: 1, finishes: 1, reach: 100 });
  });

  it("C8: доля не бывает больше 100% (сутки разрезаны: старт вчера, продолжение и конец сегодня) и без свежих стартов — прочерк", () => {
    expect(reachOf(3, 3, 3)).toBe(100);
    expect(reachOf(2, 1, 1)).toBe(100);
    expect(reachOf(0, 1, 1)).toBeNull();
    expect(reachOf(1, 4, 0)).toBe(25);
    expect(reachOf(0, 0, 0)).toBeNull();
  });

  it("урок без названия в контенте — без title; без выходов и конца — прочерки", () => {
    const row = funnelRows(sum, names)[1];
    expect(row).toMatchObject({ lesson: "other", title: undefined, starts: 1, finishes: 0, reach: 0, avgAcc: null, quits: 0, quitStep: null, quitOf: null });
  });

  it("порядок — по стартам, при равенстве — по id; не больше TOP_ROWS строк; уроки без стартов пропускаются", () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < 30; i++) many[`ls:l${String(i).padStart(2, "0")}:learn`] = 5;
    many["ls:l00:learn"] = 9;
    many["lf:ghost"] = 4; // конец без старта (старт был в другие сутки вне окна) — не строка воронки
    const rows = funnelRows(many, names);
    expect(rows).toHaveLength(TOP_ROWS);
    expect(rows[0].lesson).toBe("l00");
    expect(rows[1].lesson).toBe("l01");
    expect(rows.some((r) => r.lesson === "ghost")).toBe(false);
  });

  it("id урока с двоеточием не ломает разбор режима и шага", () => {
    const s = batchFields([
      { e: "lesson_start", lesson: "x:y", via: "learn", resume: 0 },
      { e: "lesson_quit", lesson: "x:y", via: "learn", step: 2, of: 10 },
    ]);
    expect(funnelRows(s, names)[0]).toMatchObject({ lesson: "x:y", starts: 1, quitStep: 2, quitOf: 10 });
  });

  it("при равенстве выходов берётся более ранний шаг", () => {
    const s = batchFields([
      { e: "lesson_start", lesson: "a", via: "learn", resume: 0 },
      ...ev({ e: "lesson_quit", lesson: "a", via: "learn", step: 7, of: 12 }, 2),
      ...ev({ e: "lesson_quit", lesson: "a", via: "learn", step: 3, of: 12 }, 2),
    ]);
    expect(funnelRows(s, names)[0].quitStep).toBe(3);
  });
});

describe("трудные задания", () => {
  const task = (step: string, ok: 0 | 1, hint: 0 | 1 = 0, skip: 0 | 1 = 0): AnalyticsEvent => ({ e: "task", step, ok, skip, hint });

  it("только n ≥ 10; сверху — большая доля неверных; название и урок из контента", () => {
    expect(HARD_MIN_N).toBe(10);
    const sum = batchFields([
      ...ev(task("ns-1:q1", 0, 1), 6),
      ...ev(task("ns-1:q1", 1), 4),
      ...ev(task("easy", 1), 20),
      ...ev(task("rare", 0), 9),
      ...ev(task("hard", 0), 10),
    ]);
    const rows = hardTaskRows(sum, names);
    expect(rows.map((r) => r.step)).toEqual(["hard", "ns-1:q1", "easy"]);
    expect(rows[1]).toEqual({ step: "ns-1:q1", title: "Переведи 1011₂", lesson: "Двоичная система", n: 10, wrong: 6, wrongPct: 60, hintPct: 60 });
    expect(rows[0]).toMatchObject({ title: undefined, lesson: undefined, wrongPct: 100, hintPct: 0 });
    expect(rows[2].wrongPct).toBe(0);
  });

  it("пропуск считается неверным; шаг с двоеточием в id разбирается по последнему двоеточию", () => {
    const sum = batchFields([...ev(task("bank:ns:12", 0, 0, 1), 10)]);
    expect(hardTaskRows(sum, names)[0]).toMatchObject({ step: "bank:ns:12", n: 10, wrong: 10 });
  });

  it("при равной доле — где больше ответов", () => {
    const sum = batchFields([...ev(task("a", 0), 10), ...ev(task("b", 0), 30)]);
    expect(hardTaskRows(sum, names).map((r) => r.step)).toEqual(["b", "a"]);
  });

  it("пусто — пустой список", () => {
    expect(hardTaskRows({}, names)).toEqual([]);
  });
});

describe("удержание по когортам", () => {
  it("D1: вернулись / были в когортах; сегодняшний неполный день не считается", () => {
    const h: DayFields[] = [
      day("2026-10-01", { "act:0": 10 }),
      day("2026-10-02", { "act:0": 20, "act:1": 4 }),
      day("2026-10-03", { "act:0": 5, "act:1": 12 }),
      day("2026-10-04", { "act:1": 1 }), // самый свежий день: неполный — когорта 10-03 не берётся
    ];
    const r = retention(h);
    expect(r.starts).toBe(35);
    const d1 = r.rows.find((x) => x.d === 1)!;
    // Когорты 10-01 (возврат 10-02: 4) и 10-02 (возврат 10-03: 12). Когорта 10-03 — возврат в неполный день, пропущена.
    expect(d1).toEqual({ d: 1, returned: 16, cohort: 30, pct: 53 });
  });

  it("D7 и D30 считаются, только если день возврата уже в данных", () => {
    const h: DayFields[] = [day("2026-09-01", { "act:0": 10 }), day("2026-09-08", { "act:7": 3 }), day("2026-09-09"), day("2026-09-10")];
    const r = retention(h);
    expect(r.rows.find((x) => x.d === 7)).toEqual({ d: 7, returned: 3, cohort: 10, pct: 30 });
    expect(r.rows.find((x) => x.d === 30)).toEqual({ d: 30, returned: 0, cohort: 0, pct: null });
  });

  it("C6: дни без записанных первых запусков (act:0) — не когорта: возвраты устройств «до сбора» не раздувают долю", () => {
    // 10-01 пусто, 10-02 — когорта 10, но в тот же день вернулись 40 «старых» устройств (act:1 за запуск, которого не записали)
    const h: DayFields[] = [day("2026-10-01"), day("2026-10-02", { "act:0": 10, "act:1": 40 }), day("2026-10-03", { "act:1": 3 }), day("2026-10-04")];
    const d1 = retention(h).rows.find((x) => x.d === 1)!;
    // Когорта 10-02 (10 человек): вернулись 3. День 10-01 когортой не считается (act:0 нет): «возвраты» 10-02 из него не учитываются.
    expect(d1).toEqual({ d: 1, returned: 3, cohort: 10, pct: 30 });
  });

  it("C6: возвраты в день не больше когорты дня (потерянный act:0 не даёт больше 100%)", () => {
    const h: DayFields[] = [day("2026-10-01", { "act:0": 5 }), day("2026-10-02", { "act:1": 12 }), day("2026-10-03")];
    expect(retention(h).rows.find((x) => x.d === 1)).toEqual({ d: 1, returned: 5, cohort: 5, pct: 100 });
  });

  it("C6: пустая история до начала сбора и act:1 без act:0 — нет когорты, доля — прочерк", () => {
    const h: DayFields[] = [day("2026-10-01"), day("2026-10-02", { "act:1": 7 }), day("2026-10-03")];
    expect(retention(h).rows.find((x) => x.d === 1)).toEqual({ d: 1, returned: 0, cohort: 0, pct: null });
  });

  it("нет данных — нули и прочерки", () => {
    expect(retention([])).toEqual({
      starts: 0,
      rows: [
        { d: 1, returned: 0, cohort: 0, pct: null },
        { d: 7, returned: 0, cohort: 0, pct: null },
        { d: 30, returned: 0, cohort: 0, pct: null },
      ],
    });
  });
});

describe("сводка целиком", () => {
  const events: AnalyticsEvent[] = [
    ...ev({ e: "paywall_view", from: "auto" }, 5),
    ...ev({ e: "paywall_view", from: "hearts" }, 3),
    ...ev({ e: "plan_click", tier: "unlimited", period: "year" }, 2),
    { e: "plan_click", tier: "lite", period: "month" },
    { e: "trial_start", from: "auto" },
    ...ev({ e: "shop_click", item: "chips-750" }, 4),
    ...ev({ e: "hearts_out", where: "lesson" }, 6),
    { e: "hearts_out", where: "game" },
    ...ev({ e: "onb_step", step: "name" }, 10),
    ...ev({ e: "onb_step", step: "goal" }, 7),
    ...ev({ e: "onb_done", track: "ent" }, 5),
    ...ev({ e: "diag", done: 1, pct: 40 }, 3),
    { e: "diag", done: 0, pct: 0 },
    ...ev({ e: "break_reason", code: "hard" }, 2),
    { e: "break_reason", code: "time" },
    ...ev({ e: "feedback", kind: "idea" }, 2),
    ...ev({ e: "game_start", game: "binary-race", lesson: 0 }, 4),
    ...ev({ e: "game_finish", game: "binary-race", acc: 90 }, 3),
    { e: "game_quit", game: "binary-race" },
    { e: "game_quit", game: "only-quit" },
    ...ev({ e: "drill_start", mode: "smart" }, 3),
    { e: "drill_finish", mode: "smart", acc: 80 },
    { e: "exam_start", kind: "full" },
  ];

  it("спрос, сердечки, онбординг, диагностика, перерыв, отзывы, игры — каждое из своих счётчиков", () => {
    const r = buildOwnerReport([day("2026-10-05", batchFields(events))], names);
    expect(r.days).toBe(1);
    expect(r.demand.views).toEqual([
      { key: "auto", n: 5 },
      { key: "hearts", n: 3 },
    ]);
    expect(r.demand.viewsTotal).toBe(8);
    expect(r.demand.clicks).toEqual([
      { key: "unlimited:year", n: 2 },
      { key: "lite:month", n: 1 },
    ]);
    expect(r.demand.clicksTotal).toBe(3);
    expect(r.demand.trials).toEqual([{ key: "auto", n: 1 }]);
    expect(r.demand.shop).toEqual([{ key: "chips-750", n: 4 }]);
    expect(r.demand.shopTotal).toBe(4);
    expect(r.heartsOut).toEqual([
      { key: "lesson", n: 6 },
      { key: "game", n: 1 },
    ]);
    expect(r.onboarding.steps).toEqual([
      { key: "name", n: 10 },
      { key: "goal", n: 7 },
    ]);
    expect(r.onboarding.done).toEqual([{ key: "ent", n: 5 }]);
    expect(r.diagnostic).toEqual({ finished: 3, notFinished: 1 });
    expect(r.breakReasons).toEqual([
      { key: "hard", n: 2 },
      { key: "time", n: 1 },
    ]);
    expect(r.feedback).toEqual([{ key: "idea", n: 2 }]);
    expect(r.practice.games).toEqual([
      { key: "binary-race", starts: 4, finishes: 3, quits: 1 },
      { key: "only-quit", starts: 0, finishes: 0, quits: 1 },
    ]);
    expect(r.practice.drills).toEqual([{ key: "smart", starts: 3, finishes: 1 }]);
    expect(r.practice.exams).toEqual([{ key: "full", starts: 1, finishes: 0 }]);
  });

  it("окно суммирует несколько суток; итоги по дням сходятся с общей суммой", () => {
    const a = day("2026-10-04", batchFields([...ev({ e: "lesson_start", lesson: "ns-1", via: "learn", resume: 0 }, 2)]));
    const b = day("2026-10-05", batchFields([...ev({ e: "lesson_start", lesson: "ns-1", via: "learn", resume: 0 }, 3), { e: "lesson_finish", lesson: "ns-1", via: "learn", acc: 50, sec: 1 }]));
    const r = buildOwnerReport([a, b], names);
    expect(r.days).toBe(2);
    expect(r.totals).toEqual({ events: 6, lessonStarts: 5, lessonFinishes: 1 });
    expect(r.funnel[0]).toMatchObject({ starts: 5, finishes: 1, reach: 20 });
    expect(r.perDay.map((d) => d.day)).toEqual(["2026-10-05", "2026-10-04"]);
  });

  it("пусто — пустые списки, без падения", () => {
    const r = buildOwnerReport([], names);
    expect(r.days).toBe(0);
    expect(r.totals).toEqual({ events: 0, lessonStarts: 0, lessonFinishes: 0 });
    expect(r.funnel).toEqual([]);
    expect(r.hardTasks).toEqual([]);
    expect(r.demand.views).toEqual([]);
    expect(r.diagnostic).toEqual({ finished: 0, notFinished: 0 });
    expect(r.practice).toEqual({ games: [], drills: [], exams: [] });
  });
});

describe("жалобы, отзывы и ошибки: разбор строк списков", () => {
  it("жалобы: поля обрезаются до своих лимитов, битые строки пропускаются, HTML остаётся текстом", () => {
    const lines = [
      JSON.stringify({ type: "task", where: "code", reason: "wrong_answer", comment: "<script>alert(1)</script>", lang: "kk", version: "abc1234", at: "2026-10-05T09:30:00.000Z", lessonId: "ns-1", itemId: "ns-1:q1", snippet: "s".repeat(2000) }),
      "не json",
      "[1,2]",
      JSON.stringify({ reason: "x" }),
      JSON.stringify({ type: "feedback", where: "page", reason: "idea", comment: "Добавьте тёмную тему" }),
    ];
    const rows = parseIssueRows(lines);
    expect(rows).toHaveLength(2);
    expect(rows[0].comment).toBe("<script>alert(1)</script>");
    expect(rows[0].snippet).toHaveLength(600);
    expect(rows[1]).toMatchObject({ type: "feedback", where: "page", reason: "idea", comment: "Добавьте тёмную тему" });
    expect(rows[1].lang).toBeUndefined();
  });

  it("ошибки с телефонов: без сообщения — пропуск, стек и путь сохраняются", () => {
    const rows = parseErrorRows([
      JSON.stringify({ type: "client_error", message: "boom", stack: "at a (x:1:2)", path: "/lesson/ns-1", userAgent: "Phone/1", lang: "ru", version: "dev", at: "2026-10-05T09:30:00.000Z" }),
      JSON.stringify({ type: "client_error" }),
      "мусор",
    ]);
    expect(rows).toEqual([{ message: "boom", stack: "at a (x:1:2)", path: "/lesson/ns-1", userAgent: "Phone/1", lang: "ru", version: "dev", at: "2026-10-05T09:30:00.000Z" }]);
  });

  it("время записи по Астане (UTC+5); не время — как есть; пусто — пусто", () => {
    expect(formatAt("2026-10-05T09:30:00.000Z")).toBe("05.10 14:30");
    expect(formatAt("2026-10-05T20:00:00.000Z")).toBe("06.10 01:00");
    expect(formatAt("вчера")).toBe("вчера");
    expect(formatAt(undefined)).toBe("");
  });
});
