import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEEKS,
  MAX_LESSONS_PER_WEEK,
  MAX_WEEKS,
  REVIEW_ANSWERS,
  addDays,
  buildPlan,
  currentWeekOf,
  formatWeekRange,
  layoutLessons,
  nextOpenLesson,
  normalizePace,
  parseAnchor,
  planWeekCount,
  resolveAnchor,
  reviewWeekCount,
  taskHref,
  todayPlan,
  todayQuota,
  type PlanInput,
  type PlanTask,
  type PlanUnit,
  type PlanWeek,
} from "@/lib/plan";
import { UNITS } from "@/content/course";
import { groupOf, hubGroup } from "@/components/app/nav";

const TODAY = "2026-10-05"; // понедельник

/** Курс: unit → число готовых уроков (+ «скоро»). */
function course(spec: Record<string, number>, soon: Record<string, number> = {}): PlanUnit[] {
  return Object.entries(spec).map(([id, n]) => ({
    id,
    lessons: [
      ...Array.from({ length: n }, (_, i) => ({ id: `${id}-l${i + 1}`, status: "available" as const })),
      ...Array.from({ length: soon[id] ?? 0 }, (_, i) => ({ id: `${id}-s${i + 1}`, status: "soon" as const })),
    ],
  }));
}

const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  units: course({ u0: 3, u1: 4, u2: 5 }),
  today: TODAY,
  start: TODAY,
  examDate: null,
  skipBasics: false,
  lessons: {},
  exams: [],
  days: {},
  ...over,
});

const lessonIds = (p: ReturnType<typeof buildPlan>) => p.weeks.flatMap((w) => w.tasks).flatMap((t) => (t.type === "lesson" ? [t.id] : []));

describe("planWeekCount / reviewWeekCount", () => {
  it("без даты — 12 недель", () => {
    expect(planWeekCount(TODAY, null)).toBe(DEFAULT_WEEKS);
    expect(planWeekCount(TODAY, undefined)).toBe(DEFAULT_WEEKS);
    expect(planWeekCount(TODAY, "мусор")).toBe(DEFAULT_WEEKS);
  });
  it("по дате: недели с дня начала включительно", () => {
    expect(planWeekCount(TODAY, TODAY)).toBe(1);
    expect(planWeekCount(TODAY, addDays(TODAY, 6))).toBe(1);
    expect(planWeekCount(TODAY, addDays(TODAY, 7))).toBe(2);
    expect(planWeekCount(TODAY, addDays(TODAY, 83))).toBe(12);
  });
  it("дата в прошлом — 0, далёкая — потолок", () => {
    expect(planWeekCount(TODAY, addDays(TODAY, -1))).toBe(0);
    expect(planWeekCount(TODAY, addDays(TODAY, 3000))).toBe(MAX_WEEKS);
  });
  it("недели повторения: 0 / 1 / 2", () => {
    expect([1, 2, 3, 5, 6, 12, 52].map(reviewWeekCount)).toEqual([0, 0, 1, 1, 2, 2, 2]);
  });
});

describe("resolveAnchor", () => {
  it("первый вход — сегодня", () => {
    expect(resolveAnchor(null, null, TODAY)).toBe(TODAY);
  });
  it("сохранённый якорь действует, пока план не закончился", () => {
    const saved = { start: addDays(TODAY, -20), exam: null };
    expect(resolveAnchor(saved, null, TODAY)).toBe(saved.start);
  });
  it("план без даты закончился через 12 недель — новый цикл", () => {
    const saved = { start: addDays(TODAY, -84), exam: null };
    expect(resolveAnchor(saved, null, TODAY)).toBe(TODAY);
  });
  it("дату ЕНТ изменили — план с начала", () => {
    const saved = { start: addDays(TODAY, -10), exam: "2027-01-01" };
    expect(resolveAnchor(saved, "2027-02-01", TODAY)).toBe(TODAY);
    expect(resolveAnchor(saved, "2027-01-01", TODAY)).toBe(saved.start);
  });
  it("якорь из будущего игнорируется", () => {
    expect(resolveAnchor({ start: addDays(TODAY, 3), exam: null }, null, TODAY)).toBe(TODAY);
  });
  it("parseAnchor принимает только корректное", () => {
    expect(parseAnchor({ start: "2026-10-05", exam: null })).toEqual({ start: "2026-10-05", exam: null });
    expect(parseAnchor({ start: "2026-10-05", exam: "2027-01-30" })).toEqual({ start: "2026-10-05", exam: "2027-01-30" });
    expect(parseAnchor({ start: "2026-10-05", exam: 5 })).toEqual({ start: "2026-10-05", exam: null });
    expect(parseAnchor({ start: "вчера" })).toBeNull();
    expect(parseAnchor("x")).toBeNull();
    expect(parseAnchor(null)).toBeNull();
  });
});

