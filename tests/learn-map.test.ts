import { describe, expect, it } from "vitest";
import type { Lesson, Skill, Unit } from "@/lib/types";
import type { LessonStat } from "@/lib/review";
import { DAY_MS } from "@/lib/review";
import { UNITS, LESSONS } from "@/content/course";
import { SKILLS } from "@/content/skills";
import { ENT_TOPICS, topicTaskShare } from "@/content/ent-topics";
import { fillGrid, tileSpan, type TileSpan } from "@/components/learn/ent-grid";
import {
  averageMastery,
  bestPercent,
  canExtern,
  completionsBadge,
  isDarkColor,
  isDue,
  lessonTopics,
  nodeLessonRefs,
  nodeState,
  pathItemNodeId,
  pathLayout,
  pathPassed,
  pluralForm,
  practiceNodeState,
  recommendedLesson,
  reviewInDays,
  segmentDone,
  topicLessons,
  topicMastery,
  topicSkillIds,
  unitPathItems,
  unitProgress,
  unitSkillIds,
  xpKind,
  type PathItem,
} from "@/components/learn/map";
import type { CourseGroup } from "@/content/groups";
import { practiceNodeId, recapNodeId, unitGroups } from "@/content/groups";
import { skillsOfLessons } from "@/lib/drill";
import type { CourseNodeStat } from "@/lib/course-nodes";

const NOW = 1_800_000_000_000;
const stat = (p: Partial<LessonStat> = {}): LessonStat => ({ completions: 1, bestAccuracy: 0.9, lastAt: NOW - DAY_MS, totalXp: 20, ...p });

const unit = (id: string, lessons: [string, "available" | "soon"][], entTopics?: Unit["entTopics"]): Unit => ({
  id,
  title: { ru: id, kk: id },
  description: { ru: "", kk: "" },
  color: "#000",
  entTopics,
  lessons: lessons.map(([lid, status]) => ({ id: lid, title: { ru: lid, kk: lid }, status })),
});

const skill = (id: string, ent?: Skill["ent"]): Skill => ({ id, ent, title: { ru: id, kk: id }, topic: { ru: "", kk: "" } });

describe("рекомендуемый урок и состояния узлов", () => {
  const units = [unit("a", [["a1", "available"], ["a2", "available"], ["a3", "soon"]]), unit("b", [["b1", "available"]])];

  it("первый непройденный готовый урок по порядку", () => {
    expect(recommendedLesson(units, {})?.ref.id).toBe("a1");
    expect(recommendedLesson(units, { a1: stat() })?.ref.id).toBe("a2");
    // Свободный режим: пройден дальний урок — рекомендация всё равно первая непройденная.
    expect(recommendedLesson(units, { b1: stat() })?.ref.id).toBe("a1");
    expect(recommendedLesson(units, { a1: stat(), a2: stat(), b1: stat() })).toBeUndefined();
  });

  it("запись без прохождений (completions 0) не считается пройденной — как и в nodeState", () => {
    expect(recommendedLesson(units, { a1: stat({ completions: 0 }) })?.ref.id).toBe("a1");
    expect(nodeState(units[0].lessons[0], stat({ completions: 0 }), "a1", NOW)).toBe("recommended");
  });

  it("состояния: скоро, пройден, пора повторить, рекомендуемый, доступен", () => {
    const [a1, a2, a3] = units[0].lessons;
    expect(nodeState(a3, undefined, "a1", NOW)).toBe("soon");
    expect(nodeState(a1, undefined, "a1", NOW)).toBe("recommended");
    expect(nodeState(a2, undefined, "a1", NOW)).toBe("available");
    expect(nodeState(a1, stat({ dueAt: NOW + DAY_MS }), "a2", NOW)).toBe("done");
    expect(nodeState(a1, stat({ dueAt: NOW - 1 }), "a2", NOW)).toBe("due");
  });

  it("isDue: старое сохранение без расписания — через день после прохождения", () => {
    expect(isDue(stat({ lastAt: NOW - 2 * DAY_MS, dueAt: undefined }), NOW)).toBe(true);
    expect(isDue(stat({ lastAt: NOW - 1000, dueAt: undefined }), NOW)).toBe(false);
    expect(isDue(undefined, NOW)).toBe(false);
    expect(isDue(stat({ completions: 0, dueAt: NOW - 1 }), NOW)).toBe(false);
  });

  it("мусорные completions (0, −1, NaN) нигде на карте не считаются прохождением — то же определение, что у школьной карты", () => {
    for (const completions of [0, -1, Number.NaN]) {
      const stats = { a1: stat({ completions, dueAt: NOW - 1 }) };
      expect(recommendedLesson(units, stats)?.ref.id, String(completions)).toBe("a1");
      expect(nodeState(units[0].lessons[0], stats.a1, "a1", NOW), String(completions)).toBe("recommended");
      expect(isDue(stats.a1, NOW), String(completions)).toBe(false);
      expect(unitProgress(units[0], stats).done, String(completions)).toBe(0);
      // a1 не пройден, a2 пройден: экстерн по a1 всё ещё имеет смысл
      expect(canExtern(units[0], { a1: stats.a1, a2: stat() }), String(completions)).toBe(true);
    }
  });

  it("прогресс раздела и экстерн", () => {
    expect(unitProgress(units[0], { a1: stat() })).toEqual({ done: 1, ready: 2, total: 3 });
    expect(canExtern(units[0], { a1: stat() })).toBe(true);
    expect(canExtern(units[0], { a1: stat(), a2: stat() })).toBe(false);
    expect(canExtern(unit("c", [["c1", "soon"]]), {})).toBe(false);
  });
});

