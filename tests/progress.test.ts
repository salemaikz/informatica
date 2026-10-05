import { describe, expect, it } from "vitest";
import { UNITS, getLesson } from "@/content/course";
import { ENT_TOPICS, topicWeight } from "@/content/ent-topics";
import { schoolPlan } from "@/content/school-program";
import { SKILLS } from "@/content/skills";
import { topicMastery, topicSkillIds } from "@/components/learn/map";
import {
  FELL_DROP,
  MIN_ANSWERS,
  STALE_DAYS,
  TREND_MIN,
  courseProgress,
  dayTotals,
  drillHref,
  hasEnoughData,
  isPartialWindow,
  lastDays,
  schoolSectionRows,
  skillDaysSince,
  topicStats,
  topicTrend,
  unitRows,
  weakSpots,
} from "@/lib/progress";
import type { SkillStat } from "@/lib/mastery";
import type { SkillDays } from "@/lib/skill-days";
import type { DayStat } from "@/lib/store";
import type { Unit } from "@/lib/types";

const DAY = 86_400_000;
// Полдень 5 октября 2026 по местному времени: от сдвига часов день не уезжает.
const NOW = new Date(2026, 9, 5, 12, 0, 0).getTime();

const ready = (u: Unit) => u.lessons.filter((r) => r.status === "available" && getLesson(r.id));
const allIds = (units: readonly Unit[]) => units.flatMap((u) => ready(u).map((r) => r.id));
const doneOf = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { completions: 1 }]));

const key = (ago: number) => lastDays(NOW - ago * DAY, 1)[0];
const stat = (mastery: number, extra: Partial<SkillStat> = {}): SkillStat => ({ attempts: 5, correct: 3, mastery, lastSeen: NOW, ...extra });
/** Срез навыков: [сколько дней назад, навык, n, s, h?, sec?]. */
function days(rows: [number, string, number, number, number?, number?][]): SkillDays {
  const out: SkillDays = {};
  for (const [ago, skill, n, s, h, sec] of rows) {
    const day = (out[key(ago)] ??= {});
    day[skill] = { n, s, ...(h ? { h } : {}), ...(sec ? { sec } : {}) };
  }
  return out;
}

describe("lastDays", () => {
  it("n дней от старого к новому, последний — день now", () => {
    const d = lastDays(NOW, 7);
    expect(d).toHaveLength(7);
    expect(d[6]).toBe("2026-10-05");
    expect(d[0]).toBe("2026-09-29");
    expect([...d].sort()).toEqual(d);
  });

  it("переход через границу месяца и года", () => {
    expect(lastDays(new Date(2026, 0, 2, 12).getTime(), 4)).toEqual(["2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02"]);
  });

  it("мусор — пусто", () => {
    expect(lastDays(NaN, 7)).toEqual([]);
    expect(lastDays(NOW, 0)).toEqual([]);
  });
});