describe("layoutLessons", () => {
  const groups = (...sizes: number[]) => sizes.map((n, i) => ({ unit: `u${i}`, ids: Array.from({ length: n }, (_, k) => `u${i}-${k}`) }));
  const counts = (weeks: ReturnType<typeof layoutLessons>["weeks"]) => weeks.map((w) => w.filter((t) => t.type === "lesson").length);

  it("все уроки размещены по порядку, ни одного лишнего", () => {
    const r = layoutLessons(groups(4, 5, 3), 4);
    const ids = r.weeks.flat().flatMap((t) => (t.type === "lesson" ? [t.id] : []));
    expect(ids).toEqual(groups(4, 5, 3).flatMap((g) => g.ids));
    expect(r.overflow).toBe(0);
  });
  it("не больше MAX_LESSONS_PER_WEEK (14) уроков в неделю, остаток — overflow", () => {
    expect(MAX_LESSONS_PER_WEEK).toBe(14);
    const r = layoutLessons(groups(44), 2);
    expect(counts(r.weeks)).toEqual([14, 14]);
    expect(r.overflow).toBe(16);
  });
  it("равномерно: 12 уроков на 4 недели — по 3", () => {
    expect(counts(layoutLessons(groups(12), 4).weeks)).toEqual([3, 3, 3, 3]);
  });
  it("мало уроков — по одному в неделю, дальше пустые недели", () => {
    expect(counts(layoutLessons(groups(3), 6).weeks)).toEqual([1, 1, 1, 0, 0, 0]);
  });
  it("контрольная — сразу после последнего урока раздела", () => {
    const r = layoutLessons(groups(2, 2), 2);
    const flat = r.weeks.flat().map((t) => (t.type === "lesson" ? t.id : `check:${t.unit}`));
    expect(flat).toEqual(["u0-0", "u0-1", "check:u0", "u1-0", "u1-1", "check:u1"]);
  });
  it("раздел не рвётся без нужды: небольшой раздел переносится на следующую неделю", () => {
    // 3 + 3 + 3 на 3 недели: по одному разделу в неделю
    const r = layoutLessons(groups(3, 3, 3), 3);
    r.weeks.forEach((w, i) => expect(new Set(w.map((t) => t.unit))).toEqual(new Set([`u${i}`])));
  });
  it("последний урок раздела может перелезть цель на единицу", () => {
    // 7 уроков на 2 недели: цель 4, но раздел из 5 заканчивается в первой неделе
    const r = layoutLessons(groups(5, 2), 2);
    expect(counts(r.weeks)).toEqual([5, 2]);
  });
  it("слишком большой раздел рвётся", () => {
    const r = layoutLessons(groups(10), 2);
    expect(counts(r.weeks)).toEqual([5, 5]);
  });
  it("перенос раздела не рождает overflow, если всё помещается", () => {
    // 10 + 14 + 4 = 28 на 2 недели: раздел из 14 нельзя переносить так, чтобы последние 4 урока не влезли
    const r = layoutLessons(groups(10, 14, 4), 2);
    expect(r.overflow).toBe(0);
    expect(counts(r.weeks)).toEqual([14, 14]);
  });
  it("раздел без контрольной (checkpoint: false) — уроки без узла контрольной", () => {
    const r = layoutLessons([{ unit: "a", ids: ["a1"], checkpoint: false }, { unit: "b", ids: ["b1"] }], 1);
    expect(r.weeks[0].map((t) => t.type)).toEqual(["lesson", "lesson", "checkpoint"]);
  });
  it("нет уроков или недель — пусто", () => {
    expect(layoutLessons([], 5)).toEqual({ weeks: [[], [], [], [], []], overflow: 0 });
    expect(layoutLessons(groups(3), 0)).toEqual({ weeks: [], overflow: 3 });
  });
  it("не бросает на разных размерах (инварианты)", () => {
    for (let weeks = 1; weeks <= 14; weeks++) {
      for (const sizes of [[1], [7], [9, 1, 9], [2, 2, 2, 2, 2, 2], [15, 15], [4, 8, 1, 6]]) {
        const r = layoutLessons(groups(...sizes), weeks);
        const total = sizes.reduce((a, b) => a + b, 0);
        const placed = r.weeks.flat().filter((t) => t.type === "lesson").length;
        expect(placed + r.overflow).toBe(total);
        if (total <= MAX_LESSONS_PER_WEEK * weeks) expect(r.overflow).toBe(0);
        counts(r.weeks).forEach((c) => expect(c).toBeLessThanOrEqual(MAX_LESSONS_PER_WEEK));
      }
    }
  });
});

