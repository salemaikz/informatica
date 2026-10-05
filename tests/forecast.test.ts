import { describe, expect, it } from "vitest";
import { CONTEXT_COUNT, CONTEXT_TOPICS, ENT_POINTS, ENT_TOPICS, ORDINARY_COUNT, topicTaskShare, topicWeight } from "@/content/ent-topics";
import { SKILLS } from "@/content/skills";
import { DIAGNOSTIC_MARGIN, DIAGNOSTIC_UNTIL_ANSWERS, forecastFromDiagnostic, forecastMargin, forecastScore, topicMastery, type ForecastExam } from "@/lib/forecast";
import type { SkillStat } from "@/lib/mastery";
import type { DiagnosticSummary } from "@/lib/store";
import type { EntTopicId } from "@/lib/types";

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;
const stat = (mastery: number, attempts = 10): SkillStat => ({ attempts, correct: 5, mastery, lastSeen: NOW });
const allSkills = (mastery: number, attempts = 10) => Object.fromEntries(SKILLS.map((s) => [s.id, stat(mastery, attempts)]));
const byTopic = (ratio: number): Record<EntTopicId, { points: number; max: number }> =>
  Object.fromEntries(ENT_TOPICS.map((t) => [t.id, { points: ratio * 10, max: 10 }])) as never;
const exam = (points: number, daysAgo = 1, extra: Partial<ForecastExam> = {}): ForecastExam => ({
  at: NOW - daysAgo * DAY, points, maxPoints: 50, byTopic: byTopic(points / 50), ...extra,
});

