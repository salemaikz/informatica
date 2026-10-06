import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeState, useApp } from "@/lib/store";
import type { ExamSummary } from "@/lib/store";
import { ACH_RULES_VERSION } from "@/lib/achievement-rules";
import { quizSession } from "@/lib/chat-quiz";
import { DRILL_PAID_GRACE_MS, drillPaidKey } from "@/lib/drill-paid";
import { ENTRY_PAID_MAX, checkEntryKey, entryPaidActive, lessonEntryKey, putEntryPaid, quizEntryKey, sanitizeEntryPaid } from "@/lib/entry-paid";
import { heartsView, MINUTE, PERFECT_DROP } from "@/lib/economy";
import { dropRandom, noteTestDrop, sanitizeDropDay, testDropsLeft } from "@/lib/perfect";
import { todayKey } from "@/lib/text";
import type { AnswerRecord, SessionResult } from "@/lib/types";

// Исправления по ревью экономики этапа 16В (E1–E8): миграция достижений, флаг «идеальный урок», пробные ЕНТ в достижениях,
// «капсула показана», устойчивая загрузка, оплаченная тренировка, предел сюрпризов от тестов.

const rec = (over: Partial<AnswerRecord> = {}): AnswerRecord => ({
  stepId: "q1",
  skill: "ns.bin2dec",
  correct: true,
  score: 1,
  given: "5",
  expected: "5",
  prompt: "?",
  retry: false,
  timeMs: 1000,
  ...over,
});

const lesson = (over: Partial<SessionResult> = {}): SessionResult => ({
  kind: "lesson",
  lessonId: "ns-2-read",
  title: "Урок",
  answers: [rec()],
  xp: 10,
  maxCombo: 1,
  durationSec: 60,
  accuracy: 1,
  ...over,
});

const minitest = (over: Partial<SessionResult> = {}): SessionResult => ({
  kind: "drill",
  title: "Мини-тест",
  mode: "minitest",
  answers: Array.from({ length: 4 }, (_, i) => rec({ stepId: `m${i}` })),
  xp: 20,
  maxCombo: 1,
  durationSec: 60,
  accuracy: 1,
  ...over,
});

const exam = (over: Partial<ExamSummary> = {}): ExamSummary => ({
  id: "ex1",
  kind: "full",
  seed: 7,
  at: Date.now(),
  points: 20,
  maxPoints: 50,
  durationSec: 600,
  byTopic: {},
  ...over,
});

const st = () => useApp.getState();
const chips = () => st().wallet.chips;
const heartCount = () => heartsView(st().hearts, "free", Date.now(), todayKey()).count;
const noGoal = () => useApp.setState({ profile: { ...st().profile, dailyGoalXp: 0 } });
const DAY = 24 * 60 * MINUTE;

function fullReset() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
  st().resetProgress();
  vi.spyOn(dropRandom, "next").mockReturnValue(0.99); // по умолчанию «ничего»
  useApp.setState({ plan: { tier: "free" }, aiUsage: { day: "", count: 0, free: 0, freeTotal: 0 } });
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const oldLessons = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`l${i}`, { completions: 1, bestAccuracy: 0.8, lastAt: 1, totalXp: 10 }]));

