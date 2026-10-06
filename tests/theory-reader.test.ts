import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLesson, UNITS } from "@/content/course";
import { lessonDocs } from "@/lib/search";
import {
  cardIndexFromHash,
  cardIndexFromParam,
  clampCard,
  CONSPECT_ID,
  continueTarget,
  infoSteps,
  initialCard,
  lessonEntTopic,
  initialOpenUnit,
  lessonPlace,
  lessonReadStatus,
  liveCardParam,
  putTheoryRead,
  readableLessonIds,
  sanitizeTheoryLast,
  sanitizeTheoryMode,
  sanitizeTheoryRead,
  swipeDirection,
  theoryCardIds,
  THEORY_CARD_MAX,
  THEORY_READ_MAX,
  unitReadableIds,
  unitSummary,
  withoutCardAnchor,
} from "@/lib/theory";
import { CARD_PARAM, paramValue, theoryCardHref, theoryUnitHref, UNIT_PARAM } from "@/lib/theory-href";
import { mergeState, useApp } from "@/lib/store";
import { theory16cDict } from "@/i18n/parts/theory16c";
import { dict, type DictKey } from "@/i18n/dict";
import type { Lesson, Unit } from "@/lib/types";

// Теория 2.0 (этап 16В, P6): порядок и номера уроков раздела, карточки и якоря, «Продолжить чтение», сохранения, строки.

const L = (s: string) => ({ ru: s, kk: s + " қаз" });
const unit = (id: string, lessons: [string, "available" | "soon"][]): Unit => ({
  id,
  title: L(id),
  description: L(""),
  color: "#000",
  lessons: lessons.map(([lid, status]) => ({ id: lid, title: L(lid), status })),
});

// «Скоро» стоят вперемешку с готовыми: номера считаются только среди готовых.
const UNITS_X: Unit[] = [
  unit("u0", [["x1", "soon"], ["x2", "soon"]]),
  unit("u1", [["a", "available"], ["s", "soon"], ["b", "available"], ["c", "available"], ["a", "available"]]),
  unit("u2", [["d", "available"]]),
];

describe("уроки раздела: порядок и номера", () => {
  it("unitReadableIds: только готовые, по порядку курса, без повторов", () => {
    expect(unitReadableIds(UNITS_X[0])).toEqual([]);
    expect(unitReadableIds(UNITS_X[1])).toEqual(["a", "b", "c"]);
  });

  it("lessonPlace: раздел, номер среди готовых и их число", () => {
    expect(lessonPlace(UNITS_X, "b")).toMatchObject({ unitIndex: 1, number: 2, total: 3, ids: ["a", "b", "c"] });
    expect(lessonPlace(UNITS_X, "b")!.unit.id).toBe("u1");
    expect(lessonPlace(UNITS_X, "d")).toMatchObject({ unitIndex: 2, number: 1, total: 1 });
  });

  it("lessonPlace: «скоро», неизвестный и школьный урок — null", () => {
    expect(lessonPlace(UNITS_X, "s")).toBeNull();
    expect(lessonPlace(UNITS_X, "zzz")).toBeNull();
    expect(lessonPlace(UNITS_X, "constructor")).toBeNull();
  });

  it("на реальном курсе у каждого готового урока есть место: номера раздела идут 1…M без пропусков", () => {
    const ids = readableLessonIds(UNITS);
    expect(ids.length).toBeGreaterThan(50);
    for (const unitDef of UNITS) {
      const list = unitReadableIds(unitDef);
      list.forEach((id, i) => {
        const p = lessonPlace(UNITS, id);
        expect(p, id).not.toBeNull();
        expect([p!.unit.id, p!.number, p!.total]).toEqual([unitDef.id, i + 1, list.length]);
      });
    }
  });
});