describe("освоение", () => {
  const s = (mastery: number, attempts = 3) => ({ attempts, correct: 1, mastery, lastSeen: 0 });
  /** Навык, «освоенный» по правилу #67: 4 верных без подсказки в 2 разных днях. */
  const solid = (mastery: number) => ({ ...s(mastery, 6), clean: 4, okDays: 2 });

  it("среднее по навыкам: не тронутые — 0", () => {
    expect(averageMastery(["x", "y"], { x: s(0.8) })).toBe(0.4);
    expect(averageMastery([], {})).toBe(0);
    expect(averageMastery(["x"], { x: s(0.9, 0) })).toBe(0);
  });

  it("уровень темы: нет данных, слабо, в процессе, освоено", () => {
    expect(topicMastery(["x", "y"], {}).level).toBe("none");
    expect(topicMastery(["x", "y"], { x: s(0.4) }).level).toBe("weak");
    // Один хорошо освоенный навык из двух — ещё «в процессе», а не «освоено».
    expect(topicMastery(["x", "y"], { x: s(0.9) })).toEqual({ value: 0.45, level: "progress" });
    expect(topicMastery(["x", "y"], { x: solid(0.9), y: solid(0.85) }).level).toBe("mastered");
  });

  it("тема «освоена» только по правилу #67: высокая оценка за один присест — ещё «в процессе» (C15)", () => {
    // Три верных ответа подряд дают оценку 0.85, но не 4 верных в 2 разных днях.
    expect(topicMastery(["x", "y"], { x: { ...s(0.85, 3), clean: 3, okDays: 1 }, y: { ...s(0.85, 3), clean: 3, okDays: 1 } }).level).toBe("progress");
    // Один навык темы не дотянул до правила — вся тема «в процессе».
    expect(topicMastery(["x", "y"], { x: solid(0.9), y: { ...s(0.85, 3), clean: 3, okDays: 1 } }).level).toBe("progress");
    expect(topicMastery(["x", "y"], { x: solid(0.9), y: solid(0.85) }).value).toBeGreaterThanOrEqual(0.8);
  });

  it("навыки раздела: навыки уроков + навыки тем ЕНТ раздела", () => {
    const u = unit("u", [["l1", "available"]], ["t04"]);
    const lessons = { l1: { skills: ["own.skill"] } as unknown as Lesson };
    const ids = unitSkillIds(u, lessons, [skill("ns.a", "t04"), skill("logic.b", "t05")]);
    expect(ids.sort()).toEqual(["ns.a", "own.skill"]);
  });
});

