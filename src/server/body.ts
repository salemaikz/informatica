import "server-only";

/**
 * Тело запроса как текст, не больше max байт. Читаем потоком и обрываем сразу, как только набралось больше:
 * Content-Length может отсутствовать (chunked) или врать, поэтому доверять только ему нельзя.
 * null — слишком большое. Общий помощник маршрутов /api/issue, /api/events и /api/owner/login.
 */
export async function readBodyText(req: Request, max: number): Promise<string | null> {
  // Объявленный размер: отсутствие заголовка — не «0», размер тогда выяснится по ходу чтения.
  const declared = req.headers.get("content-length");
  if (declared !== null && declared.trim() !== "") {
    const n = Number(declared);
    if (Number.isFinite(n) && n > max) return null;
  }
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      // Остальное не читаем: закрываем поток, чтобы источник перестал присылать данные.
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}
