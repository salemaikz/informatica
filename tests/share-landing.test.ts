import { describe, expect, it } from "vitest";
import { challengeHref, landingModel } from "@/components/share/landing";
import { cardModelOf, daysWord, messageText, metaTexts, scoreText } from "@/components/share/labels";
import { decodeChallenge } from "@/lib/challenge";
import { parseRunParams } from "@/components/exam/logic";
import { parseShare, type ShareResult } from "@/lib/share-code";
import { dict } from "@/i18n/dict";

const exam = (over: Partial<Extract<ShareResult, { t: "exam" }>> = {}): Extract<ShareResult, { t: "exam" }> => ({
  t: "exam",
  kind: "mini",
  points: 14,
  max: 19,
  lang: "ru",
  seed: 3051234567,
  pool: "a9zq",
  topics: [],
  ...over,
});

describe("страница результата: метки по коду", () => {
  it("пробник ru: «14 из 19», вид, ссылка на тот же вариант с вызовом", () => {
    const m = landingModel(exam(), "ru");
    expect(m.kind).toBe("exam");
    expect(m.big).toBe("14");
    expect(m.suffix).toBe("из 19");
    expect(m.suffixFirst).toBe(false);
    expect(m.chip).toBe("Мини-ЕНТ");
    expect(m.eyebrow).toContain("Результат друга");
    expect(m.acceptHref).toBe("/exam/run?kind=mini&seed=3051234567&ch=14-19-a9zq");
  });
  it("пробник kk: «19 ішінен 14», подпись перед числом", () => {
    const m = landingModel(exam({ lang: "kk" }), "kk");
    expect(m.suffix).toBe("19 ішінен");
    expect(m.suffixFirst).toBe(true);
    expect(scoreText("kk", 14, 19)).toBe("19 ішінен 14");
    expect(scoreText("ru", 14, 19)).toBe("14 из 19");
  });
  it("тот же код на другом языке страницы — подписи другого языка, числа те же", () => {
    const r = exam({ lang: "kk" });
    expect(landingModel(r, "ru").suffix).toBe("из 19");
    expect(landingModel(r, "kk").suffix).toBe("19 ішінен");
  });
  it("курс: процент как sharePercent, строки «N из M уроков» и подпись курса/класса", () => {
    const m = landingModel({ t: "course", done: 37, total: 96, lang: "ru", grade: null }, "ru");
    expect(m.big).toBe("39%");
    expect(m.lines[0]).toBe("37 из 96 уроков");
    expect(m.lines[1]).toBe("курса подготовки к ЕНТ");
    expect(m.acceptHref).toBeNull();
    const c = landingModel({ t: "course", done: 3, total: 12, lang: "ru", grade: "8" }, "ru");
    expect(c.lines[1]).toBe("программы 8 класса");
    expect(landingModel({ t: "course", done: 3, total: 12, lang: "ru", grade: "8" }, "kk").lines[1]).toBe("8-сынып бағдарламасы");
  });
  it("серия: число, слово по числу, рекорд", () => {
    const m = landingModel({ t: "streak", days: 12, best: 30, lang: "ru" }, "ru");
    expect(m.big).toBe("12");
    expect(m.suffix).toBe("дней подряд");
    expect(m.lines[0]).toBe("Рекорд: 30");
    expect(m.acceptHref).toBeNull();
  });
  it("битый код — нейтральная карточка без числа и без «Пройти этот же вариант»", () => {
    const m = landingModel(null, "kk");
    expect(m.kind).toBe("invalid");
    expect(m.big).toBe("");
    expect(m.acceptHref).toBeNull();
    expect(m.eyebrow).toBe("Сілтеме ашылмады");
  });
  it("слово «дней» по числу", () => {
    const ru = [1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 111, 112].map((n) => daysWord("ru", n));
    expect(ru).toEqual(["день подряд", "дня подряд", "дня подряд", "дней подряд", "дней подряд", "дней подряд", "дней подряд", "день подряд", "дня подряд", "дней подряд", "дней подряд", "дней подряд"]);
    expect(daysWord("kk", 5)).toBe("күн қатарынан");
  });
});

describe("страница результата: ссылка вызова", () => {
  it("ведёт на тот же вариант: kind, seed, темы и ch разбираются обратно", () => {
    const r = exam({ kind: "topic", points: 7, max: 10, topics: ["t04", "t05"] });
    const href = challengeHref(r);
    const q = new URL(href, "https://x.test").searchParams;
    expect(href.startsWith("/exam/run?")).toBe(true);
    expect(q.get("kind")).toBe("topic");
    expect(q.get("seed")).toBe(String(r.seed));
    expect(q.get("topics")).toBe("t04,t05");
    expect(decodeChallenge(q.get("ch"))).toEqual({ s: 7, m: 10, pool: "a9zq" });
  });
  it("seed ≥ 2³¹ не ломается", () => {
    expect(challengeHref(exam({ seed: 4294967295 }))).toContain("seed=4294967295");
  });
  it("адрес разбирается страницей пробника: вид, вариант и темы совпадают", () => {
    const r = exam({ kind: "topic", points: 7, max: 10, topics: ["t04", "t13"] });
    const q = new URL(challengeHref(r), "https://x.test").searchParams;
    const p = parseRunParams(Object.fromEntries(q.entries()));
    expect(p).toMatchObject({ kind: "topic", seed: r.seed, topics: ["t04", "t13"] });
  });
});

