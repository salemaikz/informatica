"use client";

import { ImagePlus, Send, Square, X } from "lucide-react";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { AiCost } from "@/components/economy/AiCost";
import { VoiceButton } from "./voice/VoiceButton";

/** Поле ввода: фото, голос, текст, отправка/стоп и цена сообщения. Enter — отправить, Shift+Enter — перенос. */
export function Composer({
  draft,
  onDraft,
  image,
  onImage,
  placeholder,
  streaming,
  onSend,
  onStop,
  onAttach,
  onVoiceText,
  onVoiceError,
}: {
  draft: string;
  onDraft: (v: string) => void;
  image?: string;
  onImage: (v: string | undefined) => void;
  placeholder: string;
  streaming: boolean;
  onSend: () => void;
  onStop: () => void;
  onAttach: () => void;
  onVoiceText: (text: string) => void;
  onVoiceError: (key: DictKey) => void;
}) {
  const { t } = useT();
  return (
    <form
      className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex flex-col gap-2 rounded-3xl border-2 border-border bg-surface p-2 shadow-lg focus-within:border-ai/40 lg:bottom-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      {image && (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="h-20 rounded-xl border-2 border-border object-cover" />
          <button
            type="button"
            onClick={() => onImage(undefined)}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-text text-surface"
            aria-label={t("common.delete")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex items-end gap-1.5">
        <button
          type="button"
          onClick={onAttach}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-muted hover:bg-surface-2 hover:text-ai"
          aria-label={t("tutor.attach")}
          title={t("tutor.attach")}
        >
          <ImagePlus size={22} />
        </button>
        <VoiceButton onText={onVoiceText} onError={onVoiceError} disabled={streaming} />
        <textarea
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={1}
          placeholder={placeholder}
          className="max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 font-semibold outline-none"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-text"
            aria-label={t("chat2.stop")}
          >
            <Square size={18} fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!draft.trim() && !image}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ai text-white transition-opacity disabled:opacity-40"
            aria-label={t("chat2.send")}
          >
            <Send size={18} />
          </button>
        )}
      </div>
      <p className="flex items-center justify-end gap-1.5 px-2 pb-0.5 text-xs font-bold text-muted">
        {t("aicost.perMessage")} <AiCost kind={image ? "photo" : "chat"} />
      </p>
    </form>
  );
}