describe("веса тем (#43): план теста НЦТ 4 / 10 / 11 / 1 / 7 / 7", () => {
  const count = (ids: string[]) => ids.reduce((s, id) => s + ENT_TOPICS.find((t) => t.id === id)!.examCount, 0);

  it("examCount t01–t13 и сумма 35 обычных заданий", () => {
    expect(ENT_TOPICS.map((t) => t.examCount)).toEqual([2, 2, 4, 3, 3, 3, 3, 1, 2, 3, 2, 4, 3]);
    expect(ORDINARY_COUNT).toBe(35);
    expect(ORDINARY_COUNT + CONTEXT_COUNT).toBe(40);
  });

  it("суммы по разделам совпадают с официальным планом НЦТ (контекстные — в разделе 03)", () => {
    expect(count(["t01", "t02"])).toBe(4);
    expect(count(["t03", "t04", "t05"])).toBe(10);
    expect(count(["t06", "t07"]) + CONTEXT_COUNT).toBe(11);
    expect(count(["t08"])).toBe(1);
    expect(count(["t09", "t10", "t11"])).toBe(7);
    expect(count(["t12", "t13"])).toBe(7);
  });

  it("контекстные — из t06 и t07, баллы между ними поровну", () => {
    expect(CONTEXT_TOPICS).toEqual(["t06", "t07"]);
    expect(topicWeight("t06")).toBeCloseTo(topicWeight("t07"), 10);
    expect(topicTaskShare("t06")).toBe(5.5);
    expect(topicTaskShare("t07")).toBe(5.5);
    expect(topicTaskShare("t03")).toBe(4);
  });

  it("сумма весов всех тем — 1, в баллах — 50; вес растёт с числом заданий", () => {
    const sum = ENT_TOPICS.reduce((s, t) => s + topicWeight(t.id), 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(sum * ENT_POINTS).toBeCloseTo(50, 8);
    // 45 баллов на 35 заданий: тема из 4 заданий весит вдвое больше темы из 2.
    expect(topicWeight("t03")).toBeCloseTo(2 * topicWeight("t01"), 10);
    expect(topicWeight("t08")).toBeCloseTo(topicWeight("t01") / 2, 10);
    // Python и алгоритмы — самые тяжёлые темы (3 задания + 2,5 контекстных балла).
    const heaviest = [...ENT_TOPICS].sort((a, b) => topicWeight(b.id) - topicWeight(a.id)).slice(0, 2).map((t) => t.id);
    expect(heaviest.sort()).toEqual(["t06", "t07"]);
  });
});

describe("forecastScore", () => {
  it("нет данных — basis none, балл 0", () => {
    const f = forecastScore({ skills: {}, exams: [], now: NOW });
    expect(f).toMatchObject({ score: 0, low: 0, high: 0, basis: "none", answers: 0 });
    expect(Object.values(f.byTopic).every((v) => v === 0)).toBe(true);
  });

  it("навыки без попыток — тоже «нет данных»", () => {
    const f = forecastScore({ skills: { "ns.base": stat(0.9, 0) }, exams: [], now: NOW });
    expect(f.basis).toBe("none");
  });

  it("только навыки: полное освоение — 50, нулевое — 0, половина — 25", () => {
    expect(forecastScore({ skills: allSkills(1), exams: [], now: NOW }).score).toBe(50);
    expect(forecastScore({ skills: allSkills(0.5), exams: [], now: NOW }).score).toBe(25);
    const f = forecastScore({ skills: allSkills(0), exams: [], now: NOW });
    expect(f.basis).toBe("mastery");
    expect(f.score).toBe(0);
  });

  it("освоение темы — среднее по навыкам, неосвоенные считаются нулём", () => {
    const t04 = SKILLS.filter((s) => s.ent === "t04");
    const skills = { [t04[0].id]: stat(1) };
    const m = topicMastery(skills);
    expect(m.t04).toBeCloseTo(1 / t04.length, 5);
    expect(m.t01).toBe(0);
  });

  it("вес темы: освоена только t01 — доля её веса (2 из 35 обычных заданий)", () => {
    const skills = Object.fromEntries(SKILLS.filter((s) => s.ent === "t01").map((s) => [s.id, stat(1)]));
    const f = forecastScore({ skills, exams: [], now: NOW });
    expect(f.byTopic.t01).toBe(1);
    expect(f.score).toBe(Math.round((2 / 35) * 45)); // 3
  });

  it("вес темы: освоена только t06 — её обычные задания и половина контекстных", () => {
    const skills = Object.fromEntries(SKILLS.filter((s) => s.ent === "t06").map((s) => [s.id, stat(1)]));
    const f = forecastScore({ skills, exams: [], now: NOW });
    expect(f.score).toBe(Math.round((3 / 35) * 45 + 2.5)); // 6
  });

  it("только пробники: свежее весомее", () => {
    const f = forecastScore({ skills: {}, exams: [exam(10, 20), exam(40, 1)], now: NOW });
    expect(f.basis).toBe("exams");
    expect(f.score).toBeGreaterThan(25);
    expect(f.score).toBeLessThan(40);
    expect(f.byTopic.t01).toBeGreaterThan(0.5);
  });

  it("учитываются только последние 3 пробника", () => {
    const old = exam(0, 100);
    const f = forecastScore({ skills: {}, exams: [old, exam(30, 3), exam(30, 2), exam(30, 1)], now: NOW });
    expect(f.score).toBe(30);
  });

  it("тест по теме (kind: topic) не влияет на прогноз", () => {
    const f = forecastScore({ skills: {}, exams: [exam(50, 1, { kind: "topic" })], now: NOW });
    expect(f.basis).toBe("none");
    const g = forecastScore({ skills: {}, exams: [exam(30, 1, { kind: "mini" })], now: NOW });
    expect(g.score).toBe(30);
  });

  it("пробник с maxPoints = 0 пропускается", () => {
    const f = forecastScore({ skills: {}, exams: [{ at: NOW, points: 0, maxPoints: 0, byTopic: byTopic(0) }], now: NOW });
    expect(f.basis).toBe("none");
  });

  it("мини-пробник (19 баллов) переводится в 50-балльную шкалу", () => {
    const f = forecastScore({ skills: {}, exams: [{ at: NOW, points: 19, maxPoints: 19, byTopic: byTopic(1) }], now: NOW });
    expect(f.score).toBe(50);
  });

  it("оба источника: 60% пробники + 40% освоение", () => {
    const f = forecastScore({ skills: allSkills(0), exams: [exam(50, 0)], now: NOW });
    // освоение у навыков с попытками = 0 → 0.6 * 50 = 30
    expect(f.basis).toBe("both");
    expect(f.score).toBe(30);
    const g = forecastScore({ skills: allSkills(1), exams: [exam(0, 0)], now: NOW });
    expect(g.score).toBe(20);
  });

  it("интервал зависит от числа ответов и обрезается 0..50", () => {
    expect(forecastMargin(0)).toBe(8);
    expect(forecastMargin(29)).toBe(8);
    expect(forecastMargin(30)).toBe(5);
    expect(forecastMargin(99)).toBe(5);
    expect(forecastMargin(100)).toBe(3);
    const few = forecastScore({ skills: allSkills(0.5, 1), exams: [], now: NOW });
    expect(few.answers).toBe(SKILLS.filter((s) => s.ent).length); // только навыки ЕНТ (этап 15)
    // навыков ≥ 30 → ±5, а ответов 1 на навык — зависит от числа навыков
    expect(few.high - few.low).toBeLessThanOrEqual(2 * forecastMargin(few.answers));
    const top = forecastScore({ skills: allSkills(1, 10), exams: [], now: NOW });
    expect(top.high).toBe(50);
    expect(top.low).toBe(47);
    const zero = forecastScore({ skills: allSkills(0, 1), exams: [], now: NOW });
    expect(zero.low).toBe(0);
    expect(zero.score).toBe(0);
  });

  it("малое число ответов — шире интервал", () => {
    const one = { [SKILLS[0].id]: stat(0.5, 5) };
    const f = forecastScore({ skills: one, exams: [], now: NOW });
    expect(f.answers).toBe(5);
    expect(f.high - f.low).toBe(f.score < 8 ? f.score + 8 : 16);
  });

  it("неизвестные навыки (нет в SKILLS) не считаются ответами", () => {
    const f = forecastScore({ skills: { "zzz.unknown": stat(1, 50) }, exams: [], now: NOW });
    expect(f.basis).toBe("none");
  });
});

describe("forecastScore: данные из сохранения", () => {
  it("частичный byTopic (как ExamSummary в сторе) — допустим", () => {
    const f = forecastScore({ skills: {}, exams: [{ at: NOW, points: 20, maxPoints: 50, kind: "full", byTopic: { t04: { points: 2, max: 4 } } }], now: NOW });
    expect(f.score).toBe(20);
    expect(f.byTopic.t04).toBe(0.5);
    expect(f.byTopic.t01).toBe(0);
  });

  it("мусорные значения не дают NaN", () => {
    const junk = [
      { at: NaN, points: 10, maxPoints: 50, byTopic: {} },
      { at: NOW, points: "x", maxPoints: 50, byTopic: {} },
      null,
      { at: NOW, points: 80, maxPoints: 50, byTopic: { t01: { points: NaN, max: 5 }, t02: { points: 9, max: 3 } } },
    ] as unknown as ForecastExam[];
    const skills = { [SKILLS[0].id]: { attempts: NaN, correct: 0, mastery: NaN, lastSeen: 0 }, [SKILLS[1].id]: null } as unknown as Record<string, SkillStat>;
    const f = forecastScore({ skills, exams: junk, now: NOW });
    expect(f.basis).toBe("exams");
    expect(f.score).toBe(50);
    expect(f.byTopic.t01).toBe(0);
    expect(f.byTopic.t02).toBe(1);
    for (const v of [f.score, f.low, f.high, f.answers, ...Object.values(f.byTopic)]) expect(Number.isFinite(v)).toBe(true);
  });
});

describe("прогноз по входной диагностике (#70)", () => {
  /** Диагностика: на каждой из перечисленных тем одинаковая доля верных. */
  const diag = (topics: EntTopicId[], ratio: number, per = 2): DiagnosticSummary => ({
    at: NOW,
    points: topics.length * per * ratio,
    max: topics.length * per,
    byTopic: Object.fromEntries(topics.map((t) => [t, { points: per * ratio, max: per }])) as DiagnosticSummary["byTopic"],
  });
  const ALL: EntTopicId[] = ENT_TOPICS.map((t) => t.id);

  it("нет навыков и пробников — basis diagnostic; все верно по всем темам — 50, все неверно — 0", () => {
    const full = forecastScore({ skills: {}, exams: [], now: NOW, diagnostic: diag(ALL, 1) });
    expect(full).toMatchObject({ basis: "diagnostic", score: 50, high: 50 });
    expect(full.low).toBe(50 - DIAGNOSTIC_MARGIN);
    const zero = forecastScore({ skills: {}, exams: [], now: NOW, diagnostic: diag(ALL, 0) });
    expect(zero).toMatchObject({ basis: "diagnostic", score: 0, low: 0, high: DIAGNOSTIC_MARGIN });
  });

  it("диапазон ±8, обрезан 0..50; ответов — столько же, сколько заданий диагностики", () => {
    const f = forecastScore({ skills: {}, exams: [], now: NOW, diagnostic: diag(ALL, 0.5) });
    expect(f.score).toBe(25);
    expect(f.low).toBe(17);
    expect(f.high).toBe(33);
    expect(f.answers).toBe(ALL.length * 2);
    expect(DIAGNOSTIC_MARGIN).toBe(8);
  });

  it("баллы по темам с весами topicWeight: верна только t06 из шести тем диагностики", () => {
    const six: EntTopicId[] = ["t03", "t04", "t05", "t06", "t07", "t10"];
    const d: DiagnosticSummary = {
      at: NOW,
      points: 2,
      max: 12,
      byTopic: Object.fromEntries(six.map((t) => [t, { points: t === "t06" ? 2 : 0, max: 2 }])) as DiagnosticSummary["byTopic"],
    };
    const f = forecastScore({ skills: {}, exams: [], now: NOW, diagnostic: d });
    // Оценённые темы — шесть, среднее 1/6; неоценённые получают его же.
    const mean = 1 / 6;
    const expected = ENT_TOPICS.reduce((s, t) => s + topicWeight(t.id) * (t.id === "t06" ? 1 : six.includes(t.id) ? 0 : mean), 0) * 50;
    expect(f.score).toBe(Math.round(expected));
    expect(f.byTopic.t06).toBe(1);
    expect(f.byTopic.t03).toBe(0);
    expect(f.byTopic.t12).toBeCloseTo(mean, 3);
  });

  it("неоценённые темы — по среднему оценённых", () => {
    const f = forecastFromDiagnostic({ at: NOW, points: 3, max: 4, byTopic: { t03: { points: 2, max: 2 }, t04: { points: 1, max: 2 } } });
    expect(f).not.toBeNull();
    expect(f!.byTopic.t03).toBe(1);
    expect(f!.byTopic.t04).toBe(0.5);
    expect(f!.byTopic.t13).toBe(0.75);
    expect(f!.byTopic.t01).toBe(0.75);
  });

  it("как только есть пробник — диагностика не используется", () => {
    const f = forecastScore({ skills: {}, exams: [exam(20, 1)], now: NOW, diagnostic: diag(ALL, 1) });
    expect(f.basis).toBe("exams");
    expect(f.score).toBe(20);
  });

  it("мало ответов по навыкам (посеянные диагностикой тоже) — всё ещё диагностика; набралось — навыки", () => {
    const few = { [SKILLS[0].id]: stat(0.45, DIAGNOSTIC_UNTIL_ANSWERS - 1) };
    expect(forecastScore({ skills: few, exams: [], now: NOW, diagnostic: diag(ALL, 1) }).basis).toBe("diagnostic");
    const enough = { [SKILLS[0].id]: stat(0.45, DIAGNOSTIC_UNTIL_ANSWERS) };
    const f = forecastScore({ skills: enough, exams: [], now: NOW, diagnostic: diag(ALL, 1) });
    expect(f.basis).toBe("mastery");
    // Натренирован один навык темы (0,45) — он тянет тему вниз, остальные навыки темы и темы — по диагностике (всё верно).
    const t0 = SKILLS[0].ent!;
    expect(f.byTopic[t0]).toBeLessThan(1);
    expect(f.byTopic[t0]).toBeGreaterThan(0.45);
    expect(f.score).toBeGreaterThan(40);
    // Без диагностики непройденные темы — 0.
    expect(forecastScore({ skills: enough, exams: [], now: NOW }).score).toBeLessThan(10);
  });

  it("диагностики нет, пустая или мусор — как раньше", () => {
    expect(forecastScore({ skills: {}, exams: [], now: NOW }).basis).toBe("none");
    expect(forecastScore({ skills: {}, exams: [], now: NOW, diagnostic: null }).basis).toBe("none");
    expect(forecastScore({ skills: {}, exams: [], now: NOW, diagnostic: { at: NOW, points: 0, max: 0, byTopic: {} } }).basis).toBe("none");
    const junk = { at: NOW, points: NaN, max: 10, byTopic: {} } as unknown as DiagnosticSummary;
    expect(forecastScore({ skills: {}, exams: [], now: NOW, diagnostic: junk }).basis).toBe("none");
    // навыки без диагностики: mastery, как раньше
    expect(forecastScore({ skills: allSkills(1), exams: [], now: NOW }).basis).toBe("mastery");
  });

  it("мусор в byTopic не даёт NaN; нет оценённых тем — берётся общая доля", () => {
    const junk = { at: NOW, points: 5, max: 10, byTopic: { t03: { points: NaN, max: 2 }, t04: { points: 1, max: 0 } } } as unknown as DiagnosticSummary;
    const f = forecastScore({ skills: {}, exams: [], now: NOW, diagnostic: junk });
    expect(f.basis).toBe("diagnostic");
    expect(f.score).toBe(25);
    for (const v of [f.score, f.low, f.high, f.answers, ...Object.values(f.byTopic)]) expect(Number.isFinite(v)).toBe(true);
  });
});

describe("прогноз после диагностики: без обвала на 30 ответах", () => {
  it("непройденные темы берутся из диагностики, а не нулём", async () => {
    const { forecastScore, DIAGNOSTIC_UNTIL_ANSWERS } = await import("@/lib/forecast");
    const { SKILLS } = await import("@/content/skills");
    const diagnostic = { at: 1, points: 6, max: 10, byTopic: { t04: { points: 2, max: 2 }, t05: { points: 1, max: 2 } } };
    // 40 ответов по одному навыку темы t04 — данных навыков уже больше порога диагностики
    const skill = SKILLS.find((s) => s.ent === "t04")!.id;
    const skills = { [skill]: { attempts: DIAGNOSTIC_UNTIL_ANSWERS + 10, correct: 30, mastery: 0.8, lastSeen: 1 } };
    const before = forecastScore({ skills: {}, exams: [], now: 2, diagnostic });
    const after = forecastScore({ skills, exams: [], now: 2, diagnostic });
    const without = forecastScore({ skills, exams: [], now: 2 });
    expect(before.basis).toBe("diagnostic");
    expect(after.basis).toBe("mastery");
    // без диагностики непройденные темы — 0, прогноз низкий; с диагностикой — близко к прежнему
    expect(without.score).toBeLessThan(5);
    expect(Math.abs(after.score - before.score)).toBeLessThanOrEqual(6);
  });
});

describe("прогноз после диагностики: без скачков вниз от верных ответов (C27)", () => {
  it("набор ответов по навыкам t03/t04/t05 и 5-й ответ по теме не роняют прогноз", async () => {
    const { forecastScore } = await import("@/lib/forecast");
    const { SKILLS } = await import("@/content/skills");
    const diagnostic = {
      at: 1,
      points: 8,
      max: 10,
      byTopic: { t03: { points: 2, max: 2 }, t04: { points: 2, max: 2 }, t05: { points: 2, max: 2 }, t06: { points: 1, max: 1 }, t07: { points: 0, max: 1 }, t01: { points: 1, max: 1 }, t10: { points: 0, max: 1 } },
    };
    const one = (t: string) => SKILLS.find((s) => s.ent === t)!.id;
    let prev = forecastScore({ skills: {}, exams: [], now: 2, diagnostic }).score;
    // (a) 3 темы по одному навыку, 1..12 ответов каждому, оценка 0,75 — «среднее» умение
    for (let n = 1; n <= 12; n++) {
      const skills = Object.fromEntries(["t03", "t04", "t05"].map((t) => [one(t), { attempts: n, correct: n, mastery: 0.75, lastSeen: 1 }]));
      const f = forecastScore({ skills, exams: [], now: 2, diagnostic });
      expect(prev - f.score).toBeLessThanOrEqual(2);
      prev = f.score;
    }
    // (b) верные ответы по навыку t04 с растущей оценкой — прогноз не падает
    let last = -1;
    for (let n = 1; n <= 8; n++) {
      const skills = { [one("t04")]: { attempts: n, correct: n, mastery: Math.min(0.95, 0.7 + n * 0.04), lastSeen: 1 }, [one("t07")]: { attempts: 40, correct: 30, mastery: 0.7, lastSeen: 1 } };
      const f = forecastScore({ skills, exams: [], now: 2, diagnostic });
      if (last >= 0) expect(f.score).toBeGreaterThanOrEqual(last - 1);
      last = f.score;
    }
  });
});

describe("темы «по диагностике» не считаются освоенными (C37)", () => {
  const perfect: DiagnosticSummary = { at: 1, points: 10, max: 10, byTopic: Object.fromEntries(ENT_TOPICS.map((t) => [t.id, { points: 1, max: 1 }])) as never };

  it("предварительный прогноз — все темы provisional; без диагностики — пусто", () => {
    expect(forecastScore({ skills: {}, exams: [], now: NOW, diagnostic: perfect }).provisional).toHaveLength(ENT_TOPICS.length);
    expect(forecastScore({ skills: allSkills(0.9, 3), exams: [], now: NOW }).provisional).toEqual([]);
  });

  it("после 30+ ответов provisional остаются темы, где своей практики мало", () => {
    // все навыки t04 — по 10 ответов, остальное не тронуто
    const skills = Object.fromEntries(SKILLS.filter((s) => s.ent === "t04").map((s) => [s.id, stat(0.9, 10)]));
    const f = forecastScore({ skills, exams: [], now: NOW, diagnostic: perfect });
    expect(f.basis).toBe("mastery");
    expect(f.provisional).not.toContain("t04");
    expect(f.provisional).toContain("t05");
    expect(f.byTopic.t05).toBeGreaterThanOrEqual(0.8); // оценка по диагностике остаётся, но план её не засчитает
  });

  it("баллы пробника по теме снимают пометку", () => {
    const f = forecastScore({ skills: {}, exams: [exam(40)], now: NOW, diagnostic: perfect });
    expect(f.provisional).toEqual([]);
  });
});
