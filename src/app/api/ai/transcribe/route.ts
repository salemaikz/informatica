import { toFile } from "openai";
import { audioExt, baseAudioType, MAX_AUDIO_BYTES, MAX_TRANSCRIPT_LEN } from "@/lib/voice";
import { callTimeoutMs, getOpenAI, jsonError, MODELS, openAiRejected } from "@/server/openai";
import { AI_UNITS } from "@/lib/economy";
import { guardAi, withGuardHeaders } from "@/server/ai-guard";
import { lang as parseLang } from "@/server/context";

// Расшифровка голосового вопроса для ИИ-чата: multipart (audio, lang) → { text }. Учёт на клиенте — spendAi("voice"): только дневной потолок, бесплатные и чипы не тратит (#118, платится ответ chat).
// Страж лимитов (server/ai-guard.ts): голос весит AI_UNITS.voice = 4 обращения. Возврат — только если модель точно не
// получила запрос: ошибка до вызова или HTTP-ошибка OpenAI; обрыв клиентом, таймаут и сеть — не возвращают.

export const maxDuration = 30;

/** Запас на служебные части multipart сверх самого файла. */
const FORM_OVERHEAD = 64 * 1024;

export async function POST(req: Request) {
  const g = await guardAi(req, { route: "stt", units: AI_UNITS.voice });
  if (!g.ok) return g.response;
  // Ошибка до вызова модели: обращения возвращаются.
  const reject = async (status: number, code: string) => {
    await g.release();
    return withGuardHeaders(jsonError(status, code), g);
  };
  const client = getOpenAI();
  if (!client) return reject(503, "ai_not_configured");

  // Заранее отсекаем заведомо большие тела, не читая их. Content-Length бывает не у всех запросов
  // (HTTP/2, прокси) — тогда читаем: размер тела всё равно ограничен платформой (~4,5 МБ на Vercel).
  const declared = Number(req.headers.get("content-length") ?? NaN);
  if (Number.isFinite(declared) && declared > MAX_AUDIO_BYTES + FORM_OVERHEAD) return reject(413, "too_large");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return reject(400, "bad_form");
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return reject(400, "no_audio");
  if (audio.size > MAX_AUDIO_BYTES) return reject(413, "too_large");
  const type = baseAudioType(audio.type);
  const ext = audioExt(type);
  if (!type.startsWith("audio/") || !ext) return reject(415, "bad_type");
  const lang = parseLang(form.get("lang"));

  // Подготовка файла — до вызова модели: сбой здесь возвращает обращения.
  let file;
  try {
    const bytes = new Uint8Array(await audio.arrayBuffer());
    file = await toFile(bytes, `voice.${ext}`, { type });
  } catch (e) {
    console.error("[ai] route=transcribe prepare error", e instanceof Error ? e.message : e);
    return reject(502, "stt_failed");
  }

  try {
    const res = await client.audio.transcriptions.create(
      { file, model: MODELS.stt, language: lang },
      { signal: req.signal, timeout: callTimeoutMs(maxDuration) },
    );
    const u = (res as { usage?: { type?: string; input_tokens?: number; output_tokens?: number } }).usage;
    const tok = u?.type === "tokens";
    console.info(`[ai] route=transcribe model=${MODELS.stt} in=${tok ? (u?.input_tokens ?? 0) : 0} out=${tok ? (u?.output_tokens ?? 0) : 0} bytes=${audio.size}`);
    return withGuardHeaders(Response.json({ text: (res.text ?? "").trim().slice(0, MAX_TRANSCRIPT_LEN) }), g);
  } catch (e) {
    console.error("[ai] route=transcribe error", e instanceof Error ? e.message : e);
    // Обращения возвращаются, только если OpenAI ответил HTTP-ошибкой; таймаут и обрыв сети — модель могла получить файл.
    if (openAiRejected(e, req.signal)) return reject(502, "stt_failed");
    return withGuardHeaders(jsonError(502, "stt_failed"), g);
  }
}
