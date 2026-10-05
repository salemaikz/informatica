import { describe, expect, it } from "vitest";
import {
  EXTERN_MAX,
  EXTERN_MIN,
  bankSkillIds,
  buildCheck,
  buildExtern,
  buildExternSession,
  externStartLesson,
  GAME_MIN_TOTAL,
  buildFromBank,
  buildMistakes,
  buildReview,
  buildSkill,
  buildSmart,
  buildTopic,
  externLessons,
  externPassed,
  firstParam,
  formatFactor,
  gameCanCredit,
  gameOpen,
  gamePassed,
  gameSkillsFor,
  gameSupportsSkills,
  hasBank,
  lessonAccuracies,
  nextLessonId,
  parseDrillMode,
  parseLessonMode,
  readyLessons,
  resolveGameContext,
  skillsByUnit,
  smartSkills,
  stepKey,
  unitOfSkill,
} from "@/lib/drill";
import { LESSONS, UNITS } from "@/content/course";
import { isSchoolSkill, SKILLS } from "@/content/skills";
import { GAMES } from "@/games/registry";
import { isQuestion } from "@/lib/evaluate";
import { DAY_MS, type LessonStat } from "@/lib/review";
import type { AnswerRecord, Lesson, QuestionStep } from "@/lib/types";

const DAY = DAY_MS;
const stat = (over: Partial<LessonStat> = {}): LessonStat => ({ completions: 1, bestAccuracy: 1, lastAt: 0, totalXp: 0, stage: 0, dueAt: 0, ...over });
const answer = (skill: string, score: number, retry = false): AnswerRecord => ({
  stepId: `${skill}:${Math.random()}`,
  skill,
  correct: score >= 1,
  score,
  given: "",
  expected: "",
  prompt: "",
  retry,
  timeMs: 1,
});
const levels = (steps: QuestionStep[]) => steps.map((s) => s.level ?? 1);
const isSorted = (a: number[]) => a.every((x, i) => i === 0 || a[i - 1] <= x);

/** Готовый урок раздела u1 (системы счисления) — стабильная опора тестов. */
const u1 = UNITS.find((u) => u.id === "u1")!;
const u1Lessons = readyLessons(u1);
const u1Banked = u1Lessons.filter((l) => l.skills.length > 0 && l.skills.every(hasBank));

describe("разбор адреса", () => {
  it("неизвестный режим тренировки — умная тренировка", () => {
    expect(parseDrillMode("review")).toBe("review");
    expect(parseDrillMode("extern")).toBe("extern");
    expect(parseDrillMode("topic")).toBe("topic");
    expect(parseDrillMode("hack")).toBe("smart");
    expect(parseDrillMode(undefined)).toBe("smart");
    expect(parseDrillMode(["review"])).toBe("smart");
  });
  it("режим урока: check или learn", () => {
    expect(parseLessonMode("check")).toBe("check");
    expect(parseLessonMode("learn")).toBe("learn");
    expect(parseLessonMode("zzz")).toBe("learn");
    expect(parseLessonMode(undefined)).toBe("learn");
  });
  it("firstParam берёт первое значение", () => {
    expect(firstParam(["a", "b"])).toBe("a");
    expect(firstParam("x")).toBe("x");
    expect(firstParam(undefined)).toBeUndefined();
  });
  it("множитель XP с запятой", () => {
    expect(formatFactor(0.5)).toBe("0,5");
    expect(formatFactor(0.75)).toBe("0,75");
    expect(formatFactor(0.3)).toBe("0,3");
    expect(formatFactor(1)).toBe("1");
  });
});

