import { describe, expect, it } from "vitest";
import { ENT_TOPICS } from "@/content/ent-topics";
import { SKILLS } from "@/content/skills";
import { dayTotals, lastDays } from "@/lib/progress";
import { courseViewOf } from "@/lib/course-view";
import { forecastScore } from "@/lib/forecast";
import { linkFits, packData, reportLink, unpackData } from "@/lib/hash-pack";
import { buildParentReport, cleanName, parseParentReport, type ParentReport, type ReportInput } from "@/lib/parent-report";
import { defaultProfile, type DayStat, type ExamSummary } from "@/lib/store";
import { todayKey } from "@/lib/text";

const NOW = new Date(2026, 9, 5, 12).getTime();
const key = (ago: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - ago);
  return todayKey(d);
};
const TOPICS = ENT_TOPICS.length;
const noStreak = { current: 0, best: 0, lastDay: null, freezes: 0 };
const empty: ReportInput = {
  profile: { ...defaultProfile, name: "  Айдана  ", lang: "ru", track: "ent" },
  xp: 0,
  streak: noStreak,
  days: {},
  skills: {},
  exams: [],
  lessons: {},
};
const day = (p: Partial<DayStat> = {}): DayStat => ({ xp: 10, answers: 4, correct: 3, seconds: 600, ...p });
const exam = (i: number, p: Partial<ExamSummary> = {}): ExamSummary => ({
  id: String(i), kind: "full", seed: i, at: NOW - i * 1000, points: 20, maxPoints: 40, durationSec: 1, byTopic: { t01: { points: 1, max: 5 } }, ...p,
});

