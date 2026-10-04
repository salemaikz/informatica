// Безопасное хранилище для persist (zustand): прогресс не должен пропадать молча и не должен ронять приложение.
// Чистая логика без React; браузерное хранилище подставляется (в тестах — подделка).
//
// Что умеет:
//  - localStorage недоступен (приватный режим, запрет cookies, SecurityError) → работаем из памяти, статус «memory»;
//  - запись не удалась (переполнение) → не падаем, держим свежую копию в памяти, статус «full»; удалась — снова «ok»;
//  - сохранение не прочиталось (битый JSON, ошибка миграции/слияния) → сырая строка копируется в BROKEN_KEY
//    (одна последняя копия), запись в основной ключ блокируется, пока ученик не решит: скачать, начать заново, повторить.

export const STORAGE_KEY = "informatica-v1";
export const BROKEN_KEY = "informatica-v1-broken";
const PROBE_KEY = "informatica-probe";

/** ok — пишется в браузер; memory — браузер не даёт сохранять; full — память браузера заполнена. */
export type StorageStatus = "ok" | "memory" | "full";

export interface RawStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SafeStorageOptions {
  /** Откуда брать хранилище; null — недоступно. По умолчанию — window.localStorage. */
  backend?: () => RawStorage | null;
  key?: string;
  brokenKey?: string;
}

/** Ошибка переполнения: у браузеров разные имена и коды. */
export function isQuotaError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const { name, code } = e as { name?: unknown; code?: unknown };
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22 || code === 1014;
}