describe("свободный режим: навыки без замков", () => {
  it("есть навыки с банком", () => {
    expect(bankSkillIds().length).toBeGreaterThan(0);
  });
  it("smart без пройденных уроков берёт навыки первого раздела", () => {
    const sk = smartSkills({});
    expect(sk.length).toBeGreaterThan(0);
    // Первый раздел, где есть готовые уроки (сейчас — «Старт: компьютер с нуля»).
    const first = UNITS.find((u) => readyLessons(u).length > 0)!;
    const firstUnitSkills = new Set(readyLessons(first).flatMap((l) => l.skills));
    expect(sk.every((s) => firstUnitSkills.has(s))).toBe(true);
  });
  it("smart по пройденным урокам берёт их навыки", () => {
    const lesson = u1Banked[0];
    const sk = smartSkills({ [lesson.id]: stat() });
    expect(new Set(sk)).toEqual(new Set(lesson.skills.filter(hasBank)));
  });
  it("buildSmart: 8 заданий, от лёгкого к сложному, без повторов", () => {
    const steps = buildSmart({}, {}, 42);
    expect(steps.length).toBe(8);
    expect(isSorted(levels(steps))).toBe(true);
    expect(new Set(steps.map(stepKey)).size).toBe(steps.length);
    expect(steps.every((s) => isQuestion(s))).toBe(true);
  });
  it("buildSkill работает для любого навыка с банком", () => {
    for (const id of bankSkillIds()) {
      const steps = buildSkill(id, {}, 7);
      expect(steps.length, id).toBeGreaterThan(0);
      expect(steps.every((s) => s.skill === id)).toBe(true);
    }
  });
  it("buildSkill для навыка без банка — пусто", () => {
    const none = SKILLS.find((s) => !hasBank(s.id));
    if (none) expect(buildSkill(none.id, {}, 1)).toEqual([]);
  });
  it("одинаковый seed — одинаковый набор", () => {
    expect(buildSmart({}, {}, 5).map((s) => s.id)).toEqual(buildSmart({}, {}, 5).map((s) => s.id));
  });
  it("слабые навыки выпадают чаще освоенных", () => {
    const [a, b] = bankSkillIds();
    if (!b) return;
    const stats = { [a]: { attempts: 20, correct: 20, mastery: 1, lastSeen: 0 }, [b]: { attempts: 20, correct: 0, mastery: 0, lastSeen: 0 } };
    let ca = 0;
    let cb = 0;
    for (let seed = 1; seed <= 30; seed++) {
      for (const s of buildFromBank([a, b], stats, { seed, count: 8 })) {
        if (s.skill === a) ca++;
        if (s.skill === b) cb++;
      }
    }
    expect(cb).toBeGreaterThan(ca);
  });
});

describe("тема ЕНТ", () => {
  it("buildTopic: задания только по навыкам темы", () => {
    const topic = SKILLS.find((s) => s.ent && hasBank(s.id))!.ent!;
    const ids = new Set(SKILLS.filter((s) => s.ent === topic).map((s) => s.id));
    const steps = buildTopic(topic, {}, 3);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((s) => ids.has(s.skill!))).toBe(true);
  });
  it("тема без банков — пусто", () => {
    expect(buildTopic("t99" as never, {}, 1)).toEqual([]);
  });
});

