import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useApp } from "@/lib/store";
import type { AnswerRecord, SessionResult } from "@/lib/types";

const rec = (over: Partial<AnswerRecord> = {}): AnswerRecord => ({
  stepId: "q1",
  skill: "ns.dec2bin",
  correct: false,
  score: 0,
  given: "1",
  expected: "2",
  prompt: "?",
  retry: false,
  timeMs: 1000,
  ...over,
});

describe("стор: работа над ошибками", () => {
  beforeEach(() => useApp.getState().resetProgress());

  it("повторная ошибка в том же задании не дублируется и сохраняет урок", () => {
    const s = useApp.getState();
    s.recordAnswer(rec(), 0, "ns-1-binary");
    s.recordAnswer(rec({ given: "3" }), 0, undefined); // повтор в тренировке — без lessonId
    const m = useApp.getState().mistakes;
    expect(m).toHaveLength(1);
    expect(m[0].lessonId).toBe("ns-1-binary");
    expect(m[0].given).toBe("3");
  });

  it("верный ответ закрывает ошибку; dismissMistake — по id задания", () => {
    const s = useApp.getState();
    s.recordAnswer(rec(), 0, "ns-1-binary");
    s.recordAnswer(rec({ stepId: "q2" }), 0, "ns-1-binary");
    s.recordAnswer(rec({ correct: true, score: 1 }), 10);
    expect(useApp.getState().mistakes.map((m) => m.stepId)).toEqual(["q2"]);
    useApp.getState().dismissMistake("q2");
    expect(useApp.getState().mistakes).toHaveLength(0);
  });

  it("пропущенное задание лишает бонуса «без ошибок»", () => {
    const base: SessionResult = {
      kind: "lesson",
      lessonId: "ns-1-binary",
      title: "t",
      answers: [rec({ correct: true, score: 1 })],
      xp: 10,
      maxCombo: 1,
      durationSec: 60,
      accuracy: 1,
    };
    expect(useApp.getState().finishSession(base).bonusXp).toBe(40);
    // Другой урок: повтор того же урока дал бы меньше XP (lib/review.ts).
    expect(useApp.getState().finishSession({ ...base, lessonId: "ns-2-read", skipped: 1 }).bonusXp).toBe(20);
  });

  it("refundAi возвращает обращение по квитанции", () => {
    const s = useApp.getState();
    s.spendAi("hint");
    const r = s.spendAi("hint");
    expect(r.ok).toBe(true);
    useApp.getState().refundAi(r);
    expect(useApp.getState().aiUsage.count).toBe(1);
    expect(useApp.getState().aiUsage.free).toBe(1);
  });

  it("сброс прогресса не возвращает бесплатные обращения к ИИ (#99)", () => {
    useApp.getState().resetProgress();
    useApp.getState().spendAi("hint");
    const spent = useApp.getState().aiUsage.freeTotal ?? 0;
    expect(spent).toBeGreaterThan(0);
    useApp.getState().resetProgress();
    expect(useApp.getState().aiUsage.freeTotal).toBe(spent);
  });
});