describe("courseProgress", () => {
  const readyCount = UNITS.reduce((a, u) => a + ready(u).length, 0);
  const totalCount = UNITS.reduce((a, u) => a + u.lessons.length, 0);

  it("пусто: ничего не пройдено", () => {
    const p = courseProgress({});
    expect(p).toEqual({ done: 0, ready: readyCount, total: totalCount, ratio: 0 });
    expect(p.ready).toBeGreaterThan(0);
  });

  it("считает только готовые уроки на карте", () => {
    const id = ready(UNITS[1])[0].id;
    const p = courseProgress({ [id]: { completions: 2 } });
    expect(p.done).toBe(1);
    expect(p.ratio).toBeCloseTo(1 / readyCount);
  });

  it("урок вне карты (старый ns-1-binary) не считается", () => {
    expect(UNITS.some((u) => u.lessons.some((r) => r.id === "ns-1-binary"))).toBe(false);
    expect(courseProgress({ "ns-1-binary": { completions: 3 }, "нет-такого": { completions: 1 } }).done).toBe(0);
  });

  it("всё готовое пройдено — 100%, не больше", () => {
    const p = courseProgress(doneOf(allIds(UNITS)));
    expect(p.done).toBe(p.ready);
    expect(p.ratio).toBe(1);
  });

  it("мусорные completions не считаются пройденными", () => {
    const [a, b, c, d] = allIds(UNITS);
    const lessons = { [a]: { completions: 0 }, [b]: { completions: -2 }, [c]: { completions: NaN }, [d]: { completions: "3" as unknown as number } };
    expect(courseProgress(lessons).done).toBe(0);
  });

  it("«скоро» не входит в готовые, но входит в total", () => {
    const real = UNITS[1];
    const units: Unit[] = [
      { ...real, lessons: [{ ...real.lessons[0] }, { id: "zz-soon-1", title: { ru: "Скоро", kk: "Жақында" }, status: "soon" }, { id: "zz-soon-2", title: { ru: "Скоро", kk: "Жақында" }, status: "soon" }] },
    ];
    const p = courseProgress(doneOf([real.lessons[0].id]), { units });
    expect(p).toEqual({ done: 1, ready: 1, total: 3, ratio: 1 });
  });

  it("урок «доступен», но его нет в курсе, готовым не считается", () => {
    const units: Unit[] = [{ ...UNITS[1], lessons: [{ id: "zz-ghost", title: { ru: "x", kk: "x" }, status: "available" }] }];
    expect(courseProgress({}, { units })).toEqual({ done: 0, ready: 0, total: 1, ratio: 0 });
  });

  it("skipBasics исключает раздел «Старт» из done, ready и total — 100% достижимо без него", () => {
    const base = UNITS.find((u) => u.id === "u0")!;
    const withoutBasics = UNITS.filter((u) => u.id !== "u0");
    const lessons = doneOf(allIds(withoutBasics));

    const full = courseProgress(lessons);
    expect(full.ratio).toBeLessThan(1);

    const skipped = courseProgress(lessons, { skipBasics: true });
    expect(skipped.ratio).toBe(1);
    expect(skipped.ready).toBe(readyCount - ready(base).length);
    expect(skipped.total).toBe(totalCount - base.lessons.length);
    expect(skipped.done).toBe(skipped.ready);
  });

  it("skipBasics: пройденные уроки «Старта» не считаются вовсе", () => {
    const base = UNITS.find((u) => u.id === "u0")!;
    expect(courseProgress(doneOf(ready(base).map((r) => r.id)), { skipBasics: true }).done).toBe(0);
  });
});

describe("unitRows", () => {
  it("по строке на раздел; пройдено/готово/скоро согласованы", () => {
    const rows = unitRows({}, {});
    expect(rows.map((r) => r.id)).toEqual(UNITS.map((u) => u.id));
    for (const r of rows) {
      expect(r.done).toBe(0);
      expect(r.soon).toBe(r.total - r.ready);
      expect(r.ratio).toBe(0);
    }
  });

  it("skipBasics убирает u0", () => {
    expect(unitRows({}, {}, { skipBasics: true }).some((r) => r.id === "u0")).toBe(false);
  });

  it("доля раздела и «скоро» на выдуманной карте", () => {
    const real = UNITS[1];
    const units: Unit[] = [
      { ...real, id: "x1", lessons: [{ ...real.lessons[0] }, { ...real.lessons[1] }, { id: "zz-soon", title: { ru: "S", kk: "S" }, status: "soon" }] },
    ];
    const [row] = unitRows(doneOf([real.lessons[0].id]), {}, { units });
    expect(row).toMatchObject({ id: "x1", done: 1, ready: 2, total: 3, soon: 1, ratio: 0.5 });
  });

  it("освоение — среднее по навыкам готовых уроков, не тронутые — 0; нет готовых — null", () => {
    const real = UNITS[1];
    const lesson = getLesson(real.lessons[0].id)!;
    const units: Unit[] = [
      { ...real, id: "x1", lessons: [{ ...real.lessons[0] }] },
      { ...real, id: "x2", lessons: [{ id: "zz-soon", title: { ru: "S", kk: "S" }, status: "soon" }] },
    ];
    const all = Object.fromEntries(lesson.skills.map((s) => [s, stat(0.8)]));
    const rows = unitRows({}, all, { units });
    expect(rows[0].mastery).toBeCloseTo(0.8);
    expect(rows[1].mastery).toBeNull();

    // Один навык не тронут — среднее ниже.
    const some = Object.fromEntries(lesson.skills.slice(1).map((s) => [s, stat(0.8)]));
    if (lesson.skills.length > 1) expect(unitRows({}, some, { units })[0].mastery!).toBeLessThan(0.8);
    // Попыток нет — как не тронут, даже с оценкой в сохранении.
    const zero = Object.fromEntries(lesson.skills.map((s) => [s, stat(0.9, { attempts: 0 })]));
    expect(unitRows({}, zero, { units })[0].mastery).toBe(0);
  });
});