describe("темы ЕНТ уроков", () => {
  const skills = [skill("py.loops", "t06"), skill("py.strings", "t07"), skill("sheets.formulas", "t12"), skill("web.html", "t13"), skill("db.model", "t09")];
  const u = unit("u", [], ["t12", "t13"]);

  it("готовый урок — по entTopics или навыкам", () => {
    const ref = { id: "x-1-y", title: { ru: "", kk: "" }, status: "available" as const };
    expect(lessonTopics(ref, u, { skills: ["py.loops"], entTopics: ["t05"] } as unknown as Lesson, skills)).toEqual(["t05"]);
    expect(lessonTopics(ref, u, { skills: ["py.loops", "py.strings"] } as unknown as Lesson, skills)).toEqual(["t06", "t07"]);
  });

  it("урок «скоро» — по навыку, угаданному из id, иначе темы раздела", () => {
    const soon = (id: string) => ({ id, title: { ru: "", kk: "" }, status: "soon" as const });
    expect(lessonTopics(soon("py-3-loops"), u, undefined, skills)).toEqual(["t06"]);
    expect(lessonTopics(soon("data-1-sheets"), u, undefined, skills)).toEqual(["t12"]);
    expect(lessonTopics(soon("db-1-relational"), u, undefined, skills)).toEqual(["t09"]);
    expect(lessonTopics(soon("zzz-1-qq"), u, undefined, skills)).toEqual(["t12", "t13"]);
  });

  it("на реальном курсе у каждой темы ЕНТ есть уроки и навыки", () => {
    for (const t of ENT_TOPICS) {
      expect(topicLessons(t.id, UNITS, LESSONS, SKILLS).length, t.id).toBeGreaterThan(0);
      expect(topicSkillIds(t.id, SKILLS).length, t.id).toBeGreaterThan(0);
    }
  });
});

describe("повторение и XP", () => {
  it("через сколько дней повторить", () => {
    expect(reviewInDays(undefined, NOW)).toBeNull();
    expect(reviewInDays(stat({ dueAt: NOW + 2.5 * DAY_MS }), NOW)).toBe(3);
    expect(reviewInDays(stat({ dueAt: NOW - DAY_MS }), NOW)).toBe(0);
  });

  it("подпись XP: первый раз, по плану, повтор", () => {
    expect(xpKind(undefined, NOW)).toBe("first");
    expect(xpKind(stat({ dueAt: NOW - 1 }), NOW)).toBe("review");
    expect(xpKind(stat({ dueAt: NOW + DAY_MS }), NOW)).toBe("second");
    expect(xpKind(stat({ completions: 3, dueAt: NOW + DAY_MS }), NOW)).toBe("later");
  });

  it("русские числительные", () => {
    expect([1, 2, 4, 5, 11, 12, 21, 22, 25, 111].map(pluralForm)).toEqual(["one", "few", "few", "many", "many", "many", "one", "few", "many", "many"]);
  });
});

describe("раскладка дороги", () => {
  it("узлы змейкой, никогда не по центру; подпись — со стороны центра", () => {
    const { nodes, height } = pathLayout(7, 0, { step: 100, amp: 80, top: 50, bottom: 40 });
    expect(nodes.map((n) => n.x)).toEqual([40, 80, 40, -40, -80, -40, 40]);
    expect(nodes.every((n) => (n.x > 0 ? n.label === "left" : n.label === "right"))).toBe(true);
    expect(nodes[3].y).toBe(350);
    expect(height).toBe(50 + 600 + 40);
  });

  it("дорога: вход сверху, участки между узлами, выход снизу", () => {
    const { segments } = pathLayout(3);
    expect(segments.map((s) => [s.from, s.to])).toEqual([[-1, 0], [0, 1], [1, 2], [2, -1]]);
    expect(segments[0].d.startsWith("M0 0C")).toBe(true);
    expect(pathLayout(0).segments).toEqual([]);
    expect(pathLayout(1).segments.map((s) => [s.from, s.to])).toEqual([[-1, 0], [0, -1]]);
  });

  it("пройденный участок — когда пройдены оба конца", () => {
    const { segments } = pathLayout(3);
    const passed = [true, true, false];
    expect(segments.map((s) => segmentDone(s, passed))).toEqual([true, true, false, false]);
  });
});