describe("статус урока и сводка раздела", () => {
  it("пройден важнее прочитан, иначе не начат", () => {
    expect(lessonReadStatus({ done: true, read: true })).toBe("done");
    expect(lessonReadStatus({ done: true, read: false })).toBe("done");
    expect(lessonReadStatus({ done: false, read: true })).toBe("read");
    expect(lessonReadStatus({ done: false, read: false })).toBe("new");
  });

  it("«прочитано N из M»: пройденный урок считается прочитанным", () => {
    const done = new Set(["a"]);
    const read = new Set(["b"]);
    expect(unitSummary(["a", "b", "c"], (id) => done.has(id), (id) => read.has(id))).toEqual({ total: 3, read: 2, done: 1 });
    // и пройден, и прочитан — один раз
    expect(unitSummary(["a"], () => true, () => true)).toEqual({ total: 1, read: 1, done: 1 });
    expect(unitSummary([], () => true, () => true)).toEqual({ total: 0, read: 0, done: 0 });
  });

  it("какой раздел раскрыть: адрес важнее текущего урока; неизвестный адрес — раздел текущего урока; иначе никакой", () => {
    expect(initialOpenUnit(UNITS_X, "#u2", "a")).toBe("u2");
    expect(initialOpenUnit(UNITS_X, "u2", undefined)).toBe("u2");
    expect(initialOpenUnit(UNITS_X, "#nope", "b")).toBe("u1");
    expect(initialOpenUnit(UNITS_X, "", "d")).toBe("u2");
    expect(initialOpenUnit(UNITS_X, "", undefined)).toBeNull();
    expect(initialOpenUnit(UNITS_X, "", "zzz")).toBeNull();
  });

  it("раздел из параметра ?unit= важнее старого якоря #uN и текущего урока; неизвестный — пропускается", () => {
    expect(initialOpenUnit(UNITS_X, "", undefined, "u2")).toBe("u2");
    // при переходе внутри приложения хэш в первом рендере ещё старый — параметр его перебивает
    expect(initialOpenUnit(UNITS_X, "#u1", "a", "u2")).toBe("u2");
    expect(initialOpenUnit(UNITS_X, "", "a", "u2")).toBe("u2");
    // неизвестный раздел в параметре — как будто параметра нет
    expect(initialOpenUnit(UNITS_X, "#u2", "a", "nope")).toBe("u2");
    expect(initialOpenUnit(UNITS_X, "", "b", "nope")).toBe("u1");
    expect(initialOpenUnit(UNITS_X, "", undefined, "constructor")).toBeNull();
    expect(initialOpenUnit(UNITS_X, "", undefined, null)).toBeNull();
    expect(initialOpenUnit(UNITS_X, "", undefined, "")).toBeNull();
  });
});

