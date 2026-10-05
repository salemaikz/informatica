import { describe, expect, it, vi } from "vitest";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  LEGACY_BROKEN_KEY,
  STORAGE_KEY,
  createPersistRequest,
  createSafeStorage,
  hydrationPhase,
  isQuotaError,
  type RawStorage,
} from "@/lib/safe-storage";
import { guessLang, isFocusPath } from "@/lib/recovery";

class QuotaError extends Error {
  name = "QuotaExceededError";
}
class SecurityError extends Error {
  name = "SecurityError";
}

/** Подделка localStorage с возможностью «сломать» запись или чтение. */
function fakeBackend(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const ctl: { setError: Error | null; getError: Error | null } = { setError: null, getError: null };
  const backend: RawStorage = {
    getItem: (k) => {
      if (ctl.getError) throw ctl.getError;
      return data.get(k) ?? null;
    },
    setItem: (k, v) => {
      if (ctl.setError) throw ctl.setError;
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
  return { backend, data, ctl };
}

describe("safe-storage: обычная работа и недоступное хранилище", () => {
  it("ok: пишет и читает, проба записи не оставляет мусора", () => {
    const f = fakeBackend();
    const s = createSafeStorage({ backend: () => f.backend });
    expect(s.getItem("a")).toBeNull();
    s.setItem("a", "1");
    expect(s.getItem("a")).toBe("1");
    expect(f.data.get("a")).toBe("1");
    expect(s.status()).toBe("ok");
    expect([...f.data.keys()]).toEqual(["a"]);
    s.removeItem("a");
    expect(s.getItem("a")).toBeNull();
  });

  it("localStorage недоступен (backend = null): работаем из памяти, статус memory", () => {
    const s = createSafeStorage({ backend: () => null });
    expect(s.getItem("a")).toBeNull();
    s.setItem("a", "1");
    expect(s.getItem("a")).toBe("1");
    expect(s.status()).toBe("memory");
  });

  it("доступ к localStorage бросает SecurityError: не падаем, память", () => {
    const s = createSafeStorage({
      backend: () => {
        throw new SecurityError("denied");
      },
    });
    expect(() => s.setItem("a", "1")).not.toThrow();
    expect(s.getItem("a")).toBe("1");
    expect(s.status()).toBe("memory");
  });

  it("чтение бросает: null вместо падения, статус memory", () => {
    const f = fakeBackend({ a: "1" });
    const s = createSafeStorage({ backend: () => f.backend });
    f.ctl.getError = new SecurityError("denied");
    expect(s.getItem("a")).toBeNull();
    expect(s.status()).toBe("memory");
  });

  it("проба записи при старте: заполненная память видна сразу, приватный режим — как memory", () => {
    const full = fakeBackend({ a: "старое" });
    full.ctl.setError = new QuotaError("quota");
    const s1 = createSafeStorage({ backend: () => full.backend });
    expect(s1.status()).toBe("full");
    expect(s1.getItem("a")).toBe("старое"); // читать можно

    const priv = fakeBackend();
    priv.ctl.setError = new SecurityError("private");
    const s2 = createSafeStorage({ backend: () => priv.backend });
    expect(s2.status()).toBe("memory");
  });
});

describe("safe-storage: переполнение", () => {
  it("setItem бросает QuotaExceeded: не падаем, статус full, свежая копия в памяти", () => {
    const f = fakeBackend();
    const s = createSafeStorage({ backend: () => f.backend });
    const seen: string[] = [];
    s.subscribe(() => seen.push(s.status()));
    s.setItem("a", "v1");
    expect(s.status()).toBe("ok");
    f.ctl.setError = new QuotaError("quota");
    expect(() => s.setItem("a", "v2")).not.toThrow();
    expect(s.status()).toBe("full");
    expect(f.data.get("a")).toBe("v1"); // в браузере старое
    expect(s.getItem("a")).toBe("v2"); // читаем свежее из памяти
    // место освободилось — запись проходит, статус возвращается
    f.ctl.setError = null;
    s.setItem("a", "v3");
    expect(s.status()).toBe("ok");
    expect(f.data.get("a")).toBe("v3");
    expect(s.getItem("a")).toBe("v3");
    expect(seen).toEqual(["full", "ok"]);
  });

  it("другая ошибка записи (не квота) — статус memory", () => {
    const f = fakeBackend();
    const s = createSafeStorage({ backend: () => f.backend });
    s.status();
    f.ctl.setError = new SecurityError("denied");
    s.setItem("a", "1");
    expect(s.status()).toBe("memory");
    expect(s.getItem("a")).toBe("1");
  });

  it("isQuotaError узнаёт разные браузеры", () => {
    expect(isQuotaError(new QuotaError("x"))).toBe(true);
    expect(isQuotaError({ name: "NS_ERROR_DOM_QUOTA_REACHED" })).toBe(true);
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError({ code: 1014 })).toBe(true);
    expect(isQuotaError(new Error("x"))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });
});

describe("safe-storage: битое сохранение", () => {
  it("ошибка гидратации: запись в основной ключ заблокирована, сохранение лежит нетронутым, копий нет", () => {
    const f = fakeBackend({ [STORAGE_KEY]: "{" });
    const s = createSafeStorage({ backend: () => f.backend });
    expect(s.getItem(STORAGE_KEY)).toBe("{");
    s.finishHydration(new SyntaxError("Unexpected end of JSON input"));
    expect(s.hydrationFailed()).toBe(true);
    expect(s.peekSaved()).toBe("{");
    s.setItem(STORAGE_KEY, '{"state":{}}');
    expect(f.data.get(STORAGE_KEY)).toBe("{"); // не затёрто
    s.setItem("other", "1"); // другие ключи не блокируются
    expect(f.data.get("other")).toBe("1");
    // Никаких копий сохранения в браузере не появляется: только основной ключ и чужой.
    expect([...f.data.keys()].sort()).toEqual(["other", STORAGE_KEY].sort());
  });

  it("«Начать заново»: основной ключ удалён, сбой снят, запись снова работает", () => {
    const f = fakeBackend({ [STORAGE_KEY]: "{" });
    const s = createSafeStorage({ backend: () => f.backend });
    s.getItem(STORAGE_KEY);
    s.finishHydration(new Error("x"));
    const calls: number[] = [];
    s.subscribe(() => calls.push(1));
    s.discard();
    expect(f.data.has(STORAGE_KEY)).toBe(false);
    expect(s.hydrationFailed()).toBe(false);
    expect(s.peekSaved()).toBeNull();
    expect(calls.length).toBeGreaterThan(0);
    s.setItem(STORAGE_KEY, "новое");
    expect(f.data.get(STORAGE_KEY)).toBe("новое");
    expect([...f.data.keys()]).toEqual([STORAGE_KEY]); // и копии тоже нет
  });

  it("«Начать заново» до сбоя (таймаут гидратации) тоже удаляет сохранение и снимает блокировку", () => {
    const f = fakeBackend({ [STORAGE_KEY]: '{"state":{"xp":5},"version":2}' });
    const s = createSafeStorage({ backend: () => f.backend });
    s.getItem(STORAGE_KEY);
    s.discard();
    expect(f.data.has(STORAGE_KEY)).toBe(false);
    expect([...f.data.keys()]).toEqual([]);
    expect(s.hydrationFailed()).toBe(false);
  });

  it("основной ключ не прочитался вовсе (getItem бросил): peekSaved = null, discard не бросает", () => {
    const f = fakeBackend({ [STORAGE_KEY]: "{" });
    f.ctl.getError = new SecurityError("denied");
    const s = createSafeStorage({ backend: () => f.backend });
    expect(() => s.getItem(STORAGE_KEY)).toThrow();
    s.finishHydration(new Error("x"));
    expect(s.peekSaved()).toBeNull();
    expect(() => s.discard()).not.toThrow();
    expect(s.hydrationFailed()).toBe(false);
  });

  it("успешная повторная гидратация снимает блокировку", () => {
    const f = fakeBackend();
    const s = createSafeStorage({ backend: () => f.backend });
    expect(s.peekSaved()).toBeNull();
    s.getItem(STORAGE_KEY);
    s.finishHydration(new Error("x"));
    expect(s.hydrationFailed()).toBe(true);
    s.beginHydration();
    expect(s.hydrationFailed()).toBe(false);
    s.finishHydration();
    s.setItem(STORAGE_KEY, "ok");
    expect(f.data.get(STORAGE_KEY)).toBe("ok");
  });

  it("peekSaved: строка нечитаемого сохранения живёт в памяти только до успешной гидратации", () => {
    const f = fakeBackend({ [STORAGE_KEY]: "{broken" });
    const s = createSafeStorage({ backend: () => f.backend });
    s.getItem(STORAGE_KEY);
    s.finishHydration(new Error("x"));
    expect(s.peekSaved()).toBe("{broken");
    f.data.set(STORAGE_KEY, "{}");
    s.beginHydration();
    s.getItem(STORAGE_KEY);
    s.finishHydration();
    expect(s.peekSaved()).toBeNull();
  });
});

describe("safe-storage: копия повреждённого сохранения из прежней версии", () => {
  it("при запуске ключ informatica-v1-broken удаляется, основное сохранение не трогается", () => {
    const f = fakeBackend({ [LEGACY_BROKEN_KEY]: "x".repeat(100), [STORAGE_KEY]: '{"state":{"xp":1},"version":2}', other: "1" });
    const s = createSafeStorage({ backend: () => f.backend });
    expect(s.status()).toBe("ok");
    expect(f.data.has(LEGACY_BROKEN_KEY)).toBe(false);
    expect(f.data.get(STORAGE_KEY)).toBe('{"state":{"xp":1},"version":2}');
    expect(f.data.get("other")).toBe("1");
  });

  it("старая копия освобождает место до пробы записи: память не считается заполненной", () => {
    const f = fakeBackend({ [LEGACY_BROKEN_KEY]: "копия" });
    // Пока копия лежит, даже проба записи не помещается.
    const setItem = f.backend.setItem;
    f.backend.setItem = (k, v) => {
      if (f.data.has(LEGACY_BROKEN_KEY)) throw new QuotaError("quota");
      setItem(k, v);
    };
    const s = createSafeStorage({ backend: () => f.backend });
    expect(s.status()).toBe("ok");
  });

  it("removeItem бросает (запрет записи): запуск не падает", () => {
    const f = fakeBackend({ [LEGACY_BROKEN_KEY]: "копия" });
    f.backend.removeItem = () => {
      throw new SecurityError("denied");
    };
    const s = createSafeStorage({ backend: () => f.backend });
    expect(() => s.status()).not.toThrow();
    expect(s.getItem(LEGACY_BROKEN_KEY)).toBe("копия");
  });
});

/** Стор по образцу lib/store.ts: persist + безопасное хранилище + onRehydrateStorage. */
function makeStore(s: ReturnType<typeof createSafeStorage>, hooks: { migrate?: (p: unknown, v: number) => unknown; merge?: (p: unknown, c: { n: number }) => { n: number } } = {}) {
  return create<{ n: number }>()(
    persist(() => ({ n: 0 }), {
      name: STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => s),
      onRehydrateStorage: () => {
        s.beginHydration();
        return (_state, error) => s.finishHydration(error);
      },
      ...(hooks.migrate ? { migrate: hooks.migrate as never } : {}),
      ...(hooks.merge ? { merge: hooks.merge as never } : {}),
    }),
  );
}

describe("safe-storage + zustand persist: гидратация не висит", () => {
  it("валидное сохранение читается, запись работает", () => {
    const f = fakeBackend({ [STORAGE_KEY]: JSON.stringify({ state: { n: 7 }, version: 2 }) });
    const s = createSafeStorage({ backend: () => f.backend });
    const store = makeStore(s);
    expect(store.persist.hasHydrated()).toBe(true);
    expect(store.getState().n).toBe(7);
    store.setState({ n: 8 });
    expect(JSON.parse(f.data.get(STORAGE_KEY)!).state.n).toBe(8);
  });

  it("битый JSON: гидратация падает, но ошибка поймана; сохранение не затирается", () => {
    const f = fakeBackend({ [STORAGE_KEY]: "{broken" });
    const s = createSafeStorage({ backend: () => f.backend });
    const store = makeStore(s);
    expect(store.persist.hasHydrated()).toBe(false);
    expect(s.hydrationFailed()).toBe(true);
    store.setState({ n: 1 }); // действия работают, но не пишут поверх нечитаемого
    expect(f.data.get(STORAGE_KEY)).toBe("{broken");
    expect([...f.data.keys()]).toEqual([STORAGE_KEY]); // копий нет
  });

  it("getItem основного ключа бросает: это сбой чтения, а не «сохранения нет» — запись заблокирована, стор не затирает данные", () => {
    const saved = JSON.stringify({ state: { n: 7 }, version: 2 });
    const f = fakeBackend({ [STORAGE_KEY]: saved });
    f.ctl.getError = new SecurityError("denied");
    const s = createSafeStorage({ backend: () => f.backend });
    const store = makeStore(s);
    expect(store.persist.hasHydrated()).toBe(false);
    expect(s.hydrationFailed()).toBe(true);
    store.setState({ n: 1 }); // действия работают в памяти, но поверх нечитаемого не пишут
    expect(f.data.get(STORAGE_KEY)).toBe(saved);
    expect(s.peekSaved()).toBeNull(); // строки нет — язык экрана восстановления угадаем по браузеру
    // Доступ вернулся — «Попробовать ещё раз» открывает сохранение.
    f.ctl.getError = null;
    void store.persist.rehydrate();
    expect(store.persist.hasHydrated()).toBe(true);
    expect(s.hydrationFailed()).toBe(false);
    expect(store.getState().n).toBe(7);
    store.setState({ n: 8 });
    expect(JSON.parse(f.data.get(STORAGE_KEY)!).state.n).toBe(8);
  });

  it("«Попробовать ещё раз»: после исправления данных rehydrate проходит", () => {
    const f = fakeBackend({ [STORAGE_KEY]: "{broken" });
    const s = createSafeStorage({ backend: () => f.backend });
    const store = makeStore(s);
    expect(s.hydrationFailed()).toBe(true);
    f.data.set(STORAGE_KEY, JSON.stringify({ state: { n: 3 }, version: 2 }));
    void store.persist.rehydrate();
    expect(store.persist.hasHydrated()).toBe(true);
    expect(s.hydrationFailed()).toBe(false);
    expect(store.getState().n).toBe(3);
    store.setState({ n: 4 });
    expect(JSON.parse(f.data.get(STORAGE_KEY)!).state.n).toBe(4);
  });

  it("ошибка миграции и ошибка слияния тоже ведут к экрану восстановления, а не к вечной загрузке", () => {
    const old = JSON.stringify({ state: { n: 1 }, version: 1 });
    const f1 = fakeBackend({ [STORAGE_KEY]: old });
    const s1 = createSafeStorage({ backend: () => f1.backend });
    makeStore(s1, {
      migrate: () => {
        throw new Error("migrate");
      },
    });
    expect(s1.hydrationFailed()).toBe(true);
    expect(f1.data.get(STORAGE_KEY)).toBe(old); // сохранение не тронуто

    const cur = JSON.stringify({ state: { n: 1 }, version: 2 });
    const f2 = fakeBackend({ [STORAGE_KEY]: cur });
    const s2 = createSafeStorage({ backend: () => f2.backend });
    const store = makeStore(s2, {
      merge: () => {
        throw new Error("merge");
      },
    });
    expect(s2.hydrationFailed()).toBe(true);
    expect(store.persist.hasHydrated()).toBe(false);
    expect(f2.data.get(STORAGE_KEY)).toBe(cur); // сохранение не тронуто
  });

  it("localStorage недоступен: persist существует, стор работает из памяти и хранит между rehydrate", () => {
    const s = createSafeStorage({ backend: () => null });
    const store = makeStore(s);
    expect(store.persist).toBeDefined();
    expect(store.persist.hasHydrated()).toBe(true);
    store.setState({ n: 5 });
    expect(s.status()).toBe("memory");
    void store.persist.rehydrate();
    expect(store.getState().n).toBe(5);
  });

  it("переполнение: setState не бросает, статус full", () => {
    const f = fakeBackend();
    const s = createSafeStorage({ backend: () => f.backend });
    const store = makeStore(s);
    f.ctl.setError = new QuotaError("quota");
    expect(() => store.setState({ n: 9 })).not.toThrow();
    expect(s.status()).toBe("full");
    expect(store.getState().n).toBe(9);
  });
});

describe("фаза загрузки", () => {
  it("готово важнее всего; сбой или таймаут — экран восстановления; иначе ждём", () => {
    expect(hydrationPhase(true, false, false)).toBe("ready");
    expect(hydrationPhase(true, true, true)).toBe("ready");
    expect(hydrationPhase(false, true, false)).toBe("failed");
    expect(hydrationPhase(false, false, true)).toBe("failed");
    expect(hydrationPhase(false, false, false)).toBe("loading");
  });
});

describe("экран восстановления и баннер: мелкая логика", () => {
  it("язык: из сырого сохранения, иначе из браузера (kk*), иначе русский", () => {
    expect(guessLang('{"state":{"profile":{"lang":"kk"', "ru-RU")).toBe("kk");
    expect(guessLang('{"profile": {"lang" : "ru"}}', "kk-KZ")).toBe("ru");
    expect(guessLang("{", "kk-KZ")).toBe("kk");
    expect(guessLang(null, "kk")).toBe("kk");
    expect(guessLang(null, "en-US")).toBe("ru");
    expect(guessLang(null, undefined)).toBe("ru");
  });

  it("баннер не лезет в полноэкранные режимы", () => {
    // Знакомство и окно тарифов — со своими кнопками «Далее»: баннер их сдвигал.
    for (const p of ["/lesson/ns-1-binary", "/drill", "/exam/run", "/game/bingo", "/onboarding", "/plans"]) expect(isFocusPath(p), p).toBe(true);
    for (const p of ["/", "/learn", "/profile", "/exam", "/exam/result/5", "/lessons-list", "/planner", "/onboarding-x"]) expect(isFocusPath(p), p).toBe(false);
  });
});

describe("«не стирать данные»", () => {
  it("просит persist(), если ещё не выдано; один раз за сессию", async () => {
    const persistFn = vi.fn(async () => true);
    const ask = createPersistRequest(() => ({ persisted: async () => false, persist: persistFn }));
    await ask();
    await ask();
    expect(persistFn).toHaveBeenCalledTimes(1);
  });

  it("уже выдано — не просит", async () => {
    const persistFn = vi.fn(async () => true);
    await createPersistRequest(() => ({ persisted: async () => true, persist: persistFn }))();
    expect(persistFn).not.toHaveBeenCalled();
  });

  it("нет API или ошибка — молча", async () => {
    await expect(createPersistRequest(() => undefined)()).resolves.toBeUndefined();
    await expect(createPersistRequest(() => ({}))()).resolves.toBeUndefined();
    const bad = createPersistRequest(() => ({
      persist: async () => {
        throw new Error("denied");
      },
    }));
    await expect(bad()).resolves.toBeUndefined();
    const throwing = createPersistRequest(() => {
      throw new Error("no navigator");
    });
    await expect(throwing()).resolves.toBeUndefined();
  });
});