describe("недоверенные данные и цвета", () => {
  it("бейдж повторов: только от 2, целый, с потолком", () => {
    expect(completionsBadge(1)).toBeNull();
    expect(completionsBadge(Number.NaN)).toBeNull();
    expect(completionsBadge(2)).toBe("×2");
    expect(completionsBadge(3.7)).toBe("×3");
    expect(completionsBadge(1e9)).toBe("×99+");
  });

  it("лучший результат: 0..100, мусор — 0", () => {
    expect(bestPercent(0.9)).toBe(90);
    expect(bestPercent(undefined)).toBe(0);
    expect(bestPercent(Number.NaN)).toBe(0);
    expect(bestPercent(5)).toBe(100);
    expect(bestPercent(-1)).toBe(0);
  });

  it("тёмные цвета разделов осветляются на тёмной теме, остальные — нет", () => {
    expect(isDarkColor("#334155")).toBe(true);
    expect(isDarkColor("#1a91d6")).toBe(false);
    expect(isDarkColor("#64748b")).toBe(false);
    expect(isDarkColor("oops")).toBe(false);
    // На реальном курсе тёмный только последний раздел (ЕНТ).
    expect(UNITS.filter((u) => isDarkColor(u.color)).map((u) => u.id)).toEqual(["u9"]);
  });
});

describe("Карта ЕНТ: размеры плиток и сетка без дыр (#43)", () => {
  const one: TileSpan = { cols: 1, rows: 1 };
  const area = (s: TileSpan) => s.cols * s.rows;
  // Как в EntMap: плитки тем по весу + итоговая плитка 1×1 в конце. Колонки: 2 на телефоне, 3 от 640px.
  const spans = [...ENT_TOPICS.map((t) => tileSpan(topicTaskShare(t.id))), one];

  it("размер плитки по заданиям темы: ≥ 5 — на всю ширину, ≥ 4 — двойной высоты", () => {
    expect(tileSpan(5.5)).toEqual({ cols: 2, rows: 1 });
    expect(tileSpan(5)).toEqual({ cols: 2, rows: 1 });
    expect(tileSpan(4)).toEqual({ cols: 1, rows: 2 });
    expect(tileSpan(3)).toEqual(one);
    expect(tileSpan(1)).toEqual(one);
  });

  it("Python и алгоритмы (3 + 2,5 контекстных) — на всю ширину, темы из 4 заданий — высокие, остальные 1×1", () => {
    const by = Object.fromEntries(ENT_TOPICS.map((t) => [t.id, tileSpan(topicTaskShare(t.id))]));
    expect(by.t06).toEqual({ cols: 2, rows: 1 });
    expect(by.t07).toEqual({ cols: 2, rows: 1 });
    expect(by.t03).toEqual({ cols: 1, rows: 2 });
    expect(by.t12).toEqual({ cols: 1, rows: 2 });
    for (const id of ["t01", "t02", "t04", "t05", "t08", "t09", "t10", "t11", "t13"]) expect(by[id], id).toEqual(one);
  });

  it("плитка не меньше плитки более лёгкой темы", () => {
    for (const a of ENT_TOPICS) for (const b of ENT_TOPICS) {
      if (topicTaskShare(a.id) >= topicTaskShare(b.id)) {
        expect(area(tileSpan(topicTaskShare(a.id))), `${a.id} против ${b.id}`).toBeGreaterThanOrEqual(area(tileSpan(topicTaskShare(b.id))));
      }
    }
  });

  it("сетка на телефоне (2 колонки): без дыр", () => {
    expect(fillGrid(spans, 2)).toEqual({ rows: 9, holes: 0 });
  });

  it("сетка от 640px (3 колонки): без дыр", () => {
    expect(fillGrid(spans, 3)).toEqual({ rows: 6, holes: 0 });
  });

  it("fillGrid видит дыры и заполняет их по правилам dense", () => {
    expect(fillGrid([one, one, one], 2)).toEqual({ rows: 2, holes: 1 });
    expect(fillGrid([one, { cols: 2, rows: 1 }, one], 2)).toEqual({ rows: 2, holes: 0 }); // третья плитка заполняет дыру (dense)
    expect(fillGrid([{ cols: 2, rows: 1 }, { cols: 1, rows: 2 }], 3)).toEqual({ rows: 2, holes: 2 });
    expect(fillGrid([], 3)).toEqual({ rows: 0, holes: 0 });
  });
});

