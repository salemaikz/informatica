import { describe, expect, it } from "vitest";
import { LESSONS } from "@/content/course";
import { SCHOOL_PROGRAM, schoolPlan, type SchoolGradePlan } from "@/content/school-program";
import { dict } from "@/i18n/dict";
import {
  ENT_ONLY_PATHS,
  SCHOOL_GRADES,
  entVisible,
  gradeLessonIds,
  gradeProgress,
  missingGrades,
  nextSchoolLesson,
  sectionProgress,
  toSchoolGrade,
  topicProgress,
  validateSchoolProgram,
} from "@/lib/school";

const known = new Set(Object.keys(LESSONS));
const done = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, { completions: 1 }]));

describe("школьная программа: данные", () => {
  it("есть все классы 5–11 по порядку", () => {
    expect(missingGrades()).toEqual([]);
    expect(SCHOOL_PROGRAM.map((p) => p.grade)).toEqual(SCHOOL_GRADES);
  });

  it("id уникальны, названия двуязычные, все уроки существуют", () => {
    expect(validateSchoolProgram(SCHOOL_PROGRAM, known)).toEqual([]);
  });

  it("в каждом классе есть хотя бы одна тема с готовым уроком", () => {
    for (const plan of SCHOOL_PROGRAM) expect(gradeLessonIds(plan).length, plan.grade).toBeGreaterThan(0);
  });

  it("казахские названия не повторяют русские (нет забытых переводов)", () => {
    // IT Startup и подобные имена собственные допустимы: сравниваем только длинные названия.
    for (const plan of SCHOOL_PROGRAM)
      for (const s of plan.sections)
        for (const t of s.topics) if (t.title.ru.length > 20) expect(t.title.kk, t.id).not.toBe(t.title.ru);
  });

  it("в названиях нет эмодзи", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const plan of SCHOOL_PROGRAM)
      for (const s of plan.sections) {
        expect(emoji.test(s.title.ru + s.title.kk), s.id).toBe(false);
        for (const t of s.topics) expect(emoji.test(t.title.ru + t.title.kk), t.id).toBe(false);
      }
  });

  it("schoolPlan находит класс", () => {
    expect(schoolPlan("8")?.grade).toBe("8");
  });
});

describe("validateSchoolProgram", () => {
  const base: SchoolGradePlan[] = [
    {
      grade: "5",
      sections: [{ id: "s", title: { ru: "Р", kk: "Қ" }, topics: [{ id: "t", title: { ru: "Т", kk: "Т" }, lessonIds: ["a"] }] }],
    },
  ];

  it("ловит неизвестный урок, повтор id и пустой перевод", () => {
    const bad: SchoolGradePlan[] = [
      {
        grade: "5",
        sections: [
          { id: "s", title: { ru: "Р", kk: "" }, topics: [{ id: "t", title: { ru: "Т", kk: "Т" }, lessonIds: ["x", "x"] }] },
          { id: "s", title: { ru: "Р", kk: "Қ" }, topics: [] },
        ],
      },
    ];
    const problems = validateSchoolProgram(bad, new Set(["a"]));
    expect(problems.some((p) => p.includes("нет названия"))).toBe(true);
    expect(problems.some((p) => p.includes("повторяется"))).toBe(true);
    expect(problems.some((p) => p.includes("нет урока"))).toBe(true);
    expect(problems.some((p) => p.includes("дважды"))).toBe(true);
    expect(problems.some((p) => p.includes("нет тем"))).toBe(true);
  });

  it("корректные данные — без проблем", () => {
    expect(validateSchoolProgram(base, new Set(["a"]))).toEqual([]);
  });
});

