import { describe, expect, it } from "vitest";
import { ENT_POOL } from "@/content/ent";
import { compareWithChallenge, decodeChallenge, encodeChallenge, poolTag, sanitizeChallenge, withChallenge } from "@/lib/challenge";
import { buildExam, type ExamKind } from "@/lib/exam";
import { currentPoolTag, EXAM_BUILD_VERSION } from "@/lib/exam-pool";
import type { EntTopicId } from "@/lib/types";

describe("вызов: параметр ch", () => {
  it("туда и обратно", () => {
    const c = { s: 14, m: 19, pool: "a9zq" };
    expect(encodeChallenge(c)).toBe("14-19-a9zq");
    expect(decodeChallenge("14-19-a9zq")).toEqual(c);
    expect(decodeChallenge("0-50-0000")).toEqual({ s: 0, m: 50, pool: "0000" });
  });

  it("мусор — null", () => {
    for (const raw of [null, undefined, "", "14-19", "20-19-a9zq", "014-19-a9zq", "14-0-a9zq", "14-101-a9zq", "14-19-A9ZQ", "14-19-a9zq-", "1.5-19-a9zq", "eyJuIjoi", "14-19-a9zq".repeat(3)]) {
      expect(decodeChallenge(raw as string)).toBeNull();
    }
    expect(encodeChallenge({ s: 5, m: 4, pool: "a9zq" })).toBeNull();
    expect(sanitizeChallenge({ s: 1, m: 2, pool: "a9zq", n: "Айжан" })).toEqual({ s: 1, m: 2, pool: "a9zq" });
    expect(sanitizeChallenge({ s: 1, m: 2 })).toBeNull();
    expect(sanitizeChallenge([1, 2])).toBeNull();
  });

  it("withChallenge добавляет ch к ссылке на вариант", () => {
    expect(withChallenge("/exam/run?kind=mini&seed=5", { s: 3, m: 19, pool: "abcd" })).toBe("/exam/run?kind=mini&seed=5&ch=3-19-abcd");
    expect(withChallenge("/exam/run?kind=mini&seed=5", { s: 30, m: 19, pool: "abcd" })).toBe("/exam/run?kind=mini&seed=5");
  });
});

describe("сравнение с вызовом", () => {
  const c = { s: 14, m: 19, pool: "a9zq" };
  it("тот же вариант — по баллам", () => {
    expect(compareWithChallenge(15, 19, c, "a9zq")).toEqual({ outcome: "more", diff: 1, samePaper: true });
    expect(compareWithChallenge(14, 19, c, "a9zq")).toEqual({ outcome: "same", diff: 0, samePaper: true });
    expect(compareWithChallenge(10, 19, c, "a9zq")).toEqual({ outcome: "less", diff: -4, samePaper: true });
  });
  it("другой банк или максимум — по доле", () => {
    expect(compareWithChallenge(15, 19, c, "zzzz")).toMatchObject({ outcome: "more", samePaper: false, diff: 5 });
    expect(compareWithChallenge(10, 20, c, "a9zq")).toMatchObject({ outcome: "less", samePaper: false });
  });
});

describe("тег банка", () => {
  it("4 знака, не зависит от порядка id, зависит от состава и версии", () => {
    const a = poolTag(["b", "a", "c"], 1);
    expect(a).toMatch(/^[a-z0-9]{4}$/);
    expect(poolTag(["a", "b", "c"], 1)).toBe(a);
    expect(poolTag(["a", "b"], 1)).not.toBe(a);
    expect(poolTag(["a", "b", "c"], 2)).not.toBe(a);
  });

  it("текущий тег стабилен", () => {
    expect(currentPoolTag()).toMatch(/^[a-z0-9]{4}$/);
    expect(currentPoolTag()).toBe(poolTag(ENT_POOL.map((i) => i.id), EXAM_BUILD_VERSION));
  });
});

// Сторож EXAM_BUILD_VERSION: тот же seed должен давать тот же вариант, пока тег не поменялся.
// Банк поменялся (новые задания) — тег другой: обновите RECORDED (тег и отпечаток). Тег прежний, а отпечаток другой —
// поменялся алгоритм сборки (lib/exam.ts): увеличьте EXAM_BUILD_VERSION в lib/exam-pool.ts и тоже обновите RECORDED.
const RECORDED = { tag: "zbu1", fingerprint: "if02" };

function fingerprint(): string {
  const cases: [ExamKind, number, EntTopicId[]][] = [
    ["mini", 1, []],
    ["mini", 3051234567, []],
    ["full", 42, []],
    ["topic", 7, ["t04", "t05"]],
  ];
  const keys = cases.flatMap(([kind, seed, topics]) => buildExam({ kind, seed, pool: ENT_POOL, topics }).items.map((q) => `${q.key}:${q.item.id}`));
  return poolTag(keys.map((k, i) => `${i}:${k}`), 0);
}

describe("сторож версии сборки варианта", () => {
  it("тег и отпечаток варианта записаны", () => {
    const now = { tag: currentPoolTag(), fingerprint: fingerprint() };
    if (now.tag === RECORDED.tag && now.fingerprint !== RECORDED.fingerprint) {
      throw new Error("Алгоритм сборки варианта изменился при том же банке: увеличьте EXAM_BUILD_VERSION (lib/exam-pool.ts) и обновите RECORDED.");
    }
    expect(now, "банк заданий изменился: обновите RECORDED в tests/challenge.test.ts").toEqual(RECORDED);
  });
});
