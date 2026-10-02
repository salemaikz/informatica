"use client";

import clsx from "clsx";
import { BookmarkPlus, Camera, Check, ImagePlus, Send, Sparkles, Square, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { compressImage } from "@/lib/image";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Markdown } from "@/components/Markdown";
import { Mascot } from "@/components/mascot/Mascot";
import { useTutor } from "@/components/ai/useTutor";

const SUGGESTIONS: DictKey[] = ["tutor.s1", "tutor.s2", "tutor.s3", "tutor.s4"];

export default function TutorPage() {
  const { t } = useT();
  const chat = useApp((s) => s.chat);
  const addChat = useApp((s) => s.addChat);
  const clearChat = useApp((s) => s.clearChat);
  const saveToNotes = useApp((s) => s.saveToNotes);
  const { ask, stop, streaming, error } = useTutor();
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<string | undefined>();
  const [pending, setPending] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [chat.length, pending]);

  const send = async (text: string) => {
    const q = text.trim() || (image ? t("tutor.photoQuestion") : "");
    if (!q || streaming) return;
    const img = image;
    setDraft("");
    setImage(undefined);
    addChat({ role: "user", content: q, hadImage: !!img });
    const history = [...useApp.getState().chat].map((m) => ({ role: m.role, content: m.content }));
    setPending("");
    const answer = await ask({ mode: "chat", messages: history, image: img }, (full) => setPending(full));
    setPending(null);
    if (answer) addChat({ role: "assistant", content: answer });
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setImage(await compressImage(file, 1280));
  };

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col gap-4 lg:min-h-[calc(100dvh-5rem)]">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-ai">
            <Sparkles size={24} /> {t("tutor.title")}
          </h1>
          <p className="font-semibold text-muted">{t("tutor.subtitle")}</p>
        </div>
        {chat.length > 0 && (
          <button
            type="button"
            onClick={clearChat}
            className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-sm font-bold text-muted hover:bg-surface-2"
            title={t("tutor.clear")}
          >
            <Trash2 size={16} /> <span className="hidden sm:inline">{t("tutor.clear")}</span>
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {chat.length === 0 && pending === null && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <Mascot mood="happy" size={96} />
            <p className="max-w-sm font-semibold text-muted">{t("tutor.empty")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => (k === "tutor.s4" ? fileRef.current?.click() : void send(t(k)))}
                  className="rounded-2xl border-2 border-ai/30 bg-ai-soft px-3.5 py-2 text-sm font-bold text-ai hover:brightness-95"
                >
                  {t(k)}
                </button>
              ))}
            </div>
          </div>
        )}

        {chat.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-primary px-4 py-2.5 font-semibold text-white">
              {m.hadImage && <Camera size={16} className="mr-1.5 inline -mt-0.5" />}
              {m.content}
            </div>
          ) : (
            <div key={m.id} className="max-w-[92%] self-start rounded-2xl rounded-bl-md border-2 border-ai/20 bg-surface px-4 py-3">
              <Markdown>{m.content}</Markdown>
              <button
                type="button"
                disabled={saved.includes(m.id)}
                onClick={() => {
                  saveToNotes("general", m.content);
                  setSaved((s) => [...s, m.id]);
                }}
                className="mt-2 flex items-center gap-1 text-xs font-extrabold text-ai disabled:text-success"
              >
                {saved.includes(m.id) ? <Check size={14} /> : <BookmarkPlus size={14} />}
                {saved.includes(m.id) ? t("common.saved") : t("tutor.saveNote")}
              </button>
            </div>
          ),
        )}

        {pending !== null && (
          <div className="max-w-[92%] self-start rounded-2xl rounded-bl-md border-2 border-ai/20 bg-surface px-4 py-3">
            {pending ? <Markdown>{pending}</Markdown> : <span className="animate-pulse font-semibold text-ai">…</span>}
          </div>
        )}
        {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">{t(error)}</p>}
        <div ref={bottom} />
      </div>

      <form
        className="sticky bottom-20 z-10 flex flex-col gap-2 rounded-3xl border-2 border-border bg-surface p-2 shadow-lg lg:bottom-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        {image && (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="h-20 rounded-xl border-2 border-border object-cover" />
            <button
              type="button"
              onClick={() => setImage(undefined)}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-text text-surface"
              aria-label={t("common.delete")}
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-muted hover:bg-surface-2 hover:text-ai"
            aria-label={t("tutor.attach")}
            title={t("tutor.attach")}
          >
            <ImagePlus size={22} />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            rows={1}
            placeholder={t("tutor.placeholder")}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 font-semibold outline-none"
          />
          {streaming ? (
            <button type="button" onClick={stop} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-text" aria-label="stop">
              <Square size={18} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim() && !image}
              className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ai text-white transition-opacity disabled:opacity-40")}
              aria-label="send"
            >
              <Send size={18} />
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      </form>
    </div>
  );
}