describe("schoolSectionRows", () => {
  it("уникальные уроки раздела и темы без уроков", () => {
    const plan = schoolPlan("5")!;
    const rows = schoolSectionRows(plan, {});
    expect(rows).toHaveLength(plan.sections.length);
    const first = plan.sections[0];
    const ids = new Set(first.topics.flatMap((t) => t.lessonIds));
    expect(rows[0].ready).toBe(ids.size);
    expect(rows[0].soon).toBe(first.topics.filter((t) => !t.lessonIds.length).length);
    const done = schoolSectionRows(plan, doneOf([...ids]));
    expect(done[0].done).toBe(ids.size);
    expect(done[0].ratio).toBe(ids.size ? 1 : 0);
  });
});

describe("skillDaysSince / isPartialWindow", () => {
  it("самый ранний день среза", () => {
    expect(skillDaysSince({})).toBeNull();
    expect(skillDaysSince(days([[3, "ns.base", 1, 1], [10, "ns.base", 1, 1]]))).toBe(key(10));
  });

  it("пустые и кривые дни не считаются", () => {
    const sd = { "2026-01-01": {}, мусор: { "ns.base": { n: 1, s: 1 } }, [key(2)]: { "ns.base": { n: 1, s: 1 } } } as SkillDays;
    expect(skillDaysSince(sd)).toBe(key(2));
  });

  it("срез короче окна — подпись «Данные с …»; покрывает окно — без неё", () => {
    expect(isPartialWindow(null, NOW, 30)).toBe(true);
    expect(isPartialWindow(key(5), NOW, 30)).toBe(true);
    expect(isPartialWindow(key(29), NOW, 30)).toBe(false);
    expect(isPartialWindow(key(40), NOW, 30)).toBe(false);
    expect(isPartialWindow(key(6), NOW, 7)).toBe(false);
    expect(isPartialWindow(key(3), NOW, 7)).toBe(true);
  });
});

