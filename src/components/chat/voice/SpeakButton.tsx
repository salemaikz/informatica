"use client";

import { Square, Volume2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import type { Lang } from "@/lib/types";
import { pickVoice, speechLang, speechText, splitForSpeech } from "@/lib/voice";

export interface SpeakButtonProps {
  /** Текст ответа (markdown — разметку убрать перед озвучкой). */
  text: string;
  className?: string;
}

const synth = (): SpeechSynthesis | null => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null);

// Какая кнопка сейчас говорит (speechSynthesis общий на страницу).
let owner: number | null = null;
let nextId = 1;
const ownerListeners = new Set<() => void>();
function setOwner(id: number | null) {
  owner = id;
  ownerListeners.forEach((l) => l());
}
function subscribeOwner(l: () => void) {
  ownerListeners.add(l);
  return () => {
    ownerListeners.delete(l);
  };
}

/** Есть ли в браузере голос под язык (список голосов подгружается позже — подписка на voiceschanged). */
function useHasVoice(lang: Lang): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const s = synth();
      s?.addEventListener("voiceschanged", onChange);
      return () => s?.removeEventListener("voiceschanged", onChange);
    },
    () => pickVoice(synth()?.getVoices() ?? [], lang) !== null,
    () => false,
  );
}

/** «Озвучить»: бесплатно, голосом браузера (speechSynthesis). Нет голоса для языка (часто для казахского) — кнопки нет. */
export function SpeakButton({ text, className }: SpeakButtonProps) {
  const { t, lang } = useT();
  const hasVoice = useHasVoice(lang);
  const [myId] = useState(() => nextId++);
  const speaking = useSyncExternalStore(
    subscribeOwner,
    () => owner === myId,
    () => false,
  );
  // Номер запуска: события отменённой озвучки не трогают состояние.
  const run = useRef(0);

  const chunks = useMemo(() => splitForSpeech(speechText(text)), [text]);

  const stop = useCallback(() => {
    run.current++;
    if (owner === myId) {
      synth()?.cancel();
      setOwner(null);
    }
  }, [myId]);

  useEffect(
    () => () => {
      run.current++;
      if (owner === myId) {
        synth()?.cancel();
        setOwner(null);
      }
    },
    [myId],
  );

  const speak = () => {
    const s = synth();
    if (!s || !chunks.length) return;
    s.cancel();
    const id = ++run.current;
    const voice = pickVoice(s.getVoices(), lang);
    const done = () => {
      if (run.current !== id) return;
      if (owner === myId) setOwner(null);
    };
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = speechLang(lang);
      if (voice) u.voice = voice;
      u.onerror = done;
      if (i === chunks.length - 1) u.onend = done;
      s.speak(u);
    });
    setOwner(myId);
  };

  if (!hasVoice || !chunks.length) return null;
  const label = speaking ? t("voice.speakStop") : t("voice.speak");

  return (
    <button
      type="button"
      onClick={speaking ? stop : speak}
      aria-pressed={speaking}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl bg-ai-soft px-3 py-1.5 text-sm font-extrabold text-ai hover:brightness-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ai",
        className,
      )}
    >
      {speaking ? <Square size={14} fill="currentColor" aria-hidden /> : <Volume2 size={16} aria-hidden />}
      {label}
    </button>
  );
}
