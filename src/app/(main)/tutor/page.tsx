"use client";

import { BookmarkPlus, Camera, ImagePlus, ListChecks, MessageSquarePlus, PanelLeft, Send, Sparkles, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { compressImage } from "@/lib/image";
import { historyForAi, migrateLegacyChat, useChats } from "@/lib/chat-store";
import { createQuiz, quizSteps, quizSummaryText, type ChatQuiz, type QuizSource } from "@/lib/chat-quiz";
import { entTopicById } from "@/content/ent-topics";
import type { Level } from "@/lib/types";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Markdown } from "@/components/Markdown";
import { Mascot } from "@/components/mascot/Mascot";
import { Modal } from "@/components/ui/Modal";
import { useTutor } from "@/components/ai/useTutor";
import { useSaveToNotes } from "@/components/notes/saveToNotesBus";
import { ChatList } from "@/components/tutor/ChatList";
import { QuizCard } from "@/components/tutor/QuizCard";
import { QuizPicker } from "@/components/tutor/QuizPicker";

const SUGGESTIONS: DictKey[] = ["tutor.s1", "tutor.s3", "tutor.s4"];

export default function TutorPage() {
  const { t, l, lang } = useT();
  const chats = useChats((s) => s.chats);
  const activeId = useChats((s) => s.activeId);
  const addMessage = useChats((s) => s.addMessage);
  const newChat = useChats((s) => s.newChat);
  const lessons = useApp((s) => s.lessons);
  const { ask, stop, streaming, error } = useTutor();
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<string | undefined>();
  // Потоковый ответ привязан к чату, в котором задан вопрос (можно переключиться на другой).
  const [pending, setPending] = useState<{ chatId: string; text: string } | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [picker, setPicker] = useState<{ open: boolean; error: boolean }>({ open: false, error: false });
  const fileRef = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const chat = chats.find((c) => c.id === activeId);
  const messages = chat?.messages ?? [];
  const pendingHere = pending && pending.chatId === chat?.id ? pending : null;
  const hasLessons = Object.values(lessons).some((s) => (s?.completions ?? 0) > 0);

  // Перенос старого единственного чата (useApp.chat) в новое хранилище — один раз.
  useEffect(() => {
    migrateLegacyChat(useApp.getState().chat, () => useApp.getState().clearChat());
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, pendingHere?.text, activeId]);

  const topicTitle = useCallback(
    (source: QuizSource) => (source.kind === "topic" ? l(entTopicById(source.topic).title) : t("chats.quiz.lessons")),
    [l, t],
  );
  const describeQuiz = useCallback((q: ChatQuiz) => quizSummaryText(q, quizSteps(q), topicTitle(q.source), lang), [topicTitle, lang]);

  const send = async (text: string) => {
    const q = text.trim() || (image ? t("tutor.photoQuestion") : "");
    if (!q || streaming) return;
    const img = image;
    setDraft("");
    setImage(undefined);
    const { chatId } = addMessage({ role: "user", content: q, hadImage: !!img });
    const target = useChats.getState().chats.find((c) => c.id === chatId);
    const history = historyForAi(target?.messages ?? [], describeQuiz);
    setPending({ chatId, text: "" });
    const answer = await ask({ mode: "chat", messages: history, image: img }, (full) => setPending({ chatId, text: full }));
    setPending(null);
    // Чат могли удалить, пока шёл ответ, — тогда ответ не сохраняем.
    if (answer && useChats.getState().chats.some((c) => c.id === chatId)) addMessage({ role: "assistant", content: answer }, { chatId });
  };

  const startQuiz = (source: QuizSource, level: Level) => {
    const done = Object.entries(useApp.getState().lessons)
      .filter(([, s]) => (s?.completions ?? 0) > 0)
      .map(([id]) => id);
    const quiz = createQuiz(source, level, Math.floor(Math.random() * 1e9), done);
    if (!quiz) {
      setPicker({ open: true, error: true });
      return;
    }
    addMessage({ role: "assistant", content: "", quiz }, { titleHint: t("chats.quiz.header", { topic: topicTitle(source) }) });
    setPicker({ open: false, error: false });
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setImage(await compressImage(file, 1280));
  };

  const quizButton = (
    <button
      type="button"
      onClick={() => setPicker({ open: true, error: false })}
      className="flex min-h-11 items-center gap-1.5 rounded-2xl border-2 border-primary/30 bg-primary-soft px-3.5 py-2 text-sm font-bold text-primary hover:brightness-95"
    >
      <ListChecks size={16} /> {t("chats.quiz.button")}
    </button>
  );

  return (
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-4">
      {/* Компьютер: колонка со списком чатов. */}
      <aside className="hidden lg:sticky lg:top-4 lg:flex lg:h-[calc(100dvh-2rem)] lg:flex-col">
        <ChatList className="h-full" />
      </aside>

      <div className="flex min-h-[calc(100dvh-12rem)] min-w-0 flex-col gap-4 lg:min-h-[calc(100dvh-5rem)]">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-border bg-surface text-muted hover:text-ai lg:hidden"
            aria-label={t("chats.open")}
            title={t("chats.list")}
          >
            <PanelLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-ai">
              <Sparkles size={24} className="shrink-0" /> <span className="truncate">{t("tutor.title")}</span>
            </h1>
            <p className="truncate font-semibold text-muted">{chat?.title || t("tutor.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => newChat()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-muted hover:bg-surface-2 hover:text-ai lg:hidden"
            aria-label={t("chats.new")}
            title={t("chats.new")}
          >
            <MessageSquarePlus size={20} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3">
          {messages.length === 0 && !pendingHere && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <Mascot mood="happy" size={96} />
              <p className="max-w-sm font-semibold text-muted">{t("tutor.empty")}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {quizButton}
                {SUGGESTIONS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => (k === "tutor.s4" ? fileRef.current?.click() : void send(t(k)))}
                    className="min-h-11 rounded-2xl border-2 border-ai/30 bg-ai-soft px-3.5 py-2 text-sm font-bold text-ai hover:brightness-95"
                  >
                    {t(k)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chat &&
            messages.map((m) =>
              m.quiz ? (
                <QuizCard
                  key={m.id}
                  chatId={chat.id}
                  msgId={m.id}
                  quiz={m.quiz}
                  topicTitle={topicTitle(m.quiz.source)}
                  onExplain={(text) => void send(text)}
                  onAgain={startQuiz}
                  aiBusy={streaming}
                />
              ) : m.role === "user" ? (
                <div key={m.id} className="max-w-[85%] self-end whitespace-pre-line break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 font-semibold text-white">
                  {m.hadImage && <Camera size={16} className="mr-1.5 inline -mt-0.5" />}
                  {m.content}
                </div>
              ) : (
                <div key={m.id} className="max-w-[92%] self-start rounded-2xl rounded-bl-md border-2 border-ai/20 bg-surface px-4 py-3">
                  <Markdown>{m.content}</Markdown>
                  <button
                    type="button"
                    // Открываем шторку выбора папки — молча в конспект не сохраняем.
                    onClick={() => useSaveToNotes.getState().open({ source: "ai", text: m.content })}
                    className="mt-1 flex min-h-11 items-center gap-1 text-xs font-extrabold text-ai"
                  >
                    <BookmarkPlus size={14} />
                    {t("tutor.saveNote")}
                  </button>
                </div>
              ),
            )}

          {pendingHere && (
            <div className="max-w-[92%] self-start rounded-2xl rounded-bl-md border-2 border-ai/20 bg-surface px-4 py-3">
              {pendingHere.text ? <Markdown>{pendingHere.text}</Markdown> : <span className="animate-pulse font-semibold text-ai">…</span>}
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
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-text text-surface after:absolute after:-inset-2.5"
                aria-label={t("common.delete")}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-1">
            <button
              type="button"
              onClick={() => setPicker({ open: true, error: false })}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-muted hover:bg-surface-2 hover:text-primary"
              aria-label={t("chats.quiz.button")}
              title={t("chats.quiz.button")}
            >
              <ListChecks size={22} />
            </button>
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
              className="max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 font-semibold outline-none"
            />
            {streaming ? (
              <button type="button" onClick={stop} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-text" aria-label={t("chats.stop")} title={t("chats.stop")}>
                <Square size={18} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim() && !image}
                className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ai text-white transition-opacity disabled:opacity-40")}
                aria-label={t("chats.send")}
              >
                <Send size={18} />
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        </form>
      </div>

      {/* Телефон: список чатов в шторке. */}
      <Modal open={listOpen} onClose={() => setListOpen(false)} label={t("chats.list")} className="flex h-[80dvh] flex-col">
        <h2 className="mb-3 text-lg font-extrabold">{t("chats.list")}</h2>
        <ChatList className="min-h-0 flex-1" onPicked={() => setListOpen(false)} />
      </Modal>

      <QuizPicker
        key={picker.open ? "open" : "closed"}
        open={picker.open}
        error={picker.error}
        hasLessons={hasLessons}
        onClose={() => setPicker({ open: false, error: false })}
        onStart={startQuiz}
      />
    </div>
  );
}
