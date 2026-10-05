import { describe, expect, it } from "vitest";
import { ENT_POOL } from "@/content/ent";
import { LESSONS } from "@/content/course";
import {
  detailHref,
  entryClock,
  entryPercent,
  entryResult,
  entryTitle,
  entryTone,
  examResultHref,
  filterCounts,
  groupByDay,
  mistakeCounts,
  redoHref,
  relativeDay,
  replayHref,
  showExamsInHistory,
  visibleFilters,
} from "@/components/history/logic";
import { buildHistoryRedo, buildMistakes, hasBank, parseDrillMode } from "@/lib/drill";
import { entRef } from "@/lib/ent-steps";
import { isQuestion } from "@/lib/evaluate";
import type { HistoryEntry, WrongItem } from "@/lib/history";
import type { DictKey } from "@/i18n/dict";
import { dict } from "@/i18n/dict";
import { todayKey } from "@/lib/text";

const wrong = (stepId: string, over: Partial<WrongItem> = {}): WrongItem => ({ stepId, prompt: "p", given: "g", expected: "e", ...over });

const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: "e1",
  at: new Date(2026, 9, 2, 14, 5).getTime(),
  kind: "lesson",
  title: "Двоичная система",
  correct: 8,
  total: 10,
  durationSec: 120,
  xp: 40,
  wrong: [],
  fixed: [],
  ...over,
});

// Реальные данные курса и банка ЕНТ.
const lessonWithQuestion = Object.values(LESSONS).find((l) => l.steps.some((s) => isQuestion(s) && s.type !== "solution" && s.skill && hasBank(s.skill)))!;
const lessonStep = lessonWithQuestion.steps.find((s) => isQuestion(s) && s.type !== "solution" && s.skill && hasBank(s.skill))!;
const entSingle = ENT_POOL.find((i) => i.kind === "single")!;
const bankSkill = lessonStep.skill!;

describe("parseDrillMode: history", () => {
  it("знает режим history, неизвестное — smart", () => {
    expect(parseDrillMode("history")).toBe("history");
    expect(parseDrillMode("nope")).toBe("smart");
  });
});

describe("buildMistakes: ссылки ent:…", () => {
  it("ent:<id> собирается в задание ЕНТ, map ведёт на ошибку", () => {
    const ref = entRef(entSingle.id);
    const { steps, map } = buildMistakes([{ stepId: ref, skill: entSingle.skill }], {}, 1);
    expect(steps).toHaveLength(1);
    expect(steps[0].id).toBe(ref);
    expect(map[ref]).toBe(ref);
  });

  it("ent: с пунктом соответствия / вопросом контекста", () => {
    const ctx = ENT_POOL.find((i) => i.kind === "context");
    const mt = ENT_POOL.find((i) => i.kind === "match");
    const refs = [ctx && entRef(ctx.id, 0), mt && entRef(mt.id, 1)].filter((x): x is string => !!x);
    const { steps } = buildMistakes(refs.map((r) => ({ stepId: r })), {}, 1);
    expect(steps.map((s) => s.id)).toEqual(refs);
  });

  it("битая ссылка без навыка отбрасывается, с навыком — свежее задание банка", () => {
    expect(buildMistakes([{ stepId: "ent:нет-такого" }], {}, 1).steps).toHaveLength(0);
    const { steps, map } = buildMistakes([{ stepId: "ent:нет-такого", skill: bankSkill }], {}, 1);
    expect(steps).toHaveLength(1);
    expect(map[steps[0].id]).toBe("ent:нет-такого");
  });
});

describe("buildHistoryRedo", () => {
  it("берёт только неисправленные ошибки: шаг урока → ent → банк", () => {
    const e = entry({
      lessonId: lessonWithQuestion.id,
      wrong: [
        wrong(lessonStep.id, { lessonId: lessonWithQuestion.id, skill: bankSkill }),
        wrong(entRef(entSingle.id), { skill: entSingle.skill }),
        wrong("gone-step", { skill: bankSkill }),
        wrong("fixed-step", { skill: bankSkill }),
      ],
      fixed: ["fixed-step"],
    });
    const { steps, map } = buildHistoryRedo(e, {}, 42);
    expect(steps).toHaveLength(3);
    // исходный шаг урока
    expect(steps[0].id).toBe(lessonStep.id);
    expect(map[lessonStep.id]).toBe(lessonStep.id);
    // задание ЕНТ
    expect(steps[1].id).toBe(entRef(entSingle.id));
    // свежее задание банка на навык; ошибка исправленная не вернулась
    expect(map[steps[2].id]).toBe("gone-step");
    expect(Object.values(map)).not.toContain("fixed-step");
  });

  it("все ошибки исправлены → пустой набор", () => {
    const e = entry({ wrong: [wrong("a")], fixed: ["a"] });
    expect(buildHistoryRedo(e, {}, 1).steps).toEqual([]);
  });

  it("не режет набор по 8, как «работа над ошибками» (до MAX_WRONG_PER_ENTRY)", () => {
    const wrongs = Array.from({ length: 12 }, (_, i) => wrong(`x${i}`, { skill: bankSkill }));
    expect(buildHistoryRedo(entry({ wrong: wrongs }), {}, 1).steps.length).toBeGreaterThan(8);
  });
});

