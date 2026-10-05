// Безопасное хранилище для persist (zustand): прогресс не должен пропадать молча и не должен ронять приложение.
// Чистая логика без React; браузерное хранилище подставляется (в тестах — подделка).
//
// Что умеет:
//  - localStorage недоступен (приватный режим, запрет cookies, SecurityError) → работаем из памяти, статус «memory»;
//  - запись не удалась (переполнение) → не падаем, держим свежую копию в памяти, статус «full»; удалась — снова «ok»;
//  - сохранение не прочиталось (битый JSON, ошибка миграции/слияния, getItem бросил) → запись в основной ключ блокируется:
//    сохранение лежит нетронутым, пока ученик не решит — «Попробовать ещё раз» или «Начать заново» (тогда оно удаляется).
//    Копий и выгрузок нет: данные не уходят и не дублируются.

export const STORAGE_KEY = "informatica-v1";
/** Ключ копии повреждённого сохранения из прежних версий (v0.9.0): копий больше нет, при запуске ключ удаляется. */
export const LEGACY_BROKEN_KEY = "informatica-v1-broken";
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
  /** Гидратация закончилась: без ошибки — разблокировать запись; с ошибкой — запись в основной ключ заблокирована. */
  finishHydration(error?: unknown): void;
  /**
   * Сырая строка сохранения, которое не открылось. Нужна только экрану восстановления, чтобы угадать язык;
   * никуда не отправляется и не копируется. null — сохранение не прочиталось или его нет.
   */
  peekSaved(): string | null;
  /** «Начать заново»: основной ключ удаляется, запись разблокируется (подтверждение — на стороне экрана). */
  discard(): void;
}

export function createSafeStorage(opts: SafeStorageOptions = {}): SafeStorage {
  const key = opts.key ?? STORAGE_KEY;

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
    // Копия повреждённого сохранения из прежней версии больше не нужна: освобождаем место до пробы записи.
    try {
      b.removeItem(LEGACY_BROKEN_KEY);
    } catch {
      // не критично
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
    // Свежая копия в памяти новее той, что в браузере (запись не удалась).
    const mem = memory.get(name);
    let raw: string | null = null;
    if (b) {
      try {
        raw = b.getItem(name);
      } catch (e) {
        setStatus("memory");
        if (name === key && mem === undefined) {
          // Не прочиталось — это не «сохранения нет»: стор стартовал бы пустым и затёр его. Пусть гидратация упадёт
          // (finishHydration заблокирует запись и откроет экран восстановления).
          lastRaw = null;
          blocked = true;
          throw e;
        }
      }
    }
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
        // Прочиталось — держать сырую строку в памяти незачем (она нужна только при сбое).
        lastRaw = null;
        if (!blocked && !failed) return;
        blocked = false;
        failed = false;
        notify();
        return;
      }
      blocked = true;
      failed = true;
      notify();
    },
    peekSaved: () => lastRaw,
    discard: () => {
      lastRaw = null;
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
export const peekSaved = (): string | null => safeStorage.peekSaved();
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

/**
 * В конце онбординга. Только из обработчика нажатия: без жеста Firefox на компьютере
 * показывает своё окно запроса посреди экрана.
 */
export const requestPersistentStorage = (): void => {
  void persistOnce();
};
