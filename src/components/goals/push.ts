import { del, get, set } from "idb-keyval";
import type { Lang } from "@/lib/types";

// Клиентская часть уведомлений о серии: разрешение, сервис-воркер, зеркало настроек в IndexedDB для public/sw.js.
// Ключи те же, что читает sw.js (idb-keyval: keyval-store / keyval).

export const MIRROR_KEY = "informatica:reminder";
export const REMINDED_KEY = "informatica:reminded";
export const PERIODIC_TAG = "streak-reminder";

export interface ReminderMirror {
  enabled: boolean;
  push: boolean;
  time: string;
  lang: Lang;
  streak: number;
  lastActiveDay: string | null;
  freezes: number;
}

export type PushSupport = "ok" | "unsupported" | "denied";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  return Notification.permission === "denied" ? "denied" : "ok";
}

type PeriodicSync = { register: (tag: string, opts: { minInterval: number }) => Promise<void>; unregister: (tag: string) => Promise<void> };

async function periodicSyncOf(reg: ServiceWorkerRegistration): Promise<PeriodicSync | undefined> {
  return (reg as unknown as { periodicSync?: PeriodicSync }).periodicSync;
}

/** В разработке воркер только показывает уведомления (?mode=notify) — офлайн-кэш dev-чанков устарел бы сразу. */
export const WORKER_URL = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?mode=notify";

/** Регистрирует воркер, если его ещё нет (повторно не трогает: SwRegister и уведомления делят одну регистрацию). */
export async function ensureWorker(): Promise<void> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  const script = (existing?.active ?? existing?.waiting ?? existing?.installing)?.scriptURL;
  if (script) {
    const u = new URL(script);
    // Тот же скрипт — не трогаем; другой (dev ↔ production на одном адресе) — регистрация обновит его.
    if (u.pathname + u.search === WORKER_URL) return;
  }
  await navigator.serviceWorker.register(WORKER_URL);
}

/** Регистрирует сервис-воркер и (где поддерживается: Android, установленное приложение) периодическую проверку раз в 12 часов. */
export async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    await ensureWorker();
    const reg = await navigator.serviceWorker.ready;
    try {
      await (await periodicSyncOf(reg))?.register(PERIODIC_TAG, { minInterval: 12 * 3_600_000 });
    } catch {
      /* нет разрешения или не установлено приложение — остаётся обычное напоминание */
    }
    return reg;
  } catch {
    return null;
  }
}

/** Просит разрешение и включает сервис-воркер. */
export async function enablePush(): Promise<"ok" | "denied" | "unsupported" | "failed"> {
  const support = pushSupport();
  if (support !== "ok") return support;
  let permission: NotificationPermission = Notification.permission;
  if (permission !== "granted") permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  return (await registerWorker()) ? "ok" : "failed";
}

export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/");
    if (reg) await (await periodicSyncOf(reg))?.unregister(PERIODIC_TAG);
  } catch {
    /* ничего страшного */
  }
}

export async function writeMirror(m: ReminderMirror): Promise<void> {
  try {
    await set(MIRROR_KEY, m);
  } catch {
    /* IndexedDB недоступна (приватный режим) */
  }
}

export async function readReminded(): Promise<string | null> {
  try {
    const v = await get<string>(REMINDED_KEY);
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

export async function writeReminded(day: string): Promise<void> {
  try {
    await set(REMINDED_KEY, day);
  } catch {
    /* см. выше */
  }
}

export async function clearReminded(): Promise<void> {
  try {
    await del(REMINDED_KEY);
  } catch {
    /* см. выше */
  }
}

/** Показывает уведомление через сервис-воркер; false — не получилось. */
export async function showNotification(title: string, body: string): Promise<boolean> {
  try {
    if (pushSupport() !== "ok" || Notification.permission !== "granted") return false;
    const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await registerWorker());
    if (!reg) return false;
    await reg.showNotification(title, { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: PERIODIC_TAG, data: { url: "/learn" } });
    return true;
  } catch {
    return false;
  }
}