function browserStorage(): RawStorage | null {
  if (typeof window === "undefined") return null;
  try {
    // Сам доступ к window.localStorage может бросить SecurityError.
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export interface SafeStorage {
  // Строковый уровень, совместим со StateStorage zustand (createJSONStorage(() => safeStorage)).
  getItem(name: string): string | null;
  setItem(name: string, value: string): void;
  removeItem(name: string): void;
  /** Состояние хранилища (для баннера). */
  status(): StorageStatus;
  /** Подписка на смену статуса и сбоя гидратации. Возвращает отписку. */
  subscribe(cb: () => void): () => void;
  /** Гидратация упала: основной ключ нечитаем, запись в него заблокирована. */
  hydrationFailed(): boolean;
  /** Гидратация началась (в том числе повторная). */
  beginHydration(): void;
  /** Гидратация закончилась: без ошибки — разблокировать запись; с ошибкой — копия в BROKEN_KEY и блокировка. */
  finishHydration(error?: unknown): void;
  /** Сырая строка сохранения для «Скачать копию данных»; null — нечего скачивать. */
  rawForDownload(): string | null;
  /** «Начать заново»: копия остаётся в BROKEN_KEY, основной ключ очищается, запись разблокируется. */
  discard(): void;
}

export function createSafeStorage(opts: SafeStorageOptions = {}): SafeStorage {
  const key = opts.key ?? STORAGE_KEY;
  const brokenKey = opts.brokenKey ?? BROKEN_KEY;

  /** undefined — ещё не определяли. */
  let backend: RawStorage | null | undefined;
  let status: StorageStatus = "ok";
  let failed = false;
  let blocked = false;
  /** Последняя прочитанная строка основного ключа. */
  let lastRaw: string | null = null;
  /** Свежие записи, которые не удалось положить в браузер (и всё при недоступном хранилище). */
  const memory = new Map<string, string>();
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((cb) => cb());
  const setStatus = (next: StorageStatus) => {
    if (status === next) return;
    status = next;
    notify();
  };

  function resolve(): RawStorage | null {
    if (backend !== undefined) return backend;
    let b: RawStorage | null;
    try {
      b = opts.backend ? opts.backend() : browserStorage();
    } catch {
      b = null;
    }
    backend = b;
    if (!b) {
      status = "memory";
      return null;
    }
    // Проба записи: приватные режимы и заполненная память видны сразу, а не после первого действия ученика.
    try {
      b.setItem(PROBE_KEY, "1");
      b.removeItem(PROBE_KEY);
    } catch (e) {
      status = isQuotaError(e) ? "full" : "memory";
    }
    return b;
  }

  function getItem(name: string): string | null {
    const b = resolve();
    let raw: string | null = null;
    if (b) {
      try {
        raw = b.getItem(name);
      } catch {
        raw = null;
        setStatus("memory");
      }
    }
    // Свежая копия в памяти новее той, что в браузере (запись не удалась).
    const mem = memory.get(name);
    if (mem !== undefined) raw = mem;
    if (name === key) lastRaw = raw;
    return raw;
  }

  function setItem(name: string, value: string): void {
    // Основной ключ нечитаем — не затираем его пустым состоянием, пока ученик не решил.
    if (name === key && blocked) return;
    const b = resolve();
    if (!b) {
      memory.set(name, value);
      return;
    }
    try {
      b.setItem(name, value);
      memory.delete(name);
      setStatus("ok");
    } catch (e) {
      memory.set(name, value);
      setStatus(isQuotaError(e) ? "full" : "memory");
    }
  }

  function removeItem(name: string): void {
    memory.delete(name);
    try {
      resolve()?.removeItem(name);
    } catch {
      // нечего удалять
    }
  }

  /** Копия нечитаемого сохранения. Не получилось положить в браузер — остаётся в памяти (для скачивания). */
  function saveBrokenCopy(): void {
    const raw = lastRaw;
    if (raw === null) return;
    const b = resolve();
    if (b) {
      try {
        b.setItem(brokenKey, raw);
        memory.delete(brokenKey);
        return;
      } catch {
        // места нет — оставим в памяти
      }
    }
    memory.set(brokenKey, raw);
  }

  return {
    getItem,
    setItem,
    removeItem,
    status: () => {
      resolve();
      return status;
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    hydrationFailed: () => failed,
    beginHydration: () => {
      if (!failed) return;
      failed = false;
      notify();
    },
    finishHydration: (error) => {
      if (error === undefined || error === null) {
        // Прочиталось — держать копию сырой строки в памяти незачем (она нужна только при сбое).
        lastRaw = null;
        if (!blocked && !failed) return;
        blocked = false;
        failed = false;
        notify();
        return;
      }
      blocked = true;
      failed = true;
      saveBrokenCopy();
      notify();
    },
    rawForDownload: () => {
      if (lastRaw !== null) return lastRaw;
      const mem = memory.get(brokenKey);
      if (mem !== undefined) return mem;
      const b = resolve();
      try {
        return b ? b.getItem(brokenKey) : null;
      } catch {
        return null;
      }
    },
    discard: () => {
      // Если ученик нажал «Начать заново» до сбоя (гидратация не закончилась за 4 секунды), копию сохраняем сейчас.
      saveBrokenCopy();
      blocked = false;
      failed = false;
      removeItem(key);
      notify();
    },
  };
}

// ---------- Общий экземпляр приложения ----------

export const safeStorage = createSafeStorage();

export const storageStatus = (): StorageStatus => safeStorage.status();
export const subscribeStorage = (cb: () => void): (() => void) => safeStorage.subscribe(cb);
export const hydrationFailed = (): boolean => safeStorage.hydrationFailed();
export const beginHydration = (): void => safeStorage.beginHydration();
export const finishHydration = (error?: unknown): void => safeStorage.finishHydration(error);
export const rawForDownload = (): string | null => safeStorage.rawForDownload();
export const discardSaved = (): void => safeStorage.discard();

// ---------- Фаза загрузки ----------

/** Сколько ждём гидратацию стора, прежде чем показать экран восстановления. */
export const HYDRATION_TIMEOUT_MS = 4000;

export type HydrationPhase = "loading" | "ready" | "failed";

/** Что показывать: маскот загрузки, приложение или экран восстановления. */
export function hydrationPhase(hydrated: boolean, failed: boolean, timedOut: boolean): HydrationPhase {
  if (hydrated) return "ready";
  return failed || timedOut ? "failed" : "loading";
}

// ---------- «Не стирать данные» ----------

interface StorageManagerLike {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
}

/**
 * Один раз за сессию просит браузер не стирать данные сайта при нехватке места
 * (Safari иначе чистит их через 7 дней без визитов). Без окон и текстов; любая ошибка — молча.
 */
export function createPersistRequest(getManager: () => StorageManagerLike | undefined): () => Promise<void> {
  let asked = false;
  return async () => {
    if (asked) return;
    asked = true;
    try {
      const sm = getManager();
      if (!sm?.persist) return;
      if (sm.persisted && (await sm.persisted())) return;
      await sm.persist();
    } catch {
      // не критично
    }
  };
}

const persistOnce = createPersistRequest(() => (typeof navigator === "undefined" ? undefined : navigator.storage));

/** После онбординга и импорта копии. */
export const requestPersistentStorage = (): void => {
  void persistOnce();
};
