"use client";

import { ArrowLeft, Ellipsis } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { deleteMessages, loadMessages, saveMessages } from "@/lib/chat-store";
import { autoTitle, MAX_MESSAGES, type ChatMsg, type QuizSummary } from "@/lib/chats";
import { compressImage } from "@/lib/image";
import { useApp } from "@/lib/store";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { useTutor } from "@/components/ai/useTutor";
import { NoChipsNotice } from "@/components/economy/NoChipsNotice";
import { ButtonLink } from "@/components/ui/Button";
import { ChatQuiz } from "./quiz/ChatQuiz";
import { ChatEmpty } from "./ChatEmpty";
import { ChatManageSheet, nextManageNonce, type ManageTarget } from "./ChatManageSheet";
import { Composer } from "./Composer";
import { displayTitle, firstUserText, lastPreview, MODE_NAME_KEY, quizInHistory, reviewRequest, toHistory, topicTitle } from "./helpers";
import { BitBubble, PendingBubble, UserBubble } from "./MessageBubble";
import { ModeIcon } from "./ModeIcon";
import { QuizCard } from "./QuizCard";

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Состояние «Дай задачи» в ленте: off — скрыто, объект — запущено (key меняется при новом запуске). */
type QuizState = "off" | { key: number };

/** Экран одного чата: шапка, лента, поле ввода. Монтировать с key={id}. */
export function ChatScreen({ id, initialDraft }: { id: string; initialDraft?: string }) {
  const { t, lang } = useT();
  const router = useRouter();
  const chat = useApp((s) => s.chats.find((c) => c.id === id));
  const touchChat = useApp((s) => s.touchChat);
  const deleteChat = useApp((s) => s.deleteChat);
  const { ask, stop, streaming, error } = useTutor();

  const [messages, setMessages] = useState<ChatMsg[] | null>(null);
  const msgsRef = useRef<ChatMsg[]>([]);
  const [draft, setDraft] = useState(initialDraft ?? "");
  const [fromVoice, setFromVoice] = useState(false);
  const [image, setImage] = useState<string | undefined>();
  const [pending, setPending] = useState<string | null>(null);
  const [lastKind, setLastKind] = useState<"chat" | "photo">("chat");
  const [voiceError, setVoiceError] = useState<DictKey | null>(null);
  const [quizState, setQuizState] = useState<QuizState>("off");
  const [manage, setManage] = useState<ManageTarget | null>(null);
  const pendingRef = useRef("");
  const stoppedRef = useRef(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Загрузка переписки из IndexedDB.
  useEffect(() => {
    let cancelled = false;
    void loadMessages(id).then((m) => {
      if (cancelled) return;
      msgsRef.current = m;
      setMessages(m);
      // «Дай задачи»: в новом пустом чате квиз стартует сам, один раз при загрузке.
      if (m.length === 0 && useApp.getState().chats.find((c) => c.id === id)?.mode === "tasks") setQuizState({ key: 0 });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const quizOpen = typeof quizState === "object";
  const quizShown = chat?.mode === "tasks" && messages !== null && quizOpen;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages?.length, pending, quizShown]);

  if (!chat) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-xl font-extrabold">{t("chat2.notFound")}</p>
        <p className="font-semibold text-muted">{t("chat2.notFound.text")}</p>
        <ButtonLink href="/tutor" variant="ai" icon={<ArrowLeft size={18} />}>
          {t("chat2.back")}
        </ButtonLink>
      </div>
    );
  }

  const title = displayTitle(chat, lang, t);
  const topic = topicTitle(chat.topic, lang, true);

  /** Новая лента: в память, на диск и в метаданные списка (превью, счётчик, название по первому вопросу). */
  const commit = (next: ChatMsg[]) => {
    const trimmed = next.slice(-MAX_MESSAGES);
    msgsRef.current = trimmed;
    setMessages(trimmed);
    void saveMessages(id, trimmed);
    touchChat(id, { preview: lastPreview(trimmed, t), count: trimmed.length, title: autoTitle(firstUserText(trimmed)) });
  };

  /** Ядро отправки: фото и голос передаём явно, черновик не трогаем. */
  const send = async ({ text, image: img, voice }: { text: string; image?: string; voice?: boolean }) => {
    const q = text.trim() || (img ? t("tutor.photoQuestion") : "");
    if (!q || streaming || messages === null) return;
    setVoiceError(null);
    setLastKind(img ? "photo" : "chat");
    stoppedRef.current = false;
    pendingRef.current = "";
    commit([...msgsRef.current, { id: newId(), role: "user", content: q, hadImage: img ? true : undefined, voice: voice ? true : undefined, at: Date.now() }]);
    setPending("");
    const answer = await ask(
      { mode: "chat", messages: toHistory(msgsRef.current, lang, t), image: img, chatMode: chat.mode, topic: chat.topic },
      (full) => {
        pendingRef.current = full;
        setPending(full);
      },
    );
    setPending(null);
    // Остановили на полуслове — оставляем уже показанную часть ответа.
    const text2 = answer ?? (stoppedRef.current ? pendingRef.current.trim() : "");
    if (text2) commit([...msgsRef.current, { id: newId(), role: "assistant", content: text2, at: Date.now() }]);
  };

  /** Отправка из поля ввода: берёт черновик, фото и признак голоса и очищает их. */
  const sendDraft = () => {
    const img = image;
    if ((!draft.trim() && !img) || streaming || messages === null) return;
    const voice = fromVoice && !!draft.trim();
    const text = draft;
    setDraft("");
    setImage(undefined);
    setFromVoice(false);
    void send({ text, image: img, voice });
  };

  const onQuizDone = (summary: QuizSummary) => {
    setQuizState("off");
    commit([
      ...msgsRef.current,
      { id: newId(), role: "assistant", content: t("chat2.quiz.preview", { correct: summary.correct, total: summary.total, grade: summary.grade }), quiz: summary, at: Date.now() },
    ]);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      setImage(await compressImage(file, 1280));
    } catch {
      setVoiceError("tutor.error");
    }
  };

  const goBack = () => {
    // Пустой чат (создали и сразу вышли) не копим в списке.
    // Решаем по метаданным: пустой результат чтения IndexedDB не значит, что чат пуст.
    if (chat.count === 0 && msgsRef.current.length === 0 && !streaming) {
      deleteChat(id);
      void deleteMessages(id);
    }
    router.push("/tutor");
  };

  const openManage = (view: ManageTarget["view"]) => setManage({ id, view, nonce: nextManageNonce() });
  const list = messages ?? [];
  const lastQuizId = [...list].reverse().find((m) => m.quiz)?.id;
  const shownError = voiceError ?? error;
  const empty = messages !== null && list.length === 0 && pending === null && !quizShown;

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] min-w-0 flex-col gap-4 lg:min-h-[calc(100dvh-5rem)]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 lg:hidden"
          aria-label={t("chat2.back")}
        >
          <ArrowLeft size={22} />
        </button>
        <button
          type="button"
          onClick={() => openManage("rename")}
          className="min-w-0 flex-1 rounded-xl px-1 py-0.5 text-left hover:bg-surface-2"
          title={t("chat2.renameHint")}
          aria-label={`${title}. ${t("chat2.renameHint")}`}
        >
          <span className="block truncate text-lg font-extrabold">{title}</span>
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-ai">
            <ModeIcon mode={chat.mode} size={14} />
            <span className="truncate">
              {t(MODE_NAME_KEY[chat.mode])}
              {topic ? ` · ${topic}` : ""}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => openManage("actions")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ai"
          aria-label={t("chat2.menu.open")}
        >
          <Ellipsis size={22} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {messages === null && <p className="py-10 text-center font-bold text-muted">{t("common.loading")}</p>}
        {empty && (
          <ChatEmpty
            chat={chat}
            onSend={(text) => void send({ text })}
            onPhoto={(source) => (source === "camera" ? cameraRef : galleryRef).current?.click()}
            onStartQuiz={() => setQuizState({ key: Date.now() })}
          />
        )}

        {list.map((m) =>
          m.quiz ? (
            <QuizCard
              key={m.id}
              quiz={m.quiz}
              actions={m.id === lastQuizId && !quizShown}
              busy={streaming}
              onMore={() => setQuizState({ key: Date.now() })}
              onReview={() => void send({ text: reviewRequest(m.quiz!, t, !quizInHistory(msgsRef.current, m.id)) })}
            />
          ) : m.role === "user" ? (
            <UserBubble key={m.id} msg={m} />
          ) : (
            <BitBubble key={m.id} msg={m} />
          ),
        )}

        {quizShown && (
          <ChatQuiz
            key={quizOpen ? quizState.key : 0}
            topic={chat.topic}
            onDone={onQuizDone}
            onCancel={() => setQuizState("off")}
          />
        )}
        {pending !== null && <PendingBubble text={pending} />}
        {shownError === "economy.noChips" ? (
          <NoChipsNotice kind={voiceError ? "voice" : lastKind} />
        ) : (
          shownError && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">{t(shownError)}</p>
        )}
        <div ref={bottom} />
      </div>

      <Composer
        draft={draft}
        onDraft={setDraft}
        image={image}
        onImage={setImage}
        placeholder={t(chat.mode === "check" ? "chat2.check.placeholder" : "tutor.placeholder")}
        streaming={streaming}
        onSend={sendDraft}
        onStop={() => {
          stoppedRef.current = true;
          stop();
        }}
        onAttach={() => galleryRef.current?.click()}
        onVoiceText={(text) => {
          setVoiceError(null);
          setFromVoice(true);
          setDraft((d) => (d.trim() ? `${d.trim()} ${text}` : text));
        }}
        onVoiceError={setVoiceError}
      />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />

      <ChatManageSheet
        target={manage}
        onClose={() => setManage(null)}
        onDeleted={() => router.replace("/tutor")}
      />
    </div>
  );
}

