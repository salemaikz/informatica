import { describe, expect, it } from "vitest";
import { ENT_TOPICS } from "@/content/ent-topics";
import { daysText, daysUntil, examTrend, goalStatus, lessonsForTopic, nextLessonId, pluralRu, weekProgress, weekStart, weeklyPlan } from "@/lib/goals";
import type { EntTopicId } from "@/lib/types";

describe("daysUntil", () => {
  it("считает дни до даты", () => {
    expect(daysUntil("2027-05-20", "2026-10-02")).toBe(230);
    expect(daysUntil("2026-10-02", "2026-10-02")).toBe(0);
    expect(daysUntil("2026-10-01", "2026-10-02")).toBe(-1);
  });
  it("нет даты или мусор — null", () => {
    expect(daysUntil(null, "2026-10-02")).toBeNull();
    expect(daysUntil("", "2026-10-02")).toBeNull();
    expect(daysUntil("завтра", "2026-10-02")).toBeNull();
  });
  it("переход на летнее время не сдвигает счёт", () => {
    expect(daysUntil("2026-04-01", "2026-03-01")).toBe(31);
  });
});

describe("склонение", () => {
  it("русские формы", () => {
    const f = ["день", "дня", "дней"] as const;
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 111, 214].map((n) => pluralRu(n, f))).toEqual([
      "день", "дня", "дня", "дней", "дней", "дней", "дней", "день", "дня", "дней", "дней", "дней",
    ]);
  });
  it("daysText", () => {
    expect(daysText(214, "ru")).toBe("214 дней");
    expect(daysText(3, "kk")).toBe("3 күн");
  });
});