describe("повторение (разминка)", () => {
  it("нечего повторять и нет слабых — умная тренировка", () => {
    const r = buildReview({}, {}, 1000, 1);
    expect(r.fallback).toBe(true);
    expect(r.lessons).toEqual([]);
    expect(r.steps.length).toBeGreaterThan(0);
  });
  it("урок не «остыл» — не берём", () => {
    const lesson = u1Banked[0];
    const r = buildReview({ [lesson.id]: stat({ dueAt: 5 * DAY }) }, {}, DAY, 1);
    expect(r.fallback).toBe(true);
  });
  it("урок пора повторить — берём его навыки, каждый встречается", () => {
    const lesson = u1Banked[0];
    const r = buildReview({ [lesson.id]: stat({ dueAt: 0 }) }, {}, 3 * DAY, 9);
    expect(r.fallback).toBe(false);
    expect(r.lessons).toEqual([lesson.id]);
    const got = new Set(r.steps.map((s) => s.skill));
    for (const s of lesson.skills.filter(hasBank)) expect(got.has(s), s).toBe(true);
    expect(r.steps.length).toBeGreaterThan(0);
    expect(r.steps.length).toBeLessThanOrEqual(8);
  });
  it("слабые навыки без просроченных уроков — тоже разминка", () => {
    const sk = bankSkillIds()[0];
    const r = buildReview({}, { [sk]: { attempts: 5, correct: 1, mastery: 0.2, lastSeen: 0 } }, DAY, 4);
    expect(r.fallback).toBe(false);
    expect(r.lessons).toEqual([]);
    expect(r.steps.every((s) => s.skill === sk)).toBe(true);
  });
  it("точность по урокам считается по заданиям его навыков, только первые попытки", () => {
    const lesson = u1Banked[0];
    const sk = lesson.skills[0];
    const acc = lessonAccuracies([answer(sk, 1), answer(sk, 0), answer(sk, 1, true), answer("zzz.other", 0)], [lesson.id, "no-such-lesson"]);
    expect(acc[lesson.id]).toBeCloseTo(0.5);
    expect(acc["no-such-lesson"]).toBeUndefined();
  });
  it("урок без ответов по его навыкам не попадает в итог", () => {
    const lesson = u1Banked[0];
    expect(lessonAccuracies([answer("zzz.other", 1)], [lesson.id])).toEqual({});
  });
});

describe("экстерн", () => {
  it("засчитывает готовые непройденные уроки с банком", () => {
    const all = externLessons(u1.id, {});
    expect(all).toEqual(u1Banked.map((l) => l.id));
    if (u1Banked.length) {
      const rest = externLessons(u1.id, { [u1Banked[0].id]: stat() });
      expect(rest).not.toContain(u1Banked[0].id);
    }
  });
  it("неизвестный раздел — нечего сдавать", () => {
    expect(externLessons("zz", {})).toEqual([]);
    expect(buildExtern("zz", {}, 1)).toEqual([]);
    expect(buildExtern(undefined, {}, 1)).toEqual([]);
  });
  it("по 2 задания B–C на навык, до 12", () => {
    const steps = buildExtern(u1.id, {}, 11);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.length).toBeLessThanOrEqual(EXTERN_MAX);
    expect(steps.every((s) => (s.level ?? 1) >= 2)).toBe(true);
    expect(isSorted(levels(steps))).toBe(true);
    const skills = new Set(steps.map((s) => s.skill));
    const lessonSkills = new Set(u1Banked.flatMap((l) => l.skills));
    for (const s of skills) expect(lessonSkills.has(s!)).toBe(true);
    if (lessonSkills.size * 2 <= EXTERN_MAX) {
      const per = Math.max(2, Math.ceil(EXTERN_MIN / lessonSkills.size));
      for (const s of lessonSkills) expect(steps.filter((x) => x.skill === s).length, s).toBeLessThanOrEqual(per);
    }
  });
  it("засчитывает только уроки, все навыки которых проверены заданиями", () => {
    const ex = buildExternSession(u1.id, {}, 7);
    const tested = new Set(ex.steps.map((s) => s.skill));
    expect(ex.lessons.length).toBeGreaterThan(0);
    for (const id of ex.lessons) for (const s of LESSONS[id].skills) expect(tested.has(s), `${id}:${s}`).toBe(true);
    for (const id of ex.lessons) expect(externLessons(u1.id, {})).toContain(id);
  });
  it("не сдан — начинать с первого непройденного урока раздела", () => {
    expect(externStartLesson(u1.id, {})).toBe(u1Lessons[0]?.id);
    if (u1Lessons.length > 1) expect(externStartLesson(u1.id, { [u1Lessons[0].id]: stat() })).toBe(u1Lessons[1].id);
    expect(externStartLesson("zz", {})).toBeUndefined();
  });
  it("если остался один урок с одним навыком — всё равно не меньше EXTERN_MIN заданий (если банк позволяет)", () => {
    const one = u1Banked.find((l) => l.skills.length === 1);
    if (!one) return;
    const doneOthers = Object.fromEntries(u1Lessons.filter((l) => l.id !== one.id).map((l) => [l.id, stat()]));
    const ex = buildExternSession(u1.id, doneOthers, 3);
    expect(ex.lessons).toEqual([one.id]);
    expect(ex.steps.length).toBeGreaterThanOrEqual(EXTERN_MIN);
    expect(ex.steps.every((s) => s.skill === one.skills[0] && (s.level ?? 1) >= 2)).toBe(true);
  });
  it("порог зачёта — 80%", () => {
    expect(externPassed(0.8)).toBe(true);
    expect(externPassed(0.79)).toBe(false);
    expect(externPassed(1)).toBe(true);
  });
});

