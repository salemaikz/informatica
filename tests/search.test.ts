import { describe, expect, it } from "vitest";
import { LESSONS, UNITS } from "@/content/course";
import { SKILLS } from "@/content/skills";
import { ENT_TOPICS } from "@/content/ent-topics";
import { buildIndex, fold, lessonDocs, noteDocs, normalize, queryTokens, search, skillDocs, topicDocs, type SearchDoc } from "@/lib/search";

const doc = (id: string, title: string, text: string, kind: SearchDoc["kind"] = "theory"): SearchDoc => ({ id, kind, title, text, href: `/x/${id}` });

describe("normalize / fold", () => {
  it("нижний регистр, ё → е, markdown-символы, пробелы", () => {
    expect(normalize("  **Ёлка**  \n# Заголовок >`код`_ ")).toBe("елка заголовок код");
  });
  it("казахские буквы остаются как есть", () => {
    expect(normalize("Қазақстан Ұлттық ӘҢГІМЕ")).toBe("қазақстан ұлттық әңгіме");
  });
  it("мягкие пары казахских букв", () => {
    expect(fold("іүұқғңөәһ")).toBe("иуукгноах");
    expect(fold("Қазақстан")).toBe("казакстан");
    expect(fold("Ақпарат ұғымы")).toBe("акпарат угымы");
  });
});

describe("search", () => {
  const index = buildIndex([
    doc("a", "Двоичная система", "В двоичной системе только цифры 0 и 1."),
    doc("b", "Восьмеричная система", "Группируем двоичные цифры по три."),
    doc("c", "Алгоритмы", "Ветвление и циклы. Ёлка из звёздочек.", "skill"),
    doc("d", "Қазақша тақырып", "Екілік санау жүйесі: ақпаратты өлшеу."),
  ]);

  it("пустой запрос и односимвольные токены ничего не находят", () => {
    expect(search(index, "")).toEqual([]);
    expect(search(index, "   ")).toEqual([]);
    expect(search(index, "д")).toEqual([]);
    expect(queryTokens("а двоичн б")).toEqual(["двоичн"]);
  });

  it("регистр не важен, поиск по префиксу", () => {
    const ids = search(index, "ДВОИЧ").map((r) => r.doc.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).not.toContain("c");
  });

  it("ё и е считаются одной буквой", () => {
    expect(search(index, "елка").map((r) => r.doc.id)).toEqual(["c"]);
    expect(search(index, "ёлка").map((r) => r.doc.id)).toEqual(["c"]);
    expect(search(index, "звезд").map((r) => r.doc.id)).toEqual(["c"]);
  });

  it("казахские буквы и мягкие пары (без казахской раскладки)", () => {
    expect(search(index, "жүйесі").map((r) => r.doc.id)).toEqual(["d"]);
    expect(search(index, "жуйеси").map((r) => r.doc.id)).toEqual(["d"]);
    expect(search(index, "акпарат").map((r) => r.doc.id)).toEqual(["d"]);
    expect(search(index, "ақпаратты").map((r) => r.doc.id)).toEqual(["d"]);
    expect(search(index, "екилик").map((r) => r.doc.id)).toEqual(["d"]);
    expect(search(index, "олшеу").map((r) => r.doc.id)).toEqual(["d"]);
  });

  it("AND: все токены должны встретиться", () => {
    expect(search(index, "двоичн цифр").map((r) => r.doc.id).sort()).toEqual(["a", "b"]);
    expect(search(index, "двоичн ветвление")).toEqual([]);
    expect(search(index, "системе цифры").map((r) => r.doc.id)).toEqual(["a"]);
  });

  it("заголовок весит ×3: совпадение в заголовке выше, чем в тексте", () => {
    const idx = buildIndex([
      doc("text", "Что-то другое", "Тут говорится про байт и биты."),
      doc("title", "Байт", "Единица информации."),
    ]);
    const res = search(idx, "байт");
    expect(res.map((r) => r.doc.id)).toEqual(["title", "text"]);
    expect(res[0].score).toBeGreaterThanOrEqual(res[1].score * 3);
  });

  it("точное слово выше префикса", () => {
    const idx = buildIndex([doc("pre", "Тема", "Байтовая запись."), doc("exact", "Тема", "Один байт.")]);
    expect(search(idx, "байт").map((r) => r.doc.id)).toEqual(["exact", "pre"]);
  });

  it("вид документа: lesson > theory > conspect > note > skill при равном совпадении", () => {
    const kinds: SearchDoc["kind"][] = ["skill", "note", "conspect", "theory", "lesson"];
    const idx = buildIndex(kinds.map((k) => doc(k, "Тема", "Слово байт здесь.", k)));
    expect(search(idx, "байт").map((r) => r.doc.kind)).toEqual(["lesson", "theory", "conspect", "note", "skill"]);
  });

  it("limit", () => {
    const idx = buildIndex(Array.from({ length: 10 }, (_, i) => doc(`d${i}`, "Байт", "байт")));
    expect(search(idx, "байт", 3)).toHaveLength(3);
    expect(search(idx, "байт")).toHaveLength(10);
  });

  it("цифры и двоичные числа находятся", () => {
    const idx = buildIndex([doc("n", "Запись", "Число 1011₂ равно 11.")]);
    expect(search(idx, "1011").map((r) => r.doc.id)).toEqual(["n"]);
  });
});

