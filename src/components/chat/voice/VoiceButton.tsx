"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { quoteVoiceQuestion, type AiReceipt } from "@/lib/economy";
import { todayKey } from "@/lib/text";
import {
  formatTimer,
  isIosUserAgent,
  MAX_AUDIO_BYTES,
  MAX_RECORD_SEC,
  MIN_AUDIO_BYTES,
  pickRecorderMime,
  transcribe,
  VoiceError,
} from "@/lib/voice";
import { useAiQuote } from "@/components/economy/useEconomy";

export interface VoiceButtonProps {
  /** Расшифрованный текст вопроса (вставляется в поле ввода). */
  onText: (text: string) => void;
  /** Ошибка: ключ словаря (нет чипов — "economy.noChips", нет доступа к микрофону и т.п.). */
  onError?: (key: DictKey) => void;
  disabled?: boolean;
}

type State = "idle" | "starting" | "recording" | "transcribing";

/** Ключ ошибки получения микрофона. */
function micErrorKey(e: unknown): DictKey {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "voice.err.denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "voice.err.noMic";
  return "voice.err.mic";
}

/**
 * Голосовой вопрос: нажать — запись (до 60 с), нажать ещё раз — стоп и расшифровка.
 * Одна реплика — одно обращение (#118): платится ответ (chat), расшифровка бесплатных и чипов не тратит —
 * spendAi("voice") считает только дневной потолок. Поэтому перед записью проверяем, что ответ можно оплатить и что
 * потолка хватит на расшифровку и ответ вместе (quoteVoiceQuestion): нет чипов — та же ошибка, что у сообщения в чате.
 * Неудача расшифровки — возврат по квитанции.
 */
export function VoiceButton({ onText, onError, disabled }: VoiceButtonProps) {
  const { t, lang } = useT();
  // Ответ на голосовой вопрос — обычное сообщение чата; расшифровка — только потолок дня.
  const { tier, chips } = useAiQuote("chat");
  const usage = useApp((s) => s.aiUsage);
  const quote = quoteVoiceQuestion(tier, usage, chips, todayKey());
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tick = useRef<number | null>(null);
  const limit = useRef<number | null>(null);
  const startedAt = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  // Защита от двойного старта, пока getUserMedia ещё не ответил.
  const starting = useRef(false);
  // Свежие колбэки родителя — без пересоздания обработчиков записи.
  const cb = useRef({ onText, onError, lang });
  useEffect(() => {
    cb.current = { onText, onError, lang };
  });

  const clearTimers = useCallback(() => {
    if (tick.current !== null) window.clearInterval(tick.current);
    if (limit.current !== null) window.clearTimeout(limit.current);
    tick.current = null;
    limit.current = null;
  }, []);

  const releaseMic = useCallback(() => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimers();
      abort.current?.abort();
      const rec = recorder.current;
      if (rec && rec.state !== "inactive") {
        rec.onstop = null;
        rec.stop();
      }
      recorder.current = null;
      releaseMic();
    };
  }, [clearTimers, releaseMic]);

  const fail = useCallback((key: DictKey) => {
    if (mounted.current) {
      setState("idle");
      cb.current.onError?.(key);
    }
  }, []);

  /** Запись остановлена: учитываем в потолке дня, расшифровываем, при неудаче возвращаем. */
  const finish = useCallback(
    async (blob: Blob, durationMs: number) => {
      if (blob.size < MIN_AUDIO_BYTES || durationMs < 600) return fail("voice.err.empty");
      if (blob.size > MAX_AUDIO_BYTES) return fail("voice.err.tooLong");
      const app = useApp.getState();
      const receipt: AiReceipt = app.spendAi("voice");
      if (!receipt.ok) return fail(receipt.reason === "chips" ? "economy.noChips" : "tutor.limit");
      if (mounted.current) setState("transcribing");
      const ctl = new AbortController();
      abort.current = ctl;
      try {
        const text = await transcribe(blob, cb.current.lang, ctl.signal);
        if (!text) {
          useApp.getState().refundAi(receipt);
          return fail("voice.err.empty");
        }
        if (mounted.current) {
          setState("idle");
          cb.current.onText(text);
        }
      } catch (e) {
        useApp.getState().refundAi(receipt);
        fail(e instanceof VoiceError ? e.key : "voice.err.failed");
      } finally {
        if (abort.current === ctl) abort.current = null;
      }
    },
    [fail],
  );

  const stop = useCallback(() => {
    clearTimers();
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, [clearTimers]);

  const start = useCallback(async () => {
    if (starting.current || recorder.current) return;
    if (!quote.ok) return fail(quote.reason === "chips" ? "economy.noChips" : "tutor.limit");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return fail("voice.err.unsupported");
    starting.current = true;
    setState("starting");
    try {
      await startInner();
    } finally {
      starting.current = false;
    }
    async function startInner() {
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      return fail(micErrorKey(e));
    }
    if (!mounted.current) {
      media.getTracks().forEach((tr) => tr.stop());
      return;
    }
    clearTimers();
    try {
      const mime = pickRecorderMime((m) => MediaRecorder.isTypeSupported(m), isIosUserAgent(navigator.userAgent, navigator.maxTouchPoints));
      const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        clearTimers();
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        chunks.current = [];
        recorder.current = null;
        releaseMic();
        void finish(blob, Date.now() - startedAt.current);
      };
      stream.current = media;
      recorder.current = rec;
      startedAt.current = Date.now();
      rec.start();
      setSeconds(0);
      setState("recording");
      tick.current = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
      limit.current = window.setTimeout(stop, MAX_RECORD_SEC * 1000);
    } catch {
      media.getTracks().forEach((tr) => tr.stop());
      stream.current = null;
      fail("voice.err.unsupported");
    }
    }
  }, [quote, fail, finish, stop, releaseMic, clearTimers]);

  const recording = state === "recording";
  const busy = state === "transcribing" || state === "starting";
  // Своей цены у голоса нет: ответ стоит как сообщение в чате (цена — у кнопки отправки).
  const label = recording ? t("voice.stop") : state === "transcribing" ? t("voice.transcribing") : t("voice.start");

  return (
    <div className="flex shrink-0 items-center gap-2">
      {recording && (
        <span role="timer" aria-label={t("voice.recording")} className="flex items-center gap-1.5 text-sm font-extrabold tabular-nums text-danger">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-danger motion-safe:animate-pulse" />
          {formatTimer(seconds)}
        </span>
      )}
      <button
        type="button"
        onClick={recording ? stop : () => void start()}
        disabled={busy || (!recording && disabled)}
        aria-label={label}
        title={label}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-2xl transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ai",
          recording ? "bg-danger text-white" : "bg-ai-soft text-ai hover:brightness-95",
          (busy || (!recording && disabled)) && "cursor-not-allowed opacity-60",
        )}
      >
        {busy ? <Loader2 size={22} className="motion-safe:animate-spin" aria-hidden /> : recording ? <Square size={18} fill="currentColor" aria-hidden /> : <Mic size={22} aria-hidden />}
      </button>
    </div>
  );
}
