import { describe, expect, it } from "vitest";
import { getLesson, LESSONS, UNITS } from "@/content/course";
import { buildIndex, lessonDocs, search, type SearchDoc, type SearchResult } from "@/lib/search";
import {
  adjacentLessons,
  blockContext,
  groupResults,
  highlightParts,
  highlightRanges,
  infoSteps,
  mergeResults,
  parseRecent,
  pushRecent,
  readableLessonIds,
  readingStats,
  relaxQuery,
  searchAll,
  searchHref,
} from "@/lib/theory";
import type { Lesson, Unit } from "@/lib/types";

const L = (s: string) => ({ ru: s, kk: s + " қаз" });

const lesson: Lesson = {
  id: "t-1",
  unitId: "u1",
  title: L("Урок"),
  description: L("Описание"),
  skills: [],
  durationMin: 5,
  conspect: L("Конспект урока из пяти слов"),
  steps: [
    { id: "s1", type: "story", body: L("Бит стоит у двери."), scene: { kind: "quest", art: "door" } },
    { id: "s2", type: "theory", title: L("Заголовок"), body: L("Это **важное** правило.") },
    { id: "s3", type: "worked", title: L("Разбор"), steps: [{ text: L("Первый шаг") }, { text: L("Второй шаг") }], result: L("Итог") },
    { id: "s4", type: "explore", title: L("Попробуй"), tool: "lamps", size: 4 },
    { id: "s5", type: "choice", prompt: L("Вопрос?"), options: ["a", "b"], correct: 0, explanation: L("Потому") },
  ],
};

describe("чтение урока", () => {
  it("информационные шаги — без заданий, в порядке урока", () => {
    expect(infoSteps(lesson).map((s) => s.id)).toEqual(["s1", "s2", "s3", "s4"]);
  });

  it("статистика: число карточек и минимум минута", () => {
    const st = readingStats(lesson, "ru");
    expect(st.cards).toBe(4);
    expect(st.minutes).toBe(1);
  });

  it("песочница и видео прибавляют время", () => {
    const long: Lesson = { ...lesson, steps: [...lesson.steps, { id: "v", type: "video", videoId: "x", title: L("Видео") }] };
    expect(readingStats(long, "ru").minutes).toBeGreaterThanOrEqual(readingStats(lesson, "ru").minutes);
    const words = Array.from({ length: 420 }, () => "слово").join(" ");
    const big: Lesson = { ...lesson, steps: [{ id: "t", type: "theory", title: L("T"), body: L(words) }] };
    expect(readingStats(big, "ru").minutes).toBe(4);
  });

  it("реальные уроки курса: у каждого есть блоки и время ≥ 1", () => {
    for (const l of Object.values(LESSONS)) {
      const st = readingStats(l, "ru");
      expect(st.minutes).toBeGreaterThanOrEqual(1);
      expect(st.cards).toBeGreaterThan(0);
    }
  });

  it("контекст для Бита: заголовок, текст без разметки, ключ шага", () => {
    const steps = infoSteps(lesson);
    const theory = blockContext(steps[1], lesson, "ru");
    expect(theory).toMatchObject({ prompt: "Заголовок", stepKey: "s2" });
    expect(theory.theory).toBe("Это важное правило.");
    // у ситуации без заголовка — название урока
    expect(blockContext(steps[0], lesson, "ru").prompt).toBe("Урок");
    const worked = blockContext(steps[2], lesson, "kk");
    expect(worked.theory).toContain("1. Первый шаг қаз");
    expect(worked.theory).toContain("Итог қаз");
  });
});