describe("E1: достижения задним числом — молча, без чипов", () => {
  beforeEach(fullReset);

  it("новый профиль сразу на актуальной версии правил", () => {
    expect(st().achRules).toBe(ACH_RULES_VERSION);
    expect(ACH_RULES_VERSION).toBe(2);
  });

  it("старое сохранение (40 уроков): выполненное записывается при загрузке; на первом ответе чипов за достижения нет, показа нет", () => {
    noGoal();
    // Сохранение до правил 2: поля achRules нет; старые достижения (xp_500, первый урок) у ученика уже есть.
    const old = { lessons: oldLessons(40), xp: 1200, achievements: { first_lesson: 5, xp_500: 6 }, wallet: { chips: 50, earned: 50, spent: 0 } };
    const merged = mergeState(old, st());
    expect(merged.achRules).toBe(ACH_RULES_VERSION);
    expect(merged.achievements.lessons_10).toBe(Date.now());
    expect(merged.achievements.lessons_25).toBe(Date.now());
    expect(merged.achievements.lessons_50).toBeUndefined();
    expect(merged.achievements.level_5).toBe(Date.now()); // 1200 XP — уровни тоже по данным стора
    // уже полученные не перезаписываются, чипы и строки в истории не появились, показывать нечего
    expect(merged.achievements.first_lesson).toBe(5);
    expect(merged.newAchievements).toEqual([]);
    expect(merged.wallet.chips).toBe(50);
    expect(merged.ledger).toEqual([]);

    useApp.setState(merged);
    const before = chips();
    st().recordAnswer(rec(), 5);
    expect(chips()).toBe(before);
    expect(st().ledger.filter((e) => e.reason === "achievement")).toEqual([]);
    expect(st().newAchievements).toEqual([]);
    expect(st().consumeNewAchievements()).toEqual([]);
  });

  it("сохранение уже на версии 2 не трогаем: достижения выдаёт обычная проверка (с чипами)", () => {
    noGoal();
    const merged = mergeState({ lessons: oldLessons(40), xp: 1200, achRules: ACH_RULES_VERSION }, st());
    expect(merged.achievements.lessons_10).toBeUndefined();
    useApp.setState(merged);
    const before = chips();
    st().recordAnswer(rec(), 5);
    expect(st().achievements.lessons_10).toBeGreaterThan(0);
    expect(chips()).toBeGreaterThan(before);
    expect(st().ledger.some((e) => e.reason === "achievement")).toBe(true);
  });

  it("после сброса прогресса достижения не возвращаются задним числом", () => {
    useApp.setState({ lessons: oldLessons(40) as never });
    st().resetProgress();
    expect(st().achRules).toBe(ACH_RULES_VERSION);
    expect(st().achievements).toEqual({});
    expect(mergeState(JSON.parse(JSON.stringify(st())), st()).achievements).toEqual({});
  });
});

describe("E2: «идеальные уроки» и пробные ЕНТ в достижениях — честно", () => {
  beforeEach(() => {
    fullReset();
    noGoal();
  });
  const L = (i: number, over: Partial<SessionResult> = {}) => lesson({ lessonId: `p${i}`, ...over });

  it("finishSession ставит флаг perfect только за идеальное прохождение: ошибка, подсказка, пропуск — без флага", () => {
    st().finishSession(L(1));
    expect(st().lessons.p1.perfect).toBe(true);
    st().finishSession(L(2, { accuracy: 0.5, answers: [rec({ correct: false, score: 0 })] }));
    st().finishSession(L(3, { answers: [rec({ hinted: true })] })); // 100% точности, но с подсказкой
    st().finishSession(L(4, { skipped: 1 }));
    expect(st().lessons.p2.perfect).toBeUndefined();
    expect(st().lessons.p3.perfect).toBeUndefined();
    expect(st().lessons.p4.perfect).toBeUndefined();
    expect(st().lessons.p3.bestAccuracy).toBe(1);
  });

  it("флаг ставит и повторное идеальное прохождение, а раз полученный не пропадает от неидеального повтора, игры и экстерна", () => {
    st().finishSession(L(1, { answers: [rec({ correct: false, score: 0 })], accuracy: 0.5 })); // первое — с ошибкой
    expect(st().lessons.p1.perfect).toBeUndefined();
    st().finishSession(L(1)); // повтор — идеально
    expect(st().lessons.p1.perfect).toBe(true);
    st().finishSession(L(1, { answers: [rec({ correct: false, score: 0 })], accuracy: 0.5 }));
    expect(st().lessons.p1.perfect).toBe(true);
    st().completeLessons(["p1", "g1"], "game", 1);
    st().completeLessons(["e1"], "extern", 1);
    expect(st().lessons.p1.perfect).toBe(true);
    expect(st().lessons.g1.perfect).toBeUndefined();
    expect(st().lessons.e1.perfect).toBeUndefined();
    // игра или экстерн, пришедшие в finishSession с таким via, флага не ставят
    st().finishSession(L(2, { via: "game" }));
    st().finishSession(L(3, { via: "extern" }));
    expect(st().lessons.p2.perfect).toBeUndefined();
    expect(st().lessons.p3.perfect).toBeUndefined();
  });

  it("perfect_10: десять разных идеальных уроков; десять со 100% точности, но с подсказками — нет", () => {
    for (let i = 0; i < 10; i++) st().finishSession(L(i, { answers: [rec({ hinted: true })] }));
    expect(st().achievements.perfect_10).toBeUndefined();
    for (let i = 0; i < 9; i++) st().finishSession(L(100 + i));
    expect(st().achievements.perfect_10).toBeUndefined();
    st().finishSession(L(109));
    expect(st().achievements.perfect_10).toBeGreaterThan(0);
    expect(st().achievements.perfect_50).toBeUndefined();
  });

  it("exam_5: пять полных пробных, где отвечено не меньше половины заданий; пустые и неполные не считаются", () => {
    const full = (id: string, answered: number) => st().recordExam(exam({ id, questions: 40, points: answered }), { "ns.bin2dec": Array(answered).fill(1) });
    for (let i = 0; i < 4; i++) full(`f${i}`, 30);
    expect(st().achievements.exam_5).toBeUndefined();
    full("f-lazy", 5); // 5 из 40 — не завершён
    expect(st().exams.find((e) => e.id === "f-lazy")?.answered).toBe(5);
    expect(st().achievements.exam_5).toBeUndefined();
    full("f-half-", 19); // 19 из 40 — меньше половины
    expect(st().achievements.exam_5).toBeUndefined();
    full("f-half", 20); // ровно половина
    expect(st().achievements.exam_5).toBeGreaterThan(0);
  });

  it("чипы за пробный ЕНТ и достижение считают «завершён» одним правилом", () => {
    const base = chips();
    st().recordExam(exam({ id: "a", questions: 40, points: 3 }), { "ns.bin2dec": Array(5).fill(1) });
    expect(st().ledger.some((e) => e.reason === "exam")).toBe(false);
    st().recordExam(exam({ id: "b", questions: 40, points: 20 }), { "ns.bin2dec": Array(20).fill(1) });
    expect(st().ledger.filter((e) => e.reason === "exam")).toHaveLength(1);
    expect(chips()).toBeGreaterThan(base);
  });
});

