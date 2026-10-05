import { describe, expect, it } from "vitest";
import { ANSWER_SEC_CAP, SKILL_DAYS_KEEP, addSkillDay, sanitizeSkillDays } from "@/lib/skill-days";

describe("skillDays #71", () => {
  it("складывает итоги навыка за день", () => {
    let sd = addSkillDay({}, "2027-01-15", "ns.bin2dec", { n: 1, s: 1, sec: 12.4 });
    sd = addSkillDay(sd, "2027-01-15", "ns.bin2dec", { n: 1, s: 0.5, h: 1, sec: 9999 });
    expect(sd["2027-01-15"]["ns.bin2dec"]).toEqual({ n: 2, s: 1.5, h: 1, sec: Math.round(12.4 + ANSWER_SEC_CAP) });
  });
  it("хранит не больше 60 дней", () => {
    let sd = {};
    for (let i = 0; i < SKILL_DAYS_KEEP + 5; i++) {
      const d = new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10);
      sd = addSkillDay(sd, d, "x", { n: 1, s: 1 });
    }
    const keys = Object.keys(sd).sort();
    expect(keys).toHaveLength(SKILL_DAYS_KEEP);
    expect(keys[0]).toBe("2027-01-06");
  });
  it("плохие ключи не пишутся; мусор из localStorage отбрасывается", () => {
    expect(addSkillDay({}, "вчера", "x", { n: 1 })).toEqual({});
    expect(addSkillDay({}, "2027-01-15", "../x", { n: 1 })).toEqual({});
    expect(sanitizeSkillDays({ "2027-01-15": { a: { n: 2, s: 1 }, b: { n: -1 }, "x y": { n: 1 } }, bad: { a: { n: 1 } } })).toEqual({ "2027-01-15": { a: { n: 2, s: 1 } } });
    expect(sanitizeSkillDays("x")).toEqual({});
  });
});