describe("соседние уроки", () => {
  const units: Unit[] = [
    { id: "u1", title: L("A"), description: L(""), color: "#000", lessons: [{ id: "a", title: L("a"), status: "available" }, { id: "b", title: L("b"), status: "soon" }] },
    { id: "u2", title: L("B"), description: L(""), color: "#000", lessons: [{ id: "c", title: L("c"), status: "available" }, { id: "d", title: L("d"), status: "available" }] },
  ];

  it("только готовые, в порядке курса", () => {
    expect(readableLessonIds(units)).toEqual(["a", "c", "d"]);
  });

  it("prev/next и края", () => {
    const order = readableLessonIds(units);
    expect(adjacentLessons(order, "c")).toEqual({ prev: "a", next: "d" });
    expect(adjacentLessons(order, "a")).toEqual({ prev: null, next: "c" });
    expect(adjacentLessons(order, "d")).toEqual({ prev: "c", next: null });
    expect(adjacentLessons(order, "zzz")).toEqual({ prev: null, next: null });
  });

  it("на реальном курсе порядок содержит только существующие уроки", () => {
    for (const id of readableLessonIds(UNITS)) expect(LESSONS[id]).toBeDefined();
  });
});

describe("группы результатов", () => {
  const doc = (id: string, kind: SearchDoc["kind"], title: string, text = ""): SearchDoc => ({ id, kind, title, text, href: `/${id}` });
  const index = buildIndex([
    doc("1", "skill", "Двоичная запись", "навык"),
    doc("2", "theory", "Двоичная система", "теория"),
    doc("3", "topic", "Двоичные числа", "тема"),
    doc("4", "lesson", "Двоичная система счисления", "урок"),
    doc("5", "note", "Моя заметка про двоичную", "я записал"),
    doc("6", "conspect", "Конспект", "двоичная система"),
  ]);

  it("порядок групп: уроки, теория, конспекты, мои конспекты, навыки и темы", () => {
    const groups = groupResults(search(index, "двоичн"));
    expect(groups.map((g) => g.group)).toEqual(["lesson", "theory", "conspect", "note", "skill"]);
    // темы ЕНТ — вместе с навыками
    expect(groups.find((g) => g.group === "skill")!.items.map((r) => r.doc.kind).sort()).toEqual(["skill", "topic"]);
  });

  it("пустые группы не показываются", () => {
    expect(groupResults(search(index, "теория")).map((g) => g.group)).toEqual(["theory"]);
    expect(groupResults([])).toEqual([]);
  });

  it("слияние двух индексов: по убыванию очков и с лимитом", () => {
    const mk = (id: string, score: number): SearchResult => ({ doc: doc(id, "note", id), score, snippet: { text: "", ranges: [] } });
    const merged = mergeResults([mk("a", 3), mk("b", 1)], [mk("c", 2)], 2);
    expect(merged.map((r) => r.doc.id)).toEqual(["a", "c"]);
  });
});

describe("подсветка", () => {
  it("режет текст по диапазонам", () => {
    expect(highlightParts("Двоичная система", [[0, 6]])).toEqual([
      { text: "Двоичн", mark: true },
      { text: "ая система", mark: false },
    ]);
  });

  it("без диапазонов — один кусок; границы и перекрытия безопасны", () => {
    expect(highlightParts("abc", [])).toEqual([{ text: "abc", mark: false }]);
    expect(highlightParts("abc", [[1, 2], [1, 3], [5, 9]])).toEqual([
      { text: "a", mark: false },
      { text: "b", mark: true },
      { text: "c", mark: true },
    ]);
    expect(highlightParts("", [])).toEqual([{ text: "", mark: false }]);
  });

  it("склейка кусков возвращает исходный текст", () => {
    const text = "SQL: SELECT * FROM t WHERE x > 5";
    const parts = highlightParts(text, highlightRanges(text, "select from"));
    expect(parts.map((p) => p.text).join("")).toBe(text);
    expect(parts.filter((p) => p.mark).map((p) => p.text)).toEqual(["SELECT", "FROM"]);
  });

  it("диапазоны в заголовке: префикс, регистр, ё, казахские буквы", () => {
    expect(highlightRanges("Двоичная система", "двоичн")).toEqual([[0, 6]]);
    expect(highlightRanges("Ёлка", "елк")).toEqual([[0, 3]]);
    // запрос без казахской раскладки находит казахское слово
    expect(highlightRanges("Қазақстан", "казак")).toEqual([[0, 5]]);
    expect(highlightRanges("abc", "x")).toEqual([]);
    expect(highlightRanges("abc", "")).toEqual([]);
  });
});