describe("тексты сообщения и превью", () => {
  const all: ShareResult[] = [
    exam(),
    exam({ lang: "kk", kind: "full", max: 50, points: 33 }),
    exam({ kind: "topic", topics: ["t04"], points: 2, max: 3 }),
    { t: "course", done: 5, total: 40, lang: "ru", grade: null },
    { t: "course", done: 5, total: 40, lang: "kk", grade: "9" },
    { t: "streak", days: 3, best: 3, lang: "ru" },
    { t: "streak", days: 21, best: 40, lang: "kk" },
  ];
  it("нет «официально», «прогноз», «Ұлттық» и глаголов с родом; нет незакрытых {подстановок}", () => {
    for (const r of all) {
      for (const text of [messageText(r), messageText(r, "challenge"), metaTexts(r).title, metaTexts(r).description]) {
        expect(text).not.toMatch(/\{\w+\}/);
        expect(text.toLowerCase()).not.toMatch(/официальн|прогноз|болжам|ресми/);
        expect(text).not.toMatch(/\b(прошёл|прошла|сделал|сделала|набрал|набрала)\b/i);
      }
    }
  });
  it("вызов — текст из ТЗ, ссылки в тексте нет", () => {
    expect(messageText(exam(), "challenge")).toBe("У меня 14 из 19 в «Мини-ЕНТ». Пройди этот же вариант — сможешь больше?");
    expect(messageText(exam(), "challenge")).not.toContain("http");
  });
  it("заголовок превью — на языке из кода", () => {
    expect(metaTexts(exam()).title).toBe("Мини-ЕНТ: 14 из 19");
    expect(metaTexts(exam({ lang: "kk" })).title).toBe("Шағын ҰБТ: 19 ішінен 14");
  });
  it("в казахских строках нет русского «ЕНТ»", () => {
    for (const key of Object.keys(dict).filter((k) => k.startsWith("share."))) {
      const { kk } = dict[key as keyof typeof dict];
      expect(kk, key).not.toMatch(/(^|[^А-Яа-яЁё])ЕНТ([^А-Яа-яЁё]|$)/);
    }
  });
  it("у каждого ключа share.* есть ru и kk", () => {
    for (const key of Object.keys(dict).filter((k) => k.startsWith("share."))) {
      const v = dict[key as keyof typeof dict];
      expect(v.ru.trim().length, key).toBeGreaterThan(0);
      expect(v.kk.trim().length, key).toBeGreaterThan(0);
    }
  });
});

describe("карточка по результату", () => {
  it("пробник: сильные темы до 3, kk — подпись перед баллом, хост без протокола", () => {
    const topics = [
      { label: "А", points: 1, max: 4 },
      { label: "Б", points: 3, max: 3 },
      { label: "В", points: 2, max: 3 },
      { label: "Г", points: 4, max: 5 },
      { label: "Д", points: 5, max: 5 },
    ];
    const m = cardModelOf(exam({ lang: "kk" }), topics);
    expect(m.kind).toBe("exam");
    if (m.kind !== "exam") return;
    expect(m.topics.map((t) => t.label)).toEqual(["Д", "Б", "Г"]);
    expect(m.ofFirst).toBe(true);
    expect(m.ofLabel).toBe("19 ішінен");
    expect(m.siteHost).not.toMatch(/^https?:/);
    expect(m.footer).toBe("Дәл осы нұсқаны өтіп көр");
  });
  it("курс и серия: готовые строки", () => {
    const c = cardModelOf({ t: "course", done: 37, total: 96, lang: "ru", grade: null });
    expect(c).toMatchObject({ kind: "course", percent: 39, lessonsLabel: "37 из 96 уроков", subtitle: "курса подготовки к ЕНТ", lead: "Пройдено" });
    const s = cardModelOf({ t: "streak", days: 1, best: 4, lang: "ru" });
    expect(s).toMatchObject({ kind: "streak", days: 1, daysLabel: "день подряд", recordLabel: "Рекорд: 4" });
  });
  it("у кода из ссылки тот же результат, что у карточки (round-trip через parseShare)", () => {
    const r = parseShare("x1-m-14-19-k-3051234567-a9zq");
    expect(r).not.toBeNull();
    expect(landingModel(r, "kk").suffix).toBe("19 ішінен");
  });
});
