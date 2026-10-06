import { describe, expect, it } from "vitest";
import { encodeShare, parseShare, sharePath, sharePercent, SHARE_CODE_MAX, type ShareResult } from "@/lib/share-code";

const exam = (over: Partial<Extract<ShareResult, { t: "exam" }>> = {}): ShareResult => ({
  t: "exam",
  kind: "mini",
  points: 14,
  max: 19,
  lang: "kk",
  seed: 3051234567,
  pool: "a9zq",
  topics: [],
  ...over,
});

describe("код результата: туда и обратно", () => {
  const cases: [string, ShareResult, string][] = [
    ["мини", exam(), "x1-m-14-19-k-3051234567-a9zq"],
    ["полный, 0 баллов, ru", exam({ kind: "full", points: 0, max: 50, lang: "ru", seed: 0 }), "x1-f-0-50-r-0-a9zq"],
    ["тест по теме, 3 темы", exam({ kind: "topic", points: 7, max: 10, topics: ["t04", "t05", "t13"] }), "x1-t-7-10-k-3051234567-a9zq-040513"],
    ["курс ЕНТ", { t: "course", done: 37, total: 96, lang: "ru", grade: null }, "c1-37-96-r"],
    ["класс", { t: "course", done: 0, total: 12, lang: "kk", grade: "10" }, "c1-0-12-k-g10"],
    ["серия", { t: "streak", days: 12, best: 30, lang: "kk" }, "s1-12-30-k"],
    ["урок", { t: "lesson", accuracy: 85, xp: 35, perfect: false, n: 12, lang: "ru" }, "l1-85-35-0-12-r"],
    ["идеальный урок", { t: "lesson", accuracy: 100, xp: 48, perfect: true, n: 1, lang: "kk" }, "l1-100-48-1-1-k"],
    ["урок, 0%", { t: "lesson", accuracy: 0, xp: 0, perfect: false, n: 999, lang: "ru" }, "l1-0-0-0-999-r"],
  ];
  for (const [name, r, code] of cases) {
    it(name, () => {
      expect(encodeShare(r)).toBe(code);
      expect(parseShare(code)).toEqual(r);
      expect(sharePath(r)).toBe(`/r/${code}`);
    });
  }

  it("самый длинный код укладывается в предел", () => {
    const code = encodeShare(exam({ kind: "topic", points: 100, max: 100, seed: 4294967295, topics: ["t01", "t02", "t03"] }))!;
    expect(code.length).toBeLessThanOrEqual(SHARE_CODE_MAX);
    expect(parseShare(code)).not.toBeNull();
  });
});