// Гидратация настоящего стора: подставляем window.localStorage и заново загружаем модули (тесты идут в node, без браузера).
describe("стор: сохранение прогресса не ломает приложение", () => {
  const KEY = "informatica-v1";
  const LEGACY_BROKEN = "informatica-v1-broken";

  function fakeLocalStorage(initial: Record<string, string> = {}, fail?: { set?: Error }) {
    const data = new Map(Object.entries(initial));
    const ls = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (fail?.set) throw fail.set;
        data.set(k, v);
      },
      removeItem: (k: string) => void data.delete(k),
    };
    return { ls, data };
  }

  /** Свежий экземпляр стора и safe-storage над подставным window. */
  async function load(win: object) {
    vi.stubGlobal("window", win);
    vi.resetModules();
    const store = await import("@/lib/store");
    const safe = await import("@/lib/safe-storage");
    return { useApp: store.useApp, safe };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("сохранение читается: прогресс и язык на месте, гидратация закончена, статус ok", async () => {
    const saved = { state: { xp: 77, onboarded: true, profile: { lang: "kk" } }, version: 2 };
    const { ls } = fakeLocalStorage({ [KEY]: JSON.stringify(saved) });
    const { useApp, safe } = await load({ localStorage: ls });
    expect(useApp.persist.hasHydrated()).toBe(true);
    expect(useApp.getState().xp).toBe(77);
    expect(useApp.getState().profile.lang).toBe("kk");
    expect(safe.hydrationFailed()).toBe(false);
    expect(safe.storageStatus()).toBe("ok");
  });

  it("битый JSON: гидратация не «висит» молча — сбой отмечен, прогресс не затирается, копий нет", async () => {
    const { ls, data } = fakeLocalStorage({ [KEY]: "{" });
    const { useApp, safe } = await load({ localStorage: ls });
    expect(useApp.persist.hasHydrated()).toBe(false);
    expect(safe.hydrationFailed()).toBe(true);
    expect(safe.peekSaved()).toBe("{");
    expect(data.has(LEGACY_BROKEN)).toBe(false);
    // Действия работают, но поверх нечитаемого сохранения не пишут, пока ученик не решил.
    useApp.getState().updateProfile({ name: "Новый" });
    expect(data.get(KEY)).toBe("{");
    // «Начать заново»: сохранение удалено, копии не остаётся.
    safe.discardSaved();
    expect(data.has(KEY)).toBe(false);
    expect(data.has(LEGACY_BROKEN)).toBe(false);
    expect(safe.hydrationFailed()).toBe(false);
  });

  it("копия повреждённого сохранения из прежней версии удаляется при запуске, прогресс читается", async () => {
    const saved = { state: { xp: 12, onboarded: true, profile: { lang: "ru" } }, version: 2 };
    const { ls, data } = fakeLocalStorage({ [KEY]: JSON.stringify(saved), [LEGACY_BROKEN]: "x".repeat(1000) });
    const { useApp } = await load({ localStorage: ls });
    expect(data.has(LEGACY_BROKEN)).toBe(false);
    expect(useApp.persist.hasHydrated()).toBe(true);
    expect(useApp.getState().xp).toBe(12);
  });

  it("«Попробовать ещё раз»: после исправления данных стор читается", async () => {
    const { ls, data } = fakeLocalStorage({ [KEY]: "{" });
    const { useApp, safe } = await load({ localStorage: ls });
    expect(safe.hydrationFailed()).toBe(true);
    data.set(KEY, JSON.stringify({ state: { xp: 5, onboarded: true, profile: {} }, version: 2 }));
    await useApp.persist.rehydrate();
    expect(useApp.persist.hasHydrated()).toBe(true);
    expect(safe.hydrationFailed()).toBe(false);
    expect(useApp.getState().xp).toBe(5);
    useApp.getState().updateProfile({ name: "Дана" });
    expect(JSON.parse(data.get(KEY)!).state.profile.name).toBe("Дана");
  });

  it("localStorage бросает при обращении (запрет данных сайта): useApp.persist есть, всё работает из памяти", async () => {
    const win = {};
    Object.defineProperty(win, "localStorage", {
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
    const { useApp, safe } = await load(win);
    expect(useApp.persist).toBeDefined();
    expect(useApp.persist.hasHydrated()).toBe(true);
    expect(safe.storageStatus()).toBe("memory");
    useApp.getState().completeOnboarding({ name: "Айым" });
    useApp.getState().recordAnswer(rec({ correct: true, score: 1 }), 10, "ns-1-binary");
    expect(useApp.getState().profile.name).toBe("Айым");
    expect(useApp.getState().days[Object.keys(useApp.getState().days)[0]].xp).toBe(10);
    // «Попробовать ещё раз» в режиме памяти состояние не теряет.
    await useApp.persist.rehydrate();
    expect(useApp.getState().profile.name).toBe("Айым");
  });

  it("память браузера заполнена: действия не падают, статус full", async () => {
    const quota = Object.assign(new Error("quota"), { name: "QuotaExceededError" });
    const { ls } = fakeLocalStorage({}, { set: quota });
    const { useApp, safe } = await load({ localStorage: ls });
    expect(safe.storageStatus()).toBe("full");
    expect(() => useApp.getState().completeOnboarding({ name: "Дана" })).not.toThrow();
    expect(useApp.getState().profile.name).toBe("Дана");
    expect(safe.storageStatus()).toBe("full");
  });
});
