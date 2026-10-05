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
    // Подпись курса идёт первой: «39% курса подготовки к ЕНТ», потом «37 из 96 уроков».
    expect(m.lines[0]).toBe("курса подготовки к ЕНТ");
    expect(m.lines[1]).toBe("37 из 96 уроков");
    expect(m.acceptHref).toBeNull();
    const c = landingModel({ t: "course", done: 3, total: 12, lang: "ru", grade: "8" }, "ru");
    expect(c.lines[0]).toBe("программы 8 класса");
    expect(landingModel({ t: "course", done: 3, total: 12, lang: "ru", grade: "8" }, "kk").lines[0]).toBe("8-сынып бағдарламасы");
  });
  it("серия: число, слово по числу, рекорд", () => {
    const m = landingModel({ t: "streak", days: 12, best: 30, lang: "ru" }, "ru");
    expect(m.big).toBe("12");
    expect(m.suffix).toBe("дней подряд");
    expect(m.lines[0]).toBe("Рекорд: 30");
    expect(m.acceptHref).toBeNull();
  });
  it("урок: точность в кольце, строки «Урок пройден» и «+XP · уроков пройдено», без ссылки на вариант", () => {
    const m = landingModel({ t: "lesson", accuracy: 85, xp: 35, perfect: false, n: 12, lang: "ru" }, "ru");
    expect(m.kind).toBe("lesson");
    expect(m.big).toBe("85%");
    expect(m.ratio).toBe(0.85);
    expect(m.lines).toEqual(["Урок пройден", "+35 XP · Пройдено уроков: 12"]);
    expect(m.acceptHref).toBeNull();
    const perfect = landingModel({ t: "lesson", accuracy: 100, xp: 48, perfect: true, n: 1, lang: "kk" }, "kk");
    expect(perfect.lines).toEqual(["Бірде-бір қатесіз!", "+48 XP · Өтілген сабақтар: 1"]);
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

// Глаголы прошедшего времени с родом (пол ученика неизвестен). `\b` с кириллицей не работает — границы слова через \p{L}.
const GENDERED = /(^|[^\p{L}])(прошёл|прошел|прошла|сделал|сделала|набрал|набрала|смог|смогла|решил|решила|освоил|освоила|выполнил|выполнила|справился|справилась)(?=$|[^\p{L}])/iu;

describe("тексты сообщения и превью", () => {
  it("проверка на глаголы с родом реально срабатывает", () => {
    for (const s of ["Ты прошёл тест", "Я набрала 14", "Прошла неделя? Нет: смогла!", "сделал"]) expect(s, s).toMatch(GENDERED);
    for (const s of ["прошёлся", "Сделали", "Пройдено 42%", "Ты сможешь так же?"]) expect(s, s).not.toMatch(GENDERED);
  });
  it("в ru-строках share.*, challenge.* и report.* нет глаголов с родом", () => {
    for (const key of Object.keys(dict).filter((k) => /^(share|challenge|report)\./.test(k))) {
      expect(dict[key as keyof typeof dict].ru, key).not.toMatch(GENDERED);
    }
  });
  const all: ShareResult[] = [
    exam(),
    exam({ lang: "kk", kind: "full", max: 50, points: 33 }),
    exam({ kind: "topic", topics: ["t04"], points: 2, max: 3 }),
    { t: "course", done: 5, total: 40, lang: "ru", grade: null },
    { t: "course", done: 5, total: 40, lang: "kk", grade: "9" },
    { t: "streak", days: 3, best: 3, lang: "ru" },
    { t: "streak", days: 21, best: 40, lang: "kk" },
    { t: "lesson", accuracy: 85, xp: 35, perfect: false, n: 12, lang: "ru" },
    { t: "lesson", accuracy: 100, xp: 48, perfect: true, n: 1, lang: "kk" },
  ];
  it("нет «официально», «прогноз», «Ұлттық» и глаголов с родом; нет незакрытых {подстановок}", () => {
    for (const r of all) {
      for (const text of [messageText(r), messageText(r, "challenge"), metaTexts(r).title, metaTexts(r).description]) {
        expect(text).not.toMatch(/\{\w+\}/);
        expect(text.toLowerCase()).not.toMatch(/официальн|прогноз|болжам|ресми/);
        expect(text).not.toMatch(GENDERED);
      }
    }
  });
  it("урок: сообщение и превью — только числа, без глаголов с родом; в ru-строках progress16c.share.* их тоже нет", () => {
    const lesson: ShareResult = { t: "lesson", accuracy: 85, xp: 35, perfect: false, n: 12, lang: "ru" };
    expect(messageText(lesson)).toBe("Урок в Informatica: точность 85%, +35 XP.");
    expect(messageText({ ...lesson, perfect: true, accuracy: 100 })).toBe("Урок в Informatica — без единой ошибки! +35 XP.");
    expect(metaTexts(lesson)).toEqual({ title: "Урок пройден на 85%", description: "+35 XP в Informatica. Занимайся вместе!" });
    expect(metaTexts({ ...lesson, perfect: true }).title).toBe("Урок без единой ошибки");
    expect(metaTexts({ ...lesson, lang: "kk" }).title).toBe("Сабақ 85% дәлдікпен өтілді");
    for (const key of Object.keys(dict).filter((k) => k.startsWith("progress16c."))) {
      expect(dict[key as keyof typeof dict].ru, key).not.toMatch(GENDERED);
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
    expect(m.footer).toBe("Дәл осы нұсқаны шешіп көр");
  });
  it("курс и серия: готовые строки", () => {
    const c = cardModelOf({ t: "course", done: 37, total: 96, lang: "ru", grade: null });
    expect(c).toMatchObject({ kind: "course", percent: 39, lessonsLabel: "37 из 96 уроков", subtitle: "курса подготовки к ЕНТ", lead: "Пройдено" });
    const s = cardModelOf({ t: "streak", days: 1, best: 4, lang: "ru" });
    expect(s).toMatchObject({ kind: "streak", days: 1, daysLabel: "день подряд", recordLabel: "Рекорд: 4" });
  });
  it("урок: карточка с точностью, XP, числом уроков и подписью «Мой урок»", () => {
    const m = cardModelOf({ t: "lesson", accuracy: 85, xp: 35, perfect: false, n: 12, lang: "ru" });
    expect(m).toMatchObject({ kind: "lesson", percent: 85, lead: "Урок пройден", xpLabel: "+35 XP", countLabel: "Пройдено уроков: 12", kicker: "Мой урок" });
    const p = cardModelOf({ t: "lesson", accuracy: 100, xp: 48, perfect: true, n: 3, lang: "kk" });
    expect(p).toMatchObject({ kind: "lesson", lead: "Бірде-бір қатесіз!", kicker: "Менің сабағым" });
    // на карточке нет ни имени ученика, ни названия урока: только числа и подписи из словаря
    expect(Object.keys(m).sort()).toEqual(["countLabel", "footer", "kicker", "kind", "lead", "percent", "siteHost", "siteName", "xpLabel"]);
  });
  it("у кода из ссылки тот же результат, что у карточки (round-trip через parseShare)", () => {
    const r = parseShare("x1-m-14-19-k-3051234567-a9zq");
    expect(r).not.toBeNull();
    expect(landingModel(r, "kk").suffix).toBe("19 ішінен");
  });
});