describe("topicStats", () => {
  it("пусто: 13 тем по порядку спецификации, данных нет", () => {
    const rows = topicStats({}, {}, 30, NOW);
    expect(rows.map((r) => r.topic)).toEqual(ENT_TOPICS.map((t) => t.id));
    for (const r of rows) expect(r).toMatchObject({ n: 0, acc: null, sec: 0, hinted: 0, level: "none", mastery: 0 });
  });

  it("складывает навыки темы: задания, точность, секунды, подсказки", () => {
    // ns.bin2dec и ns.dec2bin — обе t04
    const sd = days([
      [0, "ns.bin2dec", 4, 3, 1, 120],
      [1, "ns.dec2bin", 6, 3, 2, 200],
      [2, "logic.ops", 2, 2],
    ]);
    const rows = topicStats(sd, {}, 30, NOW);
    const t04 = rows.find((r) => r.topic === "t04")!;
    expect(t04).toMatchObject({ n: 10, score: 6, acc: 0.6, sec: 320, hinted: 3 });
    expect(rows.find((r) => r.topic === "t05")).toMatchObject({ n: 2, acc: 1 });
  });

  it("окно 7 дней отсекает старые дни, 30 — нет", () => {
    const sd = days([
      [0, "ns.bin2dec", 2, 2],
      [10, "ns.bin2dec", 5, 0],
    ]);
    expect(topicStats(sd, {}, 7, NOW).find((r) => r.topic === "t04")).toMatchObject({ n: 2, acc: 1 });
    expect(topicStats(sd, {}, 30, NOW).find((r) => r.topic === "t04")).toMatchObject({ n: 7 });
    // ровно граница: 6 дней назад — внутри 7-дневного окна, 7 — снаружи
    expect(topicStats(days([[6, "ns.bin2dec", 1, 1]]), {}, 7, NOW).find((r) => r.topic === "t04")!.n).toBe(1);
    expect(topicStats(days([[7, "ns.bin2dec", 1, 1]]), {}, 7, NOW).find((r) => r.topic === "t04")!.n).toBe(0);
  });

  it("навык без темы ЕНТ и неизвестный навык не попадают ни в одну тему", () => {
    const sd = days([
      [0, "ent.strategy", 5, 5],
      [0, "zz.unknown", 5, 5],
    ]);
    expect(topicStats(sd, {}, 30, NOW).every((r) => r.n === 0)).toBe(true);
  });

  it("мусор в срезе (минус, NaN, строки) не ломает суммы; точность не больше 1", () => {
    const sd = {
      [key(0)]: {
        "ns.bin2dec": { n: 2, s: 5 },
        "ns.dec2bin": { n: -3, s: NaN, h: "x", sec: -1 },
      },
    } as unknown as SkillDays;
    const t04 = topicStats(sd, {}, 30, NOW).find((r) => r.topic === "t04")!;
    expect(t04.n).toBe(2);
    expect(t04.acc).toBe(1);
    expect(t04.sec).toBe(0);
    expect(t04.hinted).toBe(0);
  });

  it("освоение темы совпадает с «Картой ЕНТ» (components/learn/map.ts)", () => {
    const skills: Record<string, SkillStat> = {
      "ns.bin2dec": stat(0.9),
      "ns.dec2bin": stat(0.3),
      "logic.ops": stat(0.85),
      "py.vars": stat(0.5, { attempts: 0 }),
    };
    const rows = topicStats({}, skills, 30, NOW);
    for (const t of ENT_TOPICS) {
      const mine = rows.find((r) => r.topic === t.id)!;
      const ref = topicMastery(topicSkillIds(t.id, SKILLS), skills);
      expect(mine.mastery).toBeCloseTo(ref.value);
      expect(mine.level).toBe(ref.level);
    }
  });

  it("тема «освоена» только по правилу #67: 3 верных подряд за один присест — «в процессе», 4 верных в 2 днях — «освоено» (C15)", () => {
    const ids = topicSkillIds("t04", SKILLS);
    const level = (extra: Partial<SkillStat>) => {
      const skills = Object.fromEntries(ids.map((id) => [id, stat(0.9, extra)]));
      const row = topicStats({}, skills, 30, NOW).find((r) => r.topic === "t04")!;
      // Карта ЕНТ и «Прогресс» считают одинаково.
      expect(row.level).toBe(topicMastery(ids, skills).level);
      expect(row.mastery).toBeGreaterThanOrEqual(0.8);
      return row.level;
    };
    expect(level({ clean: 3, okDays: 1 })).toBe("progress");
    expect(level({ clean: 4, okDays: 1 })).toBe("progress");
    expect(level({ clean: 4, okDays: 2 })).toBe("mastered");
  });
});

