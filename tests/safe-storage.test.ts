import { describe, expect, it, vi } from "vitest";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  BROKEN_KEY,
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
  it("ошибка гидратации: копия в informatica-v1-broken, запись в основной ключ заблокирована", () => {
    const f = fakeBackend({ [STORAGE_KEY]: "{" });
    const s = createSafeStorage({ backend: () => f.backend });
    expect(s.getItem(STORAGE_KEY)).toBe("{");
    s.finishHydration(new SyntaxError("Unexpected end of JSON input"));
    expect(s.hydrationFailed()).toBe(true);
    expect(f.data.get(BROKEN_KEY)).toBe("{");
    expect(s.rawForDownload()).toBe("{");
    s.setItem(STORAGE_KEY, '{"state":{}}');
    expect(f.data.get(STORAGE_KEY)).toBe("{"); // не затёрто
    s.setItem("other", "1"); // другие ключи не блокируются
    expect(f.data.get("other")).toBe("1");
  });

  it("copy в broken — одна последняя: новая копия заменяет прежнюю", () => {
    const f = fakeBackend({ [STORAGE_KEY]: "первая" });
    const s = createSafeStorage({ backend: () => f.backend });
    s.getItem(STORAGE_KEY);
    s.finishHydration(new Error("x"));
    expect(f.data.get(BROKEN_KEY)).toBe("первая");
    f.data.set(STORAGE_KEY, "вторая");
    s.getItem(STORAGE_KEY);
    s.finishHydration(new Error("y"));
    expect(f.data.get(BROKEN_KEY)).toBe("вторая");
  });

  it("«Начать заново»: основной ключ очищен, копия осталась, запись снова работает", () => {
    const f = fakeBackend({ [STORAGE_KEY]: "{" });
    const s = createSafeStorage({ backend: () => f.backend });
    s.getItem(STORAGE_KEY);
    s.finishHydration(new Error("x"));
    const calls: number[] = [];
    s.subscribe(() => calls.push(1));
    s.discard();
    expect(f.data.has(STORAGE_KEY)).toBe(false);
    expect(f.data.get(BROKEN_KEY)).toBe("{");
    expect(s.hydrationFailed()).toBe(false);
    expect(calls.length).toBeGreaterThan(0);
    s.setItem(STORAGE_KEY, "новое");
    expect(f.data.get(STORAGE_KEY)).toBe("новое");
  });

  it("discard до сбоя (таймаут гидратации) тоже сохраняет копию", () => {
    const f = fakeBackend({ [STORAGE_KEY]: '{"state":{"xp":5},"version":2}' });
    const s = createSafeStorage({ backend: () => f.backend });
    s.getItem(STORAGE_KEY);
    s.discard();
    expect(f.data.get(BROKEN_KEY)).toBe('{"state":{"xp":5},"version":2}');
    expect(f.data.has(STORAGE_KEY)).toBe(false);
  });

  it("копию не удалось положить в браузер (нет места) — остаётся в памяти для скачивания", () => {
    const f = fakeBackend({ [STORAGE_KEY]: "{" });
    const s = createSafeStorage({ backend: () => f.backend });
    s.getItem(STORAGE_KEY);
    f.ctl.setError = new QuotaError("quota");
    s.finishHydration(new Error("x"));
    expect(f.data.has(BROKEN_KEY)).toBe(false);
    expect(s.rawForDownload()).toBe("{");
  });

  it("нечего скачивать — null; успешная повторная гидратация снимает блокировку", () => {
    const f = fakeBackend();
    const s = createSafeStorage({ backend: () => f.backend });
    expect(s.rawForDownload()).toBeNull();
    s.getItem(STORAGE_KEY);
    s.finishHydration(new Error("x"));
    expect(s.hydrationFailed()).toBe(true);
    s.beginHydration();
    expect(s.hydrationFailed()).toBe(false);
    s.finishHydration();
    s.setItem(STORAGE_KEY, "ok");
    expect(f.data.get(STORAGE_KEY)).toBe("ok");
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

  it("битый JSON: гидратация падает, но ошибка поймана; сохранение не затирается, копия есть", () => {
    const f = fakeBackend({ [STORAGE_KEY]: "{broken" });
    const s = createSafeStorage({ backend: () => f.backend });
    const store = makeStore(s);
    expect(store.persist.hasHydrated()).toBe(false);
    expect(s.hydrationFailed()).toBe(true);
    expect(f.data.get(BROKEN_KEY)).toBe("{broken");
    store.setState({ n: 1 }); // действия работают, но не пишут поверх нечитаемого
    expect(f.data.get(STORAGE_KEY)).toBe("{broken");
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
    expect(f1.data.get(BROKEN_KEY)).toBe(old);

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
    expect(f2.data.get(BROKEN_KEY)).toBe(cur);
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
    for (const p of ["/lesson/ns-1-binary", "/drill", "/exam/run", "/game/bingo"]) expect(isFocusPath(p), p).toBe(true);
    for (const p of ["/", "/learn", "/profile", "/exam", "/exam/result/5", "/onboarding", "/lessons-list"]) expect(isFocusPath(p), p).toBe(false);
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
