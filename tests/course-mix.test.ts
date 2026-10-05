import { describe, expect, it } from "vitest";
import { ENT_POOL } from "@/content/ent";
import { COURSE_GROUPS, type CourseGroup } from "@/content/groups";
import type { SkillStat } from "@/lib/mastery";
import type { LessonStat } from "@/lib/review";
import type { EntItem, EntMatch, QuestionStep } from "@/lib/types";
import { skillsOfLessons } from "@/lib/drill";
import { evaluate } from "@/lib/evaluate";
import { entMatchStep, entRef } from "@/lib/ent-steps";
import { tx } from "@/lib/text";
import {
  MINITEST_COUNT,
  PRACTICE_COUNT,
  RECAP_COUNT,
  buildMiniTest,
  buildPractice,
  buildRecap,
  hasMiniTest,
  miniTestPoints,
  miniTestPool,
  mixCounts,
  mixShares,
  pickMiniTest,
  stepMaxPoints,
  touchedSkills,
  weakestSkill,
} from "@/lib/course-mix";
import { validateStep } from "./validate";

const stat = (mastery = 0.5): SkillStat => ({ attempts: 4, correct: 2, mastery, lastSeen: 0 });
const skillsOf = (groups: CourseGroup[]) => new Set(skillsOfLessons(groups.flatMap((g) => g.lessons)));
const statsFor = (skills: Iterable<string>, mastery = 0.5): Record<string, SkillStat> => Object.fromEntries([...skills].map((s) => [s, stat(mastery)]));
const group = (id: string): CourseGroup => COURSE_GROUPS.find((g) => g.id === id)!;
const idxOf = (g: CourseGroup) => COURSE_GROUPS.indexOf(g);

/** Три набора навыков группы g (как в правилах ТЗ), без пересечений. */
function expectedSets(current: CourseGroup[], firstIdx: number) {
  const cur = skillsOf(current);
  const from = Math.max(0, firstIdx - 3);
  const recent = new Set([...skillsOf(COURSE_GROUPS.slice(from, firstIdx))].filter((s) => !cur.has(s)));
  const old = new Set([...skillsOf(COURSE_GROUPS.slice(0, from))].filter((s) => !cur.has(s) && !recent.has(s)));
  return { cur, recent, old };
}

function share(steps: QuestionStep[], sets: ReturnType<typeof expectedSets>) {
  return {
    cur: steps.filter((s) => sets.cur.has(s.skill!)).length,
    recent: steps.filter((s) => sets.recent.has(s.skill!)).length,
    old: steps.filter((s) => sets.old.has(s.skill!)).length,
  };
}

const MIDDLE = group("g:py-4-strings"); // раздел «Python»: впереди много групп, три предыдущие — в том же разделе

describe("доли практики", () => {
  it("12 → 6/4/2, 15 → 7/5/3", () => {
    expect(mixShares(12)).toEqual({ current: 6, recent: 4, old: 2 });
    expect(mixShares(15)).toEqual({ current: 7, recent: 5, old: 3 });
  });

  it("пустой набор отдаёт долю следующему: давние → недавние → текущая; нет текущей — нет заданий", () => {
    const sets = (c: number, r: number, o: number) => ({ current: Array(c).fill("a"), recent: Array(r).fill("b"), old: Array(o).fill("c") });
    expect(mixCounts(12, sets(2, 2, 2))).toEqual({ current: 6, recent: 4, old: 2 });
    expect(mixCounts(12, sets(2, 2, 0))).toEqual({ current: 6, recent: 6, old: 0 });
    expect(mixCounts(12, sets(2, 0, 2))).toEqual({ current: 10, recent: 0, old: 2 });
    expect(mixCounts(12, sets(2, 0, 0))).toEqual({ current: 12, recent: 0, old: 0 });
    expect(mixCounts(15, sets(2, 0, 0))).toEqual({ current: 15, recent: 0, old: 0 });
    expect(mixCounts(12, sets(0, 3, 3))).toEqual({ current: 0, recent: 0, old: 0 });
  });
});