describe("topicTrend", () => {
  it("точки по дням за период: от старого к новому, последняя — сегодня", () => {
    const tr = topicTrend(days([[0, "ns.bin2dec", 2, 1]]), "t04", NOW);
    expect(tr.points).toHaveLength(30);
    expect(tr.points[29]).toEqual({ day: key(0), n: 2, acc: 0.5 });
    expect(tr.points[28]).toEqual({ day: key(1), n: 0, acc: null });
    expect(topicTrend({}, "t04", NOW, 14).points).toHaveLength(14);
    expect(topicTrend({}, "t04", NOW, 7).points).toHaveLength(7);
  });

  it("изменение: неделя к неделе, когда в обеих хватает заданий", () => {
    const sd = days([
      [1, "ns.bin2dec", 5, 5], // последние 7 дней: 100%
      [9, "ns.dec2bin", 10, 5], // предыдущие 7 дней: 50%
    ]);
    const tr = topicTrend(sd, "t04", NOW);
    expect(tr.recent).toEqual({ n: 5, acc: 1 });
    expect(tr.prev).toEqual({ n: 10, acc: 0.5 });
    expect(tr.change).toBeCloseTo(0.5);
  });

  it(`меньше ${TREND_MIN} заданий в любой из недель — изменения нет (ровно ${TREND_MIN} — есть)`, () => {
    const enough = days([
      [1, "ns.bin2dec", TREND_MIN, TREND_MIN],
      [9, "ns.bin2dec", TREND_MIN, 0],
    ]);
    expect(topicTrend(enough, "t04", NOW).change).toBeCloseTo(1);

    const fewRecent = days([
      [1, "ns.bin2dec", TREND_MIN - 1, TREND_MIN - 1],
      [9, "ns.bin2dec", 10, 5],
    ]);
    expect(topicTrend(fewRecent, "t04", NOW).change).toBeNull();

    const fewPrev = days([
      [1, "ns.bin2dec", 10, 5],
      [9, "ns.bin2dec", TREND_MIN - 1, 0],
    ]);
    expect(topicTrend(fewPrev, "t04", NOW).change).toBeNull();
    expect(topicTrend({}, "t04", NOW).change).toBeNull();
  });

  it("падение — отрицательное изменение; границы недель: 6 и 7 дней назад", () => {
    const sd = days([
      [6, "ns.bin2dec", 5, 0], // ещё «последняя» неделя
      [7, "ns.bin2dec", 5, 5], // уже «предыдущая»
    ]);
    const tr = topicTrend(sd, "t04", NOW);
    expect(tr.recent.n).toBe(5);
    expect(tr.prev.n).toBe(5);
    expect(tr.change).toBeCloseTo(-1);
  });

  it("сравнение недель не зависит от длины графика", () => {
    const sd = days([
      [1, "ns.bin2dec", 5, 5],
      [9, "ns.bin2dec", 5, 0],
    ]);
    expect(topicTrend(sd, "t04", NOW, 7).change).toBeCloseTo(1);
  });

  it("другая тема не примешивается", () => {
    const sd = days([[1, "logic.ops", 9, 9]]);
    expect(topicTrend(sd, "t04", NOW).recent.n).toBe(0);
  });
});