describe("адреса теории: карточка и раздел параметрами", () => {
  it("theoryCardHref / theoryUnitHref: параметр, а не «#»", () => {
    expect(theoryCardHref("ns-1-bits", "s2")).toBe("/theory/ns-1-bits?card=s2");
    expect(theoryCardHref("ns-1-bits", "conspect")).toBe("/theory/ns-1-bits?card=conspect");
    expect(theoryCardHref("ns-1-bits")).toBe("/theory/ns-1-bits");
    expect(theoryCardHref("a", "x y&z")).toBe("/theory/a?card=x%20y%26z");
    expect(theoryUnitHref("u3")).toBe("/theory?unit=u3");
    expect([CARD_PARAM, UNIT_PARAM]).toEqual(["card", "unit"]);
  });

  it("paramValue: первое непустое значение; пусто и отсутствует — null", () => {
    expect(paramValue("s2")).toBe("s2");
    expect(paramValue(["s2", "s3"])).toBe("s2");
    for (const v of [undefined, null, "", [], [""]] as const) expect(paramValue(v), String(v)).toBeNull();
  });

  it("в исходниках не осталось ссылок на карточки и разделы теории через «#»", () => {
    const hits: string[] = [];
    for (const file of [...sources("src/components"), ...sources("src/app"), ...sources("src/lib")]) {
      const code = readFileSync(join(ROOT, file), "utf8");
      for (const m of code.matchAll(/\/theory[^"'`\s]*#/g)) hits.push(`${file}: ${m[0]}`);
    }
    // единственное исключение — пояснения в комментариях к старым ссылкам
    expect(hits.filter((h) => !/^src\/(lib\/theory|lib\/theory-href|components\/theory\/use)/.test(h))).toEqual([]);
  });
});

describe("тема ЕНТ урока для чата по теме", () => {
  const units: Unit[] = [{ ...unit("u1", [["a", "available"]]), entTopics: ["t04", "t03"] }, unit("u2", [["b", "available"]])];

  it("своя тема урока важнее; иначе первая тема раздела; иначе нет", () => {
    expect(lessonEntTopic({ unitId: "u1", entTopics: ["t08"] }, units)).toBe("t08");
    expect(lessonEntTopic({ unitId: "u1" }, units)).toBe("t04");
    expect(lessonEntTopic({ unitId: "u2" }, units)).toBeUndefined();
    expect(lessonEntTopic({ unitId: "school" }, units)).toBeUndefined();
  });

  it("у почти всех готовых уроков курса тема ЕНТ находится (без неё — чат просто без темы, например, у стратегии экзамена)", () => {
    const ids = readableLessonIds(UNITS);
    const withTopic = ids.filter((id) => lessonEntTopic(getLesson(id)!, UNITS) !== undefined);
    expect(withTopic.length / ids.length).toBeGreaterThan(0.9);
  });
});

const lesson: Lesson = {
  id: "t-1",
  unitId: "u1",
  title: L("Урок"),
  description: L("Описание"),
  skills: [],
  durationMin: 5,
  conspect: L("Конспект"),
  steps: [
    { id: "s1", type: "story", body: L("Бит стоит у двери."), scene: { kind: "quest", art: "door" } },
    { id: "s2", type: "theory", title: L("Заголовок"), body: L("Правило.") },
    { id: "q", type: "choice", prompt: L("Вопрос?"), options: ["a", "b"], correct: 0, explanation: L("Потому") },
    { id: "s3", type: "worked", title: L("Разбор"), steps: [{ text: L("Шаг") }], result: L("Итог") },
  ],
};

describe("карточки урока и якоря", () => {
  const ids = theoryCardIds(infoSteps(lesson));

  it("информационные шаги по порядку (без заданий) и конспект последним", () => {
    expect(ids).toEqual(["s1", "s2", "s3", CONSPECT_ID]);
  });

  it("якорь → номер карточки; чужой, пустой и битый — null", () => {
    expect(cardIndexFromHash("#s2", ids)).toBe(1);
    expect(cardIndexFromHash("s3", ids)).toBe(2);
    expect(cardIndexFromHash("#conspect", ids)).toBe(3);
    expect(cardIndexFromHash("#q", ids)).toBeNull(); // задание — не карточка теории
    expect(cardIndexFromHash("", ids)).toBeNull();
    expect(cardIndexFromHash("#", ids)).toBeNull();
    expect(cardIndexFromHash("#%E0%A4%A", ids)).toBeNull();
  });

  it("параметр ?card= → номер карточки; чужой, пустой и отсутствующий — null", () => {
    expect(cardIndexFromParam("s2", ids)).toBe(1);
    expect(cardIndexFromParam("conspect", ids)).toBe(3);
    expect(cardIndexFromParam("q", ids)).toBeNull();
    for (const v of ["", null, undefined, "constructor", "__proto__", "#s2"]) expect(cardIndexFromParam(v, ids), String(v)).toBeNull();
  });

  it("clampCard: в пределах, мусор — 0", () => {
    expect(clampCard(2, 4)).toBe(2);
    expect(clampCard(-3, 4)).toBe(0);
    expect(clampCard(99, 4)).toBe(3);
    expect(clampCard(1.9, 4)).toBe(1);
    expect(clampCard(NaN, 4)).toBe(0);
    expect(clampCard(Infinity, 4)).toBe(0);
    expect(clampCard(2, 0)).toBe(0);
  });

  it("с какой карточки открыть: якорь, затем где остановились, иначе первая", () => {
    const last = { id: "t-1", card: 2, at: 1 };
    expect(initialCard({ hash: "#s2", cardIds: ids, lessonId: "t-1", last })).toBe(1);
    expect(initialCard({ hash: "", cardIds: ids, lessonId: "t-1", last })).toBe(2);
    // другой урок — с начала
    expect(initialCard({ hash: "", cardIds: ids, lessonId: "t-2", last })).toBe(0);
    // конспект уже был открыт (урок дочитан) — перечитываем с начала
    expect(initialCard({ hash: "", cardIds: ids, lessonId: "t-1", last: { id: "t-1", card: 3, at: 1 } })).toBe(0);
    // сохранённая карточка за пределами урока (урок стал короче) — не дальше конспекта
    expect(initialCard({ hash: "", cardIds: ids, lessonId: "t-1", last: { id: "t-1", card: 50, at: 1 } })).toBe(0);
    expect(initialCard({ hash: "", cardIds: ids, lessonId: "t-1", last: null })).toBe(0);
  });

  it("T1: ?card= важнее хэша (в первом рендере после перехода внутри приложения хэш ещё старый), сохранённой карточки и первой", () => {
    const last = { id: "t-1", card: 1, at: 1 };
    // поиск → /theory/t-1?card=s3, а в адресной строке ещё «#s1» от прошлой страницы
    expect(initialCard({ card: "s3", hash: "#s1", cardIds: ids, lessonId: "t-1", last })).toBe(2);
    expect(initialCard({ card: "conspect", hash: "", cardIds: ids, lessonId: "t-1", last: null })).toBe(3);
    expect(initialCard({ card: "s2", hash: "", cardIds: ids, lessonId: "t-1", last })).toBe(1);
    // чужая или пустая карточка — как будто параметра нет: старая ссылка с «#», затем где остановились, затем первая
    expect(initialCard({ card: "zzz", hash: "#s3", cardIds: ids, lessonId: "t-1", last })).toBe(2);
    expect(initialCard({ card: "zzz", hash: "", cardIds: ids, lessonId: "t-1", last })).toBe(1);
    expect(initialCard({ card: null, hash: "", cardIds: ids, lessonId: "t-1", last: null })).toBe(0);
    // старые ссылки с «#<шаг>» при полной загрузке работают по-прежнему
    expect(initialCard({ hash: "#conspect", cardIds: ids, lessonId: "t-1", last })).toBe(3);
  });

  it("T1: «Назад» к записи, где ?card= уже убрали при листании, — параметр с сервера устарел, открываем где остановились", () => {
    const last = { id: "t-1", card: 4, at: 1 }; // долистали до s5 (индекс 4)
    const cards = ["s1", "s2", "s3", "s4", "s5", CONSPECT_ID];
    // переход по ссылке из поиска: сервер и адрес роутера — оба ?card=s3 → параметр действует
    expect(liveCardParam("s3", "s3")).toBe("s3");
    expect(initialCard({ card: liveCardParam("s3", "s3"), hash: "", cardIds: cards, lessonId: "t-1", last })).toBe(2);
    // «Назад»: пропсы прежние (s3), а в адресе параметра уже нет → theoryLast, а не карточка из поиска
    expect(liveCardParam("s3", null)).toBeNull();
    expect(initialCard({ card: liveCardParam("s3", null), hash: "", cardIds: cards, lessonId: "t-1", last })).toBe(4);
    // в адресе другая карточка (обе ссылки на один урок) — прежний параметр тоже не действует
    expect(liveCardParam("s3", "s5")).toBeNull();
    // параметра на сервере не было — его и нет (обычное открытие, старые ссылки с «#»)
    expect(liveCardParam(null, null)).toBeNull();
    expect(liveCardParam(undefined, undefined)).toBeNull();
    expect(liveCardParam("", "")).toBeNull();
    expect(liveCardParam(null, "s3")).toBeNull();
  });

  it("withoutCardAnchor: убирает ?card= и «#…», остальные параметры остаются; нечего убирать — null", () => {
    expect(withoutCardAnchor("/theory/t-1", "?card=s3", "")).toBe("/theory/t-1");
    expect(withoutCardAnchor("/theory/t-1", "?card=conspect&x=1", "")).toBe("/theory/t-1?x=1");
    expect(withoutCardAnchor("/theory/t-1", "", "#s3")).toBe("/theory/t-1");
    expect(withoutCardAnchor("/theory/t-1", "?x=1", "#s3")).toBe("/theory/t-1?x=1");
    expect(withoutCardAnchor("/theory/t-1", "?card=s3", "#s3")).toBe("/theory/t-1");
    expect(withoutCardAnchor("/theory/t-1", "", "")).toBeNull();
    expect(withoutCardAnchor("/theory/t-1", "?x=1", "")).toBeNull();
  });

  it("на реальном курсе ссылки поиска (`?card=<шаг>`, `?card=conspect`) попадают в карточки", () => {
    let checked = 0;
    for (const id of readableLessonIds(UNITS)) {
      const real = getLesson(id)!;
      const cards = theoryCardIds(infoSteps(real));
      expect(cards[cards.length - 1]).toBe(CONSPECT_ID);
      expect(new Set(cards).size, id).toBe(cards.length);
      for (const doc of lessonDocs([real], UNITS, "ru")) {
        if (doc.kind !== "theory" && doc.kind !== "conspect") continue;
        const url = new URL(doc.href, "http://localhost");
        expect(url.pathname, doc.href).toBe(`/theory/${id}`);
        expect(url.hash, doc.href).toBe("");
        const card = paramValue(url.searchParams.get(CARD_PARAM));
        expect(card, doc.href).toBeTruthy();
        expect(cardIndexFromParam(card, cards), doc.href).not.toBeNull();
        // и ведёт ровно на свою карточку: «конспект» — на последнюю, шаг — на шаг с таким id
        expect(cards[cardIndexFromParam(card, cards)!], doc.href).toBe(doc.kind === "conspect" ? CONSPECT_ID : card);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe("«Продолжить чтение»", () => {
  const order = ["a", "b", "c"];
  const cards: Record<string, number> = { a: 5, b: 8, c: 4 };
  const cardsOf = (id: string) => cards[id] ?? null;

  it("нет последнего — продолжать нечего", () => {
    expect(continueTarget(null, order, cardsOf)).toBeNull();
  });

  it("урок не дочитан — с той же карточки", () => {
    expect(continueTarget({ id: "b", card: 3, at: 1 }, order, cardsOf)).toEqual({ id: "b", card: 3, cards: 8, next: false });
    expect(continueTarget({ id: "b", card: 7, at: 1 }, order, cardsOf)).toEqual({ id: "b", card: 7, cards: 8, next: false });
  });

  it("дочитан до конспекта — следующий урок курса с начала", () => {
    expect(continueTarget({ id: "a", card: 5, at: 1 }, order, cardsOf)).toEqual({ id: "b", card: 0, cards: 8, next: true });
  });

  it("дочитан последний урок — остаётся он сам", () => {
    expect(continueTarget({ id: "c", card: 4, at: 1 }, order, cardsOf)).toEqual({ id: "c", card: 4, cards: 4, next: false });
  });

  it("неизвестный урок или урок вне порядка (школьный) — null", () => {
    expect(continueTarget({ id: "zzz", card: 1, at: 1 }, order, cardsOf)).toBeNull();
    expect(continueTarget({ id: "a", card: 1, at: 1 }, ["b"], cardsOf)).toBeNull();
  });
});

describe("свайп по карточке", () => {
  it("влево — дальше, вправо — назад", () => {
    expect(swipeDirection(-80, 5)).toBe("next");
    expect(swipeDirection(80, -5)).toBe("prev");
  });

  it("короткий жест, почти вертикальный жест и мусор — не листают", () => {
    expect(swipeDirection(-30, 0)).toBeNull();
    expect(swipeDirection(-80, 70)).toBeNull();
    expect(swipeDirection(80, 100)).toBeNull();
    expect(swipeDirection(NaN, 0)).toBeNull();
    expect(swipeDirection(60, Infinity)).toBeNull();
  });
});

describe("сохранения чтения: очистка недоверенных данных", () => {
  it("theoryLast: урок, карточка с нуля и время; мусор — null", () => {
    expect(sanitizeTheoryLast({ id: "ns-1-bits", card: 3, at: 5 })).toEqual({ id: "ns-1-bits", card: 3, at: 5 });
    expect(sanitizeTheoryLast({ id: "a", card: 3.9, at: 5 })).toEqual({ id: "a", card: 3, at: 5 });
    expect(sanitizeTheoryLast({ id: "a", card: -2, at: 5 })).toEqual({ id: "a", card: 0, at: 5 });
    expect(sanitizeTheoryLast({ id: "a", card: 999, at: 5 })).toEqual({ id: "a", card: THEORY_CARD_MAX, at: 5 });
    for (const bad of [null, undefined, 5, "x", [], {}, { id: "", card: 1, at: 1 }, { id: "a", card: NaN, at: 1 }, { id: "a", card: 1, at: -1 }, { id: "a", card: "1", at: 1 }, { id: "x".repeat(81), card: 1, at: 1 }]) {
      expect(sanitizeTheoryLast(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("theoryRead: только «строка → положительное время», самые свежие, не больше предела", () => {
    expect(sanitizeTheoryRead({ a: 5, b: "x", c: NaN, d: 0, e: -1, "": 4, f: Infinity })).toEqual({ a: 5 });
    for (const bad of [null, undefined, 5, "x", [], [1, 2]]) expect(sanitizeTheoryRead(bad)).toEqual({});
    const many: Record<string, number> = {};
    for (let i = 0; i < THEORY_READ_MAX + 30; i++) many[`l${i}`] = i + 1;
    const out = sanitizeTheoryRead(many);
    expect(Object.keys(out)).toHaveLength(THEORY_READ_MAX);
    expect(out[`l${THEORY_READ_MAX + 29}`]).toBe(THEORY_READ_MAX + 30);
    expect(out.l0).toBeUndefined();
  });

  it("putTheoryRead: добавляет, исходный объект не меняет", () => {
    const before = { a: 1 };
    expect(putTheoryRead(before, "b", 9)).toEqual({ a: 1, b: 9 });
    expect(before).toEqual({ a: 1 });
  });

  it("режим чтения: по умолчанию — по карточкам", () => {
    expect(sanitizeTheoryMode("all")).toBe("all");
    expect(sanitizeTheoryMode("cards")).toBe("cards");
    for (const bad of [undefined, null, "", "steps", 1, {}]) expect(sanitizeTheoryMode(bad)).toBe("cards");
  });
});

const st = () => useApp.getState();

describe("стор: чтение теории", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
    st().resetProgress();
  });
  afterEach(() => vi.useRealTimers());

  it("по умолчанию: ничего не читали, режим — по карточкам", () => {
    expect(st().theoryLast).toBeNull();
    expect(st().theoryRead).toEqual({});
    expect(st().theoryMode).toBe("cards");
  });

  it("noteTheoryOpen запоминает урок и карточку; повтор того же не пишет заново", () => {
    st().noteTheoryOpen("ns-1-bits", 2);
    expect(st().theoryLast).toEqual({ id: "ns-1-bits", card: 2, at: Date.now() });
    const first = st().theoryLast;
    vi.setSystemTime(Date.now() + 60_000);
    st().noteTheoryOpen("ns-1-bits", 2);
    expect(st().theoryLast).toBe(first);
    st().noteTheoryOpen("ns-1-bits", 3);
    expect(st().theoryLast).toMatchObject({ card: 3 });
    st().noteTheoryOpen("ns-2-read", 0);
    expect(st().theoryLast).toMatchObject({ id: "ns-2-read", card: 0 });
  });

  it("noteTheoryOpen: мусорная карточка обрезается, пустой id игнорируется; платы и прогресс уроков не трогает", () => {
    st().noteTheoryOpen("a", -5);
    expect(st().theoryLast).toMatchObject({ card: 0 });
    st().noteTheoryOpen("a", 10_000);
    expect(st().theoryLast).toMatchObject({ card: THEORY_CARD_MAX });
    st().noteTheoryOpen("", 1);
    expect(st().theoryLast).toMatchObject({ id: "a" });
    expect(st().theoryPaid).toEqual({});
    expect(st().lessons).toEqual({});
  });

  it("markTheoryRead: отмечает один раз", () => {
    st().markTheoryRead("ns-1-bits");
    expect(st().theoryRead).toEqual({ "ns-1-bits": Date.now() });
    const at = st().theoryRead["ns-1-bits"];
    vi.setSystemTime(Date.now() + 60_000);
    st().markTheoryRead("ns-1-bits");
    expect(st().theoryRead["ns-1-bits"]).toBe(at);
    st().markTheoryRead("");
    st().markTheoryRead("x".repeat(81));
    expect(Object.keys(st().theoryRead)).toEqual(["ns-1-bits"]);
  });

  it("setTheoryMode запоминает выбор", () => {
    st().setTheoryMode("all");
    expect(st().theoryMode).toBe("all");
    st().setTheoryMode("cards");
    expect(st().theoryMode).toBe("cards");
  });

  it("загрузка сохранения: мусор вычищается, у старых сохранений — значения по умолчанию", () => {
    const old = mergeState({}, st());
    expect([old.theoryLast, old.theoryRead, old.theoryMode]).toEqual([null, {}, "cards"]);
    const m = mergeState({ theoryLast: { id: "a", card: 2, at: 7 }, theoryRead: { a: 7, b: "x" }, theoryMode: "all" }, st());
    expect(m.theoryLast).toEqual({ id: "a", card: 2, at: 7 });
    expect(m.theoryRead).toEqual({ a: 7 });
    expect(m.theoryMode).toBe("all");
    const junk = mergeState({ theoryLast: "мусор", theoryRead: [1], theoryMode: 5 } as never, st());
    expect([junk.theoryLast, junk.theoryRead, junk.theoryMode]).toEqual([null, {}, "cards"]);
  });
});

// ---------- Строки ----------

const ROOT = join(import.meta.dirname, "..");

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) return name === "parts" ? [] : sources(rel);
    return /\.tsx?$/.test(name) ? [rel] : [];
  });
}

describe("строки theory16c.*", () => {
  const keys = Object.keys(theory16cDict) as DictKey[];
  const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it("ключи есть, у каждого непустые ru и kk, плейсхолдеры одинаковые", () => {
    expect(keys.length).toBeGreaterThan(30);
    for (const k of keys) {
      expect(k.startsWith("theory16c."), k).toBe(true);
      expect(dict[k].ru.trim().length, k).toBeGreaterThan(0);
      expect(dict[k].kk.trim().length, k).toBeGreaterThan(0);
      expect(ph(dict[k].kk), k).toEqual(ph(dict[k].ru));
    }
  });

  it("числа (цена) — только плейсхолдером; без эмодзи и глаголов с родом", () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const k of keys) {
      for (const lang of ["ru", "kk"] as const) {
        const text = dict[k][lang];
        expect(text.replace(/\{\w+\}/g, ""), `${k} ${lang}`).not.toMatch(/\d/);
        expect(text, `${k} ${lang}`).not.toMatch(emoji);
      }
      expect(dict[k].ru, k).not.toMatch(/\b(?:сделал|сделала|прочитал|прочитала|начал|начала|оплатил|оплатила)\b/i);
      // ЕНТ по-казахски — ҰБТ
      expect(dict[k].kk, k).not.toMatch(/ЕНТ/);
    }
  });

  it("каждый ключ используется в коде, а каждый использованный — определён", () => {
    const used = new Set<string>();
    for (const file of [...sources("src/components"), ...sources("src/app"), ...sources("src/lib")]) {
      for (const m of readFileSync(join(ROOT, file), "utf8").matchAll(/"(theory16c\.[a-zA-Z0-9_.]+)"/g)) used.add(m[1]);
    }
    expect([...used].filter((k) => !(k in theory16cDict))).toEqual([]);
    expect(keys.filter((k) => !used.has(k))).toEqual([]);
  });

  it("в старых ключах theory.* не осталось неиспользуемых", () => {
    const code = [...sources("src/components"), ...sources("src/app"), ...sources("src/lib")].map((f) => readFileSync(join(ROOT, f), "utf8")).join("\n");
    const dead = (Object.keys(dict) as string[]).filter((k) => k.startsWith("theory.") && !code.includes(`"${k}"`));
    expect(dead).toEqual([]);
  });
});