describe("buildPractice", () => {
  const idx = idxOf(MIDDLE);
  const sets = expectedSets([MIDDLE], idx);
  const touchedAll = statsFor(skillsOf(COURSE_GROUPS.slice(0, idx)));

  it("в середине курса: 12 заданий, доли 6/4/2 (текущая / три предыдущие / раньше)", () => {
    expect(sets.cur.size).toBeGreaterThan(0);
    expect(sets.recent.size).toBeGreaterThan(0);
    expect(sets.old.size).toBeGreaterThan(0);
    const steps = buildPractice(MIDDLE, {}, touchedAll, 7);
    expect(steps).toHaveLength(PRACTICE_COUNT);
    expect(share(steps, sets)).toEqual({ cur: 6, recent: 4, old: 2 });
  });

  it("у начала курса (первая группа) — всё из текущей группы", () => {
    const first = COURSE_GROUPS[0];
    const steps = buildPractice(first, {}, {}, 3);
    expect(steps).toHaveLength(PRACTICE_COUNT);
    const cur = skillsOf([first]);
    expect(steps.every((s) => cur.has(s.skill!))).toBe(true);
  });

  it("недавние пусты — их доля уходит текущей; давние остаются", () => {
    const oldOnly = statsFor(sets.old);
    const steps = buildPractice(MIDDLE, {}, oldOnly, 11);
    expect(steps).toHaveLength(PRACTICE_COUNT);
    expect(share(steps, sets)).toEqual({ cur: 10, recent: 0, old: 2 });
  });

  it("прошлые навыки — только тронутые: без попыток и уроков берётся одна текущая группа", () => {
    const steps = buildPractice(MIDDLE, {}, {}, 5);
    expect(steps).toHaveLength(PRACTICE_COUNT);
    expect(share(steps, sets)).toEqual({ cur: 12, recent: 0, old: 0 });
  });

  it("давние: берутся только из тронутых навыков (часть тронута — только они)", () => {
    const some = [...sets.old].slice(0, 2);
    for (let seed = 1; seed <= 5; seed++) {
      const steps = buildPractice(MIDDLE, {}, statsFor(some), seed);
      const fromOld = steps.filter((s) => sets.old.has(s.skill!));
      expect(fromOld.length).toBeGreaterThan(0);
      expect(fromOld.every((s) => some.includes(s.skill!))).toBe(true);
    }
  });

  it("навык тронут и по уроку: запись LessonStat у урока открывает его навыки", () => {
    const earlier = COURSE_GROUPS[idx - 1].lessons[0];
    const lessons: Record<string, LessonStat> = { [earlier]: { completions: 1, bestAccuracy: 1, lastAt: 0, totalXp: 10 } };
    expect(touchedSkills(lessons, {}).size).toBeGreaterThan(0);
    const steps = buildPractice(MIDDLE, lessons, {}, 2);
    expect(steps.some((s) => sets.recent.has(s.skill!))).toBe(true);
  });

  it("без повторов, от лёгкого к сложному (A → C)", () => {
    const steps = buildPractice(MIDDLE, {}, touchedAll, 21);
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    const levels = steps.map((s) => s.level ?? 1);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it("детерминизм по seed", () => {
    const a = buildPractice(MIDDLE, {}, touchedAll, 99);
    const b = buildPractice(MIDDLE, {}, touchedAll, 99);
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
    expect(a).toEqual(b);
    const c = buildPractice(MIDDLE, {}, touchedAll, 100);
    expect(c.map((s) => s.id)).not.toEqual(a.map((s) => s.id));
  });

  it("слабые и давние навыки выпадают чаще освоенных", () => {
    const cur = [...sets.cur];
    const stats: Record<string, SkillStat> = Object.fromEntries(cur.map((s, i) => [s, stat(i === 0 ? 0.05 : 0.95)]));
    let weak = 0;
    let strong = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const st of buildPractice(MIDDLE, {}, stats, seed)) {
        if (st.skill === cur[0]) weak++;
        else if (cur.includes(st.skill!)) strong++;
      }
    }
    // Один слабый навык против остальных освоенных: на навык приходится заметно больше заданий.
    expect(weak).toBeGreaterThan(strong / (cur.length - 1));
  });

  it("группа вне курса не ломает сборку: берутся навыки её уроков", () => {
    const fake: CourseGroup = { ...MIDDLE, id: "g:нет-такой", index: 0, last: false };
    const steps = buildPractice(fake, {}, {}, 1);
    expect(steps).toHaveLength(PRACTICE_COUNT);
  });
});