describe("buildPlan: структура", () => {
  it("без даты — 12 недель, последние 2 — повторение и полный ЕНТ", () => {
    const p = buildPlan(base());
    expect(p.state).toBe("ok");
    expect(p.totalWeeks).toBe(12);
    expect(p.weeks).toHaveLength(12);
    for (const w of p.weeks.slice(-2)) {
      expect(w.review).toBe(true);
      expect(w.tasks.map((t) => t.type)).toEqual(["review", "exam"]);
      expect(w.tasks.every((t) => t.type !== "exam" || t.exam === "full")).toBe(true);
    }
    expect(p.weeks.slice(0, 10).every((w) => !w.review)).toBe(true);
  });
  it("мини-ЕНТ каждые 2 недели (чётные недели уроков)", () => {
    const p = buildPlan(base());
    const miniWeeks = p.weeks.filter((w) => w.tasks.some((t) => t.type === "exam" && t.exam === "mini")).map((w) => w.n);
    expect(miniWeeks).toEqual([2, 4, 6, 8, 10]);
  });
  it("все готовые уроки в плане по порядку курса; даты недель подряд", () => {
    const p = buildPlan(base());
    expect(lessonIds(p)).toEqual(base().units.flatMap((u) => u.lessons.map((l) => l.id)));
    expect(p.weeks[0].start).toBe(TODAY);
    expect(p.weeks[0].end).toBe(addDays(TODAY, 6));
    expect(p.weeks[1].start).toBe(addDays(TODAY, 7));
    expect(p.lessonsTotal).toBe(12);
    expect(p.lessonsLeft).toBe(12);
  });
  it("контрольная раздела — после его последнего урока, по одной на раздел", () => {
    const p = buildPlan(base());
    const checks = p.weeks.flatMap((w) => w.tasks).filter((t) => t.type === "checkpoint");
    expect(checks.map((t) => t.type === "checkpoint" && t.unit)).toEqual(["u0", "u1", "u2"]);
    const flat = p.weeks.flatMap((w) => w.tasks);
    for (const unit of ["u0", "u1", "u2"]) {
      const last = flat.map((t, i) => (t.type === "lesson" && t.unit === unit ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
      expect(flat[last + 1]).toMatchObject({ type: "checkpoint", unit });
    }
  });
  it("ключи дел уникальны", () => {
    const keys = buildPlan(base()).weeks.flatMap((w) => w.tasks.map((t) => t.key));
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("недели без уроков получают повторение", () => {
    const p = buildPlan(base({ units: course({ u1: 2 }) }));
    const empty = p.weeks.slice(2, 10);
    expect(empty.every((w) => w.tasks.some((t) => t.type === "review"))).toBe(true);
  });
  it("мини-ЕНТ не лишний: в нечётных неделях уроков его нет", () => {
    const p = buildPlan(base());
    expect(p.weeks[0].tasks.some((t) => t.type === "exam")).toBe(false);
  });
});

describe("buildPlan: дата ЕНТ", () => {
  it("недель столько, сколько до даты; последняя обрезается по дате ЕНТ", () => {
    const exam = addDays(TODAY, 30); // 31 день → 5 недель
    const p = buildPlan(base({ examDate: exam }));
    expect(p.totalWeeks).toBe(5);
    expect(p.weeks[4].end).toBe(exam);
    expect(p.end).toBe(exam);
    expect(p.daysLeft).toBe(30);
    expect(p.hasDate).toBe(true);
    // 5 недель → 1 неделя повторения
    expect(p.weeks.filter((w) => w.review)).toHaveLength(1);
  });
  it("дата прошла — плана нет", () => {
    const p = buildPlan(base({ examDate: addDays(TODAY, -1) }));
    expect(p.state).toBe("past");
    expect(p.weeks).toEqual([]);
    expect(currentWeekOf(p)).toBeNull();
  });
  it("ЕНТ сегодня — план на одну неделю с мини-ЕНТ", () => {
    const p = buildPlan(base({ examDate: TODAY }));
    expect(p.totalWeeks).toBe(1);
    expect(p.weeks[0].tasks.some((t) => t.type === "exam" && t.exam === "mini")).toBe(true);
  });
  it("не влезает — overflow и перегрузка не больше 14", () => {
    const p = buildPlan(base({ units: course({ u1: 50 }), examDate: addDays(TODAY, 20) })); // 3 недели: 2 для уроков
    p.weeks.forEach((w) => expect(w.tasks.filter((t) => t.type === "lesson").length).toBeLessThanOrEqual(MAX_LESSONS_PER_WEEK));
    expect(p.overflow).toBe(22);
    expect(p.lessonsLeft).toBe(50);
  });
});

describe("buildPlan: прогресс и пропуски", () => {
  const T0 = new Date(`${TODAY}T10:00:00`).getTime();

  it("skipBasics пропускает раздел «Старт»", () => {
    const p = buildPlan(base({ skipBasics: true }));
    expect(lessonIds(p).some((id) => id.startsWith("u0-"))).toBe(false);
    expect(lessonIds(p)).toHaveLength(9);
  });
  it("уроки, пройденные до начала плана, не входят", () => {
    const lessons = { "u1-l1": { completions: 1, firstAt: T0 - 5 * 86_400_000 } };
    const p = buildPlan(base({ lessons }));
    expect(lessonIds(p)).not.toContain("u1-l1");
    expect(p.lessonsTotal).toBe(11);
  });
  it("уроки без firstAt (старые данные) считаются пройденными до плана", () => {
    const p = buildPlan(base({ lessons: { "u1-l1": { completions: 2 } } }));
    expect(lessonIds(p)).not.toContain("u1-l1");
  });
  it("урок, пройденный после начала, остаётся в плане с галочкой — план не «едет»", () => {
    const before = buildPlan(base());
    const after = buildPlan(base({ lessons: { "u0-l1": { completions: 1, firstAt: T0 } } }));
    expect(lessonIds(after)).toEqual(lessonIds(before));
    expect(after.weeks[0].done).toBe(1);
    expect(after.lessonsDone).toBe(1);
    expect(after.lessonsLeft).toBe(before.lessonsLeft - 1);
  });
  it("уроки «скоро» не входят в план, но считаются в notReady", () => {
    const p = buildPlan(base({ units: course({ u1: 3 }, { u1: 4 }) }));
    expect(lessonIds(p)).toHaveLength(3);
    expect(p.notReady).toBe(4);
  });
  it("в разделе только «скоро» — ни уроков, ни контрольной", () => {
    const p = buildPlan(base({ units: course({ u1: 0, u2: 2 }, { u1: 5 }) }));
    const flat = p.weeks.flatMap((w) => w.tasks);
    expect(flat.some((t) => t.type === "checkpoint" && t.unit === "u1")).toBe(false);
    expect(p.notReady).toBe(5);
  });
  it("контрольная только у разделов из checkpoints (мало заданий ЕНТ — контрольной нет)", () => {
    const flat = buildPlan(base({ checkpoints: new Set(["u1"]) })).weeks.flatMap((w) => w.tasks);
    expect(flat.filter((t) => t.type === "checkpoint").map((t) => (t.type === "checkpoint" ? t.unit : ""))).toEqual(["u1"]);
    expect(flat.filter((t) => t.type === "lesson")).toHaveLength(12);
  });
  it("все уроки пройдены — план из повторений и пробных", () => {
    const lessons = Object.fromEntries(base().units.flatMap((u) => u.lessons.map((l) => [l.id, { completions: 1, firstAt: 1 }])));
    const p = buildPlan(base({ lessons }));
    expect(p.lessonsTotal).toBe(0);
    expect(p.perWeekNeeded).toBeNull();
    expect(p.weeks.every((w) => w.tasks.every((t) => t.type !== "lesson"))).toBe(true);
    expect(p.weeks.every((w) => w.total > 0)).toBe(true);
  });
  it("контрольная засчитывается по итогу своего раздела после начала плана", () => {
    const exams = [
      { kind: "unit", unit: "u1", at: T0 + 1000 },
      { kind: "unit", unit: "u2", at: T0 - 2 * 86_400_000 }, // до начала плана
      { kind: "unit", at: T0 + 1000 }, // без раздела
    ];
    const flat = buildPlan(base({ exams })).weeks.flatMap((w) => w.tasks);
    const done = (u: string) => flat.find((t) => t.type === "checkpoint" && t.unit === u)!.done;
    expect(done("u1")).toBe(true);
    expect(done("u2")).toBe(false);
    expect(done("u0")).toBe(false);
  });
  it("пробный засчитывается в окне своей недели; полный засчитывается как мини", () => {
    const W = 86_400_000;
    const p = buildPlan(base({ exams: [{ kind: "full", at: T0 + 8 * W }] })); // неделя 2
    const mini2 = p.weeks[1].tasks.find((t) => t.type === "exam")!;
    expect(mini2.done).toBe(true);
    const mini4 = p.weeks[3].tasks.find((t) => t.type === "exam")!;
    expect(mini4.done).toBe(false);
    const p2 = buildPlan(base({ exams: [{ kind: "mini", at: T0 + 8 * W }] }));
    expect(p2.weeks[1].tasks.find((t) => t.type === "exam")!.done).toBe(true);
    // мини не закрывает полный в неделях повторения
    const p3 = buildPlan(base({ exams: [{ kind: "mini", at: T0 + 77 * W }] }));
    expect(p3.weeks[11].tasks.find((t) => t.type === "exam")!.done).toBe(false);
  });
  it("повторение засчитывается по числу ответов за неделю", () => {
    const days = { [addDays(TODAY, 71)]: { answers: REVIEW_ANSWERS - 1 }, [addDays(TODAY, 72)]: { answers: 1 } };
    const w = buildPlan(base({ days })).weeks[10];
    expect(w.tasks.find((t) => t.type === "review")!.done).toBe(true);
    const w2 = buildPlan(base({ days: { [addDays(TODAY, 71)]: { answers: REVIEW_ANSWERS - 1 } } })).weeks[10];
    expect(w2.tasks.find((t) => t.type === "review")!.done).toBe(false);
  });
  it("текущая неделя считается по дням от начала", () => {
    const p = buildPlan(base({ today: addDays(TODAY, 15) }));
    expect(p.currentWeek).toBe(3);
    expect(currentWeekOf(p)?.n).toBe(3);
    expect(p.weeks.map((w) => w.status).slice(0, 4)).toEqual(["past", "past", "current", "future"]);
  });
  it("последняя неделя — не дальше конца плана", () => {
    expect(buildPlan(base({ today: addDays(TODAY, 83) })).currentWeek).toBe(12);
  });
  it("behind — несделанное в прошедших неделях; perWeekNeeded — по оставшимся неделям уроков", () => {
    const p = buildPlan(base({ today: addDays(TODAY, 7) })); // неделя 2, ничего не сделано
    const past = p.weeks[0];
    expect(p.behind).toBe(past.total);
    expect(p.behind).toBeGreaterThan(0);
    // 12 уроков, 10 недель уроков, осталось 9 (недели 2..10)
    expect(p.perWeekNeeded).toBe(Math.ceil(12 / 9));
  });
  it("в неделях повторения perWeekNeeded = null", () => {
    expect(buildPlan(base({ today: addDays(TODAY, 80) })).perWeekNeeded).toBeNull();
  });
  it("устойчив к мусору в данных", () => {
    const p = buildPlan(
      base({
        lessons: { "u1-l1": { completions: Number.NaN, firstAt: Number.NaN }, x: undefined },
        days: { [TODAY]: { answers: Number.NaN } },
        exams: [{ kind: "full", at: Number.NaN }],
      }),
    );
    expect(p.state).toBe("ok");
    expect(p.lessonsTotal).toBe(12);
  });
});

describe("taskHref", () => {
  it("ссылки дел", () => {
    expect(taskHref({ key: "a", type: "lesson", id: "info-1-units", unit: "u1", done: false })).toBe("/lesson/info-1-units");
    expect(taskHref({ key: "a", type: "checkpoint", unit: "u3", done: false })).toBe("/exam/run?kind=unit&unit=u3");
    expect(taskHref({ key: "a", type: "exam", exam: "mini", done: false })).toBe("/exam/run?kind=mini");
    expect(taskHref({ key: "a", type: "exam", exam: "full", done: false })).toBe("/exam/run?kind=full");
    expect(taskHref({ key: "a", type: "review", done: false })).toBe("/drill?mode=smart");
  });
});

describe("buildPlan на реальном курсе", () => {
  it("раскладывает все готовые уроки и не падает (в том числе когда часть уроков ещё «скоро»)", () => {
    const p = buildPlan(base({ units: UNITS }));
    const ready = UNITS.flatMap((u) => u.lessons).filter((l) => l.status === "available").length;
    expect(p.lessonsTotal + p.overflow).toBe(ready);
    expect(p.lessonsTotal + p.overflow + p.notReady).toBe(UNITS.reduce((s, u) => s + u.lessons.length, 0));
    p.weeks.forEach((w) => expect(w.tasks.filter((t) => t.type === "lesson").length).toBeLessThanOrEqual(MAX_LESSONS_PER_WEEK));
  });
});

describe("formatWeekRange", () => {
  it("внутри месяца, через границу месяца, один день", () => {
    expect(formatWeekRange("2026-10-05", "2026-10-11", "ru")).toBe("5–11 окт");
    expect(formatWeekRange("2026-09-28", "2026-10-04", "ru")).toBe("28 сен – 4 окт");
    expect(formatWeekRange("2026-10-05", "2026-10-05", "ru")).toBe("5 окт");
    expect(formatWeekRange("2026-10-05", "2026-10-11", "kk")).toBe("5–11 қаз");
  });
  it("неверные даты — пустая строка", () => {
    expect(formatWeekRange("x", "2026-10-11", "ru")).toBe("");
    expect(formatWeekRange("2026-13-05", "2026-10-11", "kk")).toBe("");
  });
});

describe("навигация", () => {
  it("/plan относится к группе «Учиться», а /plans («Тарифы») — нет", () => {
    expect(groupOf("/plan")).toBe("learn");
    expect(groupOf("/plans")).toBe("progress");
    expect(hubGroup("/plan")).toBeNull();
  });
});

// ---------- Этап 15, F1: темп из профиля и план на день ----------

/** Момент дня «ГГГГ-ММ-ДД», час — локальное время (как dayStartMs в плане). */
const at = (day: string, hour = 10) => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`).getTime();
const lessonsPerWeek = (p: ReturnType<typeof buildPlan>) => p.weeks.map((w) => w.tasks.filter((t) => t.type === "lesson").length);

describe("normalizePace", () => {
  it("целое 1…14; не число — null", () => {
    expect([0, 1, 4.4, 14, 15, 99, -3].map(normalizePace)).toEqual([1, 1, 4, 14, 14, 14, 1]);
    expect([Number.NaN, Number.POSITIVE_INFINITY, "4", null, undefined].map(normalizePace)).toEqual([null, null, null, null, null]);
  });
});

describe("layoutLessons: темп из профиля", () => {
  const groups = (...sizes: number[]) => sizes.map((n, i) => ({ unit: `u${i}`, ids: Array.from({ length: n }, (_, k) => `u${i}-${k}`) }));
  const counts = (weeks: ReturnType<typeof layoutLessons>["weeks"]) => weeks.map((w) => w.filter((t) => t.type === "lesson").length);

  it("без «подтягивания» (нет даты) — ровно темп, остаток — overflow", () => {
    expect(counts(layoutLessons(groups(12), 6, { perWeek: 3, catchUp: false }).weeks)).toEqual([3, 3, 3, 3, 0, 0]);
    const r = layoutLessons(groups(30), 4, { perWeek: 3, catchUp: false });
    expect(counts(r.weeks)).toEqual([3, 3, 3, 3]);
    expect(r.overflow).toBe(18);
  });
  it("с «подтягиванием» (есть дата) — не медленнее нужного, чтобы успеть", () => {
    expect(counts(layoutLessons(groups(12), 4, { perWeek: 2 }).weeks)).toEqual([3, 3, 3, 3]);
  });
  it("темп выше нужного — не растягиваем: уроки заканчиваются раньше", () => {
    expect(counts(layoutLessons(groups(12), 6, { perWeek: 4 }).weeks)).toEqual([4, 4, 4, 0, 0, 0]);
  });
  it("темп не выше 14; мусор в темпе игнорируется", () => {
    const r = layoutLessons(groups(30), 1, { perWeek: 99, catchUp: false });
    expect(counts(r.weeks)).toEqual([MAX_LESSONS_PER_WEEK]);
    expect(r.overflow).toBe(30 - MAX_LESSONS_PER_WEEK);
    expect(layoutLessons(groups(12), 4, { perWeek: Number.NaN })).toEqual(layoutLessons(groups(12), 4));
  });
  it("раздел не рвётся и в фиксированном темпе: по разделу в неделю", () => {
    const r = layoutLessons(groups(3, 3, 3), 3, { perWeek: 3, catchUp: false });
    r.weeks.forEach((w, i) => expect(new Set(w.map((t) => t.unit))).toEqual(new Set([`u${i}`])));
  });
});

describe("buildPlan: weeklyLessons", () => {
  const dated = (days: number) => addDays(TODAY, days);

  it("без даты темп плана = weeklyLessons; нужный темп не подтягивает", () => {
    const p = buildPlan(base({ units: course({ u1: 12 }), weeklyLessons: 3 }));
    expect(lessonsPerWeek(p).slice(0, 5)).toEqual([3, 3, 3, 3, 0]);
    expect(p.pace).toBe(3);
    expect(p.needMore).toBeNull();
    const slow = buildPlan(base({ units: course({ u1: 40 }), weeklyLessons: 2 })); // 10 недель уроков × 2
    expect(lessonsPerWeek(slow).slice(0, 10)).toEqual(Array(10).fill(2));
    expect(slow.overflow).toBe(20);
    expect(slow.needMore).toBeNull(); // без даты «успеть к ЕНТ» не бывает
  });
  it("с датой: темп = max(weeklyLessons, нужный); если выбранного мало — needMore", () => {
    // 41 день → 6 недель, 2 из них повторение, 4 — уроки; 12 уроков → нужно 3 в неделю
    const slow = buildPlan(base({ units: course({ u1: 12 }), examDate: dated(41), weeklyLessons: 2 }));
    expect(lessonsPerWeek(slow).slice(0, 4)).toEqual([3, 3, 3, 3]);
    expect(slow.pace).toBe(2);
    expect(slow.needMore).toBe(3);
    // выбрано больше нужного — план идёт в выбранном темпе и заканчивается раньше
    const fast = buildPlan(base({ units: course({ u1: 12 }), examDate: dated(41), weeklyLessons: 4 }));
    expect(lessonsPerWeek(fast).slice(0, 4)).toEqual([4, 4, 4, 0]);
    expect(fast.needMore).toBeNull();
    // ровно столько, сколько нужно — предупреждения нет
    expect(buildPlan(base({ units: course({ u1: 12 }), examDate: dated(41), weeklyLessons: 3 })).needMore).toBeNull();
  });
  it("отстал: нужный темп считается по оставшимся неделям — предупреждение растёт", () => {
    const p = buildPlan(base({ units: course({ u1: 12 }), examDate: dated(41), weeklyLessons: 4, today: dated(14) })); // неделя 3, ничего не сделано
    expect(p.currentWeek).toBe(3);
    expect(p.needMore).toBe(6); // 12 уроков на 2 оставшиеся недели уроков
  });
  it("не передан или мусор — как раньше: pace и needMore пустые", () => {
    const legacy = buildPlan(base({ units: course({ u1: 12 }), examDate: dated(41) }));
    expect(legacy.pace).toBeNull();
    expect(legacy.needMore).toBeNull();
    expect(lessonsPerWeek(legacy).slice(0, 4)).toEqual([3, 3, 3, 3]);
    expect(buildPlan(base({ weeklyLessons: Number.NaN })).pace).toBeNull();
  });
  it("темп из профиля больше 14 обрезается до 14", () => {
    expect(buildPlan(base({ weeklyLessons: 21 })).pace).toBe(14);
  });
  it("дата прошла — плана нет, темп пустой", () => {
    const p = buildPlan(base({ examDate: dated(-1), weeklyLessons: 4 }));
    expect(p.state).toBe("past");
    expect(p.pace).toBeNull();
    expect(p.needMore).toBeNull();
  });
});

describe("todayQuota", () => {
  const lesson = (id: string, done = false, doneAt?: number): PlanTask => ({ key: `l:${id}`, type: "lesson", id, unit: "u1", done, at: doneAt });
  const weekOf = (tasks: PlanTask[], start = TODAY): PlanWeek => ({
    n: 1,
    start,
    end: addDays(start, 6),
    status: "current",
    review: false,
    tasks,
    done: tasks.filter((t) => t.done).length,
    total: tasks.length,
  });
  const six = () => Array.from({ length: 6 }, (_, i) => lesson(`a${i + 1}`));

  it("в понедельник: ceil(осталось / 7 дней)", () => {
    const q = todayQuota(weekOf(six()), at(TODAY));
    expect(q).toMatchObject({ total: 1, done: 0, left: 1, weekLeft: 6, daysLeft: 7 });
    expect(q.lessons.map((t) => t.id)).toEqual(["a1"]);
    expect(q.next?.id).toBe("a1");
  });
  it("к середине недели норма растёт: в среду 6 уроков на 5 дней — 2 в день", () => {
    const q = todayQuota(weekOf(six()), at("2026-10-07"));
    expect(q).toMatchObject({ total: 2, done: 0, left: 2, daysLeft: 5 });
    expect(q.lessons.map((t) => t.id)).toEqual(["a1", "a2"]);
  });
  it("норма не «уезжает» после выполнения: пройдено 2 из 2 — осталось 0, а не снова 1", () => {
    const today = at("2026-10-07");
    const tasks = [lesson("a1", true, today), lesson("a2", true, today), ...six().slice(2)];
    const q = todayQuota(weekOf(tasks), today);
    expect(q).toMatchObject({ total: 2, done: 2, left: 0, weekLeft: 4 });
    expect(q.lessons).toEqual([]);
    expect(q.next?.id).toBe("a3"); // кнопка «ещё урок» есть, но норма выполнена
  });
  it("пройден один из двух — остался один", () => {
    const today = at("2026-10-07");
    const tasks = [lesson("a1", true, today), ...six().slice(1)];
    expect(todayQuota(weekOf(tasks), today)).toMatchObject({ total: 2, done: 1, left: 1 });
  });
  it("пройденное вчера «сегодня» не считается, но уменьшает остаток", () => {
    const tasks = [lesson("a1", true, at("2026-10-06")), lesson("a2", true, at("2026-10-06")), ...six().slice(2)];
    expect(todayQuota(weekOf(tasks), at("2026-10-07"))).toMatchObject({ total: 1, done: 0, left: 1, weekLeft: 4 });
  });
  it("в последний день недели — всё, что осталось", () => {
    const q = todayQuota(weekOf(six().slice(0, 3)), at("2026-10-11"));
    expect(q).toMatchObject({ total: 3, left: 3, daysLeft: 1 });
    expect(q.lessons).toHaveLength(3);
  });
  it("всё сделано — 0 и нет следующего урока", () => {
    const today = at("2026-10-07");
    const q = todayQuota(weekOf([lesson("a1", true, today), lesson("a2", true, at("2026-10-05"))]), today);
    expect(q).toMatchObject({ total: 1, done: 1, left: 0, weekLeft: 0, next: null, lessons: [] });
  });
  it("в неделе без уроков (повторение, пробный) — 0; не-уроки норму не меняют", () => {
    const review: PlanTask = { key: "r:1", type: "review", done: false };
    expect(todayQuota(weekOf([review]), at(TODAY))).toMatchObject({ total: 0, left: 0, weekLeft: 0, next: null });
    const q = todayQuota(weekOf([...six(), review, { key: "e:mini:2", type: "exam", exam: "mini", done: false }]), at(TODAY));
    expect(q).toMatchObject({ total: 1, weekLeft: 6 });
  });
  it("неделя из будущего считается с её первого дня; устаревшая — минимум 1 день", () => {
    expect(todayQuota(weekOf(six(), addDays(TODAY, 7)), at(TODAY)).daysLeft).toBe(7);
    expect(todayQuota(weekOf(six()), at("2026-10-20")).daysLeft).toBe(1);
  });
  it("урок без отметки времени (старые данные) «сегодня» не считается", () => {
    expect(todayQuota(weekOf([lesson("a1", true), ...six().slice(1)]), at("2026-10-07")).done).toBe(0);
  });
});

describe("todayPlan и nextOpenLesson", () => {
  it("buildPlan проставляет время прохождения урока: «сегодня пройдено» берётся из плана", () => {
    const today = "2026-10-07"; // среда
    const p = buildPlan(base({ units: course({ u1: 3 }), weeklyLessons: 3, today, lessons: { "u1-l1": { completions: 1, firstAt: at(today, 9) } } }));
    const t = todayPlan(p, at(today));
    // 3 урока недели, 1 пройден сегодня, 2 осталось, 5 дней: норма ceil(3/5) = 1 — уже выполнена
    expect(t?.quota).toMatchObject({ total: 1, done: 1, left: 0, weekLeft: 2 });
    expect(t?.state).toBe("quota");
    expect(t?.target).toMatchObject({ type: "lesson", id: "u1-l2" });
  });
  it("todo: кнопка ведёт на первый урок на сегодня", () => {
    const p = buildPlan(base({ units: course({ u1: 6 }), weeklyLessons: 6 }));
    const t = todayPlan(p, at(TODAY));
    expect(t?.state).toBe("todo");
    expect(t?.target).toMatchObject({ type: "lesson", id: "u1-l1" });
  });
  it("weekDone: уроки недели пройдены — кнопка на следующий урок из будущих недель", () => {
    const lessons = Object.fromEntries(["u1-l1", "u1-l2"].map((id) => [id, { completions: 1, firstAt: at(TODAY) }]));
    const p = buildPlan(base({ units: course({ u1: 6 }), weeklyLessons: 2, lessons }));
    const t = todayPlan(p, at(TODAY));
    expect(t?.state).toBe("weekDone");
    expect(t?.target).toMatchObject({ type: "lesson", id: "u1-l3" });
  });
  it("noLessons: неделя повторения — кнопка на первое непройденное дело", () => {
    const p = buildPlan(base({ today: addDays(TODAY, 77) })); // 12-я неделя без даты — повторение
    const t = todayPlan(p, at(addDays(TODAY, 77)));
    expect(t?.state).toBe("noLessons");
    expect(t?.target).toMatchObject({ type: "review" });
  });
  it("плана нет (дата прошла) — null", () => {
    expect(todayPlan(buildPlan(base({ examDate: addDays(TODAY, -1) })), at(TODAY))).toBeNull();
  });
  it("nextOpenLesson: с текущей недели вперёд, затем хвост из прошедших недель; всё пройдено — null", () => {
    const units = course({ u1: 4 });
    const now = addDays(TODAY, 7); // вторая неделя, на первой остались непройденные
    const p = buildPlan(base({ units, weeklyLessons: 2, today: now }));
    expect(nextOpenLesson(p)?.id).toBe("u1-l3"); // текущая неделя
    const done = Object.fromEntries(["u1-l3", "u1-l4"].map((id) => [id, { completions: 1, firstAt: at(now) }]));
    expect(nextOpenLesson(buildPlan(base({ units, weeklyLessons: 2, today: now, lessons: done })))?.id).toBe("u1-l1"); // хвост
    const all = Object.fromEntries(["u1-l1", "u1-l2", "u1-l3", "u1-l4"].map((id) => [id, { completions: 1, firstAt: at(now) }]));
    expect(nextOpenLesson(buildPlan(base({ units, weeklyLessons: 2, today: now, lessons: all })))).toBeNull();
  });
});