describe("E5: «капсула показана» — сюрприз из истории не разыгрывается заново", () => {
  beforeEach(() => {
    fullReset();
    noGoal();
    vi.spyOn(dropRandom, "next").mockReturnValue(0.3);
  });
  const perfectTopic = (id = "t1") => st().recordExam(exam({ id, kind: "topic", points: 10, maxPoints: 10 }), { "ns.bin2dec": [1, 1] });

  it("после recordExam есть drop, но нет dropSeen; markDropSeen ставит отметку один раз", () => {
    perfectTopic();
    expect(st().exams[0].drop).toEqual({ kind: "chips", amount: PERFECT_DROP.chips });
    expect(st().exams[0].dropSeen).toBeUndefined();
    st().markDropSeen("t1");
    expect(st().exams[0].dropSeen).toBe(true);
    const ref = st().exams;
    st().markDropSeen("t1"); // уже отмечено — без записи
    expect(st().exams).toBe(ref);
  });

  it("нет такой попытки или у неё нет сюрприза — ничего не меняется", () => {
    st().recordExam(exam({ id: "t2", kind: "topic", points: 9, maxPoints: 10 }), { "ns.bin2dec": [1] });
    const ref = st().exams;
    st().markDropSeen("t2");
    st().markDropSeen("нет-такой");
    expect(st().exams).toBe(ref);
    expect(st().exams[0].dropSeen).toBeUndefined();
  });

  it("повторная запись той же попытки не теряет ни сюрприз, ни отметку «показана»", () => {
    perfectTopic();
    st().markDropSeen("t1");
    perfectTopic();
    expect(st().exams).toHaveLength(1);
    expect(st().exams[0].drop).toEqual({ kind: "chips", amount: PERFECT_DROP.chips });
    expect(st().exams[0].dropSeen).toBe(true);
  });

  it("отметка переживает перезагрузку; без сюрприза она не сохраняется", () => {
    perfectTopic();
    st().markDropSeen("t1");
    const back = mergeState(JSON.parse(JSON.stringify(st())), st());
    expect(back.exams[0].dropSeen).toBe(true);
    const odd = mergeState({ exams: [{ ...exam({ id: "x" }), dropSeen: true }] }, st());
    expect(odd.exams[0].dropSeen).toBeUndefined();
  });
});

