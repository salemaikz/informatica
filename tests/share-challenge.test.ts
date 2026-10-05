import { describe, expect, it } from "vitest";
import { ENT_POOL } from "@/content/ent";
import { examLink, parseRunParams } from "@/components/exam/logic";
import { buildExam } from "@/lib/exam";
import { sanitizeState } from "@/lib/exam-store";
import { compareWithChallenge, decodeChallenge } from "@/lib/challenge";

// Пакет B этапа 13: вызов в адресе пробника, в попытке и в сравнении (#73). Сам формат `ch` — tests/challenge.test.ts.
const CH = { s: 14, m: 19, pool: "a9zq" };
const spOf = (link: string) => Object.fromEntries(new URL(link, "http://x").searchParams);

describe("examLink и parseRunParams с вызовом", () => {
  it("examLink дописывает ch, parseRunParams его читает", () => {
    const link = examLink("mini", 42, [], undefined, CH);
    expect(link).toBe("/exam/run?kind=mini&seed=42&ch=14-19-a9zq");
    expect(parseRunParams(spOf(link))).toEqual({ kind: "mini", seed: 42, topics: [], challenge: CH });
  });

  it("тест по теме: темы и вызов вместе", () => {
    const link = examLink("topic", 7, ["t04", "t05"], undefined, CH);
    expect(link).toBe("/exam/run?kind=topic&seed=7&topics=t04%2Ct05&ch=14-19-a9zq");
    expect(parseRunParams(spOf(link))).toMatchObject({ kind: "topic", seed: 7, topics: ["t04", "t05"], challenge: CH });
  });

  it("без вызова адрес и результат прежние", () => {
    expect(examLink("mini", 5)).toBe("/exam/run?kind=mini&seed=5");
    expect(examLink("topic", 42, ["t04", "t05"])).toBe("/exam/run?kind=topic&seed=42&topics=t04%2Ct05");
    expect(parseRunParams({ kind: "mini", seed: "5" })).toEqual({ kind: "mini", seed: 5, topics: [] });
    expect(parseRunParams({ kind: "mini", seed: "5" })?.challenge).toBeUndefined();
  });

  it("негодный ch игнорируется, остальной адрес работает", () => {
    for (const ch of ["", "abc", "20-19-a9zq", "14-19-A9ZQ", "14-19", ["x", "14-19-a9zq"]]) {
      const p = parseRunParams({ kind: "mini", seed: "5", ch });
      expect(p?.seed).toBe(5);
      expect(p?.challenge).toBeUndefined();
    }
    // несколько ch — берётся первый
    expect(parseRunParams({ kind: "mini", seed: "5", ch: ["14-19-a9zq", "1-2-aaaa"] })?.challenge).toEqual(CH);
  });

  it("у контрольной раздела (unit) вызова нет: ссылка и разбор его игнорируют", () => {
    const link = examLink("unit", 5, [], "u3", CH);
    expect(link).toBe("/exam/run?kind=unit&seed=5&unit=u3");
    expect(parseRunParams({ kind: "unit", seed: "5", unit: "u3", ch: "14-19-a9zq" })).toEqual({ kind: "unit", seed: 5, topics: [], unit: "u3" });
    expect(parseRunParams({ kind: "unit", seed: "5", unit: "u3", ch: "14-19-a9zq" })?.challenge).toBeUndefined();
  });

  it("негодный вызов в examLink не попадает в ссылку", () => {
    expect(examLink("mini", 5, [], undefined, { s: 30, m: 19, pool: "a9zq" })).toBe("/exam/run?kind=mini&seed=5");
  });
});

describe("sanitizeState: вызов и тег банка", () => {
  const paper = buildExam({ kind: "mini", seed: 1, pool: ENT_POOL });
  const base = { id: "ex-1", answers: {}, current: 0, startedAt: 1, elapsedMs: 0 };

  it("проверенный вызов и тег сохраняются, лишние поля отбрасываются", () => {
    const st = sanitizeState({ ...base, pool: "a9zq", challenge: { ...CH, n: "Айжан" } }, paper);
    expect(st?.challenge).toEqual(CH);
    expect(st?.pool).toBe("a9zq");
  });

  it("битый вызов и тег отбрасываются", () => {
    expect(sanitizeState({ ...base, challenge: { s: 30, m: 9, pool: "a9zq" } }, paper)?.challenge).toBeUndefined();
    expect(sanitizeState({ ...base, challenge: { s: 3, m: 9, pool: "ZZZZ" } }, paper)?.challenge).toBeUndefined();
    expect(sanitizeState({ ...base, challenge: "14-19-a9zq" }, paper)?.challenge).toBeUndefined();
    expect(sanitizeState({ ...base, pool: "toolong" }, paper)?.pool).toBeUndefined();
    expect(sanitizeState(base, paper)?.challenge).toBeUndefined();
  });

  it("у контрольной раздела (unit) вызов отбрасывается", () => {
    const unit = { ...paper, kind: "unit" as const };
    expect(sanitizeState({ ...base, challenge: CH }, unit)?.challenge).toBeUndefined();
  });
});

describe("сравнение с вызовом", () => {
  const c = decodeChallenge("14-19-a9zq")!;
  it("тот же вариант — по баллам", () => {
    expect(compareWithChallenge(16, 19, c, "a9zq")).toEqual({ outcome: "more", diff: 2, samePaper: true });
    expect(compareWithChallenge(14, 19, c, "a9zq").outcome).toBe("same");
    expect(compareWithChallenge(11, 19, c, "a9zq")).toEqual({ outcome: "less", diff: -3, samePaper: true });
  });
  it("другой тег банка при том же максимуме — по доле", () => {
    const r = compareWithChallenge(16, 19, c, "zzzz");
    expect(r.samePaper).toBe(false);
    expect(r.outcome).toBe("more");
  });
});
