import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useApp } from "@/lib/store";
import { ECONOMY, canFinishSession, heartStatus, recentChipHistory, spendHeart, type LearningRunKind } from "@/lib/economy";
import { COSMETICS, pickCosmetic } from "@/lib/cosmetics";
import { ACHIEVEMENTS } from "@/lib/gamification";
import type { AnswerRecord, SessionResult } from "@/lib/types";

// Хранилище существует уже при импорте Zustand, как в браузере.
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
    clear: () => data.clear(),
  } });
});

const answer: AnswerRecord = { stepId: "economy-q1", skill: "ns.bin2dec", correct: true, score: 1, given: "1", expected: "1", prompt: "1₂ = ?", retry: false, timeMs: 1000 };
const lesson: SessionResult = { kind: "lesson", lessonId: "economy-lesson", title: "Lesson", answers: [answer], xp: 10, maxCombo: 1, durationSec: 60, accuracy: 1 };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-06T10:00:00+05:00")); useApp.getState().resetProgress(); });
afterEach(() => vi.useRealTimers());

describe("сердца: все режимы проходят через один кошелёк", () => {
  it.each<LearningRunKind>(["lesson", "drill", "review", "code", "section-test", "ent", "game"])("%s списывает одно сердце; повторный допуск не списывает второе", (kind) => {
    const s = useApp.getState();
    expect(s.startLearningRun(kind, "run-1")).toBe(true);
    expect(s.startLearningRun(kind, "run-1")).toBe(true);
    expect(useApp.getState().hearts.count).toBe(4);
    expect(s.startLearningRun(kind === "lesson" ? "drill" : "lesson", "run-1")).toBe(false);
  });

  it("после пяти занятий бесплатные сердца заканчиваются, тренировка их не возвращает", () => {
    const s = useApp.getState();
    for (let i = 0; i < 5; i++) expect(s.startLearningRun("drill", `drill-${i}`)).toBe(true);
    expect(s.startLearningRun("code", "blocked")).toBe(false);
    s.finishSession({ ...lesson, kind: "drill" });
    expect(useApp.getState().hearts.count).toBe(0);
  });

  it("Lite даёт ёмкость 6, только действующая подписка Безлимит снимает ограничение", () => {
    const now = Date.now();
    const empty = { count: 0, refilledAt: now };
    expect(heartStatus(empty, { plan: "lite", expiresAt: now + 1000 }, now).maxHearts).toBe(6);
    expect(spendHeart(empty, { plan: "unlimited", expiresAt: now + 1000 }, now)).not.toBeNull();
    expect(spendHeart(empty, { plan: "unlimited", expiresAt: now - 1 }, now)).toBeNull();
  });

  it("восстанавливает ровно одно сердце за четыре часа и не превышает ёмкость", () => {
    const now = Date.now();
    const plan = { plan: "free" as const, expiresAt: null };
    const wallet = { count: 0, refilledAt: now };
    expect(heartStatus(wallet, plan, now + ECONOMY.heartRefillMs - 1).hearts).toBe(0);
    expect(heartStatus(wallet, plan, now + ECONOMY.heartRefillMs).hearts).toBe(1);
    expect(heartStatus(wallet, plan, now + ECONOMY.heartRefillMs * 20).hearts).toBe(5);
  });

  it("уже оплаченный запуск можно продолжить без сердец, новая игра списывает новое сердце", () => {
    const s = useApp.getState();
    expect(s.startLearningRun("game", "game:round1")).toBe(true);
    expect(s.startLearningRun("game", "game:round2")).toBe(true);
    expect(useApp.getState().hearts.count).toBe(3);
    useApp.setState({ hearts: { count: 0, refilledAt: Date.now() } });
    expect(s.startLearningRun("game", "game:round1")).toBe(true);
    expect(s.startLearningRun("game", "game:round3")).toBe(false);
    expect(useApp.getState().hearts.count).toBe(0);
  });

  it("запуск безлимита можно закончить после истечения подписки, новый не допускается", () => {
    useApp.setState({ hearts: { count: 0, refilledAt: Date.now() }, subscription: { plan: "unlimited", expiresAt: Date.now() + 1000 } });
    const s = useApp.getState();
    expect(s.startLearningRun("code", "code-before-expiry")).toBe(true);
    vi.advanceTimersByTime(1001);
    expect(s.startLearningRun("code", "code-before-expiry")).toBe(true);
    expect(s.startLearningRun("code", "code-after-expiry")).toBe(false);
  });

  it("при ограничении истории запусков сохраняет новые даже при одинаковом времени", () => {
    useApp.setState({ subscription: { plan: "unlimited", expiresAt: Date.now() + 1000 } });
    const s = useApp.getState();
    for (let i = 0; i < 255; i++) s.startLearningRun("game", `history-${i}`);
    expect(Object.keys(useApp.getState().learningRuns)).toHaveLength(250);
    expect(useApp.getState().learningRuns["history-0"]).toBeUndefined();
    expect(useApp.getState().learningRuns["history-253"]).toBeDefined();
    expect(useApp.getState().learningRuns["history-254"]).toBeDefined();
  });
});

