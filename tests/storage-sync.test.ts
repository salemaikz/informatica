import { afterEach, describe, expect, it, vi } from "vitest";
import { isPeerSave, watchPeerSaves, type StorageEventLike } from "@/lib/storage-sync";

// Синхронизация вкладок (#119): сохранение другой вкладки перечитываем, иначе поздняя запись старой вкладки затирает
// свежие траты (воспроизведено: 3 платных запроса в двух вкладках → freeTotal = 2).

const KEY = "informatica-v1";
const save = (state: object, version = 2) => JSON.stringify({ state, version });

describe("isPeerSave", () => {
  it("наш ключ, та же версия, есть состояние — да", () => {
    expect(isPeerSave({ key: KEY, newValue: save({ xp: 1 }) }, KEY, 2)).toBe(true);
  });
  it("чужой ключ, удаление, очистка всего хранилища — нет", () => {
    expect(isPeerSave({ key: "other", newValue: save({ xp: 1 }) }, KEY, 2)).toBe(false);
    expect(isPeerSave({ key: KEY, newValue: null }, KEY, 2)).toBe(false);
    expect(isPeerSave({ key: null, newValue: null }, KEY, 2)).toBe(false);
  });
  it("другая версия формата (вкладка со старым или новым приложением) — нет: иначе вкладки перебрасывались бы миграцией", () => {
    expect(isPeerSave({ key: KEY, newValue: save({ xp: 1 }, 1) }, KEY, 2)).toBe(false);
    expect(isPeerSave({ key: KEY, newValue: save({ xp: 1 }, 3) }, KEY, 2)).toBe(false);
  });
  it("битый JSON и пустое состояние — нет", () => {
    expect(isPeerSave({ key: KEY, newValue: "{" }, KEY, 2)).toBe(false);
    expect(isPeerSave({ key: KEY, newValue: JSON.stringify({ version: 2 }) }, KEY, 2)).toBe(false);
    expect(isPeerSave({ key: KEY, newValue: "null" }, KEY, 2)).toBe(false);
  });
  it("событие другого хранилища (sessionStorage) — нет", () => {
    const local = {};
    expect(isPeerSave({ key: KEY, newValue: save({}), storageArea: {} }, KEY, 2, local)).toBe(false);
    expect(isPeerSave({ key: KEY, newValue: save({}), storageArea: local }, KEY, 2, local)).toBe(true);
  });
});

/** Подставное окно: localStorage общий для «вкладок», события `storage` шлём вручную (браузер шлёт их только другим вкладкам). */
function fakeWindow(ls: object) {
  const listeners = new Set<(e: StorageEventLike) => void>();
  return {
    localStorage: ls,
    addEventListener: (_t: "storage", cb: (e: StorageEventLike) => void) => void listeners.add(cb),
    removeEventListener: (_t: "storage", cb: (e: StorageEventLike) => void) => void listeners.delete(cb),
    emit: (e: StorageEventLike) => listeners.forEach((cb) => cb(e)),
    count: () => listeners.size,
  };
}

describe("watchPeerSaves", () => {
  it("зовёт onPeerSave только на сохранение другой вкладки; отписка снимает слушателя", () => {
    const win = fakeWindow({});
    const onPeerSave = vi.fn();
    const off = watchPeerSaves(win, { key: KEY, version: 2, onPeerSave });
    win.emit({ key: KEY, newValue: save({ xp: 3 }) });
    win.emit({ key: "x", newValue: save({ xp: 3 }) });
    win.emit({ key: KEY, newValue: null });
    expect(onPeerSave).toHaveBeenCalledTimes(1);
    off();
    expect(win.count()).toBe(0);
  });
});

describe("две вкладки с настоящим стором", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function tab(win: object) {
    vi.stubGlobal("window", win);
    vi.resetModules();
    return (await import("@/lib/store")).useApp;
  }

  it("три обращения к ИИ в двух вкладках по очереди — потрачены все три бесплатных, а не два", async () => {
    const data = new Map<string, string>([[KEY, save({ onboarded: true, profile: { lang: "ru" }, wallet: { chips: 50, earned: 50, spent: 0 } })]]);
    const ls = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
    const winA = fakeWindow(ls);
    const winB = fakeWindow(ls);
    const A = await tab(winA);
    const B = await tab(winB);
    const version = A.persist.getOptions().version ?? 0;
    watchPeerSaves(winA, { key: KEY, version, onPeerSave: () => void A.persist.rehydrate() });
    watchPeerSaves(winB, { key: KEY, version, onPeerSave: () => void B.persist.rehydrate() });
    // Запись одной вкладки — событие в другую (как в браузере).
    const wrote = (other: ReturnType<typeof fakeWindow>) => other.emit({ key: KEY, newValue: data.get(KEY)!, storageArea: ls });

    expect(A.getState().spendAi("chat")).toMatchObject({ ok: true, pay: "free" });
    wrote(winB);
    expect(B.getState().spendAi("chat")).toMatchObject({ ok: true, pay: "free" });
    wrote(winA);
    expect(A.getState().spendAi("chat")).toMatchObject({ ok: true, pay: "free" });
    wrote(winB);

    expect(JSON.parse(data.get(KEY)!).state.aiUsage.freeTotal).toBe(3);
    expect(A.getState().aiUsage.freeTotal).toBe(3);
    expect(B.getState().aiUsage.freeTotal).toBe(3);
    // Четвёртое — уже за чипы в любой вкладке.
    expect(B.getState().spendAi("chat")).toMatchObject({ ok: true, pay: "chips" });
    expect(A.persist.hasHydrated()).toBe(true);
    expect(B.persist.hasHydrated()).toBe(true);
  });
});