describe("проверить себя", () => {
  const lesson = u1Banked[0];
  const fake = (steps: Lesson["steps"]): Lesson => ({ ...lesson, steps });
  it("только задания урока, A → B → C", () => {
    const steps = buildCheck(lesson, 1);
    expect(steps.every(isQuestion)).toBe(true);
    expect(isSorted(levels(steps))).toBe(true);
  });
  it("если заданий меньше 6 — добираем из банка навыков урока", () => {
    const own = lesson.steps.filter(isQuestion).slice(0, 2);
    const steps = buildCheck(fake(own), 5);
    expect(steps.length).toBe(6);
    expect(steps.filter((s) => own.some((o) => o.id === s.id)).length).toBe(own.length);
    expect(isSorted(levels(steps))).toBe(true);
    const extra = steps.filter((s) => !own.some((o) => o.id === s.id));
    expect(extra.every((s) => lesson.skills.includes(s.skill!))).toBe(true);
  });
  it("без теории и разборов", () => {
    const steps = buildCheck(lesson, 2);
    expect(steps.some((s) => !isQuestion(s))).toBe(false);
  });
  it("если заданий достаточно — банк не нужен", () => {
    const own = lesson.steps.filter(isQuestion);
    if (own.length >= 6) expect(buildCheck(lesson, 1).length).toBe(own.length);
  });
});

describe("работа над ошибками", () => {
  it("задание урока возвращается как есть, остальное — свежее задание по навыку", () => {
    const lesson = u1Banked[0];
    const q = lesson.steps.find((s) => isQuestion(s) && s.type !== "solution")!;
    const sk = bankSkillIds()[0];
    const r = buildMistakes(
      [
        { stepId: q.id, lessonId: lesson.id, skill: (q as QuestionStep).skill },
        { stepId: "gone", skill: sk },
        { stepId: "none", skill: "zzz.no" },
      ],
      {},
      1,
    );
    expect(r.steps.length).toBe(2);
    expect(r.map[q.id]).toBe(q.id);
    expect(Object.values(r.map)).toContain("gone");
  });
});

describe("разделы и навигация", () => {
  it("каждый навык попадает ровно в один раздел", () => {
    const groups = skillsByUnit();
    const all = groups.flatMap((g) => g.skills.map((s) => s.id));
    // Навыки школьных уроков (этап 15) — не разделы курса ЕНТ.
    const course = SKILLS.filter((s) => !isSchoolSkill(s.id));
    expect(all.length).toBe(course.length);
    expect(new Set(all).size).toBe(course.length);
    for (const g of groups) for (const s of g.skills) expect(unitOfSkill(s.id).id).toBe(g.unit.id);
  });
  it("флаг hasBank совпадает с банком", () => {
    for (const g of skillsByUnit()) for (const s of g.skills) expect(s.hasBank).toBe(hasBank(s.id));
  });
  it("следующий урок: пропускает пройденные, у последнего — null", () => {
    const ready = UNITS.flatMap((u) => u.lessons).filter((r) => r.status === "available" && LESSONS[r.id]);
    if (ready.length < 3) return;
    expect(nextLessonId(ready[0].id)).toBe(ready[1].id);
    expect(nextLessonId(ready[0].id, { [ready[1].id]: stat() })).toBe(ready[2].id);
    // Всё впереди пройдено — всё равно следующий по порядку.
    const doneAll = Object.fromEntries(ready.map((r) => [r.id, stat()]));
    expect(nextLessonId(ready[0].id, doneAll)).toBe(ready[1].id);
    expect(nextLessonId(ready[ready.length - 1].id)).toBeNull();
  });
});