describe("buildRecap", () => {
  const unitId = "u4";
  const unitGroups = COURSE_GROUPS.filter((g) => g.unitId === unitId);
  const first = COURSE_GROUPS.indexOf(unitGroups[0]);
  const sets = expectedSets(unitGroups, first);
  const touchedAll = statsFor(skillsOf(COURSE_GROUPS.slice(0, first)));

  it("15 заданий: раздел 7, три группы перед ним 5, всё раньше 3", () => {
    const steps = buildRecap(unitId, {}, touchedAll, 4);
    expect(steps).toHaveLength(RECAP_COUNT);
    expect(share(steps, sets)).toEqual({ cur: 7, recent: 5, old: 3 });
    const levels = steps.map((s) => s.level ?? 1);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
  });

  it("первый раздел курса — всё из самого раздела; неизвестный раздел — пусто", () => {
    const u0 = COURSE_GROUPS.filter((g) => g.unitId === "u0");
    const steps = buildRecap("u0", {}, {}, 4);
    expect(steps).toHaveLength(RECAP_COUNT);
    const cur = skillsOf(u0);
    expect(steps.every((s) => cur.has(s.skill!))).toBe(true);
    expect(buildRecap("нет-такого", {}, {}, 1)).toEqual([]);
  });

  it("детерминизм по seed", () => {
    expect(buildRecap(unitId, {}, touchedAll, 8).map((s) => s.id)).toEqual(buildRecap(unitId, {}, touchedAll, 8).map((s) => s.id));
  });
});