describe("E6: устойчивая загрузка попыток и уроков", () => {
  beforeEach(fullReset);

  it("в exams остаются только объекты с конечными points/maxPoints/at; null, строки и мусор отбрасываются", () => {
    const good = exam({ id: "good", kind: "unit", points: 9, maxPoints: 10 });
    const raw = [
      null,
      7,
      "x",
      [],
      { id: "no-numbers", kind: "full" },
      { ...good, id: "nan-points", points: Number.NaN },
      { ...good, id: "str-max", maxPoints: "10" },
      { ...good, id: "inf-at", at: Number.POSITIVE_INFINITY },
      { ...good, id: "bad-kind", kind: "weird" },
      { ...good, id: "" },
      good,
    ];
    const merged = mergeState({ exams: raw }, st());
    expect(merged.exams.map((e) => e.id)).toEqual(["good"]);
    expect(() => mergeState({ exams: raw, lessons: oldLessons(12) }, st())).not.toThrow();
  });

  it("недостающие второстепенные поля приводятся к безопасным; сюрприз проверяется как недоверенный", () => {
    const merged = mergeState({ exams: [{ id: "e", kind: "topic", points: 1, maxPoints: 2, at: 5, drop: { kind: "chips", amount: -4 }, byTopic: null }] }, st());
    expect(merged.exams[0]).toMatchObject({ id: "e", seed: 0, durationSec: 0, byTopic: {} });
    expect(merged.exams[0].drop).toBeUndefined();
  });

  it("нечисловые xp, maxCombo и битые записи уроков не роняют загрузку и миграцию достижений", () => {
    const merged = mergeState({ xp: "много", maxCombo: null, lessons: { a: null, b: "x", c: { completions: 1, lastAt: 1 } }, achievements: { a: "x", lessons_10: 3 }, newAchievements: [1, "ok"] }, st());
    expect(merged.xp).toBe(0);
    expect(merged.maxCombo).toBe(0);
    expect(Object.keys(merged.lessons)).toEqual(["c"]);
    expect(merged.achievements).toEqual({ lessons_10: 3 });
    expect(merged.newAchievements).toEqual(["ok"]);
    expect(() => mergeState({ lessons: null, exams: null, achievements: null }, st())).not.toThrow();
  });
});