describe("weakSpots", () => {
  const spots = (skills: Record<string, SkillStat>, sd: SkillDays = {}, limit?: number, hasBank: (id: string) => boolean = () => true) =>
    weakSpots({ skills, skillDays: sd, now: NOW, hasBank }, limit);

  it("пусто и мусор", () => {
    expect(spots({})).toEqual([]);
    expect(weakSpots({ skills: {}, skillDays: {}, now: NaN })).toEqual([]);
    expect(spots({ "zz.unknown": stat(0.1) })).toEqual([]);
    expect(spots({ "ns.bin2dec": undefined as unknown as SkillStat })).toEqual([]);
    expect(spots({ "ns.bin2dec": stat(0.1) }, {}, 0)).toEqual([]);
  });

  it(`порог данных: ровно ${MIN_ANSWERS} ответа — есть, меньше — нет`, () => {
    expect(spots({ "ns.bin2dec": stat(0.2, { attempts: MIN_ANSWERS }) })).toHaveLength(1);
    expect(spots({ "ns.bin2dec": stat(0.2, { attempts: MIN_ANSWERS - 1 }) })).toEqual([]);
    expect(spots({ "ns.bin2dec": stat(0.2, { attempts: 0 }) })).toEqual([]);
  });

  it("hasEnoughData — по порогу ответов у известных навыков", () => {
    expect(hasEnoughData({})).toBe(false);
    expect(hasEnoughData({ "ns.bin2dec": stat(0.5, { attempts: 2 }) })).toBe(false);
    expect(hasEnoughData({ "ns.bin2dec": stat(0.5, { attempts: 3 }) })).toBe(true);
    expect(hasEnoughData({ "zz.unknown": stat(0.5, { attempts: 9 }) })).toBe(false);
  });

  it("низкая оценка — причина low; оценка от 0,6 и без падения — не слабое место", () => {
    const [s] = spots({ "ns.bin2dec": stat(0.4) });
    expect(s).toMatchObject({ skill: "ns.bin2dec", topic: "t04", reason: "low", mastery: 0.4, attempts: 5 });
    expect(spots({ "ns.bin2dec": stat(0.6) })).toEqual([]);
    expect(spots({ "ns.bin2dec": stat(0.95) })).toEqual([]);
  });

  it("ранг: при равной оценке выше навык темы с большим весом", () => {
    expect(topicWeight("t06")).toBeGreaterThan(topicWeight("t01"));
    const r = spots({ "base.computer": stat(0.3), "py.vars": stat(0.3) });
    expect(r.map((x) => x.skill)).toEqual(["py.vars", "base.computer"]);
  });

  it("ранг: при равном весе выше навык с меньшей оценкой", () => {
    const r = spots({ "ns.bin2dec": stat(0.5), "ns.dec2bin": stat(0.2), "ns.props": stat(0.4) });
    expect(r.map((x) => x.skill)).toEqual(["ns.dec2bin", "ns.props", "ns.bin2dec"]);
  });

  it("падение точности: причина fell, даже при оценке выше порога", () => {
    const sd = days([
      [9, "ns.bin2dec", 4, 4], // неделя назад — 100%
      [1, "ns.bin2dec", 4, 1], // эта неделя — 25%
    ]);
    const [s] = spots({ "ns.bin2dec": stat(0.75) }, sd);
    expect(s.reason).toBe("fell");
    expect(s.drop).toBeCloseTo(0.75);
    expect(s.n30).toBe(8);
    expect(s.acc30).toBeCloseTo(5 / 8);
  });

  it("падение меньше порога или данных меньше FELL_MIN в неделе — не fell", () => {
    const small = days([
      [9, "ns.bin2dec", 4, 4],
      [1, "ns.bin2dec", 4, 4 - 4 * (FELL_DROP - 0.05)],
    ]);
    expect(spots({ "ns.bin2dec": stat(0.75) }, small)).toEqual([]);
    const few = days([
      [9, "ns.bin2dec", 4, 4],
      [1, "ns.bin2dec", 2, 0],
    ]);
    expect(spots({ "ns.bin2dec": stat(0.75) }, few)).toEqual([]);
  });

  it("давность: оценка ниже «освоено» и ≥ STALE_DAYS без практики — stale; освоенный — нет", () => {
    const old = (d: number) => NOW - d * DAY;
    const [s] = spots({ "ns.bin2dec": stat(0.7, { lastSeen: old(STALE_DAYS) }) });
    expect(s).toMatchObject({ reason: "stale", idleDays: STALE_DAYS });
    expect(spots({ "ns.bin2dec": stat(0.7, { lastSeen: old(STALE_DAYS - 1) }) })).toEqual([]);
    expect(spots({ "ns.bin2dec": stat(0.85, { lastSeen: old(60) }) })).toEqual([]);
  });

  it("давность поднимает ранг: при одной оценке давний навык выше свежего слабого", () => {
    const old = NOW - 28 * DAY;
    const r = spots({ "ns.bin2dec": stat(0.5), "ns.dec2bin": stat(0.5, { lastSeen: old }) });
    expect(r.map((x) => x.skill)).toEqual(["ns.dec2bin", "ns.bin2dec"]);
  });

  it("приоритет причин: low важнее fell важнее stale", () => {
    const sd = days([
      [9, "ns.bin2dec", 4, 4],
      [1, "ns.bin2dec", 4, 0],
    ]);
    const old = NOW - 30 * DAY;
    expect(spots({ "ns.bin2dec": stat(0.3, { lastSeen: old }) }, sd)[0].reason).toBe("low");
    expect(spots({ "ns.bin2dec": stat(0.7, { lastSeen: old }) }, sd)[0].reason).toBe("fell");
  });

  it("limit: по умолчанию 5; явный меньше — меньше", () => {
    const skills = Object.fromEntries(["ns.base", "ns.bin2dec", "ns.dec2bin", "ns.props", "ns.octhex", "ns.anybase", "ns.arith"].map((id, i) => [id, stat(0.1 + i * 0.05)]));
    expect(spots(skills)).toHaveLength(5);
    expect(spots(skills, {}, 2)).toHaveLength(2);
    expect(spots(skills, {}, 50)).toHaveLength(7);
  });

  it("точность за 30 дней: нет заданий — null, а не 0", () => {
    const [s] = spots({ "ns.bin2dec": stat(0.3) });
    expect(s).toMatchObject({ acc30: null, n30: 0, drop: 0 });
    const [t] = spots({ "ns.bin2dec": stat(0.3) }, days([[40, "ns.bin2dec", 5, 5]]));
    expect(t.n30).toBe(0);
  });

  it("ссылка «Потренировать»: навык с банком — по навыку, без банка — по теме, без темы — умная тренировка", () => {
    expect(spots({ "ns.bin2dec": stat(0.3) })[0].href).toBe("/drill?mode=skill&skill=ns.bin2dec");
    expect(spots({ "ns.bin2dec": stat(0.3) }, {}, 5, () => false)[0].href).toBe("/drill?mode=smart");
    // у темы есть другой навык с банком — тренировка по теме
    const bankOnlyDec2bin = (id: string) => id === "ns.dec2bin";
    expect(spots({ "ns.bin2dec": stat(0.3) }, {}, 5, bankOnlyDec2bin)[0].href).toBe("/drill?mode=topic&topic=t04");
    expect(spots({ "ent.strategy": stat(0.3) }, {}, 5, () => false)[0].href).toBe("/drill?mode=smart");
  });

  it("drillHref по умолчанию использует реальные банки", () => {
    expect(drillHref("ns.bin2dec")).toBe("/drill?mode=skill&skill=ns.bin2dec");
  });

  it("результат детерминирован: одинаковые ранги — по id", () => {
    const a = spots({ "ns.dec2bin": stat(0.3), "ns.bin2dec": stat(0.3) });
    const b = spots({ "ns.bin2dec": stat(0.3), "ns.dec2bin": stat(0.3) });
    expect(a.map((x) => x.skill)).toEqual(b.map((x) => x.skill));
    expect(a.map((x) => x.skill)).toEqual(["ns.bin2dec", "ns.dec2bin"]);
  });
});