describe("мини-тест", () => {
  const g = group("g:py-2a-if");

  it("состав: 4 single + 1 multi (6 вариантов) + 1 «соответствие» 2×4; id — ссылка ent:", () => {
    const steps = buildMiniTest(g, 5);
    expect(steps).toHaveLength(MINITEST_COUNT);
    expect(steps.filter((s) => s.type === "choice")).toHaveLength(4);
    const multi = steps.filter((s) => s.type === "multi");
    expect(multi).toHaveLength(1);
    expect(multi[0].type === "multi" && multi[0].options).toHaveLength(6);
    const match = steps.filter((s) => s.type === "entmatch");
    expect(match).toHaveLength(1);
    if (match[0].type === "entmatch") {
      expect(match[0].items).toHaveLength(2);
      expect(match[0].choices).toHaveLength(4);
    }
    const skills = skillsOf([g]);
    for (const s of steps) {
      expect(s.id.startsWith("ent:")).toBe(true);
      expect(s.ent).toBe(true);
      expect(skills.has(s.skill!)).toBe(true);
    }
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
  });

  it("без подсказок; шаги валидны; порядок A → C; уровни 3 A + 2 B + 1 C", () => {
    for (const seed of [1, 2, 3, 40]) {
      const steps = buildMiniTest(g, seed);
      for (const s of steps) {
        expect(s.hint).toBeUndefined();
        expect(validateStep(s)).toEqual([]);
      }
      const levels = steps.map((s) => s.level ?? 1);
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
      expect(levels).toEqual([1, 1, 1, 2, 2, 3]);
    }
  });

  it("варианты перемешаны, верный ответ остаётся верным (по тексту)", () => {
    const steps = buildMiniTest(g, 9);
    for (const s of steps) {
      const item = ENT_POOL.find((i) => entRef(i.id) === s.id)!;
      if (s.type === "choice" && item.kind === "single") expect(tx(s.options[s.correct], "ru")).toBe(tx(item.options[item.correct], "ru"));
      if (s.type === "multi" && item.kind === "multi") expect(s.correct.map((i) => tx(s.options[i], "ru")).sort()).toEqual(item.correct.map((i) => tx(item.options[i], "ru")).sort());
      if (s.type === "entmatch" && item.kind === "match") expect(s.answer.map((i, n) => `${n}:${tx(s.choices[i], "ru")}`)).toEqual(item.answer.map((i, n) => `${n}:${tx(item.choices[i], "ru")}`));
    }
    // Хоть где-то порядок отличается от исходного (иначе перемешивания нет).
    const moved = [3, 4, 5, 6, 7, 8].some((seed) =>
      buildMiniTest(g, seed).some((s) => {
        const item = ENT_POOL.find((i) => entRef(i.id) === s.id)!;
        return s.type === "choice" && item.kind === "single" && s.correct !== item.correct;
      }),
    );
    expect(moved).toBe(true);
  });

  it("детерминизм по seed; разные seed — разные наборы", () => {
    expect(buildMiniTest(g, 77)).toEqual(buildMiniTest(g, 77));
    const ids = (seed: number) => buildMiniTest(g, seed).map((s) => s.id).join();
    expect(new Set([1, 2, 3, 4, 5, 6].map(ids)).size).toBeGreaterThan(1);
  });

  it("нет заданий ЕНТ у группы — пусто, кнопки мини-теста нет", () => {
    const strategy = group("g:ent-1-strategy");
    expect(buildMiniTest(strategy, 1)).toEqual([]);
    expect(hasMiniTest(strategy)).toBe(false);
    expect(hasMiniTest(g)).toBe(true);
  });

  it("контекстных заданий в пуле мини-теста нет", () => {
    expect(miniTestPool(g).some((i) => i.kind === "context")).toBe(false);
  });

  it("мало заданий: сколько есть; меньше 3 — пусто; не хватает multi/match — добираем single", () => {
    const of = (kind: EntItem["kind"], n: number) => ENT_POOL.filter((i) => i.kind === kind).slice(0, n);
    expect(pickMiniTest([...of("single", 2)], 1)).toEqual([]);
    const four = pickMiniTest(of("single", 4), 1);
    expect(four).toHaveLength(4);
    const tenSingles = pickMiniTest(of("single", 10), 1);
    expect(tenSingles).toHaveLength(6);
    expect(tenSingles.every((s) => s.type === "choice")).toBe(true);
    const noMulti = pickMiniTest([...of("single", 10), ...of("match", 3)], 1);
    expect(noMulti).toHaveLength(6);
    expect(noMulti.filter((s) => s.type === "entmatch")).toHaveLength(1);
    expect(noMulti.filter((s) => s.type === "multi")).toHaveLength(0);
    // Мало single, зато есть multi и match — добираем ими: всего всё равно сколько есть, до шести.
    const mixed = pickMiniTest([...of("single", 2), ...of("multi", 3), ...of("match", 3)], 1);
    expect(mixed).toHaveLength(6);
  });

  it("реальные группы: у каждой группы с ≥ 6 заданиями — ровно 6, без повторов", () => {
    for (const grp of COURSE_GROUPS) {
      const n = miniTestPool(grp).length;
      const steps = buildMiniTest(grp, 3);
      expect(steps.length, grp.id).toBe(n >= MINITEST_COUNT ? MINITEST_COUNT : n >= 3 ? n : 0);
      expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    }
  });
});