describe("логика экрана истории", () => {
  const t = (key: DictKey, params?: Record<string, string | number>) =>
    dict[key].ru.replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k] ?? `{${k}}`));

  it("заголовок: свой, иначе по виду/режиму", () => {
    expect(entryTitle(entry(), t)).toBe("Двоичная система");
    expect(entryTitle(entry({ kind: "exam", mode: "mini", title: "" }), t)).toBe("Пробный ЕНТ · мини");
    expect(entryTitle(entry({ kind: "exam", mode: "full", title: "" }), t)).toBe("Пробный ЕНТ · полный");
    expect(entryTitle(entry({ kind: "exam", mode: "topic", title: "" }), t)).toBe("Пробный ЕНТ · по теме");
    expect(entryTitle(entry({ kind: "exam", title: "" }), t)).toBe("Пробный ЕНТ");
    expect(entryTitle(entry({ kind: "drill", mode: "review", title: "  " }), t)).toBe("Повторение");
    expect(entryTitle(entry({ kind: "drill", mode: "?", title: "" }), t)).toBe("Тренировка");
    expect(entryTitle(entry({ kind: "check", title: "" }), t)).toBe("Проверка себя");
  });

  it("результат: «верно 8 из 10» (пропуск входит в N) и «32 / 50 баллов», процент, цвет", () => {
    expect(entryResult(entry(), t)).toBe("верно 8 из 10");
    const ex = entry({ kind: "exam", points: 32, maxPoints: 50, correct: 0, total: 0 });
    expect(entryResult(ex, t)).toBe("32 / 50 баллов");
    expect(entryPercent(ex)).toBe(64);
    expect(entryTone(entry({ correct: 8, total: 10 }))).toBe("success");
    expect(entryTone(entry({ correct: 5, total: 10 }))).toBe("warning");
    expect(entryTone(entry({ correct: 4, total: 10 }))).toBe("danger");
    expect(entryTone(ex)).toBe("warning");
  });

  it("ошибки: всего / исправлено / осталось", () => {
    const e = entry({ wrong: [wrong("a"), wrong("b"), wrong("c")], fixed: ["b", "лишний"] });
    expect(mistakeCounts(e)).toEqual({ total: 3, fixed: 1, open: 2 });
  });

  it("группировка по дням сохраняет порядок", () => {
    const d1 = new Date(2026, 9, 2, 18).getTime();
    const d2 = new Date(2026, 9, 2, 9).getTime();
    const d3 = new Date(2026, 9, 1, 23).getTime();
    const groups = groupByDay([entry({ id: "a", at: d1 }), entry({ id: "b", at: d2 }), entry({ id: "c", at: d3 })]);
    expect(groups.map((g) => [g.key, g.entries.map((e) => e.id)])).toEqual([
      ["2026-10-02", ["a", "b"]],
      ["2026-10-01", ["c"]],
    ]);
    expect(groupByDay([])).toEqual([]);
  });

  it("сегодня / вчера / раньше", () => {
    const now = new Date(2026, 9, 2, 12).getTime();
    expect(relativeDay(todayKey(new Date(now)), now)).toBe("today");
    expect(relativeDay("2026-10-01", now)).toBe("yesterday");
    expect(relativeDay("2026-09-20", now)).toBeNull();
  });

  it("время записи", () => {
    expect(entryClock(new Date(2026, 9, 2, 14, 5).getTime())).toBe("14:05");
    expect(entryClock(0)).toBe("");
  });

  it("ссылки", () => {
    expect(redoHref("e1")).toBe("/drill?mode=history&entry=e1");
    expect(detailHref("e1")).toBe("/history/e1");
    expect(examResultHref("x")).toBe("/exam/result/x");
    expect(replayHref(entry({ lessonId: "l1" }))).toBe("/lesson/l1");
    expect(replayHref(entry({ kind: "check", lessonId: "l1" }))).toBe("/lesson/l1?mode=check");
    expect(replayHref(entry({ kind: "drill" }))).toBeNull();
    expect(replayHref(entry({ lessonId: undefined }))).toBeNull();
  });

  it("счётчики фильтров", () => {
    const list = [
      entry({ id: "1" }),
      entry({ id: "2", kind: "drill", wrong: [wrong("a")] }),
      entry({ id: "3", kind: "exam" }),
      entry({ id: "4", kind: "check" }),
    ];
    expect(filterCounts(list)).toEqual({ all: 4, lessons: 2, drills: 1, exams: 1, open: 1 });
  });

  it("фильтр «Пробный ЕНТ»: в треке ЕНТ всегда, у школьника — только если старые пробники есть", () => {
    const none = filterCounts([entry({ id: "1" })]);
    const some = filterCounts([entry({ id: "1" }), entry({ id: "2", kind: "exam" })]);
    expect(showExamsInHistory(true, none)).toBe(true);
    expect(showExamsInHistory(false, none)).toBe(false);
    expect(showExamsInHistory(false, some)).toBe(true);
    expect(visibleFilters(true)).toEqual(["all", "lessons", "drills", "exams", "open"]);
    expect(visibleFilters(false)).toEqual(["all", "lessons", "drills", "open"]);
  });

  it("школьные тексты истории: оба языка, без ЕНТ/ҰБТ", () => {
    for (const key of ["history.subtitle.school", "history.empty.text.school"] as const) {
      expect(dict[key].ru.trim(), key).toBeTruthy();
      expect(dict[key].kk.trim(), key).toBeTruthy();
      expect(dict[key].ru, key).not.toMatch(/ЕНТ/);
      expect(dict[key].kk, key).not.toMatch(/ҰБТ|ЕНТ/);
    }
  });
});