describe("buildParentReport", () => {
  it("пустой ученик ЕНТ: нули, акк = null, прогноза нет, имени нет", () => {
    const r = buildParentReport(empty, NOW);
    expect(r.v).toBe(2);
    expect(r.track).toBe("ent");
    expect(r.name).toBeUndefined();
    expect(r.d7).toEqual({ active: 0, lessons: 0, min: 0, acc: null });
    expect(r.d30).toEqual({ active: 0, lessons: 0 });
    expect(r.ent?.forecast).toBeNull();
    expect(r.ent?.weak).toEqual([]);
    expect(r.ent?.topics).toHaveLength(TOPICS);
    expect(r.lang).toBe("ru");
  });

  it("имя — только при withName, с чисткой", () => {
    expect(buildParentReport(empty, NOW, { withName: false }).name).toBeUndefined();
    expect(buildParentReport(empty, NOW, { withName: true }).name).toBe("Айдана");
    const blank = { ...empty, profile: { ...empty.profile, name: "   " } };
    expect(buildParentReport(blank, NOW, { withName: true }).name).toBeUndefined();
  });

  it("язык отчёта: по умолчанию язык ученика, можно переопределить", () => {
    const kk = { ...empty, profile: { ...empty.profile, lang: "kk" as const } };
    expect(buildParentReport(kk, NOW).lang).toBe("kk");
    expect(buildParentReport(kk, NOW, { lang: "ru" }).lang).toBe("ru");
  });

  it("7 и 30 дней: активные дни и уроки по дням; время и точность — через dayTotals/lastDays", () => {
    const days = {
      [key(0)]: day({ lessons: 2, asked: 10, score: 7, seconds: 1200 }),
      [key(6)]: day({ lessons: 1, asked: 10, score: 9, seconds: 600 }),
      [key(7)]: day({ lessons: 4 }),
      [key(29)]: day({ lessons: 1 }),
      [key(30)]: day({ lessons: 9 }),
      [key(3)]: { xp: 0, answers: 0, correct: 0, seconds: 30 }, // не активный: ни XP, ни ответов
    };
    const r = buildParentReport({ ...empty, days }, NOW);
    expect(r.d7.active).toBe(2);
    expect(r.d7.lessons).toBe(3);
    expect(r.d30).toEqual({ active: 4, lessons: 8 });
    const totals = dayTotals(days, lastDays(NOW, 7));
    expect(r.d7.min).toBe(Math.round(totals.seconds / 60));
    expect(r.d7.acc).toBe(Math.round((totals.accuracy.value ?? 0) * 100));
    expect(r.d7.acc).toBe(80);
  });

  it("недельная точность: нет ответов за неделю — null, даже если они были раньше", () => {
    const days = { [key(20)]: day({ asked: 10, score: 5 }) };
    expect(buildParentReport({ ...empty, days }, NOW).d7.acc).toBeNull();
  });

  it("серия: «живая» (после пропуска без заморозки — 0), рекорд не меньше текущей", () => {
    const alive = { current: 5, best: 3, lastDay: key(0), freezes: 0 };
    expect(buildParentReport({ ...empty, streak: alive }, NOW).streak).toEqual({ cur: 5, best: 5 });
    const dead = { current: 9, best: 12, lastDay: key(4), freezes: 0 };
    expect(buildParentReport({ ...empty, streak: dead }, NOW).streak).toEqual({ cur: 0, best: 12 });
  });

  it("курс: процент как courseViewOf", () => {
    const lessons = { "base.computer": { completions: 1 } } as never;
    const state = { ...empty, lessons };
    const v = courseViewOf({ lessons, track: "ent", grade: empty.profile.grade, skipBasics: false });
    const r = buildParentReport(state, NOW);
    expect(r.course.done).toBe(v.done);
    expect(r.course.total).toBe(v.total);
    expect(r.course.pct).toBe(Math.round(v.ratio * 100));
    expect(r.course.grade).toBeUndefined();
  });

  it("диагностика без пробников и ответов → basis diagnostic, у тем есть значения", () => {
    const byTopic = Object.fromEntries(ENT_TOPICS.map((t) => [t.id, { points: 1, max: 2 }]));
    const diagnostic = { at: NOW, points: 5, max: 10, byTopic };
    const state = { ...empty, profile: { ...empty.profile, diagnostic } };
    const r = buildParentReport(state, NOW);
    const f = forecastScore({ skills: {}, exams: [], now: NOW, diagnostic });
    expect(r.ent?.forecast?.basis).toBe("diagnostic");
    expect(r.ent?.forecast?.score).toBe(f.score);
    expect(r.ent?.topics.every((x) => x === 50)).toBe(true);
    expect(r.ent?.weak).toHaveLength(3);
  });

  it("школьный трек: без ЕНТ-блока, процент и класс программы", () => {
    const state = { ...empty, profile: { ...empty.profile, track: "school" as const, grade: "8" as const } };
    const r = buildParentReport(state, NOW);
    expect(r.track).toBe("school");
    expect(r.ent).toBeUndefined();
    expect("ent" in r).toBe(false);
    expect(r.course.grade).toBe("8");
  });

  it("пробники: последние 5, новые первыми, контрольные по разделу не входят; прогноз и слабые темы", () => {
    const exams = [...Array.from({ length: 7 }, (_, i) => exam(i)), exam(99, { kind: "unit", unit: "u1", at: NOW + 5000 })];
    const skill = SKILLS.find((s) => s.ent)!;
    const skills = { [skill.id]: { attempts: 6, correct: 6, mastery: 0.95, lastSeen: NOW } };
    const r = buildParentReport({ ...empty, exams, skills }, NOW);
    expect(r.ent?.exams).toHaveLength(5);
    expect(r.ent?.exams[0]).toEqual({ at: NOW, kind: "full", p: 20, m: 40 });
    expect(r.ent?.exams.every((e) => e.kind !== ("unit" as string))).toBe(true);
    expect(r.ent?.forecast?.basis).toBe("both");
    expect(r.ent?.weak.length).toBeGreaterThan(0);
    expect(r.ent?.weak.length).toBeLessThanOrEqual(3);
    // слабые — только темы с данными: у t01 есть баллы пробника, у темы навыка — ответы, у остальных данных нет
    const withData = new Set<string>(["t01", skill.ent ?? ""]);
    expect(r.ent?.weak.every((t) => withData.has(t))).toBe(true);
    expect(r.ent?.weak).toContain("t01");
  });

  it("худшая длина ссылки — не больше 1500 символов", async () => {
    // Самое тяжёлое: имя на 30 казахских букв, 5 пробников, все темы, случайные «неудобные» числа.
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const exams = Array.from({ length: 5 }, (_, i) => exam(i, { at: NOW - Math.floor(rnd() * 1e10), points: Math.floor(rnd() * 40), maxPoints: 40, kind: (["full", "mini", "topic"] as const)[i % 3] }));
    const skills = Object.fromEntries(SKILLS.map((s) => [s.id, { attempts: 3 + Math.floor(rnd() * 90), correct: 1, mastery: rnd(), lastSeen: NOW }]));
    const days = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [key(i), day({ lessons: Math.floor(rnd() * 20), asked: 40, score: Math.floor(rnd() * 40), seconds: Math.floor(rnd() * 20000) })]));
    const state: ReportInput = {
      ...empty,
      profile: { ...empty.profile, name: "Ұғұқәңөһіғүқ".repeat(3), lang: "kk" },
      xp: 9_876_543,
      streak: { current: 365, best: 400, lastDay: key(0), freezes: 0 },
      days, skills, exams,
    };
    const r = buildParentReport(state, NOW, { withName: true });
    const link = reportLink("https://informatica-chi.vercel.app", await packData(r));
    expect(link.length).toBeLessThanOrEqual(1500);
    expect(linkFits(link)).toBe(true);
    expect(parseParentReport(await unpackData(link.split("#d=")[1]))).toEqual(r);
  });
});