describe("E7 / #120: оплаченный вход — то же занятие 20 минут не списывает сердечко второй раз", () => {
  beforeEach(fullReset);
  const key = drillPaidKey("skill", { skill: "ns.bin2dec" });

  it("ключ тренировки: режим + навык, раздел, тема, запись истории, узел, задание, область", () => {
    expect(drillPaidKey("smart")).toBe(drillPaidKey("smart", {}));
    expect(drillPaidKey("skill", { skill: "a" })).not.toBe(drillPaidKey("skill", { skill: "b" }));
    expect(drillPaidKey("skill", { skill: "a" })).not.toBe(drillPaidKey("topic", { topic: "a" }));
    expect(drillPaidKey("context", { item: "x" })).not.toBe(drillPaidKey("codeview", { area: "x" }));
    expect(drillPaidKey("minitest", { node: "n1" })).not.toBe(drillPaidKey("practice", { node: "n1" }));
  });

  it("payEntryOnce: первый вход платный и запоминается; то же занятие в течение 20 минут — бесплатно", () => {
    expect(heartCount()).toBe(5);
    const first = st().payEntryOnce(key, 1);
    expect(first).toMatchObject({ ok: true, paid: 1 });
    expect(heartCount()).toBe(4);
    expect(st().entryPaid).toEqual({ [key]: Date.now() });
    vi.setSystemTime(Date.now() + 19 * MINUTE);
    expect(st().payEntryOnce(key, 1)).toMatchObject({ ok: true, paid: 0 });
    expect(heartCount()).toBe(4);
    vi.setSystemTime(Date.now() + 2 * MINUTE); // от оплаты прошла 21 минута
    expect(st().payEntryOnce(key, 1)).toMatchObject({ ok: true, paid: 1 });
    expect(heartCount()).toBe(3);
  });

  it("двойной вызов (StrictMode, двойное нажатие) списывает один раз; payDrill — синоним", () => {
    const k = lessonEntryKey("ns-1-bits");
    st().payEntryOnce(k, 1);
    st().payEntryOnce(k, 1);
    st().payDrill(k, 1);
    expect(heartCount()).toBe(4);
  });

  it("payEntryFresh («Начать заново») списывает всегда и обновляет отметку", () => {
    const k = lessonEntryKey("ns-1-bits");
    st().payEntryOnce(k, 1);
    vi.setSystemTime(Date.now() + 5 * MINUTE);
    expect(st().payEntryFresh(k, 1)).toMatchObject({ ok: true, paid: 1 });
    expect(heartCount()).toBe(3);
    expect(st().entryPaid[k]).toBe(Date.now());
    // Отметка обновлена: 19 минут от «Начать заново» (24 от первой оплаты) — ещё бесплатно.
    vi.setSystemTime(Date.now() + 19 * MINUTE);
    expect(st().payEntryOnce(k, 1).paid).toBe(0);
  });

  it("другие занятия платные, их отметки живут рядом; граница ровно 20 минут — ещё бесплатно", () => {
    st().payEntryOnce(key, 1);
    expect(st().payEntryOnce(drillPaidKey("skill", { skill: "other" }), 1).paid).toBe(1);
    expect(st().payEntryOnce(lessonEntryKey("a"), 1).paid).toBe(1);
    expect(heartCount()).toBe(2);
    expect(Object.keys(st().entryPaid)).toHaveLength(3);
    expect(st().payEntryOnce(key, 1).paid).toBe(0);
    const k = drillPaidKey("smart");
    st().payEntryOnce(k, 1);
    vi.setSystemTime(Date.now() + DRILL_PAID_GRACE_MS);
    expect(st().payEntryOnce(k, 1).paid).toBe(0);
  });

  it("помним не больше ENTRY_PAID_MAX самых свежих отметок", () => {
    let paid = {};
    const t0 = Date.now();
    for (let i = 0; i < ENTRY_PAID_MAX + 3; i++) paid = putEntryPaid(paid, `k${i}`, t0 + i * 1000);
    const keys = Object.keys(paid);
    expect(keys).toHaveLength(ENTRY_PAID_MAX);
    expect(keys).not.toContain("k0");
    expect(keys).toContain(`k${ENTRY_PAID_MAX + 2}`);
    // Просроченные выкидываются при следующей записи.
    expect(Object.keys(putEntryPaid({ old: t0 - DRILL_PAID_GRACE_MS - 1 }, "new", t0))).toEqual(["new"]);
  });

  it("закончили тренировку — отметка снимается: следующая такая же снова платная", () => {
    st().payEntryOnce(key, 1);
    expect(entryPaidActive(st().entryPaid, key, Date.now())).toBe(true);
    st().finishSession({ kind: "drill", title: "Т", mode: "skill", drillKey: key, answers: [rec()], xp: 5, maxCombo: 1, durationSec: 10, accuracy: 1 });
    expect(st().entryPaid).toEqual({});
    expect(st().payEntryOnce(key, 1).paid).toBe(1);
  });

  it("закончили урок — снимается ключ урока его режима; «Проверить себя» — свой ключ", () => {
    const learn = lessonEntryKey("ns-2-read");
    const check = checkEntryKey("ns-2-read");
    st().payEntryOnce(learn, 1);
    st().payEntryOnce(check, 1);
    st().finishSession(lesson());
    expect(Object.keys(st().entryPaid)).toEqual([check]);
    st().payEntryOnce(learn, 1);
    st().finishSession(lesson({ via: "check" }));
    expect(Object.keys(st().entryPaid)).toEqual([learn]);
  });

  it("квиз в чате со своим ключом снимает только его; итог без ключа и чужая тренировка отметку не трогают", () => {
    st().payEntryOnce(key, 1);
    const quiz = quizEntryKey(undefined);
    st().payEntryOnce(quiz, 1);
    expect(heartCount()).toBe(3);
    st().finishSession({ ...quizSession([rec()], 5, 1, 10, "Квиз"), drillKey: quiz });
    expect(Object.keys(st().entryPaid)).toEqual([key]);
    // Итог без ключа вообще и итог тренировки с другим ключом — тоже не трогают.
    st().finishSession({ kind: "drill", title: "Т", mode: "skill", answers: [rec()], xp: 5, maxCombo: 1, durationSec: 10, accuracy: 1 });
    st().finishSession({ kind: "drill", title: "Т", mode: "smart", drillKey: drillPaidKey("smart"), answers: [rec()], xp: 5, maxCombo: 1, durationSec: 10, accuracy: 1 });
    expect(st().entryPaid).toEqual({ [key]: Date.now() });
    vi.setSystemTime(Date.now() + 10 * MINUTE);
    expect(st().payEntryOnce(key, 1)).toMatchObject({ ok: true, paid: 0 });
    expect(heartCount()).toBe(3);
  });

  it("мини-тест: ключ из итога тоже снимает отметку", () => {
    const k = drillPaidKey("minitest", { node: "n1" });
    st().payEntryOnce(k, 1);
    st().finishSession({ kind: "drill", title: "М", mode: "minitest", drillKey: k, answers: [rec()], xp: 5, maxCombo: 1, durationSec: 10, accuracy: 1 });
    expect(st().entryPaid).toEqual({});
  });

  it("не хватает сердечек — отказ, ничего не запоминается; «Безлимит» ничего не списывает и не запоминает", () => {
    for (let i = 0; i < 5; i++) st().payEntry(1);
    expect(st().payEntryOnce(key, 1)).toMatchObject({ ok: false, paid: 0 });
    expect(st().payEntryFresh(key, 1)).toMatchObject({ ok: false, paid: 0 });
    expect(st().entryPaid).toEqual({});
    fullReset();
    st().startTrial();
    expect(st().payEntryOnce(key, 1)).toMatchObject({ ok: true, paid: 0 });
    expect(st().payEntryFresh(key, 1)).toMatchObject({ ok: true, paid: 0 });
    expect(st().entryPaid).toEqual({});
  });

  it("отметки переживают перезагрузку; просроченные, из будущего и мусор отбрасываются", () => {
    st().payEntryOnce(key, 1);
    expect(mergeState(JSON.parse(JSON.stringify(st())), st()).entryPaid).toEqual({ [key]: Date.now() });
    const now = Date.now();
    expect(sanitizeEntryPaid({ [key]: now - DRILL_PAID_GRACE_MS - 1 }, now)).toEqual({});
    expect(sanitizeEntryPaid({ [key]: now + 1000 }, now)).toEqual({});
    expect(sanitizeEntryPaid({ "": now }, now)).toEqual({});
    expect(sanitizeEntryPaid({ [key]: "5" }, now)).toEqual({});
    expect(sanitizeEntryPaid({ [key]: Number.NaN }, now)).toEqual({});
    expect(sanitizeEntryPaid(null, now)).toEqual({});
    expect(sanitizeEntryPaid([], now)).toEqual({});
    expect(sanitizeEntryPaid({ [key]: now, x: now - 1 }, now)).toEqual({ [key]: now, x: now - 1 });
    expect(entryPaidActive({ [key]: now }, "другой", now)).toBe(false);
    expect(entryPaidActive(null, key, now)).toBe(false);
  });

  it("перенос старого drillPaid ({ key, at }) при загрузке: оплаченная тренировка остаётся бесплатной, само поле уходит", () => {
    const now = Date.now();
    const saved = { ...JSON.parse(JSON.stringify(st())), drillPaid: { key, at: now - MINUTE } };
    delete saved.entryPaid;
    const merged = mergeState(saved, st()) as unknown as Record<string, unknown>;
    expect(merged.entryPaid).toEqual({ [key]: now - MINUTE });
    expect("drillPaid" in merged).toBe(false);
    // Просроченная старая отметка и мусор не переносятся.
    expect(sanitizeEntryPaid(undefined, now, { key, at: now - DRILL_PAID_GRACE_MS - 1 })).toEqual({});
    expect(sanitizeEntryPaid(undefined, now, { key: 5, at: now })).toEqual({});
    expect(sanitizeEntryPaid(undefined, now, "мусор")).toEqual({});
  });
});

