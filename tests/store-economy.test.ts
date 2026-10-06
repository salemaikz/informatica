import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeState, useApp } from "@/lib/store";
import { ACHIEVEMENT_CHIPS, MINUTE, PERFECT_DROP, PLAN_FEATURES, START_WALLET, CHIP_REWARD, heartsView } from "@/lib/economy";
import { dropRandom } from "@/lib/perfect";
import { todayKey } from "@/lib/text";
import type { AnswerRecord, SessionResult } from "@/lib/types";
import type { ExamSummary } from "@/lib/store";
import type { LessonRun } from "@/lib/lesson-run";

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

const drill = (n = 3, accuracy = 1, over: Partial<SessionResult> = {}): SessionResult => ({
  kind: "drill",
  title: "Тренировка",
  mode: "smart",
  answers: Array.from({ length: n }, (_, i) => rec({ stepId: `d${i}` })),
  xp: 30,
  maxCombo: 1,
  durationSec: 60,
  accuracy,
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

const wrongEnt = (stepId: string) => ({ stepId, skill: "ns.bin2dec", prompt: "Условие", given: "1", expected: "2" });

const st = () => useApp.getState();
/** Потратить одно сердечко (вход в урок); возвращает запас после. */
const lose = () => st().payEntry(1).view;
// resetProgress сохраняет тариф — для изоляции тестов сбрасываем и его.
function fullReset() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
  st().resetProgress();
  // «Сюрприз за идеальный урок» (этап 16В): по умолчанию кубик «ничего» — чипы и сердечки в тестах не прыгают; тесты броска задают свои значения.
  vi.spyOn(dropRandom, "next").mockReturnValue(0.99);
  // «Бесплатные навсегда» (#99) переживают resetProgress — для изоляции тестов обнуляем и их.
  useApp.setState({ plan: { tier: "free" }, aiUsage: { day: "", count: 0, free: 0, freeTotal: 0 } });
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const chips = () => st().wallet.chips;
const heartCount = () => heartsView(st().hearts, "free", Date.now(), todayKey()).count;
/** Приветственный запас (20 чипов) — на покупки не хватает, поэтому тестам с тратами выдаём кошелёк. */
const START = START_WALLET.chips;
const fund = (n = 100) => useApp.setState({ wallet: { chips: n, earned: n, spent: 0 } });

describe("стор: чипы за опыт и бонусы", () => {
  beforeEach(fullReset);

  it("старт: 20 приветственных чипов, полный запас сердечек, бесплатный тариф", () => {
    expect(START).toBe(20);
    expect(st().wallet).toEqual({ chips: 20, earned: 20, spent: 0 });
    expect(st().plan.tier).toBe("free");
    expect(heartCount()).toBe(5);
    expect(st().ledger).toEqual([]);
    expect(st().history).toEqual([]);
  });

  it("recordAnswer: за опыт чипы не дают (#105)", () => {
    st().recordAnswer(rec(), 5);
    st().recordAnswer(rec({ stepId: "b" }), 10);
    expect(chips()).toBe(START);
    expect(st().ledger).toHaveLength(0);
  });

  it("пересечение дневной цели даёт +2 один раз", () => {
    const goal = st().profile.dailyGoalXp; // 50
    st().recordAnswer(rec({ stepId: "a" }), goal - 10); // цель ещё не достигнута
    expect(chips()).toBe(START);
    st().recordAnswer(rec({ stepId: "b" }), 10);
    expect(chips()).toBe(START + CHIP_REWARD.dailyGoal);
    expect(st().ledger.some((e) => e.reason === "dailyGoal" && e.amount === CHIP_REWARD.dailyGoal)).toBe(true);
    st().recordAnswer(rec({ stepId: "c" }), 10); // цель уже была
    expect(chips()).toBe(START + CHIP_REWARD.dailyGoal);
    expect(st().ledger.filter((e) => e.reason === "dailyGoal")).toHaveLength(1);
  });

  it("достижение даёт чипы по редкости, повторное — нет", () => {
    st().unlock("first_lesson"); // обычное
    expect(chips()).toBe(START + ACHIEVEMENT_CHIPS.common);
    expect(st().ledger[0]).toMatchObject({ reason: "achievement", amount: ACHIEVEMENT_CHIPS.common });
    st().unlock("first_lesson");
    expect(chips()).toBe(START + ACHIEVEMENT_CHIPS.common);
    st().unlock("gamer");
    st().unlock("drill");
    expect(chips()).toBe(START + 3 * ACHIEVEMENT_CHIPS.common);
  });

  it("редкое, эпическое и легендарное достижения платят 4 / 7 / 10", () => {
    st().unlock("solver"); // редкое
    expect(chips()).toBe(START + 4);
    st().unlock("binary_master"); // эпическое
    expect(chips()).toBe(START + 11);
    st().unlock("level_20"); // легендарное
    expect(chips()).toBe(START + 21);
  });

  it("несколько достижений за одно действие складываются в одну строку истории", () => {
    // Пробный ЕНТ на 96%: «пробный старт» и «высокий балл» приходят вместе
    st().recordExam(exam({ points: 48, maxPoints: 50 }), { "ns.bin2dec": [1] });
    const ach = st().ledger.filter((e) => e.reason === "achievement");
    expect(ach).toHaveLength(1);
    // exam_first (редкое, 4) + exam_90 (легендарное, 10)
    expect(ach[0].amount).toBe(ACHIEVEMENT_CHIPS.rare + ACHIEVEMENT_CHIPS.legendary);
  });

  it("пробный период (Безлимит ×2) удваивает чипы за награды", () => {
    st().startTrial();
    st().recordAnswer(rec(), 10); // за опыт чипов нет
    expect(chips()).toBe(START);
    st().unlock("solver"); // редкое: 4 × 2
    expect(chips()).toBe(START + 8);
  });

  it("бустер ×2 чипы не умножает (редкое достижение остаётся 4), а опыт удваивает", () => {
    fund(); // бустер за 40 чипов
    expect(st().buy("boost-15")).toEqual({ ok: true });
    const before = chips();
    st().unlock("solver");
    expect(chips() - before).toBe(4);
    const xp0 = st().xp;
    st().recordAnswer(rec({ stepId: "bx" }), 10);
    expect(st().xp - xp0).toBe(20);
    expect(st().days[todayKey()].xp).toBe(20);
    const g = st().recordGame("bit-rush", { score: 5, correct: 4, total: 5, attempts: [] }, "normal");
    expect(st().xp - xp0 - 20).toBe(g.xp);
    // без бустера — как раньше
    vi.setSystemTime(Date.now() + 2 * 3600_000);
    const xp1 = st().xp;
    st().recordAnswer(rec({ stepId: "by" }), 10);
    expect(st().xp - xp1).toBe(10);
  });
});

describe("бустер ×2: все места начисления опыта", () => {
  beforeEach(fullReset);
  const task = (id: string) => ({ id, lang: "python", level: "A", title: { ru: "x", kk: "x" }, prompt: { ru: "x", kk: "x" }, starter: "", solution: "", check: {} }) as never;
  const boostOn = () => useApp.setState({ boost: { mult: 2, until: Date.now() + 15 * MINUTE } as never });

  it("бонус урока, задача практикума и игра удваиваются, ответ плеера = дельте стора", () => {
    const xp0 = st().xp;
    const plain = st().finishSession(lesson({ lessonId: "ns-2-read", answers: [rec({ stepId: "p1" })], xp: 10 }));
    const plainDelta = st().xp - xp0;
    expect(plainDelta).toBe(plain.bonusXp);
    const t1 = st().recordCodeTask(task("py-1-a"), true);
    const g1 = st().recordGame("bit-rush", { score: 5, correct: 4, total: 5, attempts: [] }, "normal");
    fullReset();
    boostOn();
    const xp1 = st().xp;
    const boosted = st().finishSession(lesson({ lessonId: "ns-2-read", answers: [rec({ stepId: "p1" })], xp: 10 }));
    expect(boosted.bonusXp).toBe(plain.bonusXp * 2);
    expect(st().xp - xp1).toBe(boosted.bonusXp);
    const t2 = st().recordCodeTask(task("py-1-a"), true);
    expect(t2.xp).toBe(t1.xp * 2);
    const g2 = st().recordGame("bit-rush", { score: 5, correct: 4, total: 5, attempts: [] }, "normal");
    expect(g2.xp).toBe(g1.xp * 2);
  });

  it("mergeState отбрасывает записи истории чипов старше недели", () => {
    const now = Date.now();
    const old = { id: "o", at: now - 8 * 24 * 3600_000, amount: 2, reason: "lesson" };
    const fresh = { id: "f", at: now - 24 * 3600_000, amount: 2, reason: "lesson" };
    expect(mergeState({ ledger: [fresh, old] }, st()).ledger.map((e) => e.id)).toEqual(["f"]);
  });
});

describe("стор: finishSession", () => {
  beforeEach(fullReset);

  it("урок пишет запись в историю и даёт 2 чипа за первое прохождение", () => {
    const out = st().finishSession(lesson({ answers: [rec({ stepId: "a" }), rec({ stepId: "b", correct: false, score: 0, given: "1", expected: "2" })], accuracy: 0.5 }));
    expect(out.perfect).toBe(false);
    expect(out.perfectDrop).toBeNull(); // не идеально — кубик не бросали
    expect(out.bonusXp).toBe(20);
    expect(st().history).toHaveLength(1);
    const h = st().history[0];
    expect(h).toMatchObject({ kind: "lesson", lessonId: "ns-2-read", title: "Урок", total: 2, correct: 1 });
    expect(h.wrong.map((w) => w.stepId)).toEqual(["b"]);
    const lessonEntry = st().ledger.find((e) => e.reason === "lesson");
    expect(lessonEntry?.amount).toBe(CHIP_REWARD.lessonFirst);
    expect(st().ledger.some((e) => e.reason === "perfect")).toBe(false);
    expect(st().ledger.some((e) => e.reason === "xp")).toBe(false);
  });

  it("идеальный первый урок: бонуса +5 больше нет — только 2 чипа за урок; повтор — без чипов и без броска", () => {
    useApp.setState({ profile: { ...st().profile, dailyGoalXp: 0 } }); // без бонуса дневной цели
    const out1 = st().finishSession(lesson());
    expect(out1.perfect).toBe(true);
    expect(out1).toMatchObject({ firstPass: true, lessonChips: 2, perfectDrop: { kind: "none" } }); // кубик 0,99 — «ничего»
    expect(st().ledger.find((e) => e.reason === "lesson")?.amount).toBe(2);
    expect(st().ledger.some((e) => e.reason === "perfect")).toBe(false);
    const before = chips();
    const out = st().finishSession(lesson());
    expect(out.perfect).toBe(true); // урок без ошибок и при повторе, но сюрприза нет: бросок — только за первое прохождение
    expect(out).toMatchObject({ firstPass: false, lessonChips: 0, perfectDrop: null });
    expect(dropRandom.next).toHaveBeenCalledTimes(1);
    // повтор: чипов за прохождение нет (достижения уже получены)
    expect(chips() - before).toBe(CHIP_REWARD.lessonRepeat);
    expect(st().history).toHaveLength(2);
  });

  it("множитель тарифа применяется к чипам за урок (Безлимит ×2: 2 → 4)", () => {
    useApp.setState({ profile: { ...st().profile, dailyGoalXp: 0 } });
    st().startTrial();
    const out = st().finishSession(lesson());
    expect(out).toMatchObject({ lessonChips: 4 }); // суммы с множителем — их показывают итоги
    expect(st().ledger.find((e) => e.reason === "lesson")?.amount).toBe(4);
  });

  it("тренировка чипов не даёт", () => {
    useApp.setState({ profile: { ...st().profile, dailyGoalXp: 0 } });
    st().finishSession(drill(8));
    expect(chips()).toBe(START + ACHIEVEMENT_CHIPS.common); // только достижение «Тренер сам себе»
    expect(st().ledger.every((e) => e.reason === "achievement")).toBe(true);
  });

  it("пробный ЕНТ завершён: +5; тест по разделу — +5 только если сдан (≥ 80%)", () => {
    useApp.setState({ profile: { ...st().profile, dailyGoalXp: 0 } });
    st().recordExam(exam({ kind: "full" }), { "ns.bin2dec": [1] });
    expect(st().ledger.find((e) => e.reason === "exam")?.amount).toBe(5);
    st().recordExam(exam({ id: "u1", kind: "unit", unit: "u1", points: 7, maxPoints: 10 }), { "ns.bin2dec": [1] });
    expect(st().ledger.some((e) => e.reason === "unit")).toBe(false);
    st().recordExam(exam({ id: "u2", kind: "unit", unit: "u1", points: 8, maxPoints: 10 }), { "ns.bin2dec": [1] });
    expect(st().ledger.find((e) => e.reason === "unit")?.amount).toBe(5);
  });

  it("тест по разделу: +5 только за первую сдачу раздела, пересдача и другой раздел", () => {
    useApp.setState({ profile: { ...st().profile, dailyGoalXp: 0 } });
    // Подряд идущие записи одной причины в журнале склеиваются — считаем сумму.
    const unitChips = () => st().ledger.filter((e) => e.reason === "unit").reduce((a, e) => a + e.amount, 0) / 5;
    st().recordExam(exam({ id: "u1", kind: "unit", unit: "a", points: 9, maxPoints: 10 }), { "ns.bin2dec": [1] });
    expect(unitChips()).toBe(1);
    st().recordExam(exam({ id: "u2", kind: "unit", unit: "a", points: 10, maxPoints: 10 }), { "ns.bin2dec": [1] });
    expect(unitChips()).toBe(1); // раздел уже сдан
    st().recordExam(exam({ id: "u3", kind: "unit", unit: "b", points: 10, maxPoints: 10 }), { "ns.bin2dec": [1] });
    expect(unitChips()).toBe(2); // другой раздел — снова награда
  });

  it("мини-ЕНТ и тест по теме чипов не дают; пробный ЕНТ с менее чем половиной ответов — тоже", () => {
    useApp.setState({ profile: { ...st().profile, dailyGoalXp: 0 } });
    const examChips = () => st().ledger.filter((e) => e.reason === "exam").reduce((a, e) => a + e.amount, 0) / 5;
    st().recordExam(exam({ id: "m1", kind: "mini" }), { "ns.bin2dec": [1, 1, 1] });
    st().recordExam(exam({ id: "t1", kind: "topic" }), { "ns.bin2dec": [1, 1, 1] });
    expect(examChips()).toBe(0);
    st().recordExam(exam({ id: "f1", kind: "full", questions: 40 }), { "ns.bin2dec": [1] });
    expect(examChips()).toBe(0);
    st().recordExam(exam({ id: "f2", kind: "full", questions: 40 }), { "ns.bin2dec": Array(20).fill(1) });
    expect(examChips()).toBe(1);
  });

  it("игра, практикум и комбо без новых достижений и без цели дня чипов не дают", () => {
    useApp.setState({ profile: { ...st().profile, dailyGoalXp: 0 } });
    const gameRes = { score: 5, correct: 4, total: 5, attempts: [] };
    const task = { id: "py-1-x", lang: "python", level: "A", title: { ru: "x", kk: "x" }, prompt: { ru: "x", kk: "x" }, starter: "", solution: "", check: {} } as never;
    // Первая игра и первая задача выдают свои достижения (чипы за них — отдельно, их не считаем).
    st().recordGame("bit-rush", gameRes, "normal");
    st().recordCodeTask(task, true);
    st().noteCombo(2);
    const base = st().wallet.earned;
    st().recordGame("bit-rush", { ...gameRes, score: 9 }, "normal");
    st().recordCodeTask({ ...(task as object), id: "py-1-y" } as never, true);
    st().noteCombo(3);
    expect(st().wallet.earned).toBe(base);
  });

  it("серия идеальных: растёт на первых прохождениях, ошибка сбрасывает, повтор и тренировка не трогают", () => {
    const first = (id: string, ok = true) =>
      st().finishSession(lesson({ lessonId: id, answers: [rec({ stepId: `${id}a` }), rec({ stepId: `${id}b`, correct: ok, score: ok ? 1 : 0 })], accuracy: ok ? 1 : 0.5 }));
    first("l1");
    first("l2");
    expect(st().perfectRun).toEqual({ current: 2, best: 2 });
    st().finishSession(drill(8)); // тренировка — мимо серии
    first("l1"); // повтор — мимо серии
    first("l2", false); // повтор с ошибкой — тоже
    expect(st().perfectRun).toEqual({ current: 2, best: 2 });
    first("l3", false); // первое прохождение с ошибкой — сброс
    expect(st().perfectRun).toEqual({ current: 0, best: 2 });
    first("l4");
    expect(st().perfectRun).toEqual({ current: 1, best: 2 });
  });

  it("достижение «5 идеальных подряд» — на пятом", () => {
    for (let i = 1; i <= 4; i++) st().finishSession(lesson({ lessonId: `p${i}` }));
    expect(st().achievements.perfect_5).toBeUndefined();
    st().finishSession(lesson({ lessonId: "p5" }));
    expect(st().achievements.perfect_5).toBeTypeOf("number");
    expect(st().perfectRun.best).toBe(5);
  });

  it("сессия без заданий в историю не попадает", () => {
    st().finishSession(lesson({ answers: [] }));
    expect(st().history).toHaveLength(0);
  });

  it("тренировка записывается как drill с режимом", () => {
    st().finishSession(drill(3, 1, { mode: "mistakes" }));
    expect(st().history[0]).toMatchObject({ kind: "drill", mode: "mistakes" });
  });

  it("тренировка сердечко не возвращает (этап 16В: возврата за тренировку больше нет)", () => {
    lose();
    expect(heartCount()).toBe(4);
    const out = st().finishSession(drill(10, 1));
    expect(out.perfectDrop).toBeNull(); // обычная тренировка сюрприза не даёт, даже на 100%
    expect(heartCount()).toBe(4);
    expect(st().finishSession(drill(10, 1, { mode: "extern" })).perfectDrop).toBeNull();
    expect(heartCount()).toBe(4);
    expect("practiceHearts" in st()).toBe(false);
  });

  it("урок сердечко не возвращает", () => {
    lose();
    st().finishSession(lesson({ lessonId: "l-x", accuracy: 0.5, answers: [rec(), rec({ stepId: "b", correct: false, score: 0 })] }));
    expect(heartCount()).toBe(4);
  });

  it("у безлимита сердечки не тратятся и не возвращаются", () => {
    st().startTrial();
    expect(lose().unlimited).toBe(true);
    st().finishSession(drill(8));
    expect(heartsView(st().hearts, "unlimited", Date.now(), todayKey()).unlimited).toBe(true);
  });
});

describe("стор: «Сюрприз за идеальный урок» (этап 16В)", () => {
  beforeEach(fullReset);
  const roll = (r: number) => vi.spyOn(dropRandom, "next").mockReturnValue(r);
  const noGoal = () => useApp.setState({ profile: { ...st().profile, dailyGoalXp: 0 } });
  const perfectSum = () => st().ledger.filter((e) => e.reason === "perfect").reduce((a, e) => a + e.amount, 0);

  it("r < 0,2 — пол-сердечка сразу в запас; результат в итоге действия", () => {
    noGoal();
    lose();
    lose();
    expect(heartCount()).toBe(3);
    roll(0.1);
    const out = st().finishSession(lesson());
    expect(out.perfectDrop).toEqual({ kind: "heart", amount: 0.5 });
    expect(heartCount()).toBe(3.5);
    expect(st().ledger.some((e) => e.reason === "perfect")).toBe(false); // сердечко — не чипы
  });

  it("0,2 ≤ r < 0,4 — 3 чипа с записью perfect, без множителя тарифа и бустера", () => {
    // Одинаковый урок при кубике «ничего» и «чипы»: разница в кошельке — ровно чипы сюрприза (достижения и урок одинаковы).
    noGoal();
    roll(0.99);
    const b0 = chips();
    st().finishSession(lesson());
    const withoutDrop = chips() - b0;
    fullReset();
    noGoal();
    roll(0.3);
    const before = chips();
    const out = st().finishSession(lesson());
    expect(out.perfectDrop).toEqual({ kind: "chips", amount: PERFECT_DROP.chips });
    expect(chips() - before - withoutDrop).toBe(PERFECT_DROP.chips);
    expect(perfectSum()).toBe(PERFECT_DROP.chips);
    expect(st().wallet.earned).toBe(START_WALLET.earned + (chips() - before));
  });

  it("Безлимит ×2: чипы за урок удваиваются, чипы сюрприза — нет («немного»)", () => {
    noGoal();
    st().startTrial();
    roll(0.3);
    expect(st().finishSession(lesson()).perfectDrop).toEqual({ kind: "chips", amount: 3 });
    expect(perfectSum()).toBe(3);
  });

  it("r ≥ 0,4 — ничего: чипы и сердечки не меняются", () => {
    noGoal();
    lose();
    roll(0.4);
    const heartsBefore = heartCount();
    const out = st().finishSession(lesson());
    expect(out.perfectDrop).toEqual({ kind: "none" });
    expect(heartCount()).toBe(heartsBefore);
    expect(perfectSum()).toBe(0);
  });

  it("запас полон — вместо пол-сердечка 3 чипа (показанное = выданное)", () => {
    noGoal();
    roll(0.05);
    const out = st().finishSession(lesson());
    expect(out.perfectDrop).toEqual({ kind: "chips", amount: 3 });
    expect(heartCount()).toBe(5);
    expect(perfectSum()).toBe(3);
  });

  it("«Безлимит» — вместо пол-сердечка 3 чипа", () => {
    noGoal();
    st().startTrial();
    roll(0.05);
    expect(st().finishSession(lesson()).perfectDrop).toEqual({ kind: "chips", amount: 3 });
    expect(perfectSum()).toBe(3);
  });

  it("бросают один раз за действие и только за идеальное ПЕРВОЕ прохождение урока", () => {
    noGoal();
    const spy = roll(0.1);
    lose();
    st().finishSession(lesson({ lessonId: "l1" }));
    expect(spy).toHaveBeenCalledTimes(1);
    st().finishSession(lesson({ lessonId: "l1" })); // повтор — нет
    expect(spy).toHaveBeenCalledTimes(1);
    st().finishSession(lesson({ lessonId: "l2", accuracy: 0.5, answers: [rec({ correct: false, score: 0 })] })); // с ошибкой — нет
    expect(spy).toHaveBeenCalledTimes(1);
    st().finishSession(lesson({ lessonId: "l3", answers: [rec({ hinted: true })] })); // с подсказкой — не идеально
    expect(spy).toHaveBeenCalledTimes(1);
    st().finishSession(drill(10, 1)); // тренировка — нет
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("мини-тест группы на 100% бросает кубик; с ошибкой — нет", () => {
    noGoal();
    const spy = roll(0.3);
    const mini = (answers: AnswerRecord[], accuracy: number) => st().finishSession(drill(0, accuracy, { mode: "minitest", answers }));
    const ok = Array.from({ length: 4 }, (_, i) => rec({ stepId: `m${i}` }));
    expect(mini(ok, 1).perfectDrop).toEqual({ kind: "chips", amount: 3 });
    expect(spy).toHaveBeenCalledTimes(1);
    const bad = [...ok.slice(0, 3), rec({ stepId: "m9", correct: false, score: 0 })];
    expect(mini(bad, 0.75).perfectDrop).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("тест по теме и по разделу на 100%: бросок в recordExam, исход — в записи попытки; мини-ЕНТ и пробный ЕНТ — нет", () => {
    noGoal();
    const spy = roll(0.3);
    const exams = () => st().exams;
    st().recordExam(exam({ id: "t1", kind: "topic", points: 10, maxPoints: 10 }), { "ns.bin2dec": [1, 1] });
    expect(exams().find((e) => e.id === "t1")?.drop).toEqual({ kind: "chips", amount: 3 });
    expect(perfectSum()).toBe(3);
    st().recordExam(exam({ id: "u1", kind: "unit", unit: "a", points: 10, maxPoints: 10 }), { "ns.bin2dec": [1] });
    expect(exams().find((e) => e.id === "u1")?.drop).toEqual({ kind: "chips", amount: 3 });
    expect(spy).toHaveBeenCalledTimes(2);
    st().recordExam(exam({ id: "m1", kind: "mini", points: 10, maxPoints: 10 }), { "ns.bin2dec": [1] });
    st().recordExam(exam({ id: "f1", kind: "full", points: 50, maxPoints: 50, questions: 1 }), { "ns.bin2dec": [1] });
    st().recordExam(exam({ id: "t2", kind: "topic", points: 9, maxPoints: 10 }), { "ns.bin2dec": [1] });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(exams().find((e) => e.id === "m1")?.drop).toBeUndefined();
    expect(exams().find((e) => e.id === "t2")?.drop).toBeUndefined();
  });

  it("тест по теме: сердечко выпало — запас +0,5; повторная запись той же попытки не бросает заново и не теряет исход", () => {
    noGoal();
    lose();
    lose();
    const spy = roll(0.1);
    st().recordExam(exam({ id: "t1", kind: "topic", points: 10, maxPoints: 10 }), { "ns.bin2dec": [1, 1] });
    expect(st().exams[0].drop).toEqual({ kind: "heart", amount: 0.5 });
    expect(heartCount()).toBe(3.5);
    // Та же попытка записана второй раз (сбой сохранения): кубик не бросаем, исход сохраняется в записи.
    st().recordExam(exam({ id: "t1", kind: "topic", points: 10, maxPoints: 10 }), { "ns.bin2dec": [1, 1] });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(st().exams.filter((e) => e.id === "t1")).toHaveLength(1);
    expect(st().exams[0].drop).toEqual({ kind: "heart", amount: 0.5 });
    expect(heartCount()).toBe(3.5);
  });
});

describe("стор: сердечки и покупки", () => {
  beforeEach(fullReset);

  it("loseHeart снимает по одному, не ниже нуля", () => {
    expect(lose().count).toBe(4);
    for (let i = 0; i < 10; i++) lose();
    expect(lose()).toMatchObject({ count: 0, max: 5, unlimited: false });
    expect(heartCount()).toBe(0);
  });

  it("после первой потери виден таймер: следующее сердечко через 6 ч", () => {
    const v = lose();
    expect(v.nextAt).not.toBeNull();
    expect(v.nextAt!).toBeGreaterThan(Date.now());
    expect(v.nextAt).toBe(Date.now() + PLAN_FEATURES.free.regenMs);
    expect(PLAN_FEATURES.free.regenMs).toBe(6 * 60 * MINUTE);
  });

  it("суточного пополнения нет: на следующий день сердечки возвращаются по одному за 6 ч", () => {
    for (let i = 0; i < 5; i++) lose();
    expect(heartCount()).toBe(0);
    vi.setSystemTime(new Date(2027, 0, 16, 0, 0, 0)); // полночь, прошло 12 ч
    expect(todayKey()).toBe("2027-01-16");
    expect(heartCount()).toBe(2);
    vi.setSystemTime(new Date(2027, 0, 16, 12, 0, 0)); // сутки: 24 / 6 = 4 сердечка, а не полный запас
    expect(heartCount()).toBe(4);
    vi.setSystemTime(new Date(2027, 0, 16, 18, 0, 0)); // 30 ч — запас полон
    expect(heartCount()).toBe(5);
  });

  it("Лайт: запас 6, сердечко возвращается за 3 ч", () => {
    useApp.setState({ plan: { tier: "lite", period: "month", until: Date.now() + 30 * 86_400_000 } });
    const v = lose();
    expect(v).toMatchObject({ count: 5, max: 6, unlimited: false });
    expect(v.nextAt).toBe(Date.now() + 180 * MINUTE);
    const liteCount = () => heartsView(st().hearts, "lite", Date.now(), todayKey()).count;
    vi.setSystemTime(Date.now() + 180 * MINUTE - 1);
    expect(liteCount()).toBe(5);
    vi.setSystemTime(Date.now() + 1);
    expect(liteCount()).toBe(6);
  });

  it("buy: при полном запасе сердечки не продаются", () => {
    expect(st().buy("heart-1")).toEqual({ ok: false, reason: "full" });
    expect(st().buy("hearts-3")).toEqual({ ok: false, reason: "full" });
    expect(st().buy("hearts-full")).toEqual({ ok: false, reason: "full" });
    expect(chips()).toBe(START);
    expect(st().ledger).toHaveLength(0);
  });

  it("buy heart-1: +1 сердечко за 60 чипов, запись в истории чипов", () => {
    fund();
    lose();
    lose();
    expect(st().buy("heart-1")).toEqual({ ok: true });
    expect(heartCount()).toBe(4);
    expect(chips()).toBe(40);
    expect(st().wallet.spent).toBe(60);
    expect(st().ledger[0]).toMatchObject({ reason: "buy", note: "heart-1", amount: -60 });
  });

  it("buy hearts-3: +3 сердечка за 150 чипов, запись в истории чипов", () => {
    fund(200);
    for (let i = 0; i < 3; i++) lose(); // 2 из 5: набор как раз помещается
    expect(st().buy("hearts-3")).toEqual({ ok: true });
    expect(heartCount()).toBe(5);
    expect(chips()).toBe(50);
    expect(st().wallet.spent).toBe(150);
    expect(st().ledger[0]).toMatchObject({ reason: "buy", note: "hearts-3", amount: -150 });
  });

  it("buy hearts-3: если не помещается — overflow, ничего не списывается; поштучно можно", () => {
    fund();
    lose();
    lose(); // 3 из 5, не хватает 2
    const hearts = st().hearts;
    expect(st().buy("hearts-3")).toEqual({ ok: false, reason: "overflow" });
    expect(chips()).toBe(100);
    expect(st().hearts).toBe(hearts);
    expect(st().ledger).toHaveLength(0);
    expect(st().buy("heart-1")).toEqual({ ok: true });
    expect(heartCount()).toBe(4);
  });

  it("buy hearts-3: не хватает чипов — chips; при безлимите — unlimited", () => {
    for (let i = 0; i < 3; i++) lose();
    expect(st().buy("hearts-3")).toEqual({ ok: false, reason: "chips" }); // 20 < 150
    expect(chips()).toBe(START);
    st().startTrial();
    expect(st().buy("hearts-3")).toEqual({ ok: false, reason: "unlimited" });
  });

  it("buy hearts-full: по 45 за каждое недостающее, только когда не хватает хотя бы четырёх", () => {
    lose();
    expect(st().buy("hearts-full")).toEqual({ ok: false, reason: "overflow" }); // не хватает 1 — выгоднее поштучно
    for (let i = 0; i < 3; i++) lose(); // 1 из 5
    expect(st().buy("hearts-full")).toEqual({ ok: false, reason: "chips" }); // 20 < 4 × 45
    fund(180);
    expect(st().buy("hearts-full")).toEqual({ ok: true });
    expect(heartCount()).toBe(5);
    expect(chips()).toBe(0);
    expect(st().ledger[0]).toMatchObject({ reason: "buy", note: "hearts-full", amount: -180 });
  });

  it("payEntry: списывает цену входа целиком или ничего", () => {
    expect(st().payEntry(2)).toMatchObject({ ok: true, paid: 2, view: { count: 3 } });
    expect(st().payEntry(1)).toMatchObject({ ok: true, paid: 1, view: { count: 2 } });
    expect(st().payEntry(2)).toMatchObject({ ok: true, paid: 2, view: { count: 0 } });
    const hearts = st().hearts;
    expect(st().payEntry(1)).toMatchObject({ ok: false, paid: 0, view: { count: 0 } });
    expect(st().hearts).toBe(hearts);
  });

  it("payEntry: двух сердечек нет — вход за 2 не списывает последнее", () => {
    for (let i = 0; i < 4; i++) lose();
    expect(st().payEntry(2)).toMatchObject({ ok: false, paid: 0, view: { count: 1 } });
    expect(heartCount()).toBe(1);
  });

  it("payEntry: безлимит и нулевая цена — бесплатно", () => {
    expect(st().payEntry(0)).toMatchObject({ ok: true, paid: 0, view: { count: 5 } });
    st().startTrial();
    expect(st().payEntry(2)).toMatchObject({ ok: true, paid: 0, view: { unlimited: true } });
  });

  it("buy: нехватка чипов ничего не меняет", () => {
    lose();
    fund(10);
    const hearts = st().hearts;
    expect(st().buy("heart-1")).toEqual({ ok: false, reason: "chips" });
    expect(chips()).toBe(10);
    expect(st().hearts).toBe(hearts);
  });

  it("buy boost: ставит множитель, повтор продлевает", () => {
    fund(500);
    expect(st().buy("boost-15")).toEqual({ ok: true });
    const b1 = st().boost!;
    expect(b1.mult).toBe(2);
    expect(b1.until).toBeGreaterThan(Date.now() + 14 * 60_000);
    expect(st().buy("boost-15")).toEqual({ ok: true });
    expect(st().boost!.until - b1.until).toBe(15 * 60_000);
    expect(chips()).toBe(420);
  });

  it("buy: неизвестный товар", () => {
    expect(st().buy("nope" as never)).toEqual({ ok: false, reason: "unknown" });
  });

  it("пробный период: один раз, потом сердечки безлимитные и не продаются", () => {
    expect(st().startTrial()).toBe(true);
    expect(st().plan).toMatchObject({ tier: "unlimited", trial: true, trialUsed: true });
    expect(st().plan.until!).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect(st().startTrial()).toBe(false);
    expect(lose()).toMatchObject({ unlimited: true, count: Infinity });
    expect(st().buy("heart-1")).toEqual({ ok: false, reason: "unlimited" });
  });

  it("истёкший пробный период не повторяется и возвращает free", () => {
    st().startTrial();
    useApp.setState((s) => ({ plan: { ...s.plan, until: Date.now() - 1 } }));
    expect(st().startTrial()).toBe(false);
    expect(lose().unlimited).toBe(false);
  });

  it("notePaywallShown считает показы", () => {
    st().notePaywallShown();
    st().notePaywallShown();
    expect(st().paywall.views).toBe(2);
    expect(st().paywall.lastShownAt).toBeGreaterThan(0);
  });
});

describe("стор: ИИ за чипы", () => {
  beforeEach(fullReset);

  it("3 бесплатных, потом чипы, потом отказ", () => {
    for (let i = 0; i < 3; i++) expect(st().spendAi("hint")).toMatchObject({ ok: true, pay: "free", cost: 0 });
    expect(chips()).toBe(START);
    expect(st().aiUsage).toMatchObject({ count: 3, free: 3 });

    const paid = st().spendAi("hint");
    expect(paid).toMatchObject({ ok: true, pay: "chips", cost: 3 });
    expect(chips()).toBe(START - 3);
    expect(st().wallet.spent).toBe(3);
    expect(st().ledger[0]).toMatchObject({ reason: "ai", note: "hint", amount: -3 });

    useApp.setState({ wallet: { chips: 2, earned: 2, spent: 0 } });
    const before = st().aiUsage;
    expect(st().spendAi("hint")).toMatchObject({ ok: false, reason: "chips", cost: 3 });
    expect(st().aiUsage).toEqual(before);
    expect(chips()).toBe(2);
  });

  it("цена зависит от вида: фото — 10, чат — 7, разбор пробника — 15", () => {
    for (let i = 0; i < 3; i++) st().spendAi("hint");
    expect(st().spendAi("photo")).toMatchObject({ pay: "chips", cost: 10 });
    expect(chips()).toBe(START - 10);
    expect(st().spendAi("review")).toMatchObject({ ok: false, reason: "chips", cost: 15 }); // осталось 10
  });

  it("голосовой вопрос: расшифровка — 2 чипа, запись в истории с note voice", () => {
    for (let i = 0; i < 3; i++) st().spendAi("hint");
    expect(st().spendAi("voice")).toMatchObject({ ok: true, pay: "chips", cost: 2 });
    expect(chips()).toBe(START - 2);
    expect(st().ledger[0]).toMatchObject({ reason: "ai", note: "voice", amount: -2 });
  });

  it("refundAi возвращает чипы и счётчик", () => {
    for (let i = 0; i < 3; i++) st().spendAi("hint");
    const r = st().spendAi("chat");
    expect(chips()).toBe(START - 7);
    st().refundAi(r);
    expect(chips()).toBe(START);
    expect(st().wallet.spent).toBe(0);
    expect(st().aiUsage.count).toBe(3);
    expect(st().ledger[0]).toMatchObject({ reason: "refund", amount: 7, note: "chat" });
  });

  it("refundAi бесплатного обращения возвращает бесплатный лимит", () => {
    const r = st().spendAi("hint");
    st().refundAi(r);
    expect(st().aiUsage).toMatchObject({ count: 0, free: 0 });
    expect(chips()).toBe(START);
  });

  it("потолок дня считается в обращениях: фото весит 2, голос — 4, возврат возвращает тот же вес", () => {
    useApp.setState({ wallet: { chips: 999, earned: 999, spent: 0 } });
    const photo = st().spendAi("photo");
    expect(st().aiUsage.count).toBe(2);
    const voice = st().spendAi("voice");
    expect(st().aiUsage.count).toBe(6);
    st().refundAi(voice);
    expect(st().aiUsage.count).toBe(2);
    st().refundAi(photo);
    expect(st().aiUsage.count).toBe(0);
  });

  it("потолок бесплатного тарифа — 65 обращений: фото на 65-м уже не помещается, подсказка помещается; чипы при отказе целы", () => {
    useApp.setState({ wallet: { chips: 999, earned: 999, spent: 0 }, aiUsage: { day: todayKey(), count: 64, free: 3, freeTotal: 3 } });
    expect(st().spendAi("photo")).toMatchObject({ ok: false, reason: "cap" });
    expect(chips()).toBe(999);
    expect(st().aiUsage.count).toBe(64);
    expect(st().spendAi("hint")).toMatchObject({ ok: true, pay: "chips", cost: 3 });
    expect(st().aiUsage.count).toBe(65);
    expect(st().spendAi("hint")).toMatchObject({ ok: false, reason: "cap" });
    expect(chips()).toBe(996);
  });

  it("потолок 65 одинаков на «Лайте» и «Безлимите»: бесплатные обращения и чипы не двигают границу", () => {
    useApp.setState({ plan: { tier: "lite", period: "month", until: Date.now() + 30 * 86_400_000 }, aiUsage: { day: todayKey(), count: 64, free: 30 } });
    expect(st().spendAi("photo")).toMatchObject({ ok: false, reason: "cap" });
    expect(st().spendAi("hint")).toMatchObject({ ok: true, pay: "chips" });
    expect(st().spendAi("hint")).toMatchObject({ ok: false, reason: "cap" });

    useApp.setState({ plan: { tier: "unlimited", period: "month", until: Date.now() + 30 * 86_400_000 }, aiUsage: { day: todayKey(), count: 63, free: 0 } });
    expect(st().spendAi("photo")).toMatchObject({ ok: true, pay: "plan", cost: 0 });
    expect(st().aiUsage.count).toBe(65);
    expect(st().spendAi("hint")).toMatchObject({ ok: false, reason: "cap" });
  });

  it("бесплатные даются один раз: назавтра их не прибавляется (#99)", () => {
    useApp.setState({ aiUsage: { day: "2000-01-01", count: 3, free: 3, freeTotal: 3 } });
    expect(st().spendAi("hint")).toMatchObject({ ok: true, pay: "chips", cost: 3 });
    expect(st().aiUsage).toMatchObject({ day: todayKey(), count: 1, free: 0, freeTotal: 3 });
  });

  it("возврат бесплатного (ответ из кэша) возвращает попытку «навсегда» и в другой день", () => {
    const r = st().spendAi("hint");
    expect(r).toMatchObject({ pay: "free" });
    expect(st().aiUsage.freeTotal).toBe(1);
    st().refundAi(r);
    expect(st().aiUsage).toMatchObject({ count: 0, free: 0, freeTotal: 0 });
  });

  it("refundAi неудачной квитанции ничего не делает", () => {
    useApp.setState({ wallet: { chips: 0, earned: 0, spent: 0 }, aiUsage: { day: todayKey(), count: 3, free: 3, freeTotal: 3 } });
    const r = st().spendAi("hint");
    expect(r.ok).toBe(false);
    st().refundAi(r);
    expect(chips()).toBe(0);
    expect(st().aiUsage).toMatchObject({ count: 3, free: 3 });
  });

  it("отзыв после урока бесплатен и не съедает лимит", () => {
    expect(st().spendAi("feedback")).toMatchObject({ ok: true, pay: "free", cost: 0 });
    expect(st().aiUsage.free).toBe(0);
    expect(st().spendAi("hint").pay).toBe("free");
  });

  it("безлимит: ИИ оплачен тарифом, чипы не списываются", () => {
    st().startTrial();
    for (let i = 0; i < 10; i++) expect(st().spendAi("photo")).toMatchObject({ ok: true, pay: "plan", cost: 0 });
    expect(st().spendAi("voice")).toMatchObject({ ok: true, pay: "plan", cost: 0 });
    expect(chips()).toBe(START);
  });
});

describe("стор: пробный ЕНТ и работа над ошибками", () => {
  beforeEach(fullReset);

  it("recordExam: ошибки с ent:-id попадают в mistakes и историю", () => {
    st().recordExam(exam(), { "ns.bin2dec": [1, 0, 0.5] }, [wrongEnt("ent:aaa"), wrongEnt("ent:bbb:2")]);
    expect(st().mistakes.map((m) => m.stepId).sort()).toEqual(["ent:aaa", "ent:bbb:2"]);
    expect(st().exams).toHaveLength(1);
    const h = st().history[0];
    expect(h).toMatchObject({ id: "exam-ex1", kind: "exam", mode: "full", examId: "ex1", points: 20, maxPoints: 50, xp: 0, title: "" });
    expect(h.wrong.map((w) => w.stepId)).toEqual(["ent:aaa", "ent:bbb:2"]);
    expect(h.fixed).toEqual([]);
    expect(h.total).toBe(3);
    expect(h.correct).toBe(1);
  });

  const examBonus = () => st().ledger.filter((e) => e.reason === "exam").reduce((a, e) => a + e.amount, 0);

  it("+5 чипов только за новый пробник, повторная запись того же — нет (первый пробник — ещё +4 за достижение)", () => {
    st().recordExam(exam(), { "ns.bin2dec": [1] });
    expect(examBonus()).toBe(5);
    expect(st().ledger.find((e) => e.reason === "achievement")?.amount).toBe(4);
    expect(chips()).toBe(START + 9);
    st().recordExam(exam({ points: 30 }), { "ns.bin2dec": [1] });
    expect(examBonus()).toBe(5);
    expect(chips()).toBe(START + 9);
    expect(st().exams).toHaveLength(1);
    expect(st().history).toHaveLength(1);
    expect(st().history[0].points).toBe(30);
  });

  it("ЕНТ +5: не чаще раза в сутки и один раз за вариант (seed)", () => {
    useApp.setState({ profile: { ...st().profile, dailyGoalXp: 0 } });
    st().recordExam(exam({ id: "a", seed: 1 }), { "ns.bin2dec": [1] });
    expect(examBonus()).toBe(5);
    // тот же день, другой вариант — награды нет
    st().recordExam(exam({ id: "b", seed: 2 }), { "ns.bin2dec": [1] });
    expect(examBonus()).toBe(5);
    // следующий день, тот же вариант, что уже был засчитан — награды нет
    vi.setSystemTime(Date.now() + 24 * 3600_000);
    st().recordExam(exam({ id: "c", seed: 1, at: Date.now() }), { "ns.bin2dec": [1] });
    expect(examBonus()).toBe(5);
    // следующий день, новый вариант — награда
    vi.setSystemTime(Date.now() + 24 * 3600_000);
    st().recordExam(exam({ id: "d", seed: 3, at: Date.now() }), { "ns.bin2dec": [1] });
    expect(examBonus()).toBe(10);
  });

  it("за пробник XP не начисляется — чипы только бонусом", () => {
    st().recordExam(exam(), { "ns.bin2dec": [1, 1, 1, 1] });
    expect(st().xp).toBe(0);
    expect(st().ledger.some((e) => e.reason === "xp")).toBe(false);
    expect(examBonus()).toBe(5);
  });

  it("пробник без ответов бонуса не даёт", () => {
    st().recordExam(exam(), {});
    expect(examBonus()).toBe(0);
    expect(st().history[0].total).toBe(0);
  });

  it("dismissMistake закрывает ошибку и отмечает её исправленной в истории", () => {
    st().recordExam(exam(), { "ns.bin2dec": [0, 0] }, [wrongEnt("ent:aaa"), wrongEnt("ent:bbb")]);
    st().dismissMistake("ent:aaa");
    expect(st().mistakes.map((m) => m.stepId)).toEqual(["ent:bbb"]);
    expect(st().history[0].fixed).toEqual(["ent:aaa"]);
  });

  it("верный ответ на задание из истории отмечает его исправленным", () => {
    st().recordExam(exam(), { "ns.bin2dec": [0] }, [wrongEnt("ent:aaa")]);
    st().recordAnswer(rec({ stepId: "ent:aaa", correct: true }), 5, undefined);
    expect(st().mistakes).toHaveLength(0);
    expect(st().history[0].fixed).toEqual(["ent:aaa"]);
  });

  it("неверный ответ ошибку не исправляет", () => {
    st().recordExam(exam(), { "ns.bin2dec": [0] }, [wrongEnt("ent:aaa")]);
    st().recordAnswer(rec({ stepId: "ent:aaa", correct: false, score: 0, retry: true }), 0);
    expect(st().history[0].fixed).toEqual([]);
    expect(st().mistakes).toHaveLength(1);
  });

  it("ошибка урока: запись истории → верный ответ позже её исправляет", () => {
    st().finishSession(lesson({ answers: [rec({ stepId: "w1", correct: false, score: 0, given: "1", expected: "2" })], accuracy: 0 }));
    expect(st().history[0].wrong[0].stepId).toBe("w1");
    st().recordAnswer(rec({ stepId: "w1" }), 5, "ns-2-read");
    expect(st().history[0].fixed).toEqual(["w1"]);
  });

  it("повторная ошибка пробника не дублирует mistakes", () => {
    st().recordExam(exam(), { "ns.bin2dec": [0] }, [wrongEnt("ent:aaa")]);
    st().recordExam(exam({ id: "ex2" }), { "ns.bin2dec": [0] }, [wrongEnt("ent:aaa")]);
    expect(st().mistakes).toHaveLength(1);
  });
});

describe("стор: сброс и загрузка сохранений", () => {
  beforeEach(fullReset);

  it("resetProgress сохраняет тариф, остальное сбрасывает", () => {
    st().startTrial();
    st().recordAnswer(rec(), 100);
    st().finishSession(lesson());
    lose();
    st().resetProgress();
    expect(st().plan).toMatchObject({ tier: "unlimited", trial: true, trialUsed: true });
    expect(st().wallet).toEqual(START_WALLET);
    expect(st().ledger).toEqual([]);
    expect(st().history).toEqual([]);
    expect(st().xp).toBe(0);
    expect(st().boost).toBeNull();
    expect(st().aiUsage).toEqual({ day: "", count: 0, free: 0, freeTotal: 0 });
  });

  it("resetProgress не возвращает бесплатные обращения к ИИ «навсегда» (#99)", () => {
    st().spendAi("hint");
    st().spendAi("hint");
    st().resetProgress();
    expect(st().aiUsage).toEqual({ day: "", count: 0, free: 0, freeTotal: 2 });
  });

  it("resetProgress не даёт пробный период второй раз", () => {
    st().startTrial();
    st().resetProgress();
    expect(st().startTrial()).toBe(false);
  });

  it("старое сохранение без экономики получает значения по умолчанию (20 чипов)", () => {
    const m = mergeState({ xp: 42, profile: {} }, st());
    expect(m.xp).toBe(42);
    expect(m.wallet).toEqual(START_WALLET);
    expect(m.plan).toEqual({ tier: "free" });
    expect(m.hearts).toMatchObject({ count: 5, day: "" });
    expect(m.ledger).toEqual([]);
    expect(m.boost).toBeNull();
    expect(m.history).toEqual([]);
    expect(m.paywall).toEqual({ lastShownAt: 0, views: 0 });
    expect(m.aiUsage).toEqual({ day: "", count: 0, free: 0, freeTotal: 0 });
  });

  it("мусор в полях экономики не ломает загрузку", () => {
    const m = mergeState(
      {
        plan: { tier: "gold", until: "x" },
        hearts: "abc",
        wallet: { chips: "много", earned: -1 },
        ledger: "нет",
        boost: { mult: "2" },
        paywall: null,
        aiUsage: 12,
        history: { a: 1 },
      },
      st(),
    );
    expect(m.plan).toEqual({ tier: "free" });
    expect(m.hearts.count).toBe(5);
    expect(m.wallet).toEqual(START_WALLET);
    expect(m.ledger).toEqual([]);
    expect(m.boost).toBeNull();
    expect(m.paywall).toEqual({ lastShownAt: 0, views: 0 });
    expect(m.aiUsage).toEqual({ day: "", count: 0, free: 0, freeTotal: 0 });
    expect(m.history).toEqual([]);
  });

  it("старое поле practiceHearts (возврат сердечка за тренировку убран в 16В) молча отбрасывается, остальное грузится", () => {
    const m = mergeState({ xp: 7, practiceHearts: { day: "2027-01-15", count: 3 } }, st());
    expect(m.xp).toBe(7);
    expect("practiceHearts" in m).toBe(false);
    expect("practiceHearts" in mergeState({ practiceHearts: 7 }, st())).toBe(false);
  });

  it("сохранённая попытка с исходом сюрприза переживает загрузку", () => {
    const e = exam({ id: "t9", kind: "topic", points: 10, maxPoints: 10, drop: { kind: "chips", amount: 3 } });
    const m = mergeState(JSON.parse(JSON.stringify({ exams: [e] })), st());
    expect(m.exams[0].drop).toEqual({ kind: "chips", amount: 3 });
  });

  it("корректные данные сохраняются; мусорные записи ledger и history отбрасываются", () => {
    const m = mergeState(
      {
        plan: { tier: "lite", period: "year", until: Date.now() + 1e9 },
        wallet: { chips: 7, earned: 20, spent: 13 },
        ledger: [{ id: "a", at: Date.now() - 1000, amount: 3, reason: "xp" }, { id: "old", at: 1, amount: 3, reason: "xp" }, null, { id: "b" }, 5],
        history: [{ id: "h", kind: "lesson", wrong: [], fixed: [] }, { kind: "bad" }],
      },
      st(),
    );
    expect(m.plan.tier).toBe("lite");
    expect(m.wallet).toEqual({ chips: 7, earned: 20, spent: 13 });
    expect(m.ledger.map((x) => x.id)).toEqual(["a"]); // запись at: 1 старше недели — отброшена
    expect(m.history.map((e) => e.id)).toEqual(["h"]);
  });
});

describe("стор: незаконченные уроки (#41)", () => {
  beforeEach(fullReset);

  const run = (lessonId: string, over: Partial<LessonRun> = {}): LessonRun => ({
    lessonId,
    sig: "3-abc",
    queue: [
      { id: "s1", retry: false },
      { id: "s2", retry: false },
      { id: "s3", retry: false },
    ],
    pos: 1,
    done: 1,
    records: [rec({ stepId: "s1" })],
    xp: 10,
    combo: 1,
    maxCombo: 1,
    skipped: 0,
    activeMs: 30_000,
    xpFactor: 1,
    chipsEarned: 4,
    cost: 1,
    startedAt: Date.now() - 60_000,
    updatedAt: Date.now(),
    paidAt: Date.now() - 50_000,
    ...over,
  });

  it("saveLessonRun / clearLessonRun", () => {
    st().saveLessonRun(run("ns-2-read"));
    expect(st().lessonRuns["ns-2-read"]).toMatchObject({ pos: 1, xp: 10 });
    st().saveLessonRun(run("ns-2-read", { pos: 2 }));
    expect(st().lessonRuns["ns-2-read"].pos).toBe(2);
    st().clearLessonRun("ns-2-read");
    expect(st().lessonRuns).toEqual({});
    const before = st().lessonRuns;
    st().clearLessonRun("nope");
    expect(st().lessonRuns).toBe(before);
  });

  it("пройденный в режиме «Учиться» урок забывает сохранение; «Проверить себя» — нет", () => {
    st().saveLessonRun(run("ns-2-read"));
    st().finishSession(lesson({ via: "check" }));
    expect(st().lessonRuns["ns-2-read"]).toBeDefined();
    st().finishSession(lesson());
    expect(st().lessonRuns["ns-2-read"]).toBeUndefined();
  });

  it("хранится не больше 5 самых свежих", () => {
    for (let i = 0; i < 7; i++) st().saveLessonRun(run(`l${i}`, { updatedAt: Date.now() + i }));
    expect(Object.keys(st().lessonRuns).sort()).toEqual(["l2", "l3", "l4", "l5", "l6"]);
  });

  it("сброс прогресса и загрузка сохранения проверяют сохранения уроков", () => {
    st().saveLessonRun(run("ns-2-read"));
    st().resetProgress();
    expect(st().lessonRuns).toEqual({});
    const m = mergeState({ lessonRuns: { "ns-2-read": run("ns-2-read"), bad: { lessonId: "bad" }, "x y": run("x y") } }, st());
    expect(Object.keys(m.lessonRuns)).toEqual(["ns-2-read"]);
    expect(mergeState({ lessonRuns: "мусор" }, st()).lessonRuns).toEqual({});
  });
});