describe("чипы: небольшие награды без повторного фарма", () => {
  it("первый и идеальный урок дают +2/+3 один раз, цель дня +2 один раз", () => {
    const s = useApp.getState();
    s.recordAnswer(answer, 10, lesson.lessonId);
    s.finishSession(lesson);
    const reasons = useApp.getState().chipHistory;
    expect(reasons.find((entry) => entry.reason === "lesson")?.amount).toBe(2);
    expect(reasons.find((entry) => entry.reason === "perfect")?.amount).toBe(3);
    expect(reasons.find((entry) => entry.reason === "daily")?.amount).toBe(2);
    const chips = useApp.getState().chips;
    s.finishSession(lesson);
    expect(useApp.getState().chips).toBe(chips);
  });

  it("у тестов награда +5 за отдельный вариант, достижения от 1 до 10", () => {
    const s = useApp.getState();
    s.recordAssessment("ent", "variant-1", .7);
    s.recordAssessment("ent", "variant-1", 1);
    s.recordAssessment("section-test", "unit-1", .8);
    expect(useApp.getState().chips).toBe(10);
    expect(ACHIEVEMENTS.every((item) => item.difficulty >= 1 && item.difficulty <= 10)).toBe(true);
    s.unlock("binary_master");
    s.unlock("binary_master");
    expect(useApp.getState().chips).toBe(20);
  });

  it("бустер умножает только XP, чипы за уроки и достижения не растут", () => {
    useApp.setState({ chips: 40 });
    const s = useApp.getState();
    expect(s.buyXpBoost()).toBe(true);
    expect(useApp.getState().chips).toBe(0);
    expect(s.recordAnswer(answer, 10, lesson.lessonId)).toBe(20);
    expect(s.finishSession(lesson).bonusXp).toBe(80);
    const history = useApp.getState().chipHistory;
    expect(history.find((entry) => entry.reason === "lesson")?.amount).toBe(2);
    expect(history.find((entry) => entry.reason === "perfect")?.amount).toBe(3);
    expect(history.find((entry) => entry.reason === "daily")?.amount).toBe(2);
    expect(s.buyXpBoost()).toBe(false);
  });

  it("история старше недели удаляется, но право на повторную награду не возникает", () => {
    const s = useApp.getState();
    s.recordAssessment("ent", "old-variant", 1);
    vi.advanceTimersByTime(ECONOMY.historyRetentionMs + 1);
    s.pruneChipHistory();
    expect(useApp.getState().chipHistory).toHaveLength(0);
    s.recordAssessment("ent", "old-variant", 1);
    expect(useApp.getState().chips).toBe(5);
    expect(recentChipHistory([{ id: "future", reason: "daily", amount: 2, at: Date.now() + 1000 }])).toHaveLength(0);
  });

  it("пустые и преимущественно пропущенные уроки не выдают XP, чипы или завершение", () => {
    const s = useApp.getState();
    expect(s.finishSession({ ...lesson, answers: [], skipped: 3 }).bonusXp).toBe(0);
    expect(s.finishSession({ ...lesson, answers: [answer], skipped: 2 }).bonusXp).toBe(0);
    expect(useApp.getState().chips).toBe(0);
    expect(useApp.getState().xp).toBe(0);
    expect(useApp.getState().lessons[lesson.lessonId!]).toBeUndefined();
    const attempts = Array.from({ length: 7 }, (_, i) => ({ ...answer, stepId: `threshold-${i}` }));
    expect(canFinishSession({ answers: attempts, skipped: 3 })).toBe(true);
    expect(canFinishSession({ answers: Array(7).fill(answer), skipped: 3 })).toBe(false);
    expect(canFinishSession({ answers: [{ ...answer, retry: true }], skipped: 0 })).toBe(false);
  });

  it("учитывает длительность экзамена; повреждённое время и XP не ломают прогресс", () => {
    const s = useApp.getState();
    s.recordAssessment("ent", "timed-variant", .5, 480);
    expect(Object.values(useApp.getState().days)[0].seconds).toBe(480);
    s.recordAssessment("section-test", "timed-unit", .5, -100);
    s.recordAssessment("ent", "timed-variant-2", .5, Infinity);
    expect(Object.values(useApp.getState().days)[0].seconds).toBe(480);
    expect(s.recordAnswer(answer, Infinity)).toBe(0);
    expect(useApp.getState().xp).toBe(0);
  });

  it("сохраняет время неполного теста без наград и ограничивает ошибочное время", () => {
    const s = useApp.getState();
    s.recordStudyTime(321.9);
    s.recordStudyTime(-10);
    s.recordStudyTime(NaN);
    s.recordStudyTime(Infinity);
    expect(Object.values(useApp.getState().days)[0]).toEqual({ xp: 0, answers: 0, correct: 0, seconds: 321 });
    expect(useApp.getState().chips).toBe(0);
    expect(useApp.getState().xp).toBe(0);
    expect(useApp.getState().cases).toBe(0);
    expect(useApp.getState().chipClaims).toEqual({});
    expect(useApp.getState().lessons).toEqual({});
    s.recordStudyTime(100_000);
    expect(Object.values(useApp.getState().days)[0].seconds).toBe(321 + 7200);
  });
});

