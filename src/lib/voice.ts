import type { DictKey } from "@/i18n/dict";
import { aiCodeKey } from "./ai-errors";
import type { Lang } from "./types";

// Голос в чате: запись вопроса (MediaRecorder → /api/ai/transcribe) и озвучка ответа (speechSynthesis).
// Чистые помощники без React — покрыты tests/voice.test.ts. Константы общие с серверным маршрутом.

/** Предел записи, секунд. */
export const MAX_RECORD_SEC = 60;
/** Предел размера записи, байт (сервер проверяет то же число). */
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
/** Слишком короткая запись (мало байт) — «ничего не записалось». */
export const MIN_AUDIO_BYTES = 800;
/** Предел длины расшифровки, символов. */
export const MAX_TRANSCRIPT_LEN = 2000;

// ---------- Запись ----------

const RECORDER_MIMES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const IOS_MIMES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

/** Формат записи: первый из поддерживаемых браузером (на iPhone сначала audio/mp4); undefined — пусть выберет сам. */
export function pickRecorderMime(isSupported: (mime: string) => boolean, ios = false): string | undefined {
  return (ios ? IOS_MIMES : RECORDER_MIMES).find((m) => {
    try {
      return isSupported(m);
    } catch {
      return false;
    }
  });
}

/** iPhone / iPad (в том числе iPadOS, который выдаёт себя за Mac). */
export function isIosUserAgent(ua: string, maxTouchPoints = 0): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

const EXT_BY_TYPE: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "m4a",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/flac": "flac",
};

/** Тип без параметров: «audio/webm;codecs=opus» → «audio/webm». */
export function baseAudioType(type: string): string {
  return type.split(";")[0].trim().toLowerCase();
}

/** Расширение файла для типа (OpenAI определяет формат по имени); undefined — формат не принимаем. */
export function audioExt(type: string): string | undefined {
  return EXT_BY_TYPE[baseAudioType(type)];
}

/** Ошибка голоса с ключом словаря для показа ученику. */
export class VoiceError extends Error {
  constructor(public readonly key: DictKey) {
    super(key);
    this.name = "VoiceError";
  }
}

/** Ключ ошибки по ответу сервера; отказы по лимитам — общие тексты ИИ (lib/ai-errors.ts). */
export function voiceErrorKey(status: number, code?: string): DictKey {
  if (status === 413 || code === "too_large") return "voice.err.tooLong";
  if (status === 415 || code === "bad_type") return "voice.err.unsupported";
  if (status === 429 || code === "ai_busy") return aiCodeKey(code ?? `http_${status}`);
  return "voice.err.failed";
}

/** Расшифровывает запись: POST /api/ai/transcribe (multipart: audio, lang). Бросает VoiceError. */
export async function transcribe(blob: Blob, lang: Lang, signal?: AbortSignal): Promise<string> {
  const ext = audioExt(blob.type) ?? "webm";
  const form = new FormData();
  form.append("audio", new File([blob], `voice.${ext}`, { type: baseAudioType(blob.type) || "audio/webm" }));
  form.append("lang", lang);
  let res: Response;
  try {
    res = await fetch("/api/ai/transcribe", { method: "POST", body: form, signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new VoiceError("voice.err.failed");
  }
  let data: { text?: unknown; error?: unknown } = {};
  try {
    data = await res.json();
  } catch {
    // тело не JSON — разберёмся по статусу
  }
  if (!res.ok) throw new VoiceError(voiceErrorKey(res.status, typeof data.error === "string" ? data.error : undefined));
  return typeof data.text === "string" ? data.text.trim() : "";
}

/** Время записи «0:07». */
export function formatTimer(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---------- Озвучка ----------

export const speechLang = (lang: Lang): string => (lang === "kk" ? "kk-KZ" : "ru-RU");

/** Голос под язык (kk-KZ / ru-RU, допускаем «kk_KZ» и «ru»); предпочитаем точное совпадение и локальные голоса. */
export function pickVoice<V extends { lang: string; localService?: boolean }>(voices: readonly V[], lang: Lang): V | null {
  const prefix = lang === "kk" ? "kk" : "ru";
  const own = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").split("-")[0] === prefix);
  if (!own.length) return null;
  const exact = speechLang(lang).toLowerCase();
  return own.find((v) => v.lang.toLowerCase().replace("_", "-") === exact) ?? own.find((v) => v.localService) ?? own[0];
}

/** Markdown → простой текст для озвучки: без кода, ссылок, картинок и значков разметки. */
export function speechText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/gm, " ")
    .replace(/\s*\|\s*/g, ", ")
    .replace(/(\*\*|__|~~|==)/g, "")
    .replace(/(^|[\s(])[*_]+(?=\S)|(?<=\S)[*_]+(?=$|[\s).,;:!?])/g, "$1")
    .replace(/#/g, " ")
    .replace(/\s*\n\s*/g, ". ")
    .replace(/\.(\s*\.)+/g, ".")
    .replace(/([:;,])\s*\./g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Делит текст на куски (Chrome обрывает слишком длинные фразы): по предложениям, затем по словам. */
export function splitForSpeech(text: string, maxLen = 200): string[] {
  const out: string[] = [];
  let cur = "";
  const push = (piece: string) => {
    if (!piece) return;
    if (cur && cur.length + 1 + piece.length > maxLen) {
      out.push(cur);
      cur = piece;
    } else cur = cur ? `${cur} ${piece}` : piece;
  };
  for (const sentence of text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text]) {
    const s = sentence.trim();
    if (s.length <= maxLen) {
      push(s);
      continue;
    }
    for (const word of s.split(" ")) {
      if (word.length > maxLen) {
        for (let i = 0; i < word.length; i += maxLen) push(word.slice(i, i + maxLen));
      } else push(word);
    }
  }
  if (cur) out.push(cur);
  return out;
}