describe("сниппет", () => {
  const long = "слово ".repeat(40) + "Ключевой термин встречается здесь, " + "хвост ".repeat(40);

  it("±60 символов вокруг первого совпадения, диапазоны указывают на подсвечиваемый текст", () => {
    const idx = buildIndex([doc("a", "Заголовок", long)]);
    const [res] = search(idx, "ключев");
    const { text, ranges } = res.snippet;
    expect(text.length).toBeLessThanOrEqual(60 + 6 + 60 + 2 + 2 + 20);
    expect(text.startsWith("…")).toBe(true);
    expect(text.endsWith("…")).toBe(true);
    expect(ranges).toHaveLength(1);
    const [s, e] = ranges[0];
    expect(text.slice(s, e)).toBe("Ключев");
  });

  it("подсвечиваются все токены, диапазоны не пересекаются", () => {
    const idx = buildIndex([doc("a", "Тема", "Двоичная система счисления использует двоичные цифры.")]);
    const [res] = search(idx, "двоичн цифр");
    const { text, ranges } = res.snippet;
    expect(ranges.map(([s, e]) => text.slice(s, e))).toEqual(["Двоичн", "двоичн", "цифр"]);
    for (let i = 1; i < ranges.length; i++) expect(ranges[i][0]).toBeGreaterThanOrEqual(ranges[i - 1][1]);
  });

  it("короткий текст — без многоточий; markdown убран, регистр сохранён", () => {
    const idx = buildIndex([doc("a", "Тема", "**Байт** — это `8` бит.")]);
    const [res] = search(idx, "байт");
    expect(res.snippet.text).toBe("Байт — это 8 бит.");
    expect(res.snippet.ranges).toEqual([[0, 4]]);
  });

  it("мягкое совпадение подсвечивает исходные буквы", () => {
    const idx = buildIndex([doc("a", "Тема", "Екілік санау жүйесі.")]);
    const [res] = search(idx, "жуйеси");
    const [s, e] = res.snippet.ranges[0];
    expect(res.snippet.text.slice(s, e)).toBe("жүйесі");
  });

  it("совпадение только в заголовке — начало текста без подсветки", () => {
    const idx = buildIndex([doc("a", "Байт", "Единица информации.")]);
    const [res] = search(idx, "байт");
    expect(res.snippet.text).toBe("Единица информации.");
    expect(res.snippet.ranges).toEqual([]);
  });
});

describe("документы курса", () => {
  const lessons = Object.values(LESSONS);

  it("lessonDocs: урок + теория/разбор/ситуация + конспект, ссылки и id уникальны", () => {
    for (const lang of ["ru", "kk"] as const) {
      const docs = lessonDocs(lessons, UNITS, lang);
      expect(new Set(docs.map((d) => d.id)).size).toBe(docs.length);
      for (const l of lessons) {
        expect(docs.some((d) => d.kind === "lesson" && d.lessonId === l.id && d.href === `/lesson/${l.id}`)).toBe(true);
        expect(docs.some((d) => d.kind === "conspect" && d.href === `/theory/${l.id}#conspect`)).toBe(true);
      }
      for (const d of docs.filter((x) => x.kind === "theory")) {
        expect(d.href).toMatch(/^\/theory\/[^#]+#.+/);
        expect(d.title).toBeTruthy();
      }
    }
  });

  it("поиск по реальному курсу находит двоичную систему на обоих языках", () => {
    const ru = buildIndex(lessonDocs(lessons, UNITS, "ru"));
    expect(search(ru, "двоичн").length).toBeGreaterThan(0);
    const kk = buildIndex(lessonDocs(lessons, UNITS, "kk"));
    expect(search(kk, "екілік").length).toBeGreaterThan(0);
    expect(search(kk, "екилик").length).toBeGreaterThan(0);
  });

  it("навыки, темы ЕНТ и записи ученика попадают в индекс", () => {
    const docs = [
      ...skillDocs(SKILLS, "ru"),
      ...topicDocs(ENT_TOPICS, "ru"),
      ...noteDocs([{ id: "n1", title: "Мой конспект", body: "# Шпаргалка\nпро **регистры**", lessonId: "x" }]),
    ];
    expect(docs.filter((d) => d.kind === "skill")).toHaveLength(SKILLS.length);
    expect(docs.filter((d) => d.kind === "topic")).toHaveLength(ENT_TOPICS.length);
    const idx = buildIndex(docs);
    const res = search(idx, "шпаргалк");
    expect(res.map((r) => r.doc.id)).toEqual(["note:n1"]);
    expect(res[0].doc.href).toBe("/notes/n1");
  });

  it("производительность: 50 уроков × 15 шагов — поиск быстрее 10 мс", () => {
    const docs: SearchDoc[] = [];
    for (let l = 0; l < 50; l++) {
      for (let s = 0; s < 17; s++) {
        const text = Array.from({ length: 60 }, (_, i) => `слово${(l * 31 + s * 7 + i) % 400} данные${i % 13}`).join(" ");
        docs.push(doc(`${l}:${s}`, `Урок ${l} шаг ${s}`, text));
      }
    }
    const idx = buildIndex(docs);
    search(idx, "слово1 данные"); // прогрев
    const t = performance.now();
    for (let i = 0; i < 20; i++) search(idx, "слово1 данные2");
    expect((performance.now() - t) / 20).toBeLessThan(10);
  });
});