describe("weekProgress", () => {
  it("неделя — с понедельника", () => {
    expect(weekStart("2026-10-02")).toBe("2026-09-28"); // пятница
    expect(weekStart("2026-09-28")).toBe("2026-09-28"); // понедельник
    expect(weekStart("2026-10-04")).toBe("2026-09-28"); // воскресенье
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
  });
  it("считает уроки только текущей недели", () => {
    const days = {
      "2026-09-27": { lessons: 5 }, // воскресенье прошлой недели — не в счёт
      "2026-09-28": { lessons: 1 },
      "2026-09-30": { lessons: 2 },
      "2026-10-02": { lessons: 1 },
      "2026-10-05": { lessons: 3 }, // следующая неделя
    };
    const w = weekProgress(days, 4, "2026-10-02");
    expect(w.done).toBe(4);
    expect(w.goal).toBe(4);
    expect(w.reached).toBe(true);
    expect(w.ratio).toBe(1);
    expect(w.days.map((d) => d.key)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(w.days[4].today).toBe(true);
    expect(w.days[5].future).toBe(true);
    expect(w.days[3].future).toBe(false);
  });
  it("не доходит до цели — доля", () => {
    const w = weekProgress({ "2026-10-01": { lessons: 1 } }, 4, "2026-10-02");
    expect(w.done).toBe(1);
    expect(w.ratio).toBe(0.25);
    expect(w.reached).toBe(false);
  });
  it("мусор в данных и нулевая цель не ломают", () => {
    const w = weekProgress({ "2026-10-02": { lessons: NaN }, "2026-10-01": {} }, 0, "2026-10-02");
    expect(w.done).toBe(0);
    expect(w.goal).toBe(1);
  });
});

describe("goalStatus", () => {
  it("без данных — none", () => {
    expect(goalStatus({ score: 0, basis: "none" }, 35).status).toBe("none");
  });
  it("ниже / на уровне / выше", () => {
    expect(goalStatus({ score: 20, basis: "mastery" }, 35)).toEqual({ status: "below", gap: 15 });
    expect(goalStatus({ score: 33, basis: "mastery" }, 35).status).toBe("on");
    expect(goalStatus({ score: 37, basis: "both" }, 35).status).toBe("on");
    expect(goalStatus({ score: 40, basis: "exams" }, 35)).toEqual({ status: "above", gap: -5 });
  });
});

describe("weeklyPlan", () => {
  const zero = Object.fromEntries(ENT_TOPICS.map((t) => [t.id, 0])) as Record<EntTopicId, number>;
  it("три самые весомые темы, когда ничего не освоено", () => {
    const plan = weeklyPlan(zero);
    expect(plan).toHaveLength(3);
    // t06 (Python, с контекстными) — самая весомая; затем темы по 5 заданий (t01, t02), потом 4 (t03...)
    expect(plan[0].topic).toBe("t06");
    expect(plan.map((p) => p.topic)).toEqual(["t06", "t01", "t02"]);
    expect(plan[0].gain).toBeGreaterThan(plan[1].gain);
  });
  it("приоритет = вес × (1 − освоение)", () => {
    const plan = weeklyPlan({ ...zero, t06: 0.75, t01: 0.5 }, 13);
    const t06 = plan.find((p) => p.topic === "t06");
    const t01 = plan.find((p) => p.topic === "t01");
    if (t06) expect(t06.gain).toBeCloseTo(t06.weight * 0.25, 10);
    expect(t01!.gain).toBeCloseTo(t01!.weight * 0.5, 10);
  });
  it("освоенные темы пропускаются", () => {
    const plan = weeklyPlan({ ...zero, t06: 0.9, t01: 0.85, t02: 0.8 });
    expect(plan.map((p) => p.topic)).not.toContain("t06");
    expect(plan.map((p) => p.topic)).not.toContain("t01");
    expect(plan.map((p) => p.topic)).not.toContain("t02");
    expect(plan).toHaveLength(3);
  });
  it("если слабых мало — короче; пустой ввод не ломает", () => {
    const all = Object.fromEntries(ENT_TOPICS.map((t) => [t.id, 1])) as Record<EntTopicId, number>;
    expect(weeklyPlan(all)).toEqual([]);
    expect(weeklyPlan({}).length).toBe(3);
    expect(weeklyPlan({ t01: NaN as unknown as number }).length).toBe(3);
  });
});

describe("examTrend", () => {
  it("от старых к новым, к 50, без тестов по теме", () => {
    const pts = examTrend([
      { at: 3, points: 30, maxPoints: 50, kind: "full" },
      { at: 1, points: 10, maxPoints: 20, kind: "mini" },
      { at: 2, points: 5, maxPoints: 10, kind: "topic" },
      { at: 4, points: 5, maxPoints: 0, kind: "full" },
    ]);
    expect(pts.map((p) => p.at)).toEqual([1, 3]);
    expect(pts.map((p) => p.score)).toEqual([25, 30]);
  });
  it("ограничение по числу", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ at: i, points: i, maxPoints: 50, kind: "full" }));
    expect(examTrend(many, 5).map((p) => p.at)).toEqual([15, 16, 17, 18, 19]);
  });
});

describe("nextLessonId / lessonsForTopic", () => {
  const units = [
    { lessons: [{ id: "a", status: "available" }, { id: "b", status: "soon" }] },
    { lessons: [{ id: "c", status: "available" }] },
  ];
  it("первый готовый непройденный", () => {
    expect(nextLessonId(units, {})).toBe("a");
    expect(nextLessonId(units, { a: 1 })).toBe("c");
    expect(nextLessonId(units, { a: 1, c: 1 })).toBeNull();
  });
  it("уроки темы — по навыкам и по entTopics", () => {
    const lessons = [
      { id: "x", skills: ["ns.bin2dec"] },
      { id: "y", skills: ["info.units"] },
      { id: "z", skills: [], entTopics: ["t04" as EntTopicId] },
    ];
    expect(lessonsForTopic("t04", lessons)).toEqual(["x", "z"]);
    expect(lessonsForTopic("t03", lessons)).toEqual(["y"]);
  });
});