describe("код результата: мусор и границы", () => {
  const bad = [
    "",
    "x",
    "x1",
    "../etc",
    "x1-m-14-19-k-3051234567-A9ZQ",
    "x1-m-20-19-k-1-a9zq", // баллы больше максимума
    "x1-m-1-0-k-1-a9zq", // максимум 0
    "x1-m-1-101-k-1-a9zq", // максимум больше предела
    "x1-m-014-19-k-1-a9zq", // ведущий ноль: неканонично
    "x1-m-14-19-e-1-a9zq", // неизвестный язык
    "x1-u-14-19-k-1-a9zq", // контрольной не делятся
    "x1-m-14-19-k-4294967296-a9zq", // seed больше uint32
    "x1-m-14-19-k-1-a9z", // тег короче
    "x1-m-14-19-k-1-a9zq-04", // темы у мини
    "x1-t-7-10-k-1-a9zq", // тест по теме без тем
    "x1-t-7-10-k-1-a9zq-0404", // повтор темы
    "x1-t-7-10-k-1-a9zq-14", // нет такой темы
    "x1-t-7-10-k-1-a9zq-01020304", // больше трёх тем
    "x2-m-14-19-k-1-a9zq", // неизвестная версия
    "c1-5-4-r", // пройдено больше всего
    "c1-0-0-r",
    "c1-1-2-r-g4", // нет такого класса
    "c1-1-2-r-gother",
    "s1-0-0-r", // серия 0 — нечем делиться
    "s1-5-4-r", // рекорд меньше серии
    "s1-5-5-r-x",
    "l1-85-35-0-12", // нет языка
    "l1-85-35-0-12-r-x", // лишняя часть
    "l1-101-35-0-12-r", // точность больше 100
    "l1-085-35-0-12-r", // ведущий ноль: неканонично
    "l1-85-1000-0-12-r", // XP больше предела
    "l1-85-35-2-12-r", // «идеально» — только 0 или 1
    "l1-99-35-1-12-r", // «идеально» при точности меньше 100 — противоречие
    "l1-0-0-1-1-k",
    "l1-85-35-true-12-r",
    "l1-85-35-0-0-r", // уроков пройдено не меньше одного
    "l1-85-35-0-1000-r",
    "l1-85-35-0-12-e", // неизвестный язык
    "l2-85-35-0-12-r", // неизвестная версия
    "x1-m-14-19-k-3051234567-a9zq-",
    "x1--14-19-k-1-a9zq",
    "x1-m-14-19-k-1-a9zq".padEnd(80, "0"),
    "х1-m-14-19-k-1-a9zq", // кириллическая «х»
    "x1-m-1e1-19-k-1-a9zq",
  ];
  for (const code of bad) it(JSON.stringify(code), () => expect(parseShare(code)).toBeNull());

  it("не строка — null", () => {
    for (const v of [null, undefined, 5, {}, ["x1"]]) expect(parseShare(v)).toBeNull();
  });

  it("encodeShare не кодирует негодное", () => {
    expect(encodeShare(exam({ points: 20 }))).toBeNull();
    expect(encodeShare(exam({ pool: "ab" }))).toBeNull();
    expect(encodeShare(exam({ seed: -1 }))).toBeNull();
    expect(encodeShare(exam({ points: 1.5 }))).toBeNull();
    expect(encodeShare({ t: "streak", days: 3, best: 2, lang: "ru" })).toBeNull();
    expect(encodeShare({ t: "course", done: 1, total: 2, lang: "en" as never, grade: null })).toBeNull();
    const lesson = { t: "lesson", accuracy: 80, xp: 20, perfect: false, n: 3, lang: "ru" } as const;
    expect(encodeShare({ ...lesson, accuracy: 101 })).toBeNull();
    expect(encodeShare({ ...lesson, accuracy: 80.5 })).toBeNull();
    expect(encodeShare({ ...lesson, xp: -1 })).toBeNull();
    expect(encodeShare({ ...lesson, n: 0 })).toBeNull();
    expect(encodeShare({ ...lesson, perfect: 1 as never })).toBeNull();
    // «идеально» — только при точности 100
    expect(encodeShare({ ...lesson, accuracy: 99, perfect: true })).toBeNull();
    expect(encodeShare({ ...lesson, accuracy: 0, perfect: true })).toBeNull();
    expect(encodeShare({ ...lesson, accuracy: 100, perfect: true })).toBe("l1-100-20-1-3-r");
    // а точность 100 без «идеально» (была подсказка) — можно
    expect(encodeShare({ ...lesson, accuracy: 100, perfect: false })).toBe("l1-100-20-0-3-r");
  });

  it("урок: в коде только числа и метка языка — ни имени, ни названия", () => {
    const code = encodeShare({ t: "lesson", accuracy: 90, xp: 40, perfect: false, n: 7, lang: "kk" })!;
    expect(code).toMatch(/^l1(-\d+){4}-[rk]$/);
    expect(parseShare(code)).toEqual({ t: "lesson", accuracy: 90, xp: 40, perfect: false, n: 7, lang: "kk" });
  });
});

describe("процент курса", () => {
  it("как в шкале прогресса", () => {
    expect(sharePercent(37, 96)).toBe(39);
    expect(sharePercent(0, 12)).toBe(0);
    expect(sharePercent(12, 12)).toBe(100);
    expect(sharePercent(1, 0)).toBe(0);
  });
});