describe("E8: сюрприз от тестов — не больше 3 раз в день", () => {
  beforeEach(() => {
    fullReset();
    noGoal();
  });
  const roll = (r: number) => vi.spyOn(dropRandom, "next").mockReturnValue(r);
  const mini = (i: number) => st().finishSession(minitest({ title: `Мини ${i}` }));

  it("константа: 3 в день", () => {
    expect(PERFECT_DROP.testsPerDay).toBe(3);
  });

  it("мини-тесты: три броска, четвёртый без капсулы; на следующий день — снова", () => {
    const spy = roll(0.3);
    expect(mini(1).perfectDrop).toEqual({ kind: "chips", amount: 3 });
    expect(mini(2).perfectDrop).toEqual({ kind: "chips", amount: 3 });
    expect(mini(3).perfectDrop).toEqual({ kind: "chips", amount: 3 });
    const before = chips();
    expect(mini(4).perfectDrop).toBeNull();
    expect(spy).toHaveBeenCalledTimes(3);
    expect(st().dropDay).toEqual({ day: todayKey(), count: 3 });
    expect(chips() - before).toBe(0); // в мини-тесте чипов нет, а сюрприз не выдан
    vi.setSystemTime(Date.now() + DAY);
    expect(mini(5).perfectDrop).toEqual({ kind: "chips", amount: 3 });
    expect(spy).toHaveBeenCalledTimes(4);
    expect(st().dropDay).toEqual({ day: todayKey(), count: 1 });
  });

  it("бросок «ничего» тоже считается; тест с ошибкой не считается", () => {
    const spy = roll(0.99);
    expect(mini(1).perfectDrop).toEqual({ kind: "none" });
    st().finishSession(minitest({ accuracy: 0.75, answers: [rec({ stepId: "m1", correct: false, score: 0 }), rec({ stepId: "m2" })] }));
    expect(st().dropDay.count).toBe(1);
    mini(2);
    mini(3);
    expect(mini(4).perfectDrop).toBeNull();
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("предел общий для мини-тестов, тестов по теме и по разделу", () => {
    const spy = roll(0.3);
    mini(1);
    st().recordExam(exam({ id: "t1", kind: "topic", points: 10, maxPoints: 10 }), { "ns.bin2dec": [1, 1] });
    st().recordExam(exam({ id: "u1", kind: "unit", unit: "a", points: 10, maxPoints: 10 }), { "ns.bin2dec": [1] });
    expect(spy).toHaveBeenCalledTimes(3);
    expect(st().exams.find((e) => e.id === "u1")?.drop).toEqual({ kind: "chips", amount: 3 });
    // четвёртый и пятый тест — без броска и без записи сюрприза
    st().recordExam(exam({ id: "t2", kind: "topic", points: 10, maxPoints: 10 }), { "ns.bin2dec": [1, 1] });
    expect(st().exams.find((e) => e.id === "t2")?.drop).toBeUndefined();
    expect(mini(2).perfectDrop).toBeNull();
    expect(spy).toHaveBeenCalledTimes(3);
    expect(st().dropDay.count).toBe(3);
  });

  it("повторная запись той же попытки счётчик не увеличивает", () => {
    roll(0.3);
    st().recordExam(exam({ id: "t1", kind: "topic", points: 10, maxPoints: 10 }), { "ns.bin2dec": [1, 1] });
    st().recordExam(exam({ id: "t1", kind: "topic", points: 10, maxPoints: 10 }), { "ns.bin2dec": [1, 1] });
    expect(st().dropDay.count).toBe(1);
  });

  it("уроки — без предела и в счётчик не входят", () => {
    const spy = roll(0.3);
    for (let i = 0; i < 5; i++) expect(st().finishSession(lesson({ lessonId: `u${i}` })).perfectDrop).toEqual({ kind: "chips", amount: 3 });
    expect(spy).toHaveBeenCalledTimes(5);
    expect(st().dropDay.count).toBe(0);
    // исчерпанный предел тестов урокам не мешает
    mini(1);
    mini(2);
    mini(3);
    expect(st().finishSession(lesson({ lessonId: "u-last" })).perfectDrop).toEqual({ kind: "chips", amount: 3 });
  });

  it("чистые помощники и санитайзер", () => {
    const today = "2027-01-15";
    expect(testDropsLeft({ day: "", count: 0 }, today)).toBe(3);
    expect(testDropsLeft({ day: today, count: 2 }, today)).toBe(1);
    expect(testDropsLeft({ day: today, count: 9 }, today)).toBe(0);
    expect(testDropsLeft({ day: "2027-01-14", count: 3 }, today)).toBe(3); // вчерашний счётчик не в счёт
    expect(noteTestDrop({ day: "2027-01-14", count: 3 }, today)).toEqual({ day: today, count: 1 });
    expect(noteTestDrop({ day: today, count: 1 }, today)).toEqual({ day: today, count: 2 });
    expect(sanitizeDropDay({ day: today, count: 2.7 })).toEqual({ day: today, count: 2 });
    expect(sanitizeDropDay({ day: today, count: 500 })).toEqual({ day: today, count: 99 });
    for (const bad of [null, 5, [], { day: "вчера", count: 1 }, { day: today, count: -1 }, { day: today, count: "2" }, { day: today }]) {
      expect(sanitizeDropDay(bad)).toEqual({ day: "", count: 0 });
    }
    expect(mergeState({ dropDay: { day: today, count: 2 } }, st()).dropDay).toEqual({ day: today, count: 2 });
  });
});