describe("прогресс класса", () => {
  const plan: SchoolGradePlan = {
    grade: "7",
    sections: [
      {
        id: "s1",
        title: { ru: "А", kk: "А" },
        topics: [
          { id: "t1", title: { ru: "1", kk: "1" }, lessonIds: ["a", "b"] },
          { id: "t2", title: { ru: "2", kk: "2" }, lessonIds: [] },
          { id: "t3", title: { ru: "3", kk: "3" }, lessonIds: ["b"] },
        ],
      },
      { id: "s2", title: { ru: "Б", kk: "Б" }, topics: [{ id: "t4", title: { ru: "4", kk: "4" }, lessonIds: ["c"] }] },
    ],
  };

  it("тема: пройдено / следующий урок", () => {
    expect(topicProgress(plan.sections[0].topics[0], {})).toEqual({ total: 2, done: 0, ready: true, complete: false, nextLessonId: "a" });
    expect(topicProgress(plan.sections[0].topics[0], done("a"))).toMatchObject({ done: 1, complete: false, nextLessonId: "b" });
    expect(topicProgress(plan.sections[0].topics[0], done("a", "b"))).toMatchObject({ done: 2, complete: true, nextLessonId: null });
  });

  it("тема без уроков — «скоро»: не готова и не завершена", () => {
    expect(topicProgress(plan.sections[0].topics[1], done("a", "b", "c"))).toEqual({ total: 0, done: 0, ready: false, complete: false, nextLessonId: null });
  });

  it("completions = 0 не считается пройденным", () => {
    expect(topicProgress(plan.sections[1].topics[0], { c: { completions: 0 } }).done).toBe(0);
  });

  it("раздел и класс: темы и уникальные уроки", () => {
    expect(sectionProgress(plan.sections[0], done("a", "b"))).toEqual({ topics: 3, readyTopics: 2, doneTopics: 2 });
    const g = gradeProgress(plan, done("a", "b"));
    // уроки a, b, c — три уникальных (b привязан к двум темам и считается один раз)
    expect(g).toMatchObject({ topics: 4, readyTopics: 3, doneTopics: 2, lessonsTotal: 3, lessonsDone: 2 });
    expect(g.ratio).toBeCloseTo(2 / 3);
  });

  it("класс без готовых уроков: прогресс 0, без деления на ноль", () => {
    const empty: SchoolGradePlan = { grade: "5", sections: [{ id: "s", title: { ru: "А", kk: "А" }, topics: [{ id: "t", title: { ru: "1", kk: "1" }, lessonIds: [] }] }] };
    expect(gradeProgress(empty, {})).toMatchObject({ lessonsTotal: 0, lessonsDone: 0, ratio: 0 });
    expect(nextSchoolLesson(empty, {})).toBeNull();
  });

  it("следующий урок класса — первый непройденный по порядку программы", () => {
    expect(nextSchoolLesson(plan, {})).toEqual({ lessonId: "a", sectionId: "s1", topicId: "t1" });
    expect(nextSchoolLesson(plan, done("a"))).toEqual({ lessonId: "b", sectionId: "s1", topicId: "t1" });
    expect(nextSchoolLesson(plan, done("a", "b"))).toEqual({ lessonId: "c", sectionId: "s2", topicId: "t4" });
    expect(nextSchoolLesson(plan, done("a", "b", "c"))).toBeNull();
  });
});

describe("toSchoolGrade", () => {
  it("5–11 проходят, «другое» и мусор — null", () => {
    expect(toSchoolGrade("5")).toBe("5");
    expect(toSchoolGrade("11")).toBe("11");
    expect(toSchoolGrade("other")).toBeNull();
    expect(toSchoolGrade(undefined)).toBeNull();
    expect(toSchoolGrade("12" as never)).toBeNull();
  });
});

describe("entVisible — одна точка решения про ЕНТ-элементы (#52)", () => {
  it("трек ЕНТ — показываем, школьный трек — скрываем", () => {
    expect(entVisible({ track: "ent" })).toBe(true);
    expect(entVisible({ track: "school" })).toBe(false);
  });

  it("профиль без трека (старое сохранение, пустой объект, null) считается треком ЕНТ", () => {
    expect(entVisible({})).toBe(true);
    expect(entVisible(undefined)).toBe(true);
    expect(entVisible(null)).toBe(true);
  });

  it("ЕНТ-разделы: /exam и /plan", () => {
    expect([...ENT_ONLY_PATHS]).toEqual(["/exam", "/plan"]);
  });

  it("тексты карточки «Этот раздел — для подготовки к ҰБТ»: оба языка, в казахском — ҰБТ, а не ЕНТ", () => {
    for (const key of ["school.entOnly.title", "school.entOnly.text", "school.entOnly.switch", "school.entOnly.back"] as const) {
      expect(dict[key].ru.trim(), key).toBeTruthy();
      expect(dict[key].kk.trim(), key).toBeTruthy();
      expect(dict[key].kk, key).not.toMatch(/ЕНТ/);
    }
    expect(dict["school.entOnly.title"].kk).toContain("ҰБТ");
    expect(dict["school.entOnly.switch"].ru).toBe("Переключиться на ЕНТ");
    expect(dict["school.entOnly.back"].ru).toBe("К школьной программе");
  });
});
