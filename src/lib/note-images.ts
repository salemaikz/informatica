// Картинки конспектов (фото и рисунки) живут в IndexedDB, а не в localStorage: там мало места.
// В тексте записи на них ссылка ![](note-img:<id>). Если IndexedDB недоступна (приватный режим, старый браузер) —
// запасной режим: картинки хранятся в памяти вкладки (до перезагрузки).

import { createStore, del, delMany, get, set, type UseStore } from "idb-keyval";

/** Предел размера картинки (по декодированным байтам). */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const DATA_URL_HEAD = /^data:image\/(png|jpeg);base64,/;
const BASE64_BODY = /^[A-Za-z0-9+/]+={0,2}$/;

/** Размер данных base64 в байтах. */
function base64Bytes(b64: string): number {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

export type ImageCheck = "ok" | "format" | "size";

/** Проверка dataURL: только png/jpeg в base64 и не больше MAX_IMAGE_BYTES. */
export function checkImageDataUrl(dataUrl: unknown): ImageCheck {
  if (typeof dataUrl !== "string") return "format";
  const head = DATA_URL_HEAD.exec(dataUrl);
  if (!head) return "format";
  const body = dataUrl.slice(head[0].length);
  // Грубая отсечка до разбора тела: так мы не гоняем регулярное выражение по десяткам мегабайт.
  if (body.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4) return "size";
  if (!BASE64_BODY.test(body)) return "format";
  return base64Bytes(body) > MAX_IMAGE_BYTES ? "size" : "ok";
}

export class NoteImageError extends Error {
  constructor(public reason: Exclude<ImageCheck, "ok">) {
    super(`note-image:${reason}`);
  }
}

// ---------- Хранилище ----------

let store: UseStore | null | undefined;
/** Запасной режим: картинки в памяти вкладки. */
const memory = new Map<string, string>();
/** Небольшой кэш прочитанного, чтобы не декодировать из IndexedDB при каждом показе. */
const cache = new Map<string, string>();
const CACHE_MAX = 24;

function getStore(): UseStore | null {
  if (store !== undefined) return store;
  try {
    store = typeof indexedDB === "undefined" ? null : createStore("informatica-notes", "images");
  } catch {
    store = null;
  }
  return store;
}

function remember(id: string, dataUrl: string) {
  cache.delete(id);
  cache.set(id, dataUrl);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

function newId(): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `i${Date.now().toString(36)}${rnd}`;
}

/** Сохраняет картинку, возвращает id. Бросает NoteImageError, если формат или размер не подходят. */
export async function putImage(dataUrl: string): Promise<string> {
  const check = checkImageDataUrl(dataUrl);
  if (check !== "ok") throw new NoteImageError(check);
  const id = newId();
  const s = getStore();
  if (s) {
    try {
      await set(id, dataUrl, s);
      remember(id, dataUrl);
      return id;
    } catch {
      // IndexedDB есть, но писать не даёт (квота, приватный режим) — запасной режим.
    }
  }
  memory.set(id, dataUrl);
  return id;
}

/** Картинка по id; undefined — нет (другое устройство, удалена). */
export async function getImage(id: string): Promise<string | undefined> {
  const mem = memory.get(id) ?? cache.get(id);
  if (mem) return mem;
  const s = getStore();
  if (!s) return undefined;
  try {
    const v = await get<unknown>(id, s);
    // Данные из хранилища недоверенные — проверяем так же, как при записи.
    if (typeof v === "string" && checkImageDataUrl(v) === "ok") {
      remember(id, v);
      return v;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/** Удаляет картинки (вместе с удалённой записью). */
export async function deleteImages(ids: readonly string[]): Promise<void> {
  if (!ids.length) return;
  for (const id of ids) {
    memory.delete(id);
    cache.delete(id);
  }
  const s = getStore();
  if (!s) return;
  try {
    if (ids.length === 1) await del(ids[0], s);
    else await delMany([...ids], s);
  } catch {
    // ignore
  }
}