describe("недавние запросы", () => {
  it("новый — первым, без повторов и коротких, не больше лимита", () => {
    let list: string[] = [];
    list = pushRecent(list, "SQL");
    list = pushRecent(list, "  цикл   for ");
    list = pushRecent(list, "sql");
    expect(list).toEqual(["sql", "цикл for"]);
    expect(pushRecent(list, "a")).toEqual(list);
    let many: string[] = [];
    for (let i = 0; i < 10; i++) many = pushRecent(many, `запрос ${i}`);
    expect(many).toHaveLength(6);
    expect(many[0]).toBe("запрос 9");
  });

  it("разбор недоверенного JSON", () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent("не json")).toEqual([]);
    expect(parseRecent('{"a":1}')).toEqual([]);
    expect(parseRecent('["ok", 5, "", " x ", "двоичная"]')).toEqual(["ok", "двоичная"]);
  });

  it("сохранённый список с повторами и лишним — без повторов (иначе одинаковые key у чипов) и не длиннее лимита", () => {
    expect(parseRecent('["SQL", "sql", "  цикл   for ", "SQL"]')).toEqual(["SQL", "цикл for"]);
    expect(parseRecent(JSON.stringify(Array.from({ length: 20 }, (_, i) => `запрос ${i}`)))).toEqual(
      Array.from({ length: 6 }, (_, i) => `запрос ${i}`),
    );
  });

  it("адрес поиска экранирует запрос", () => {
    expect(searchHref("  ")).toBe("/search");
    expect(searchHref("a b&c")).toBe("/search?q=a%20b%26c");
  });
});

describe("мягкий запрос", () => {
  it("срезает окончания длинных кириллических слов и служебные слова", () => {
    expect(relaxQuery("перевод в двоичную")).toBe("перев двоич");
    expect(relaxQuery("биты и байты")).toBe("бит байт");
    // казахский: служебное «және» не обязательно, буквы «сложены» как в индексе
    expect(relaxQuery("бит және байт")).toBe("бит бай");
    expect(relaxQuery("ақиқат кестесі")).toBe("акик кесте");
  });

  it("латиница и числа не режутся; нечего смягчать — пустая строка", () => {
    expect(relaxQuery("SQL")).toBe("");
    expect(relaxQuery("1011")).toBe("");
    expect(relaxQuery("цикл for")).toBe("цик for");
    expect(relaxQuery("")).toBe("");
  });

  const doc = (id: string, title: string, text: string): SearchDoc => ({ id, kind: "theory", title, text, href: `/${id}` });
  const course = buildIndex([doc("a", "Двоичная система", "Перевести число в двоичную систему"), doc("b", "Биты", "Восемь битов — один байт")]);
  const notes = buildIndex([doc("n", "Моя запись", "двоичная запись числа")]);

  it("точный поиск находит — мягкий не нужен", () => {
    const r = searchAll([{ index: course, limit: 10 }], "двоичная", 10);
    expect(r.query).toBe("двоичная");
    expect(r.results.map((x) => x.doc.id)).toEqual(["a"]);
  });

  it("точный пуст — повтор с мягким запросом по всем индексам", () => {
    const r = searchAll(
      [
        { index: course, limit: 10 },
        { index: notes, limit: 10 },
      ],
      "двоичными",
      10,
    );
    expect(r.query).toBe("двоичн");
    expect(r.results.map((x) => x.doc.id).sort()).toEqual(["a", "n"]);
    expect(searchAll([{ index: course, limit: 10 }], "биты и байты", 10).results.map((x) => x.doc.id)).toEqual(["b"]);
    expect(searchAll([{ index: course, limit: 10 }], "абракадабра", 10).results).toEqual([]);
  });

  it("на готовых уроках курса естественный запрос находит теорию (ru и kk)", () => {
    const lessons = readableLessonIds(UNITS)
      .map((id) => getLesson(id))
      .filter((x): x is Lesson => !!x);
    for (const [lang, q] of [
      ["ru", "перевод в двоичную"],
      ["kk", "екілік жүйеге аудару"],
    ] as const) {
      const index = buildIndex(lessonDocs(lessons, UNITS, lang));
      expect(searchAll([{ index, limit: 50 }], q, 50).results.length).toBeGreaterThan(0);
    }
  });
});
