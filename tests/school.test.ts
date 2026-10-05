import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LESSONS, UNITS } from "@/content/course";
import { SCHOOL_PROGRAM, schoolPlan, type SchoolGradePlan } from "@/content/school-program";
import { SKILLS } from "@/content/skills";
import { dict } from "@/i18n/dict";
import { isPassed, nodeState, recommendedLesson, topicLessons, topicMastery, topicSkillIds, unitProgress } from "@/components/learn/map";
import type { LessonStat } from "@/lib/review";
import {
  ENT_ONLY_PATHS,
  SCHOOL_GRADES,
  entVisible,
  gradeLessonIds,
  gradeProgress,
  isLessonDone,
  isPassedStat,
  missingGrades,
  nextSchoolLesson,
  sectionProgress,
  toSchoolGrade,
  topicProgress,
  validateSchoolProgram,
} from "@/lib/school";
import { useApp } from "@/lib/store";
import type { AnswerRecord, SessionResult } from "@/lib/types";

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

  it("ЕНТ-разделы: /exam, /plan, прохождение пробного /exam/run и входная диагностика", () => {
    expect([...ENT_ONLY_PATHS]).toEqual(["/exam", "/plan", "/exam/run", "/diagnostic"]);
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

describe("общий прогресс школы и ЕНТ (v0.9.1)", () => {
  const NOW = 1_800_000_000_000;
  const DAY = 86_400_000;
  const BITS = "ns-1-bits";
  /** Статистика урока после одного прохождения. */
  const stat = (over: Partial<LessonStat> = {}): LessonStat => ({ completions: 1, bestAccuracy: 1, lastAt: NOW, totalXp: 10, dueAt: NOW + DAY, ...over });
  const mapRef = (id: string) => UNITS.flatMap((u) => u.lessons.map((ref) => ({ unit: u, ref }))).find((x) => x.ref.id === id);
  const schoolTopics = SCHOOL_PROGRAM.flatMap((p) => p.sections.flatMap((s) => s.topics.map((t) => ({ grade: p.grade, topic: t }))));
  const allSchoolLessons = [...new Set(SCHOOL_PROGRAM.flatMap(gradeLessonIds))];
  const rec = (over: Partial<AnswerRecord> = {}): AnswerRecord => ({
    stepId: "q1",
    skill: "ns.base",
    correct: true,
    score: 1,
    given: "1",
    expected: "1",
    prompt: "?",
    retry: false,
    timeMs: 1000,
    ...over,
  });
  const session = (lessonId: string): SessionResult => ({ kind: "lesson", lessonId, title: "t", answers: [rec()], xp: 10, maxCombo: 1, durationSec: 60, accuracy: 1 });

  beforeEach(() => useApp.getState().resetProgress());
  afterEach(() => useApp.getState().resetProgress());

  it("каждый урок школьной программы есть на карте курса ЕНТ как готовый — иначе пройденный в школе урок не отметился бы на «Пути»", () => {
    expect(allSchoolLessons.length).toBeGreaterThan(0);
    for (const id of allSchoolLessons) expect(mapRef(id)?.ref.status, id).toBe("available");
  });

  it("«пройден» — одно определение: школьные функции и карта курса согласны, мусор в сохранении не считается прохождением", () => {
    for (const completions of [0, -1, Number.NaN]) {
      const lessons = { [BITS]: stat({ completions }) };
      const { unit, ref } = mapRef(BITS)!;
      expect(isPassedStat(lessons[BITS]), String(completions)).toBe(false);
      expect(isLessonDone(BITS, lessons), String(completions)).toBe(false);
      expect(unitProgress(unit, lessons).done, String(completions)).toBe(0);
      expect(isPassed(nodeState(ref, lessons[BITS], undefined, NOW)), String(completions)).toBe(false);
    }
    expect(isPassedStat(undefined)).toBe(false);
    for (const completions of [1, 2, 7]) expect(isPassedStat(stat({ completions }))).toBe(true);
  });

  it("любой урок школьной программы, пройденный в одном режиме, пройден в обоих (школьные функции и карта ЕНТ)", () => {
    for (const id of allSchoolLessons) {
      const lessons = { [id]: stat() };
      const { unit, ref } = mapRef(id)!;
      // карта ЕНТ («Путь»): узел пройден, раздел насчитал один урок
      expect(isPassed(nodeState(ref, lessons[id], undefined, NOW)), id).toBe(true);
      expect(unitProgress(unit, lessons).done, id).toBe(1);
      expect(recommendedLesson([unit], lessons)?.ref.id, id).not.toBe(id);
      // школьная карта: каждая тема с этим уроком насчитала его, класс — тоже
      for (const { grade, topic } of schoolTopics.filter((x) => x.topic.lessonIds.includes(id))) {
        expect(topicProgress(topic, lessons).done, `${grade}/${topic.id}/${id}`).toBe(1);
        expect(gradeProgress(schoolPlan(grade)!, lessons).lessonsDone, `${grade}/${id}`).toBe(1);
      }
    }
  });

  it("урок про биты есть и в школьной программе (6 и 10 классы), и в курсе ЕНТ (раздел «Информация и системы счисления», тема t04)", () => {
    const grades = schoolTopics.filter((x) => x.topic.lessonIds.includes(BITS)).map((x) => `${x.grade}/${x.topic.id}`);
    expect(grades).toEqual(expect.arrayContaining(["6/g6-3-3", "10/g10-2-1"]));
    expect(mapRef(BITS)?.unit.id).toBe("u1");
    expect(topicLessons("t04", UNITS, LESSONS, SKILLS).map((x) => x.ref.id)).toContain(BITS);
  });

  it("пройден в школьном режиме → пройден и на карте ЕНТ: стор → школьная карта и «Путь»", () => {
    useApp.getState().updateProfile({ track: "school", grade: "6" });
    const { unit, ref } = mapRef(BITS)!;
    const topic = schoolTopics.find((x) => x.topic.id === "g6-3-3")!.topic;
    const plan = schoolPlan("6")!;
    const before = useApp.getState().lessons;
    expect(isLessonDone(BITS, before)).toBe(false);
    expect(isPassed(nodeState(ref, before[BITS], undefined, Date.now()))).toBe(false);

    useApp.getState().finishSession(session(BITS));

    const { lessons } = useApp.getState();
    // школьная карта
    expect(isLessonDone(BITS, lessons)).toBe(true);
    expect(topicProgress(topic, lessons)).toMatchObject({ total: 4, done: 1, complete: false });
    expect(gradeProgress(plan, lessons).lessonsDone).toBe(1);
    expect(nextSchoolLesson(plan, lessons)?.lessonId).not.toBe(BITS);
    // карта ЕНТ: «Путь» (узел и раздел) и «Рекомендуем»
    expect(isPassed(nodeState(ref, lessons[BITS], undefined, Date.now()))).toBe(true);
    expect(unitProgress(unit, lessons).done).toBe(1);
    expect(recommendedLesson(UNITS, lessons)?.ref.id).not.toBe(BITS);
  });

  it("пройден в режиме ЕНТ → пройден и в школьной программе (6 и 10 классы); смена режима ничего не стирает", () => {
    useApp.getState().updateProfile({ track: "ent" });
    useApp.getState().finishSession(session(BITS));
    const snapshot = useApp.getState().lessons;
    useApp.getState().updateProfile({ track: "school", grade: "10" });
    expect(useApp.getState().lessons).toBe(snapshot);
    const lessons = useApp.getState().lessons;
    expect(topicProgress(schoolTopics.find((x) => x.topic.id === "g10-2-1")!.topic, lessons)).toMatchObject({ total: 6, done: 1 });
    expect(gradeProgress(schoolPlan("10")!, lessons).lessonsDone).toBe(1);
    expect(gradeProgress(schoolPlan("6")!, lessons).lessonsDone).toBe(1);
    useApp.getState().updateProfile({ track: "ent" });
    expect(useApp.getState().lessons).toBe(snapshot);
  });

  it("тема школьной программы целиком пройдена → все её уроки пройдены на «Пути»", () => {
    const topic = schoolTopics.find((x) => x.topic.id === "g6-3-3")!.topic;
    useApp.getState().completeLessons(topic.lessonIds, "extern", 1);
    const { lessons } = useApp.getState();
    expect(topicProgress(topic, lessons)).toMatchObject({ total: 4, done: 4, complete: true, nextLessonId: null });
    for (const id of topic.lessonIds) expect(isPassed(nodeState(mapRef(id)!.ref, lessons[id], undefined, Date.now())), id).toBe(true);
  });

  it("освоение навыков общее: ответы в школьном режиме видны на карте ЕНТ; смена режима не трогает навыки", () => {
    const ent = SKILLS.find((s) => s.id === "ns.base")!.ent!;
    expect(ent).toBe("t04");
    const level = () => topicMastery(topicSkillIds(ent, SKILLS), useApp.getState().skills).level;
    expect(level()).toBe("none");
    useApp.getState().updateProfile({ track: "school" });
    useApp.getState().recordAnswer(rec(), 5, BITS);
    const skills = useApp.getState().skills;
    expect(skills["ns.base"]?.attempts).toBe(1);
    expect(level()).not.toBe("none");
    for (const track of ["ent", "school", "ent"] as const) {
      useApp.getState().updateProfile({ track });
      expect(useApp.getState().skills).toBe(skills);
      expect(level()).not.toBe("none");
    }
  });

  it("строка про общий прогресс: оба языка, в казахском — ҰБТ, а не ЕНТ", () => {
    const d = dict["school.progress.shared"];
    expect(d.ru.trim()).toBeTruthy();
    expect(d.kk.trim()).toBeTruthy();
    expect(d.ru).toContain("обоих режимах");
    expect(d.kk).toContain("ҰБТ");
    expect(d.kk).not.toMatch(/ЕНТ/);
  });
});