describe("кейсы и аналитика", () => {
  it("кейс появляется только за новый уровень и содержит оформление", () => {
    const s = useApp.getState();
    expect(s.openCase()).toBeNull();
    s.recordAnswer(answer, 300);
    expect(useApp.getState().cases).toBe(2);
    s.recordAnswer({ ...answer, retry: true }, 0);
    expect(useApp.getState().cases).toBe(2);
    const item = s.openCase();
    expect(item).not.toBeNull();
    expect(useApp.getState().cases).toBe(1);
    expect(useApp.getState().cosmetics).toContain(item?.id);
    s.equipCosmetic("unowned");
    expect(useApp.getState().equippedCosmeticId).toBeNull();
    s.equipCosmetic(item!.id);
    expect(useApp.getState().equippedCosmeticId).toBe(item!.id);
  });

  it("до заполнения коллекции кейс не даёт дубликат", () => {
    const owned = COSMETICS.slice(0, -1).map((item) => item.id);
    expect(pickCosmetic(owned, () => 0).id).toBe(COSMETICS[COSMETICS.length - 1].id);
    useApp.setState({ cosmetics: COSMETICS.map((item) => item.id), cases: 2 });
    expect(useApp.getState().openCase()).toBeNull();
    expect(useApp.getState().cases).toBe(2);
  });

  it("сохраняет первые попытки, тему, урок и частичный балл без искажения повтором", () => {
    const s = useApp.getState();
    s.recordAnswer({ ...answer, correct: false, score: .5 }, 0, "lesson-1");
    s.recordAnswer(answer, 10);
    s.recordAnswer({ ...answer, retry: true }, 5);
    expect(useApp.getState().questionStats[answer.stepId]).toMatchObject({ lessonId: "lesson-1", skill: answer.skill, attempts: 2, correct: 1, scoreTotal: 1.5 });
  });
});

