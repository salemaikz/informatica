// Данные в ссылке: JSON → deflate-raw → base64url. Живёт во фрагменте «#», на сервер не уходит.
// Формат: первая буква — версия («z» — сжато, «r» — без сжатия, если нет CompressionStream), дальше base64url.

import type { AppState } from "./store";

/** Длиннее — ссылка плохо открывается в мессенджерах. */
export const MAX_LINK_LENGTH = 8000;
/**
 * Порог для QR: версия 40 (уровень L, байтовый режим) вмещает ~2950 байт, берём с запасом.
 * Такой код плотный (до 177 модулей), поэтому QrCode рисуется на всю ширину карточки.
 */
export const MAX_QR_LENGTH = 2900;
/** Верхняя граница распакованных данных (защита от «бомбы»). */
const MAX_UNPACKED_BYTES = 4 * 1024 * 1024;
const MAX_PACKED_CHARS = 200_000;

const hasStreams = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

export function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function readAll(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new Error("too big");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

async function transform(bytes: Uint8Array, ts: CompressionStream | DecompressionStream, limit: number): Promise<Uint8Array> {
  const src = new Blob([bytes as BlobPart]).stream().pipeThrough(ts as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return readAll(src, limit);
}

/** Любой JSON-совместимый объект → короткая строка для ссылки. */
export async function packData(obj: unknown): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (!hasStreams()) return "r" + bytesToBase64Url(raw);
  const packed = await transform(raw, new CompressionStream("deflate-raw"), MAX_UNPACKED_BYTES);
  return "z" + bytesToBase64Url(packed);
}

/** Строка из ссылки → объект; любая порча → null. Данные недоверенные — проверяет вызывающий. */
export async function unpackData(str: string): Promise<unknown | null> {
  try {
    if (typeof str !== "string" || str.length < 2 || str.length > MAX_PACKED_CHARS) return null;
    const kind = str[0];
    const bytes = base64UrlToBytes(str.slice(1));
    let raw: Uint8Array;
    if (kind === "r") {
      if (bytes.length > MAX_UNPACKED_BYTES) return null;
      raw = bytes;
    } else if (kind === "z") {
      if (!hasStreams()) return null;
      raw = await transform(bytes, new DecompressionStream("deflate-raw"), MAX_UNPACKED_BYTES);
    } else return null;
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    return null;
  }
}

/** Данные из фрагмента: «#d=…» → «…» (или null). */
export function dataFromHash(hash: string): string | null {
  const m = /^#?(?:.*&)?d=([A-Za-z0-9_-]+)/.exec(hash);
  return m ? m[1] : null;
}

export function buildLink(origin: string, path: "/restore" | "/report", packed: string): string {
  return `${origin}${path}#d=${packed}`;
}

export type LinkFit = "ok" | "noqr" | "toobig";

/** Помещается ли ссылка: ok — со ссылкой и QR, noqr — только ссылка, toobig — слишком большая. */
export function linkFit(link: string): LinkFit {
  if (link.length > MAX_LINK_LENGTH) return "toobig";
  return link.length > MAX_QR_LENGTH ? "noqr" : "ok";
}

const NOTE_IMG = /!\[[^\]]*\]\(note-img:[^)]*\)/g;
/** Чат с ИИ в ссылку не кладём: это не прогресс, а место. */
const DROPPED = ["chat", "newAchievements"];

type Obj = Record<string, unknown>;

/**
 * Копия прогресса для ссылки: как файл экспорта, но без картинок конспектов (они в IndexedDB),
 * без фото-аватара и без чата с ИИ.
 */
export function buildBackupData(state: AppState): Obj {
  const data: Obj = {};
  for (const [k, v] of Object.entries(state)) {
    if (typeof v === "function" || DROPPED.includes(k)) continue;
    data[k] = v;
  }
  data.version = 2;
  const profile = { ...state.profile } as Obj;
  if (state.profile.avatar.kind === "photo") profile.avatar = { kind: "initial", color: "primary" };
  data.profile = profile;
  data.notebook = {
    ...state.notebook,
    notes: state.notebook.notes.map((n) => {
      const { images, ...rest } = n;
      void images;
      return { ...rest, body: n.body.replace(NOTE_IMG, "") };
    }),
  };
  return data;
}

/** Сколько конспектов с картинками (чтобы предупредить, что картинки не переедут). */
export function notesWithImages(state: Pick<AppState, "notebook">): number {
  return state.notebook.notes.filter((n) => (n.images?.length ?? 0) > 0 || /note-img:/.test(n.body)).length;
}

export interface BackupPreview {
  name: string;
  xp: number;
  lessons: number;
  notes: number;
}

/** Что внутри копии — для экрана «Восстановить». Данные уже прошли cleanBackup. */
export function previewBackup(data: Obj): BackupPreview {
  const profile = data.profile as Obj;
  const lessons = data.lessons && typeof data.lessons === "object" ? Object.keys(data.lessons as Obj).length : 0;
  const nb = data.notebook as Obj | undefined;
  const notes = nb && Array.isArray(nb.notes) ? nb.notes.length : 0;
  return {
    name: typeof profile.name === "string" ? profile.name.slice(0, 30) : "",
    xp: typeof data.xp === "number" ? data.xp : 0,
    lessons,
    notes,
  };
}