describe("cleanName", () => {
  it("чистит управляющие, bidi, угловые скобки; обрезает до 30 символов", () => {
    expect(cleanName("  Ай\u0000дана‮  ")).toBe("Ай дана");
    expect(cleanName("<b>Ali</b>")).toBe("b Ali /b");
    expect(cleanName("ә".repeat(50))).toHaveLength(30);
    expect(cleanName(5)).toBe("");
  });
});

describe("parseParentReport", () => {
  const ok = (): ParentReport => buildParentReport({ ...empty, exams: [exam(1)] }, NOW, { withName: true });
  const clone = () => JSON.parse(JSON.stringify(ok())) as Record<string, unknown>;

  it("круг через ссылку", async () => {
    const r = ok();
    expect(parseParentReport(await unpackData(await packData(r)))).toEqual(r);
  });

  it("мусор и чужая версия → null", () => {
    for (const bad of [null, undefined, 5, "x", [], {}]) expect(parseParentReport(bad)).toBeNull();
    expect(parseParentReport({ ...clone(), v: 1 })).toBeNull();
    expect(parseParentReport({ ...clone(), v: 3 })).toBeNull();
    expect(parseParentReport({ ...clone(), track: "other" })).toBeNull();
    expect(parseParentReport({ ...clone(), d7: { active: "x", lessons: 1, min: 1, acc: null } })).toBeNull();
    expect(parseParentReport({ ...clone(), streak: null })).toBeNull();
  });

  it("у ЕНТ без блока ent или с битыми темами → null", () => {
    const a = clone();
    delete a.ent;
    expect(parseParentReport(a)).toBeNull();
    const b = clone();
    (b.ent as { topics: number[] }).topics = [1, 2];
    expect(parseParentReport(b)).toBeNull();
    const c = clone();
    (c.ent as { topics: unknown[] }).topics = [...Array(TOPICS - 1).fill(50), "x"];
    expect(parseParentReport(c)).toBeNull();
    const d = clone();
    (d.ent as { forecast: unknown }).forecast = { basis: "none", score: 1, low: 1, high: 1 };
    expect(parseParentReport(d)).toBeNull();
  });

  it("школьный отчёт без ent читается; лишний ent у школьного отбрасывается", () => {
    const school = { ...empty, profile: { ...empty.profile, track: "school" as const, grade: "7" as const } };
    const r = buildParentReport(school, NOW);
    expect(parseParentReport(JSON.parse(JSON.stringify(r)))).toEqual(r);
    const withEnt = { ...JSON.parse(JSON.stringify(r)), ent: ok().ent };
    expect(parseParentReport(withEnt)?.ent).toBeUndefined();
  });

  it("числа ограничиваются, строки чистятся, списки обрезаются", () => {
    const r = clone() as Record<string, unknown> & { ent: { topics: number[]; weak: string[]; exams: unknown[] }; d7: Record<string, unknown> };
    r.xp = -5;
    r.name = "x".repeat(200);
    r.d7 = { active: 99, lessons: 5, min: 999999, acc: 250 };
    r.ent.topics = r.ent.topics.map(() => 999);
    r.ent.weak = ["t01", "zzz", "t02", "t03", "t04"];
    r.ent.exams = Array.from({ length: 9 }, () => ({ at: 1, kind: "full", p: 90, m: 40 }));
    const p = parseParentReport(r)!;
    expect(p.xp).toBe(0);
    expect(p.name).toHaveLength(30);
    expect(p.d7).toEqual({ active: 7, lessons: 5, min: 7 * 24 * 60, acc: 100 });
    expect(p.ent?.topics.every((x) => x === 100)).toBe(true);
    expect(p.ent?.weak).toEqual(["t01", "t02", "t03"]);
    expect(p.ent?.exams).toHaveLength(5);
    expect(p.ent?.exams[0].p).toBe(40);
  });

  it("язык: только ru/kk; имя — только строкой; пустое имя — без поля", () => {
    expect(parseParentReport({ ...clone(), lang: "kk" })?.lang).toBe("kk");
    expect(parseParentReport({ ...clone(), lang: "en" })?.lang).toBe("ru");
    expect(parseParentReport({ ...clone(), name: 42 })?.name).toBeUndefined();
    expect(parseParentReport({ ...clone(), name: "  " })?.name).toBeUndefined();
    const noName = clone();
    delete noName.name;
    expect(parseParentReport(noName)?.name).toBeUndefined();
  });

  it("лишние поля отбрасываются", () => {
    const p = parseParentReport({ ...clone(), secret: "x", profile: { name: "Y" } }) as unknown as Record<string, unknown>;
    expect(p.secret).toBeUndefined();
    expect(p.profile).toBeUndefined();
  });
});
