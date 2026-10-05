// Данные в ссылке (#74): JSON → deflate-raw → base64url. Живут во фрагменте «#», на сервер не уходят.
// Формат: первая буква — версия («z» — сжато, «r» — без сжатия, если нет CompressionStream), дальше base64url.
// Только упаковка отчёта родителю: переноса прогресса и QR нет (#49, #60).

/** Длиннее — ссылка плохо открывается в мессенджерах. */
export const MAX_LINK_LENGTH = 4000;
/** Верхняя граница распакованных данных (защита от «бомбы»): отчёт — пара килобайт, берём с большим запасом. */
export const MAX_UNPACKED_BYTES = 256 * 1024;
/** Дольше такая строка не бывает: более длинное не разбираем вовсе. */
export const MAX_PACKED_CHARS = 2 * MAX_LINK_LENGTH;

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

/** Любой JSON-совместимый объект → короткая строка для ссылки. Слишком большой объект — исключение. */
export async function packData(obj: unknown): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (raw.length > MAX_UNPACKED_BYTES) throw new Error("too big");
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

/** Ссылка на отчёт: `${origin}/report#d=<packed>`. */
export function reportLink(origin: string, packed: string): string {
  return `${origin}/report#d=${packed}`;
}

/** Помещается ли ссылка в лимит. */
export function linkFits(link: string): boolean {
  return link.length <= MAX_LINK_LENGTH;
}