describe("баллы мини-теста как на ЕНТ", () => {
  const steps = buildMiniTest(group("g:py-2a-if"), 5);
  const answer = (s: QuestionStep, score: number, extra: object = {}) => ({ stepId: s.id, skill: s.skill, score, retry: false, ...extra });

  it("максимум: single — 1, multi и «соответствие» — 2 (4 + 2 + 2 = 8)", () => {
    expect(stepMaxPoints({ type: "choice" })).toBe(1);
    expect(stepMaxPoints({ type: "multi" })).toBe(2);
    expect(stepMaxPoints({ type: "entmatch" })).toBe(2);
    expect(miniTestPoints(steps, []).max).toBe(8);
  });

  it("всё верно — 8 из 8; частично верные multi/match дают 1 балл", () => {
    expect(miniTestPoints(steps, steps.map((s) => answer(s, 1)))).toEqual({ points: 8, max: 8 });
    expect(miniTestPoints(steps, steps.map((s) => answer(s, s.type === "choice" ? 1 : 0.5)))).toEqual({ points: 6, max: 8 });
    expect(miniTestPoints(steps, steps.map((s) => answer(s, 0)))).toEqual({ points: 0, max: 8 });
  });

  it("считаются первые попытки; повторы и пропуски не прибавляют, неотвеченные — 0", () => {
    const first = steps.map((s) => answer(s, 0));
    const retry = steps.map((s) => answer(s, 1, { retry: true }));
    expect(miniTestPoints(steps, [...first, ...retry]).points).toBe(0);
    expect(miniTestPoints(steps, [answer(steps[0], 1)]).points).toBe(1);
    expect(miniTestPoints(steps, [answer(steps[0], 1, { skipped: true })]).points).toBe(0);
    // Две записи одного шага — берётся первая.
    expect(miniTestPoints(steps, [answer(steps[0], 0), answer(steps[0], 1)]).points).toBe(0);
  });

  it("согласовано с оценкой плеера: multi с одним лишним — 1 балл, match с одним верным — 1 балл", () => {
    const multi = steps.find((s) => s.type === "multi");
    const match = steps.find((s) => s.type === "entmatch");
    if (multi?.type !== "multi" || match?.type !== "entmatch") throw new Error("в мини-тесте нет multi или match");
    const partialMulti = evaluate(multi, { type: "multi", indices: [...multi.correct, multi.options.findIndex((_, i) => !multi.correct.includes(i))] }, "ru");
    const partialMatch = evaluate(match, { type: "entmatch", picks: [match.answer[0], [0, 1, 2, 3].find((i) => i !== match.answer[1])!] }, "ru");
    expect([partialMulti.score, partialMatch.score]).toEqual([0.5, 0.5]);
    expect(miniTestPoints([multi, match], [answer(multi, partialMulti.score), answer(match, partialMatch.score)])).toEqual({ points: 2, max: 4 });
    const item = ENT_POOL.find((i): i is EntMatch => i.kind === "match")!;
    expect(stepMaxPoints(entMatchStep(item))).toBe(2);
  });

  it("слабое место — навык с наибольшей потерей; без ошибок — нет", () => {
    const a = (skill: string, score: number, extra: object = {}) => ({ stepId: `s-${skill}-${score}-${Math.random()}`, skill, score, retry: false, ...extra });
    expect(weakestSkill([])).toBeUndefined();
    expect(weakestSkill([a("x", 1), a("y", 1)])).toBeUndefined();
    expect(weakestSkill([a("x", 0.5), a("y", 0), a("x", 1)])).toBe("y");
    expect(weakestSkill([a("x", 0), a("x", 0), a("y", 0)])).toBe("x");
    // Пропущенные и повторы не считаются.
    expect(weakestSkill([a("x", 0, { skipped: true }), a("y", 0, { retry: true })])).toBeUndefined();
    // Ничья — первый встретившийся.
    expect(weakestSkill([a("p", 0), a("q", 0)])).toBe("p");
  });
});