describe("урок игрой", () => {
  it("контекст из адреса: известный урок задаёт навыки", () => {
    const lesson = u1Banked[0];
    const ctx = resolveGameContext({ lesson: lesson.id });
    expect(ctx.lessonId).toBe(lesson.id);
    expect(ctx.skills).toEqual(lesson.skills.slice(0, 12));
  });
  it("неизвестный урок и чужие навыки отбрасываются", () => {
    expect(resolveGameContext({ lesson: "nope" })).toEqual({ skills: [] });
    const sk = bankSkillIds()[0];
    expect(resolveGameContext({ skills: `${sk},evil.skill,<script>,${sk}` })).toEqual({ skills: [sk] });
    expect(resolveGameContext({})).toEqual({ skills: [] });
  });
  it("зачёт урока игрой — от 70% верных", () => {
    expect(gamePassed(7, 10)).toBe(true);
    expect(gamePassed(6, 10)).toBe(false);
    expect(gamePassed(0, 0)).toBe(false);
    // Слишком короткая игра урок не засчитывает, даже без ошибок.
    expect(gamePassed(GAME_MIN_TOTAL - 1, GAME_MIN_TOTAL - 1)).toBe(false);
    expect(gamePassed(GAME_MIN_TOTAL, GAME_MIN_TOTAL)).toBe(true);
  });
  it("игра пишет урок, только если он не пройден или пора повторить", () => {
    expect(gameCanCredit(undefined, 100)).toBe(true);
    expect(gameCanCredit(stat({ completions: 0 }), 100)).toBe(true);
    expect(gameCanCredit(stat({ dueAt: 500 }), 100)).toBe(false);
    expect(gameCanCredit(stat({ dueAt: 50 }), 100)).toBe(true);
  });
  it("универсальная игра берёт любые навыки нужной формы; обычная — только свои", () => {
    const universal = GAMES.find((g) => g.shape)!;
    const own = GAMES.find((g) => !g.shape)!;
    const foreign = SKILLS.find((s) => !own.skills.includes(s.id) && hasBank(s.id));
    expect(gameSkillsFor(universal, bankSkillIds()).length).toBeGreaterThan(0);
    expect(gameSupportsSkills(universal, ["zzz.none"])).toBe(false);
    expect(gameSupportsSkills(own, own.skills)).toBe(true);
    if (foreign) {
      expect(gameSkillsFor(own, [foreign.id])).toEqual([]);
      expect(gameSupportsSkills(own, [foreign.id])).toBe(false);
    }
    // Без контекста — всегда доступна (игра берёт свои навыки).
    expect(gameSupportsSkills(own, [])).toBe(true);
  });
  it("игры на странице «Тренировка» открыты, если есть нужная форма", () => {
    for (const g of GAMES) expect(gameOpen(g, []), g.id).toBe(true);
    expect(gameOpen({ shape: "question", skills: ["zzz.none"] }, [])).toBe(false);
    expect(gameOpen({ shape: "question", skills: ["zzz.none"] }, [bankSkillIds()[0]])).toBe(true);
    expect(gameOpen({ skills: ["zzz.none"] }, bankSkillIds())).toBe(false);
  });
});
