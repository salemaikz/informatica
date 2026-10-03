import { toFile } from "openai";
import { audioExt, baseAudioType, MAX_AUDIO_BYTES, MAX_TRANSCRIPT_LEN } from "@/lib/voice";
import { getOpenAI, jsonError, MODELS } from "@/server/openai";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { lang as parseLang, sameOrigin } from "@/server/context";

// Расшифровка голосового вопроса для ИИ-чата: multipart (audio, lang) → { text }. Оплата — на клиенте (spendAi("voice")).

export const maxDuration = 30;

/** Запас на служебные части multipart сверх самого файла. */
const FORM_OVERHEAD = 64 * 1024;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "forbidden_origin");
  if (!rateLimit(`stt:${clientIp(req)}`, 20, 10 * 60_000)) return jsonError(429, "rate_limited");
  const client = getOpenAI();
  if (!client) return jsonError(503, "ai_not_configured");

  // Заранее отсекаем заведомо большие тела, не читая их.
  // Без числового Content-Length (chunked) тело не читаем: formData() буферизует его целиком.
  const lenHeader = req.headers.get("content-length");
  const declared = lenHeader === null || lenHeader.trim() === "" ? NaN : Number(lenHeader);
  if (!Number.isFinite(declared)) return jsonError(411, "length_required");
  if (declared > MAX_AUDIO_BYTES + FORM_OVERHEAD) return jsonError(413, "too_large");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "bad_form");
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return jsonError(400, "no_audio");
  if (audio.size > MAX_AUDIO_BYTES) return jsonError(413, "too_large");
  const type = baseAudioType(audio.type);
  const ext = audioExt(type);
  if (!type.startsWith("audio/") || !ext) return jsonError(415, "bad_type");
  const lang = parseLang(form.get("lang"));

  try {
    const bytes = new Uint8Array(await audio.arrayBuffer());
    const file = await toFile(bytes, `voice.${ext}`, { type });
    const res = await client.audio.transcriptions.create({ file, model: MODELS.stt, language: lang });
    const u = (res as { usage?: { type?: string; input_tokens?: number; output_tokens?: number } }).usage;
    const tok = u?.type === "tokens";
    console.info(`[ai] route=transcribe model=${MODELS.stt} in=${tok ? (u?.input_tokens ?? 0) : 0} out=${tok ? (u?.output_tokens ?? 0) : 0} bytes=${audio.size}`);
    return Response.json({ text: (res.text ?? "").trim().slice(0, MAX_TRANSCRIPT_LEN) });
  } catch (e) {
    console.error("[ai] route=transcribe error", e instanceof Error ? e.message : e);
    return jsonError(502, "stt_failed");
  }
}