describe("миграция старых и неполных сохранений", () => {
  it("добавляет кошельки/аналитику и выдаёт исторические кейсы ровно один раз", () => {
    const merge = useApp.persist.getOptions().merge!;
    const migrated = merge({ xp: 650, profile: { lang: "kk" }, lessons: { old: { completions: 2, bestAccuracy: 1, lastAt: Date.now(), totalXp: 650 } } }, useApp.getState());
    expect(migrated.profile.lang).toBe("kk");
    expect(migrated.profile.sound).toBe(true);
    expect(migrated.hearts.count).toBe(5);
    expect(migrated.subscription.plan).toBe("free");
    expect(migrated.chipClaims).toEqual({});
    expect(migrated.questionStats).toEqual({});
    expect(migrated.cases).toBe(3);
    expect(migrated.caseLevel).toBe(4);
    const reloaded = merge({ ...migrated, cases: 1 }, useApp.getState());
    expect(reloaded.cases).toBe(1);
    expect(reloaded.caseLevel).toBe(4);
  });

  it("глубоко дополняет кошельки и подписку, удаляет старую историю и неизвестные оформления", () => {
    const merged = useApp.persist.getOptions().merge!({ hearts: { count: 2 }, subscription: { plan: "lite" }, chipHistory: [{ id: "expired", reason: "daily", amount: 2, at: Date.now() - ECONOMY.historyRetentionMs - 1 }], cosmetics: [COSMETICS[0].id, "unknown-frame"] }, useApp.getState());
    expect(merged.hearts).toEqual({ count: 2, refilledAt: 0 });
    expect(merged.subscription).toEqual({ plan: "lite", expiresAt: null });
    expect(merged.chipHistory).toHaveLength(0);
    expect(merged.cosmetics).toEqual([COSMETICS[0].id]);
    expect(useApp.persist.getOptions().merge!({ xp: Infinity }, useApp.getState()).xp).toBe(0);
  });

  it("после недели без открытий удаляет старую историю и из состояния, и с устройства", async () => {
    localStorage.setItem("informatica-v1", JSON.stringify({ version: 0, state: { onboarded: true, profile: { name: "Old", lang: "kk", sound: false }, xp: 650, achievements: { xp_500: 1 }, lessons: { "ns-1-binary": { completions: 2, bestAccuracy: .8, lastAt: 1, totalXp: 300 } }, chips: 5, chipClaims: { "ent:old": Date.now() - ECONOMY.historyRetentionMs - 1 }, chipHistory: [{ id: "old", reason: "ent", amount: 5, at: Date.now() - ECONOMY.historyRetentionMs - 1 }] } }));
    await useApp.persist.rehydrate();
    expect(useApp.getState().onboarded).toBe(true);
    expect(useApp.getState().profile).toMatchObject({ name: "Old", lang: "kk", sound: false, vibration: true });
    expect(useApp.getState().xp).toBe(650);
    expect(useApp.getState().lessons["ns-1-binary"].completions).toBe(2);
    expect(useApp.getState().hearts.count).toBe(5);
    expect(useApp.getState().cases).toBe(3);
    expect(useApp.getState().chipHistory).toHaveLength(0);
    const saved = JSON.parse(localStorage.getItem("informatica-v1")!);
    expect(saved.version).toBe(1);
    expect(saved.state.chipHistory).toHaveLength(0);
    expect(saved.state.chips).toBe(5);
    useApp.getState().recordAssessment("ent", "old", 1);
    expect(useApp.getState().chips).toBe(5);
  });
});