describe("узлы курса 3.0 на дороге раздела (#81)", () => {
  const grp = (lessons: string[], index: number, last: boolean): CourseGroup => ({
    id: `g:${lessons[0]}`,
    unitId: "z",
    index,
    last,
    title: { ru: lessons[0], kk: lessons[0] },
    lessons,
  });
  const ready = (ref: { status: string }) => ref.status === "available";
  const kinds = (items: PathItem[]) => items.map((i) => (i.kind === "lesson" ? i.ref.id : i.kind === "practice" ? `P(${i.group.lessons[0]})` : `R(${i.unitId})`));

  it("практика — после каждой не последней группы, повторение — в конце раздела", () => {
    const u = unit("z", [["a1", "available"], ["a2", "available"], ["a3", "available"], ["a4", "available"], ["a5", "available"]]);
    const groups = [grp(["a1", "a2"], 0, false), grp(["a3", "a4"], 1, false), grp(["a5"], 2, true)];
    expect(kinds(unitPathItems(u, { groups, trainable: ready }))).toEqual(["a1", "a2", "P(a1)", "a3", "a4", "P(a3)", "a5", "R(z)"]);
  });

  it("группа без готового урока с банком узла практики не получает; нет таких уроков вообще — нет и повторения", () => {
    const u = unit("z", [["a1", "available"], ["a2", "soon"], ["a3", "soon"], ["a4", "available"]]);
    const groups = [grp(["a1"], 0, false), grp(["a2", "a3"], 1, false), grp(["a4"], 2, true)];
    expect(kinds(unitPathItems(u, { groups, trainable: ready }))).toEqual(["a1", "P(a1)", "a2", "a3", "a4", "R(z)"]);
    // «Готов» ≠ «можно тренировать»: урок без банка не считается.
    expect(kinds(unitPathItems(u, { groups, trainable: (r) => r.id === "a4" }))).toEqual(["a1", "a2", "a3", "a4", "R(z)"]);
    const none = unit("z", [["a1", "soon"], ["a2", "soon"]]);
    expect(kinds(unitPathItems(none, { groups: [grp(["a1"], 0, false), grp(["a2"], 1, true)], trainable: ready }))).toEqual(["a1", "a2"]);
    expect(unitPathItems(unit("z", []), { groups: [], trainable: ready })).toEqual([]);
  });

  it("раздел из одной группы — только повторение; уроки вне групп остаются на дороге", () => {
    const one = unit("z", [["a1", "available"], ["a2", "available"]]);
    expect(kinds(unitPathItems(one, { groups: [grp(["a1", "a2"], 0, true)], trainable: ready }))).toEqual(["a1", "a2", "R(z)"]);
    const loose = unit("z", [["a1", "available"], ["a2", "available"], ["a3", "available"]]);
    expect(kinds(unitPathItems(loose, { groups: [grp(["a1"], 0, false), grp(["a3"], 1, true)], trainable: ready }))).toEqual(["a1", "P(a1)", "a2", "a3", "R(z)"]);
  });

  it("реальный курс: уроки идут в порядке карты, узлы — по правилам групп", () => {
    for (const u of UNITS) {
      const items = unitPathItems(u);
      expect(items.filter((i): i is Extract<PathItem, { kind: "lesson" }> => i.kind === "lesson").map((i) => i.ref.id), u.id).toEqual(u.lessons.map((r) => r.id));
      const groups = unitGroups(u);
      const trainable = (id: string) => skillsOfLessons([id]).length > 0 && u.lessons.find((r) => r.id === id)?.status === "available";
      const wantPractice = groups.filter((g) => !g.last && g.lessons.some(trainable)).map((g) => practiceNodeId(g));
      const gotPractice = items.filter((i) => i.kind === "practice").map((i) => pathItemNodeId(i));
      expect(gotPractice, u.id).toEqual(wantPractice);
      expect(items.some((i) => i.kind === "recap"), u.id).toBe(u.lessons.some((r) => trainable(r.id)));
      if (items.some((i) => i.kind === "recap")) expect(items[items.length - 1].kind).toBe("recap");
      // «Практика» стоит сразу после последнего урока своей группы.
      items.forEach((it, i) => {
        if (it.kind !== "practice") return;
        const prev = items[i - 1];
        expect(prev.kind === "lesson" && prev.ref.id).toBe(it.group.lessons[it.group.lessons.length - 1]);
      });
    }
  });

  it("на карте Python узел «Практика» стоит после группы «Ветвления»", () => {
    const py = UNITS.find((u) => u.id === "u3")!;
    const items = unitPathItems(py);
    const at = items.findIndex((i) => i.kind === "practice" && i.group.title.ru === "Ветвления");
    expect(at).toBeGreaterThan(0);
    const before = items[at - 1];
    expect(before.kind === "lesson" && before.ref.id).toBe("py-2b-logic");
  });

  it("id узлов и их уроки", () => {
    const g = grp(["a1", "a2"], 0, false);
    const u = unit("z", [["a0", "available"], ["a1", "available"], ["a2", "soon"]]);
    const practice: PathItem = { kind: "practice", group: g };
    const recap: PathItem = { kind: "recap", unitId: "z" };
    expect(pathItemNodeId(practice)).toBe(practiceNodeId(g));
    expect(pathItemNodeId(recap)).toBe(recapNodeId("z"));
    expect(pathItemNodeId({ kind: "lesson", ref: u.lessons[0] })).toBeUndefined();
    expect(nodeLessonRefs(practice, u).map((r) => r.id)).toEqual(["a1", "a2"]);
    expect(nodeLessonRefs(recap, u).map((r) => r.id)).toEqual(["a0", "a1", "a2"]);
  });

  it("пройденность дороги учитывает узлы: непройденная практика обрывает пройденный отрезок", () => {
    const u = unit("z", [["a1", "available"], ["a2", "available"], ["a3", "available"]]);
    const groups = [grp(["a1", "a2"], 0, false), grp(["a3"], 1, true)];
    const items = unitPathItems(u, { groups, trainable: ready });
    expect(kinds(items)).toEqual(["a1", "a2", "P(a1)", "a3", "R(z)"]);
    const node = (runs: number): CourseNodeStat => ({ runs, best: 0.8, at: NOW });
    const allLessons = () => true;
    // Все уроки пройдены, узлы нет.
    const p0 = pathPassed(items, allLessons, {});
    expect(p0).toEqual([true, true, false, true, false]);
    const { segments } = pathLayout(items.length);
    expect(segments.map((s) => segmentDone(s, p0))).toEqual([true, true, false, false, false, false]);
    // Практика пройдена — дорога зажигается до неё и дальше до пройденного a3.
    const p1 = pathPassed(items, allLessons, { [practiceNodeId(groups[0])]: node(1) });
    expect(p1).toEqual([true, true, true, true, false]);
    expect(segments.map((s) => segmentDone(s, p1))).toEqual([true, true, true, true, false, false]);
    // Запись узла с нулём прохождений не считается пройденной.
    expect(pathPassed(items, allLessons, { [practiceNodeId(groups[0])]: node(0) })[2]).toBe(false);
    // Повторение пройдено — «выход» дороги зажигается.
    const p2 = pathPassed(items, allLessons, { [practiceNodeId(groups[0])]: node(2), [recapNodeId("z")]: node(1) });
    expect(segments.map((s) => segmentDone(s, p2))).toEqual([true, true, true, true, true, true]);
  });

  it("состояние узла: пройден / рекомендуется (все уроки пройдены, узел нет) / доступен", () => {
    const refs = [
      { id: "a1", title: { ru: "", kk: "" }, status: "available" as const },
      { id: "a2", title: { ru: "", kk: "" }, status: "available" as const },
      { id: "a3", title: { ru: "", kk: "" }, status: "soon" as const },
    ];
    const done = (n = 1) => ({ runs: n, best: 1, at: NOW });
    expect(practiceNodeState(refs, {}, undefined)).toBe("available");
    expect(practiceNodeState(refs, { a1: stat() }, undefined)).toBe("available");
    // Урок «скоро» не мешает: готовые пройдены — рекомендуем.
    expect(practiceNodeState(refs, { a1: stat(), a2: stat() }, undefined)).toBe("recommended");
    expect(practiceNodeState(refs, { a1: stat(), a2: stat() }, done())).toBe("done");
    expect(practiceNodeState(refs, {}, done())).toBe("done");
    expect(practiceNodeState(refs, { a1: stat(), a2: stat() }, { runs: 0, best: 0, at: 0 })).toBe("recommended");
    expect(practiceNodeState([refs[2]], {}, undefined)).toBe("available");
  });
});