describe("dayTotals", () => {
  const day = (over: Partial<DayStat> = {}): DayStat => ({ xp: 0, answers: 0, correct: 0, seconds: 0, ...over });

  it("пусто — данных нет", () => {
    const t = dayTotals({});
    expect(t.accuracy).toMatchObject({ value: null, asked: 0, approx: false });
    expect(t).toMatchObject({ self: 0, hinted: 0, skipped: 0, seconds: 0, gameSeconds: 0, games: 0, gameCorrect: 0 });
  });

  it("новые дни: точность по баллам, «сам / с подсказкой / пропущено» из того же периода", () => {
    const t = dayTotals({
      a: day({ asked: 10, score: 7, hinted: 2, skipped: 1, seconds: 300 }),
      b: day({ asked: 5, score: 5, hinted: 0, skipped: 0, seconds: 100 }),
    });
    expect(t.accuracy).toMatchObject({ value: 12 / 15, asked: 15, approx: false });
    expect(t).toMatchObject({ self: 12, hinted: 2, skipped: 1, seconds: 400 });
    expect(t.self + t.hinted + t.skipped).toBe(t.accuracy.asked);
  });

  it("только старые дни — приблизительно, разбивки нет", () => {
    const t = dayTotals({ a: day({ answers: 10, correct: 8, seconds: 60 }) });
    expect(t.accuracy).toMatchObject({ value: 0.8, asked: 10, approx: true });
    expect(t).toMatchObject({ self: 0, hinted: 0, skipped: 0 });
  });

  it("старый день рядом с новым не искажает разбивку: берутся дни с asked", () => {
    const t = dayTotals({ old: day({ answers: 50, correct: 10, hinted: 40 }), now: day({ asked: 4, score: 4, hinted: 1 }) });
    expect(t.accuracy.approx).toBe(false);
    expect(t).toMatchObject({ self: 3, hinted: 1, skipped: 0 });
  });

  it("игры — отдельно и не в точности; «из них игры» не больше всего времени", () => {
    const t = dayTotals({ a: day({ asked: 2, score: 1, seconds: 90, games: 20, gameCorrect: 15, gameSeconds: 400 }) });
    expect(t.accuracy.value).toBe(0.5);
    expect(t).toMatchObject({ games: 20, gameCorrect: 15, seconds: 90, gameSeconds: 90 });
  });

  it("период по ключам и мусор в днях", () => {
    const days = { a: day({ asked: 4, score: 4, seconds: 10 }), b: day({ asked: 4, score: 0, seconds: 20 }), c: null as unknown as DayStat };
    expect(dayTotals(days, ["a"]).accuracy.value).toBe(1);
    expect(dayTotals(days, ["a", "zzz"]).seconds).toBe(10);
    expect(dayTotals(days).seconds).toBe(30);
    const junk = { a: day({ asked: NaN, seconds: -5, hinted: "x" as unknown as number }) };
    expect(dayTotals(junk)).toMatchObject({ seconds: 0, hinted: 0, self: 0 });
  });
});
