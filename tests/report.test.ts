import { describe, expect, it } from "vitest";
import { buildReport, parseReport } from "@/lib/report";
import { packData, unpackData } from "@/lib/share-link";
import { todayKey } from "@/lib/text";
import { SKILLS } from "@/content/skills";
import { ENT_TOPICS } from "@/content/ent-topics";

const NOW = new Date(2026, 9, 2, 12).getTime();
const key = (ago: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - ago);
  return todayKey(d);
};
const profile = { name: "  Айдана  " } as never;
const empty = { profile, xp: 0, streak: { current: 0, best: 0, lastDay: null, freezes: 0 }, days: {}, skills: {}, exams: [] };

describe("buildReport", () => {
  it("пустой ученик: нулевые периоды, нет прогноза и слабых тем", () => {
    const r = buildReport(empty, NOW);
    expect(r.name).toBe("Айдана");
    expect(r.days.d7).toEqual({ active: 0, lessons: 0 });
    expect(r.forecast.basis).toBe("none");
    expect(r.weak).toEqual([]);
    expect(r.topics).toHaveLength(ENT_TOPICS.length);
  });

  it("окна 7 и 30 дней считаются по дням", () => {
    const days = {
      [key(0)]: { xp: 10, answers: 3, correct: 2, seconds: 5, lessons: 2 },
      [key(6)]: { xp: 0, answers: 0, correct: 0, seconds: 0 },
      [key(6 + 0)]: { xp: 5, answers: 1, correct: 1, seconds: 1, lessons: 1 },
      [key(7)]: { xp: 5, answers: 1, correct: 1, seconds: 1, lessons: 4 },
      [key(29)]: { xp: 5, answers: 1, correct: 1, seconds: 1, lessons: 1 },
      [key(30)]: { xp: 5, answers: 1, correct: 1, seconds: 1, lessons: 9 },
    };
    const r = buildReport({ ...empty, days }, NOW);
    expect(r.days.d7).toEqual({ active: 2, lessons: 3 });
    expect(r.days.d30).toEqual({ active: 4, lessons: 8 });
  });

  it("пробники: последние 5, новые первыми; прогноз и слабые темы", () => {
    const exams = Array.from({ length: 7 }, (_, i) => ({
      id: String(i), kind: "full" as const, seed: i, at: NOW - i * 1000, points: 20, maxPoints: 40, durationSec: 1, byTopic: { t01: { points: 1, max: 5 } },
    }));
    const skill = SKILLS[0];
    const r = buildReport({ ...empty, exams, skills: { [skill.id]: { attempts: 5, correct: 5, mastery: 0.9, lastSeen: NOW } } }, NOW);
    expect(r.exams).toHaveLength(5);
    expect(r.exams[0].at).toBe(NOW);
    expect(r.forecast.basis).toBe("both");
    expect(r.weak.length).toBeGreaterThan(0);
    expect(r.weak.length).toBeLessThanOrEqual(3);
  });
});

describe("parseReport", () => {
  it("круг через ссылку", async () => {
    const r = buildReport(empty, NOW);
    expect(parseReport(await unpackData(await packData(r)))).toEqual(r);
  });

  it("отбрасывает мусор и чинит выходы за границы", () => {
    const r = buildReport(empty, NOW);
    expect(parseReport(null)).toBeNull();
    expect(parseReport({ ...r, v: 2 })).toBeNull();
    expect(parseReport({ ...r, topics: [1, 2] })).toBeNull();
    expect(parseReport({ ...r, days: { d7: { active: "x", lessons: 1 }, d30: r.days.d30 } })).toBeNull();
    const wild = parseReport({ ...r, xp: -5, name: "x".repeat(200), weak: ["t01", "zzz", "t02", "t03", "t04"], topics: r.topics.map(() => 999) });
    expect(wild?.xp).toBe(0);
    expect(wild?.name).toHaveLength(30);
    expect(wild?.weak).toEqual(["t01", "t02", "t03"]);
    expect(wild?.topics.every((x) => x === 100)).toBe(true);
    expect(parseReport({ ...r, lang: "en" })?.lang).toBeUndefined();
    expect(parseReport({ ...r, lang: "kk" })?.lang).toBe("kk");
  });
});
